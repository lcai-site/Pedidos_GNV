import { createClient } from '@supabase/supabase-js';

const sb = createClient(
    'https://cgyxinpejaoadsqrxbhy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA'
);

async function run() {
    console.log('=== DIAGNÓSTICO DE CONTAGEM E LABELS ===');

    // 1. Buscar tudo do Consolidados
    const { data: consolidated, error: err1 } = await sb
        .from('pedidos_consolidados_v3')
        .select('*');

    if (err1) throw err1;

    console.log(`Total consolidado: ${consolidated.length}`);

    // Hoje
    const today = '2026-02-20';

    // 2. Simular categorização do front
    const ready = [];
    const labeled = [];
    const waiting = [];

    const refDate = new Date(today + 'T00:00:00');

    consolidated.forEach(order => {
        // Ignorar se já enviado
        if (order.data_envio) return;

        // Regra Label
        if (order.codigo_rastreio && order.codigo_rastreio !== '') {
            labeled.push(order);
            return;
        }

        // Regra Ready
        if (order.dia_despacho) {
            const diaDespacho = new Date(order.dia_despacho + 'T00:00:00');
            if (diaDespacho <= refDate) {
                ready.push(order);
            } else {
                waiting.push(order);
            }
        }
    });

    console.log(`\nFront-end Simulation:`);
    console.log(`- Prontos para envio: ${ready.length}`);
    console.log(`- Etiqueta Gerada:     ${labeled.length}`);
    console.log(`- Aguardando:          ${waiting.length}`);

    // 3. Investigar se há 31 vs 27
    // Buscar todos os pedidos aprovados na ticto_pedidos hoje (20/02)
    const { data: ticto, error: err2 } = await sb
        .from('ticto_pedidos')
        .select('transaction_hash, customer_name, paid_amount, status, order_date')
        .eq('status', 'Aprovado')
        .gte('order_date', '2026-02-20T00:00:00')
        .lte('order_date', '2026-02-20T23:59:59');

    if (err2) throw err2;

    console.log(`\nTicto Pedidos Aprovados HOJE (20/02): ${ticto.length}`);

    // 4. Verificar quais hashes de HOJE estão no Consolidados
    const consolidatedHashes = new Set();
    consolidated.forEach(o => {
        if (Array.isArray(o.codigos_agrupados)) {
            o.codigos_agrupados.forEach(h => consolidatedHashes.add(h));
        } else if (o.codigo_transacao) {
            consolidatedHashes.add(o.codigo_transacao);
        }
    });

    const missing = ticto.filter(t => !consolidatedHashes.has(t.transaction_hash));
    console.log(`Pedidos da Ticto (HOJE) faltando no Consolidados: ${missing.length}`);
    missing.forEach(m => console.log(`  - ${m.transaction_hash} | ${m.customer_name} | ${m.paid_amount}`));

    // 5. Verificar o bug de "não move"
    // Pegar um pedido que deveria estar no labeled
    const sampleLabeled = labeled.slice(0, 3);
    console.log(`\nExemplo de pedidos com etiqueta (deveriam estar na aba Labeled):`);
    sampleLabeled.forEach(o => {
        console.log(`  ID: ${o.id.substring(0, 8)} | Rastreio: ${o.codigo_rastreio} | Desc: ${o.descricao_pacote}`);
    });

    // 6. Verificar se há orders duplicadas ou de ontem que o usuário espera
    const yesterday = '2026-02-19';
    const yesterdayTicto = (await sb.from('ticto_pedidos').select('transaction_hash').eq('status', 'Aprovado').gte('order_date', yesterday + 'T00:00:00').lte('order_date', yesterday + 'T23:59:59')).data;
    console.log(`\nTicto Ontem (19/02): ${yesterdayTicto.length}`);
}

run().catch(console.error);
