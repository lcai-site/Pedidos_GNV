/**
 * Diagnóstico: Buscar pedidos pai faltantes nos logs e na ticto_pedidos
 * Para cada OB órfão, buscar o pedido pai pelo order_id
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://cgyxinpejaoadsqrxbhy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA'
);

// Order IDs dos OBs órfãos
const OB_ORDER_IDS = [3810789, 3811150, 3812911];
const OB_CPFS = ['34963429861', '03925953035', '42967240885'];

async function main() {
    console.log('=== INVESTIGAÇÃO: WEBHOOK TICTO - PEDIDOS PAI FALTANTES ===\n');

    // 1. Para cada order_id, buscar TODOS os registros na ticto_pedidos
    for (const oid of OB_ORDER_IDS) {
        console.log(`\n🔍 ORDER_ID: ${oid}`);
        console.log('─'.repeat(60));

        const { data: pedidos } = await supabase
            .from('ticto_pedidos')
            .select('id, transaction_hash, order_id, product_name, offer_name, customer_name, customer_cpf, order_date, status, created_at')
            .eq('order_id', oid);

        console.log(`  Registros encontrados: ${pedidos?.length || 0}`);
        pedidos?.forEach(p => {
            const norm = (p.offer_name || '').toUpperCase().replace(/ /g, '');
            const tipo = norm.includes('ORDERBUMP') ? '👶 OB' : norm.includes('UPSELL') ? '👶 US' : '👨 PAI';
            console.log(`  ${tipo} | ${p.customer_name} | ${p.offer_name} | data: ${p.order_date?.split('T')[0]} | status: ${p.status} | criado: ${p.created_at}`);
        });

        if ((pedidos?.length || 0) === 1) {
            console.log(`  ⚠️ APENAS 1 registro (o OB) - O PEDIDO PAI NÃO FOI RECEBIDO PELO WEBHOOK!`);
        }
    }

    // 2. Buscar por CPF para ver se o pai chegou com order_id diferente
    console.log('\n\n=== BUSCA POR CPF (caso pai tenha order_id diferente) ===\n');
    for (const cpf of OB_CPFS) {
        console.log(`\n🔍 CPF: ${cpf}`);
        const { data: pedidosCpf } = await supabase
            .from('ticto_pedidos')
            .select('id, transaction_hash, order_id, product_name, offer_name, customer_name, order_date, status')
            .eq('customer_cpf', cpf)
            .order('order_date', { ascending: false });

        console.log(`  Registros encontrados: ${pedidosCpf?.length || 0}`);
        pedidosCpf?.forEach(p => {
            const norm = (p.offer_name || '').toUpperCase().replace(/ /g, '');
            const tipo = norm.includes('ORDERBUMP') ? '👶 OB' : norm.includes('UPSELL') ? '👶 US' : norm.toUpperCase().includes('CC') ? '👶 CC' : '👨 PAI';
            console.log(`  ${tipo} | order_id: ${p.order_id} | ${p.offer_name} | ${p.product_name} | data: ${p.order_date?.split('T')[0]} | status: ${p.status}`);
        });
    }

    // 3. Buscar nos logs do webhook por erros recentes
    console.log('\n\n=== ÚLTIMOS ERROS NO WEBHOOK (ticto_logs) ===\n');
    const { data: erros } = await supabase
        .from('ticto_logs')
        .select('*')
        .eq('sucesso', false)
        .order('created_at', { ascending: false })
        .limit(20);

    console.log(`Total de erros recentes: ${erros?.length || 0}`);
    erros?.forEach((log, i) => {
        console.log(`\n  ${i + 1}. Evento: ${log.evento} | Erro: ${log.erro}`);
        console.log(`     Data: ${log.created_at}`);
        if (log.payload) {
            const p = log.payload;
            console.log(`     Hash: ${p.transaction_hash || 'N/A'} | Status: ${p.status || 'N/A'}`);
            if (p.raw_error) console.log(`     Raw: ${p.raw_error}`);
        }
    });

    // 4. Verificar se existe tabela de logs com mais info
    console.log('\n\n=== ÚLTIMOS 10 WEBHOOKS RECEBIDOS (dia 18/02) ===\n');
    const { data: logs18 } = await supabase
        .from('ticto_logs')
        .select('*')
        .gte('created_at', '2026-02-18T00:00:00')
        .lt('created_at', '2026-02-19T00:00:00')
        .order('created_at', { ascending: false })
        .limit(50);

    console.log(`Total de logs dia 18/02: ${logs18?.length || 0}`);

    // Contar por tipo
    const sucessos = logs18?.filter(l => l.sucesso).length || 0;
    const falhas = logs18?.filter(l => !l.sucesso).length || 0;
    console.log(`  Sucessos: ${sucessos} | Falhas: ${falhas}`);

    // Contar quantos pedidos APROVADOS recebemos dia 18
    const { data: recebidos18 } = await supabase
        .from('ticto_pedidos')
        .select('id, transaction_hash, order_id, customer_name, offer_name, status, order_date, created_at')
        .gte('order_date', '2026-02-18')
        .lt('order_date', '2026-02-19')
        .order('created_at', { ascending: true });

    console.log(`\n\n=== TODOS OS PEDIDOS RECEBIDOS COM order_date = 18/02 ===`);
    console.log(`Total: ${recebidos18?.length || 0}`);
    recebidos18?.forEach((p, i) => {
        const norm = (p.offer_name || '').toUpperCase().replace(/ /g, '');
        const tipo = norm.includes('ORDERBUMP') ? 'OB' : norm.includes('UPSELL') ? 'US' : norm.toUpperCase().includes('CC') ? 'CC' : 'PAI';
        console.log(`  ${i + 1}. [${tipo}] oid:${p.order_id} | ${p.customer_name} | ${p.offer_name} | ${p.status} | criado: ${p.created_at?.split('T')[0]}`);
    });

    console.log('\n=== FIM ===');
}

main().catch(console.error);
