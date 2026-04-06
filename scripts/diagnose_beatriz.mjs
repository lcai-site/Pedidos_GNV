import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://cgyxinpejaoadsqrxbhy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA'
);

async function main() {
    console.log('=== BEATRIZ DEPEDER LOPES: BUSCA EXAUSTIVA ===\n');

    // 1. Buscar por nome parcial "Beatriz" no dia 18/02
    console.log('🔍 Todos os "Beatriz" na ticto_pedidos (qualquer data):');
    const { data: allBeatriz } = await supabase
        .from('ticto_pedidos')
        .select('customer_name, customer_email, customer_cpf, offer_name, product_name, order_date, status, order_id, transaction_hash')
        .ilike('customer_name', '%beatriz%')
        .order('order_date', { ascending: false });

    console.log(`  Total: ${allBeatriz?.length || 0}`);
    allBeatriz?.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.customer_name} | ${p.customer_email} | oid:${p.order_id}`);
        console.log(`     ${p.offer_name} | ${p.product_name} | data: ${p.order_date?.split('T')[0]} | status: ${p.status}`);
        console.log(`     hash: ${p.transaction_hash}`);
    });

    // 2. Buscar "Depeder" ou "Lopes" com variações
    console.log('\n🔍 Busca "Depeder" em TODA a tabela:');
    const { data: depeder } = await supabase
        .from('ticto_pedidos')
        .select('customer_name, customer_email')
        .ilike('customer_name', '%depeder%');
    console.log(`  Resultados: ${depeder?.length || 0}`);

    // 3. Buscar na consolidada por "Beatriz" dia 18
    console.log('\n🔍 Todos os "Beatriz" na consolidada (qualquer data):');
    const { data: beatrizCons } = await supabase
        .from('pedidos_consolidados_v3')
        .select('nome_cliente, email, descricao_pacote, data_venda, dia_despacho')
        .ilike('nome_cliente', '%beatriz%');

    console.log(`  Total: ${beatrizCons?.length || 0}`);
    beatrizCons?.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.nome_cliente} | ${c.email} | ${c.descricao_pacote} | venda: ${c.data_venda?.split('T')[0]} | despacho: ${c.dia_despacho}`);
    });

    // 4. Verificar os ticto_logs por volta das 11:12 de 18/02 (horário do print)
    console.log('\n🔍 Logs do webhook entre 11:00-11:20 do dia 18/02:');
    const { data: logs } = await supabase
        .from('ticto_logs')
        .select('*')
        .gte('created_at', '2026-02-18T11:00:00')
        .lt('created_at', '2026-02-18T11:20:00')
        .order('created_at', { ascending: true });

    console.log(`  Total: ${logs?.length || 0}`);
    logs?.forEach((l, i) => {
        console.log(`  ${i + 1}. ${l.evento} | sucesso: ${l.sucesso} | ${l.created_at}`);
        if (l.payload) console.log(`     payload: ${JSON.stringify(l.payload).substring(0, 200)}`);
    });

    // 5. Contar pedidos totais recebidos no dia 18/02 entre 11:00-11:15
    console.log('\n🔍 Pedidos criados entre 11:10-11:15 do dia 18/02:');
    const { data: window } = await supabase
        .from('ticto_pedidos')
        .select('customer_name, customer_email, offer_name, order_id, created_at, status')
        .gte('created_at', '2026-02-18T11:10:00')
        .lt('created_at', '2026-02-18T11:15:00')
        .order('created_at', { ascending: true });

    console.log(`  Total: ${window?.length || 0}`);
    window?.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.customer_name} | ${p.customer_email} | ${p.offer_name} | oid:${p.order_id} | criado: ${p.created_at}`);
    });

    // 6. Listar TODAS as tabelas que podem ter dados
    console.log('\n🔍 Verificando se existe em outras tabelas (pedidos, pedidos_unificados, etc):');

    for (const table of ['pedidos', 'pedidos_unificados', 'pedidos_agrupados']) {
        const { data, error } = await supabase
            .from(table)
            .select('id')
            .limit(1);

        if (error) {
            console.log(`  ${table}: ❌ ${error.message}`);
        } else {
            console.log(`  ${table}: ✅ existe (${data?.length} registros testados)`);
        }
    }

    console.log('\n=== FIM ===');
}

main().catch(console.error);
