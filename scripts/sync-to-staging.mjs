/**
 * Script de Sincronização: Produção → Staging
 * 
 * Uso: node scripts/sync-to-staging.mjs
 * 
 * Copia TODOS os dados do banco de produção para staging.
 * Lida automaticamente com diferenças de schema entre ambientes.
 * É SOMENTE LEITURA na produção.
 */

import { createClient } from '@supabase/supabase-js';

// ============================================
// CONFIGURAÇÃO DOS AMBIENTES
// ============================================

const PRODUCAO = {
    url: 'https://cgyxinpejaoadsqrxbhy.supabase.co',
    key: process.env.SUPABASE_PROD_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc'
};

const STAGING = {
    url: 'https://vkeshyusimduiwjaijjv.supabase.co',
    key: process.env.SUPABASE_STAGING_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZXNoeXVzaW1kdWl3amFpamp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzU0NDk3NywiZXhwIjoyMDgzMTIwOTc3fQ.5HGMlM2WMTp9BYxSfPfo0YQQV5oy3ZPTWj0ZNHpZT8c'
};

// Tabelas para sincronizar (ordem importa por causa de foreign keys)
const TABELAS_PARA_SINCRONIZAR = [
    'profiles',
    'pedidos_consolidados_v3',
    'estoque',
    'estoque_movimentacoes',
    'assinaturas',
    'solicitacoes',
    'solicitacoes_historico',
    'feriados',
    'ticto_pedidos',
    // ticto_logs: descartável no staging (logs operacionais de produção)
];

// Chave de conflito por tabela (default: 'id')
const CONFLICT_KEYS = {
    ticto_pedidos: 'transaction_hash,offer_code',
};

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Remove colunas de um batch de dados.
 */
function stripColumns(batch, columnsToRemove) {
    const removeSet = new Set(columnsToRemove);
    return batch.map(row => {
        const filtered = {};
        for (const [key, value] of Object.entries(row)) {
            if (!removeSet.has(key)) {
                filtered[key] = value;
            }
        }
        return filtered;
    });
}

/**
 * Extrai o nome da coluna de uma mensagem de erro do PostgREST.
 * Ex: "Could not find the 'codigo_rastreio' column of 'profiles' in the schema cache"
 */
function extractMissingColumn(errorMessage) {
    const match = errorMessage.match(/Could not find the '(\w+)' column/);
    return match ? match[1] : null;
}

/**
 * Tenta inserir um batch no staging. Se falhar por coluna ausente,
 * remove a coluna e tenta novamente (até 10 tentativas).
 * Retorna { inserted, removedColumns }.
 */
async function upsertWithRetry(stagingClient, tableName, batch, knownBadColumns = new Set()) {
    let currentBatch = stripColumns(batch, [...knownBadColumns]);
    const removedColumns = new Set(knownBadColumns);
    let maxRetries = 10;
    const conflictKey = CONFLICT_KEYS[tableName] || 'id';

    while (maxRetries > 0) {
        // Como não limpamos mais a tabela, SEMPRE usar UPSERT para atualizar ou inserir sem duplicar
        const { error } = await stagingClient.from(tableName).upsert(currentBatch, { onConflict: conflictKey });

        if (!error) {
            return { inserted: currentBatch.length, removedColumns };
        }

        const missingCol = extractMissingColumn(error.message);
        if (missingCol && !removedColumns.has(missingCol)) {
            removedColumns.add(missingCol);
            currentBatch = stripColumns(batch, [...removedColumns]);
            maxRetries--;
        } else {
            // Erro diferente, não é coluna ausente
            console.log(`   ❌ Erro ao inserir: ${error.message}`);
            return { inserted: 0, removedColumns };
        }
    }

    console.log(`   ❌ Muitas colunas ausentes, abortando tabela`);
    return { inserted: 0, removedColumns };
}

// ============================================
// SINCRONIZAÇÃO
// ============================================

async function syncTable(prodClient, stagingClient, tableName) {
    console.log(`\n📦 Sincronizando tabela: ${tableName}`);

    try {
        // 1. Buscar dados de produção
        const { data: prodData, error: prodError } = await prodClient
            .from(tableName)
            .select('*');

        if (prodError) {
            console.log(`   ⚠️  Tabela não existe em produção ou erro: ${prodError.message}`);
            return { table: tableName, status: 'skipped', reason: prodError.message };
        }

        if (!prodData || prodData.length === 0) {
            console.log(`   ℹ️  Tabela vazia em produção`);
            return { table: tableName, status: 'empty', count: 0 };
        }

        console.log(`   📊 Encontrados ${prodData.length} registros em produção`);

        // 2. Para profiles: mapear UUID de produção → UUID de staging (por email)
        if (tableName === 'profiles') {
            const { data: { users: prodUsers } } = await prodClient.auth.admin.listUsers();
            const { data: { users: stagingUsers } } = await stagingClient.auth.admin.listUsers();

            if (prodUsers && stagingUsers) {
                const stagingUserMap = {};
                for (const u of stagingUsers) {
                    stagingUserMap[u.email.toLowerCase()] = u.id;
                }

                const prodUserMap = {};
                for (const u of prodUsers) {
                    prodUserMap[u.id] = u.email.toLowerCase();
                }

                for (const row of prodData) {
                    const email = prodUserMap[row.id];
                    if (email && stagingUserMap[email]) {
                        const oldId = row.id;
                        row.id = stagingUserMap[email];
                        console.log(`   🔄 Mapeado profile ${email}: ${oldId.slice(0, 8)}... → ${row.id.slice(0, 8)}...`);
                    }
                }
            }
        }

        // 2. Não apagar a tabela. Fazer apenas upsert dos dados para atualizar os desatualizados e inserir os faltantes.
        console.log(`   🔄 Modo de Sync Inteligente (Atualização sem Wipe)`);

        // 3. Inserir em batches com auto-retry para colunas ausentes
        const BATCH_SIZE = 100;
        let totalInserted = 0;
        let knownBadColumns = new Set();
        const allSkippedColumns = new Set();

        for (let i = 0; i < prodData.length; i += BATCH_SIZE) {
            const batch = prodData.slice(i, i + BATCH_SIZE);
            const { inserted, removedColumns } = await upsertWithRetry(
                stagingClient, tableName, batch, knownBadColumns
            );

            totalInserted += inserted;

            // Propagar colunas ruins para os próximos batches
            if (removedColumns) {
                removedColumns.forEach(col => {
                    knownBadColumns.add(col);
                    allSkippedColumns.add(col);
                });
            }
        }

        if (allSkippedColumns.size > 0) {
            console.log(`   ⚠️  Colunas ignoradas (não existem no staging): ${[...allSkippedColumns].join(', ')}`);
        }

        console.log(`   ✅ Inseridos ${totalInserted} de ${prodData.length} registros no staging`);
        return {
            table: tableName,
            status: totalInserted > 0 ? 'success' : 'error',
            count: totalInserted,
            skippedColumns: [...allSkippedColumns],
        };

    } catch (error) {
        console.log(`   ❌ Erro: ${error.message}`);
        return { table: tableName, status: 'error', reason: error.message };
    }
}

async function main() {
    console.log('🔄 Iniciando sincronização Produção → Staging\n');
    console.log('============================================');

    const prodClient = createClient(PRODUCAO.url, PRODUCAO.key);
    const stagingClient = createClient(STAGING.url, STAGING.key);

    const results = [];

    for (const tableName of TABELAS_PARA_SINCRONIZAR) {
        const result = await syncTable(prodClient, stagingClient, tableName);
        results.push(result);
    }

    // Resumo
    console.log('\n============================================');
    console.log('📋 RESUMO DA SINCRONIZAÇÃO\n');

    const success = results.filter(r => r.status === 'success');
    const skipped = results.filter(r => r.status === 'skipped' || r.status === 'empty');
    const errors = results.filter(r => r.status === 'error');

    console.log(`✅ Sucesso: ${success.length} tabelas`);
    success.forEach(r => console.log(`   - ${r.table}: ${r.count} registros`));

    if (skipped.length > 0) {
        console.log(`\n⏭️  Puladas: ${skipped.length} tabelas`);
        skipped.forEach(r => console.log(`   - ${r.table}`));
    }

    if (errors.length > 0) {
        console.log(`\n❌ Erros: ${errors.length} tabelas`);
        errors.forEach(r => console.log(`   - ${r.table}: ${r.reason || 'inserção falhou'}`));
    }

    // Listar colunas que precisam ser adicionadas ao staging
    const allMissingCols = results
        .filter(r => r.skippedColumns && r.skippedColumns.length > 0)
        .map(r => ({ table: r.table, columns: r.skippedColumns }));

    if (allMissingCols.length > 0) {
        console.log('\n⚠️  COLUNAS FALTANTES NO STAGING (adicione para sync 100%):');
        console.log('   Execute este SQL no SQL Editor do Staging:\n');
        for (const { table, columns } of allMissingCols) {
            for (const col of columns) {
                console.log(`   ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} TEXT;`);
            }
        }
    }

    console.log('\n✨ Sincronização concluída!');
}

main().catch(console.error);
