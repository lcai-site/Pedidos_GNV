/**
 * Script de Sincronização: Produção → Staging
 * 
 * Uso: node scripts/sync-to-staging.js
 * 
 * Este script copia dados do banco de produção para o banco de staging.
 * É uma operação SOMENTE LEITURA na produção.
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
    'pedidos',
    'pedidos_unificados',
    'estoque',
    'estoque_movimentacoes',
    'assinaturas',
    'carrinhos_abandonados',
    'solicitacoes',
    'solicitacoes_historico',
    'feriados'
];

// ============================================
// FUNÇÕES DE SINCRONIZAÇÃO
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

        // 2. Limpar tabela de staging (cuidado!)
        const { error: deleteError } = await stagingClient
            .from(tableName)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta tudo (hack para delete all)

        if (deleteError) {
            console.log(`   ⚠️  Erro ao limpar staging: ${deleteError.message}`);
            // Continua mesmo assim, pode ser que a tabela já esteja vazia
        }

        // 3. Inserir dados de produção no staging (em batches)
        const BATCH_SIZE = 100;
        let inserted = 0;

        for (let i = 0; i < prodData.length; i += BATCH_SIZE) {
            const batch = prodData.slice(i, i + BATCH_SIZE);

            const { error: insertError } = await stagingClient
                .from(tableName)
                .upsert(batch, { onConflict: 'id' });

            if (insertError) {
                console.log(`   ❌ Erro ao inserir batch: ${insertError.message}`);
            } else {
                inserted += batch.length;
            }
        }

        console.log(`   ✅ Inseridos ${inserted} registros no staging`);
        return { table: tableName, status: 'success', count: inserted };

    } catch (error) {
        console.log(`   ❌ Erro: ${error.message}`);
        return { table: tableName, status: 'error', reason: error.message };
    }
}

async function main() {
    console.log('🔄 Iniciando sincronização Produção → Staging\n');
    console.log('============================================');

    // Criar clientes
    const prodClient = createClient(PRODUCAO.url, PRODUCAO.key);
    const stagingClient = createClient(STAGING.url, STAGING.key);

    // Sincronizar cada tabela
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
        errors.forEach(r => console.log(`   - ${r.table}: ${r.reason}`));
    }

    console.log('\n✨ Sincronização concluída!');
}

main().catch(console.error);
