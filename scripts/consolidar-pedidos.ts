/**
 * Consolidação Automática de Pedidos
 *
 * Chama a stored procedure consolidar_pedidos() no Supabase Produção
 * para agrupar Order Bumps, Upsells, PVs CC e detectar fraude de endereço.
 *
 * Uso manual:   npx tsx scripts/consolidar-pedidos.ts
 * Via scheduler: scripts/consolidar-run.bat (Windows Task Scheduler)
 */

import { createClient } from '@supabase/supabase-js';

// Produção (mesmas credenciais dos outros scripts)
const PROD = {
    url: 'https://cgyxinpejaoadsqrxbhy.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA',
};

function log(msg: string) {
    console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`);
}

async function consolidar() {
    log('═══════════════════════════════════════════════════');
    log('🔄 CONSOLIDAÇÃO DE PEDIDOS');
    log(`   Banco: ${PROD.url}`);
    log('═══════════════════════════════════════════════════');

    const supabase = createClient(PROD.url, PROD.key);
    const inicio = Date.now();

    // Verificar conexão
    const { error: check } = await supabase.from('pedidos').select('id').limit(1);
    if (check) {
        log(`❌ Falha na conexão: ${check.message}`);
        process.exit(1);
    }
    log('✅ Conexão OK');
    log('');

    // Executar consolidação
    log('🔄 Executando consolidar_pedidos()...');
    const { data, error } = await supabase.rpc('consolidar_pedidos');

    if (error) {
        log(`❌ Erro: ${error.message}`);
        log(`   Detalhes: ${JSON.stringify(error)}`);
        process.exit(1);
    }

    const stats = Array.isArray(data) ? data[0] : data;
    const elapsed = ((Date.now() - inicio) / 1000).toFixed(1);

    log('');
    log('✅ Consolidação concluída!');
    log('');
    log('📊 Estatísticas:');
    log(`   ├─ Pedidos Principais: ${stats?.total_principais ?? 0}`);
    log(`   ├─ Order Bumps:        ${stats?.total_order_bumps ?? 0}`);
    log(`   ├─ Upsells:            ${stats?.total_upsells ?? 0}`);
    log(`   ├─ Pós Vendas CC:      ${stats?.total_pos_vendas ?? 0}`);
    log(`   ├─ Dois Cartões:       ${stats?.total_dois_cartoes ?? 0}`);
    log(`   └─ Mesmo Endereço:     ${stats?.total_mesmo_endereco ?? 0}`);
    log('');
    log(`⏱️  Tempo total: ${elapsed}s`);
    log('═══════════════════════════════════════════════════');
}

consolidar().catch((err) => {
    log(`❌ Erro fatal: ${err.message}`);
    process.exit(1);
});
