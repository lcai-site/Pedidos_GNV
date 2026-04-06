// ================================================================
// SYNC DATABASES: Produção → Desenvolvimento
// Sincroniza dados do banco de produção para o banco de testes
// Execução: npx tsx scripts/sync-databases.ts
// ================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── Configuração ──────────────────────────────────────────────

const PROD = {
    url: 'https://cgyxinpejaoadsqrxbhy.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA',
};

const DEV = {
    url: 'https://vkeshyusimduiwjaijjv.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZXNoeXVzaW1kdWl3amFpamp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzU0NDk3NywiZXhwIjoyMDgzMTIwOTc3fQ.5HGMlM2WMTp9BYxSfPfo0YQQV5oy3ZPTWj0ZNHpZT8c',
};

// Tabelas a sincronizar
const TABLES = [
    'pedidos',
    'pedidos_consolidados_v3',
    'pedidos_unificados',
    'pedidos_agrupados',
    'pedidos_vendas',
    'estoque',
    'estoque_movimentacoes',
    'assinaturas',
    'carrinhos_abandonados',
    'pedidos_status_log',
    'metas',
    'feriados',
    'notificacoes',
];

const BATCH_SIZE = 500;

// ── Helpers ───────────────────────────────────────────────────

function log(msg: string) {
    const ts = new Date().toLocaleTimeString('pt-BR');
    console.log(`[${ts}] ${msg}`);
}

function logError(msg: string) {
    const ts = new Date().toLocaleTimeString('pt-BR');
    console.error(`[${ts}] ❌ ${msg}`);
}

// ── Descobrir colunas da tabela no destino ────────────────────

async function getDevColumns(devClient: SupabaseClient, tableName: string): Promise<string[] | null> {
    // Tenta ler 1 registro para descobrir as colunas que o destino aceita
    const { data, error } = await devClient
        .from(tableName)
        .select('*')
        .limit(1);

    if (error) {
        // Tabela pode não existir no dev
        return null;
    }

    // Se tem dados, pegamos as keys do primeiro registro
    if (data && data.length > 0) {
        return Object.keys(data[0]);
    }

    // Se não tem dados, tentamos insert vazio para descobrir o schema
    // Retornamos null e tratamos na hora do upsert
    return null;
}

// ── Filtrar colunas extras que o destino não aceita ───────────

function filterColumns(records: any[], allowedColumns: string[] | null): any[] {
    if (!allowedColumns) return records;

    const allowedSet = new Set(allowedColumns);
    return records.map(record => {
        const filtered: any = {};
        for (const key of Object.keys(record)) {
            if (allowedSet.has(key)) {
                filtered[key] = record[key];
            }
        }
        return filtered;
    });
}

// ── Ler todos os registros de uma tabela ─────────────────────

async function fetchAll(client: SupabaseClient, tableName: string): Promise<any[]> {
    const allData: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        // Usa select sem order para evitar erro de coluna inexistente
        const { data, error } = await client
            .from(tableName)
            .select('*')
            .range(offset, offset + BATCH_SIZE - 1);

        if (error) {
            throw new Error(`Erro ao ler ${tableName}: ${error.message}`);
        }

        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            allData.push(...data);
            offset += BATCH_SIZE;
            if (data.length < BATCH_SIZE) hasMore = false;
        }
    }

    return allData;
}

// ── Upsert com detecção automática de conflito ──────────────

async function smartUpsert(
    devClient: SupabaseClient,
    tableName: string,
    data: any[],
    devColumns: string[] | null
): Promise<{ inserted: number; errors: number; errorMsg?: string }> {
    let inserted = 0;
    let errors = 0;
    let lastError = '';

    // Filtrar colunas que o destino não tem
    const filteredData = filterColumns(data, devColumns);

    for (let i = 0; i < filteredData.length; i += BATCH_SIZE) {
        const batch = filteredData.slice(i, i + BATCH_SIZE);

        // Tenta upsert com id como conflito
        const { error } = await devClient
            .from(tableName)
            .upsert(batch, {
                onConflict: 'id',
                ignoreDuplicates: false,
            });

        if (error) {
            // Se falhou no upsert, tenta insert ignorando duplicatas
            const { error: insertError } = await devClient
                .from(tableName)
                .insert(batch)
                .select();

            if (insertError) {
                // Última tentativa: inserir um por um
                let batchInserted = 0;
                for (const record of batch) {
                    const { error: singleError } = await devClient
                        .from(tableName)
                        .upsert(record, { onConflict: 'id', ignoreDuplicates: true });

                    if (!singleError) {
                        batchInserted++;
                    }
                }
                if (batchInserted > 0) {
                    inserted += batchInserted;
                } else {
                    lastError = error.message;
                    errors += batch.length;
                }
            } else {
                inserted += batch.length;
            }
        } else {
            inserted += batch.length;
        }
    }

    return { inserted, errors, errorMsg: lastError || undefined };
}

// ── Sincronizar uma tabela ───────────────────────────────────

async function syncTable(
    prodClient: SupabaseClient,
    devClient: SupabaseClient,
    tableName: string
): Promise<{ table: string; total: number; inserted: number; errors: number; skipped: boolean; errorMsg?: string }> {
    try {
        // Verificar se tabela existe no dev
        const { error: checkError } = await devClient.from(tableName).select('id').limit(0);
        if (checkError && checkError.message.includes('not found')) {
            log(`  ⚠️  ${tableName}: não existe no dev, pulando`);
            return { table: tableName, total: 0, inserted: 0, errors: 0, skipped: true };
        }

        // Descobrir colunas aceitas pelo dev
        const devColumns = await getDevColumns(devClient, tableName);

        // Ler dados da produção
        const prodData = await fetchAll(prodClient, tableName);

        if (prodData.length === 0) {
            log(`  ⏭️  ${tableName}: vazia na produção, pulando`);
            return { table: tableName, total: 0, inserted: 0, errors: 0, skipped: true };
        }

        log(`  📥 ${tableName}: ${prodData.length} registros lidos da produção`);

        // Upsert no desenvolvimento
        const result = await smartUpsert(devClient, tableName, prodData, devColumns);

        if (result.errors > 0) {
            log(`  ⚠️  ${tableName}: ${result.inserted} ok, ${result.errors} erros${result.errorMsg ? ' (' + result.errorMsg.slice(0, 80) + ')' : ''}`);
        } else {
            log(`  ✅ ${tableName}: ${result.inserted} sincronizados`);
        }

        return {
            table: tableName,
            total: prodData.length,
            inserted: result.inserted,
            errors: result.errors,
            skipped: false,
            errorMsg: result.errorMsg,
        };
    } catch (err: any) {
        logError(`${tableName}: ${err.message}`);
        return { table: tableName, total: 0, inserted: 0, errors: 1, skipped: false, errorMsg: err.message };
    }
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
    const startTime = Date.now();

    log('═══════════════════════════════════════════════════');
    log('🔄 SYNC: Produção → Desenvolvimento');
    log(`   Prod: ${PROD.url}`);
    log(`   Dev:  ${DEV.url}`);
    log('═══════════════════════════════════════════════════');

    const prodClient = createClient(PROD.url, PROD.key);
    const devClient = createClient(DEV.url, DEV.key);

    // Verificar conexão
    const { error: prodCheck } = await prodClient.from('pedidos').select('id').limit(1);
    if (prodCheck) {
        logError(`Não conseguiu conectar na PRODUÇÃO: ${prodCheck.message}`);
        process.exit(1);
    }
    log('✅ Conexão com produção OK');

    const { error: devCheck } = await devClient.from('pedidos').select('id').limit(1);
    if (devCheck) {
        logError(`Não conseguiu conectar no DESENVOLVIMENTO: ${devCheck.message}`);
        process.exit(1);
    }
    log('✅ Conexão com desenvolvimento OK');
    log('');

    // Sincronizar cada tabela
    const results: Awaited<ReturnType<typeof syncTable>>[] = [];

    for (const tableName of TABLES) {
        log(`🔄 Sincronizando: ${tableName}...`);
        const result = await syncTable(prodClient, devClient, tableName);
        results.push(result);
        log('');
    }

    // Resumo final
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalSynced = results.reduce((sum, r) => sum + r.inserted, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
    const tablesOk = results.filter(r => !r.skipped && r.errors === 0 && r.total > 0).length;

    log('═══════════════════════════════════════════════════');
    log('📊 RESUMO DA SINCRONIZAÇÃO');
    log('═══════════════════════════════════════════════════');
    log(`   Tabelas processadas: ${results.length}`);
    log(`   Tabelas OK:          ${tablesOk}`);
    log(`   Total sincronizado:  ${totalSynced} registros`);
    log(`   Erros:               ${totalErrors}`);
    log(`   Tempo:               ${elapsed}s`);
    log('═══════════════════════════════════════════════════');

    if (totalErrors > 0) {
        log('');
        log('⚠️  Tabelas com erros (podem precisar de ajuste no schema do dev):');
        results.filter(r => r.errors > 0).forEach(r => {
            log(`   - ${r.table}: ${r.errors} erros${r.errorMsg ? ' → ' + r.errorMsg.slice(0, 100) : ''}`);
        });
    }

    log('');
    log(`✅ Sync concluído em ${elapsed}s`);
}

main().catch((err) => {
    logError(`Erro fatal: ${err.message}`);
    process.exit(1);
});
