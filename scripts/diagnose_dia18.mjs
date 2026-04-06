/**
 * Diagnóstico: Pedidos vendidos em 18/02/2026
 * Objetivo: Descobrir por que aparecem apenas 27 quando deveriam ser mais
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://cgyxinpejaoadsqrxbhy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA'
);

async function main() {
    console.log('=== DIAGNÓSTICO: PEDIDOS DO DIA 18/02/2026 ===\n');

    // 1. Pedidos consolidados com data_venda = 18/02
    const { data: consolidados, error: e1 } = await supabase
        .from('pedidos_consolidados_v3')
        .select('id, codigo_transacao, descricao_pacote, nome_cliente, data_venda, dia_despacho, codigo_rastreio, status_envio, data_envio, codigos_filhos, codigos_agrupados, quantidade_pedidos')
        .gte('data_venda', '2026-02-18')
        .lt('data_venda', '2026-02-19')
        .order('data_venda', { ascending: true });

    if (e1) { console.error('Erro consolidados:', e1.message); return; }

    console.log(`📦 PEDIDOS CONSOLIDADOS com data_venda = 18/02: ${consolidados.length}`);
    console.log('');

    // Separar por aba
    const ready = consolidados.filter(o => !o.codigo_rastreio && !o.data_envio);
    const labeled = consolidados.filter(o => o.codigo_rastreio && !o.data_envio);
    const shipped = consolidados.filter(o => o.data_envio);

    console.log(`  ✅ Em "Prontos para Envio" (sem rastreio, sem envio): ${ready.length}`);
    console.log(`  🏷️  Em "Etiqueta Gerada" (com rastreio, sem envio): ${labeled.length}`);
    console.log(`  📬 Já enviados (com data_envio): ${shipped.length}`);
    console.log('');

    // Detalhe dos prontos
    console.log('--- DETALHES DOS PRONTOS (dia 18/02) ---');
    ready.forEach((o, i) => {
        console.log(`  ${i + 1}. ${o.descricao_pacote} | ${o.nome_cliente} | despacho: ${o.dia_despacho}`);
    });

    // Detalhe dos com etiqueta
    if (labeled.length > 0) {
        console.log(`\n--- COM ETIQUETA GERADA (dia 18/02) ---`);
        labeled.forEach((o, i) => {
            console.log(`  ${i + 1}. ${o.descricao_pacote} | ${o.nome_cliente} | despacho: ${o.dia_despacho} | rastreio: ${o.codigo_rastreio}`);
        });
    }

    // 2. Agora verificar na ticto_pedidos: quantos pedidos RAW existem no dia 18/02
    const { data: tictoRaw, error: e2 } = await supabase
        .from('ticto_pedidos')
        .select('id, transaction_hash, order_id, product_name, offer_name, customer_name, customer_email, customer_cpf, order_date, status')
        .gte('order_date', '2026-02-18')
        .lt('order_date', '2026-02-19')
        .order('order_date', { ascending: true });

    if (e2) { console.error('Erro ticto_pedidos:', e2.message); return; }

    console.log(`\n\n📋 PEDIDOS RAW na ticto_pedidos (dia 18/02): ${tictoRaw.length}`);

    // Filtrar apenas aprovados (mesma lógica da consolidação)
    const aprovados = tictoRaw.filter(p =>
        ['authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago'].includes(p.status)
    );
    const rejeitados = tictoRaw.filter(p =>
        !['authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago'].includes(p.status)
    );

    console.log(`  ✅ Aprovados: ${aprovados.length}`);
    console.log(`  ❌ Não aprovados: ${rejeitados.length}`);

    if (rejeitados.length > 0) {
        console.log('\n--- PEDIDOS NÃO APROVADOS (dia 18/02) ---');
        rejeitados.forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.customer_name} | ${p.product_name} | ${p.offer_name} | status: ${p.status}`);
        });
    }

    // Separar pais vs filhos (OB/Upsell/CC)
    const pais = aprovados.filter(p => {
        const norm = (p.offer_name || '').toUpperCase().replace(/ /g, '');
        return !norm.includes('ORDERBUMP') && !norm.includes('UPSELL') && !norm.includes('CC');
    });
    const filhos = aprovados.filter(p => {
        const norm = (p.offer_name || '').toUpperCase().replace(/ /g, '');
        return norm.includes('ORDERBUMP') || norm.includes('UPSELL') || norm.includes('CC');
    });

    console.log(`\n  👨 Pedidos "pai" (principal): ${pais.length}`);
    console.log(`  👶 Pedidos "filho" (OB/Upsell/CC): ${filhos.length}`);
    console.log(`  📦 Consolidados esperados ≈ ${pais.length} (1 consolidado por pai)`);
    console.log(`  📦 Consolidados reais: ${consolidados.length}`);

    const diff = pais.length - consolidados.length;
    if (diff > 0) {
        console.log(`\n⚠️ FALTAM ${diff} pedido(s) na consolidação!`);

        // Encontrar quais pais não estão consolidados
        const consolidadosHashes = new Set();
        consolidados.forEach(c => {
            consolidadosHashes.add(c.codigo_transacao);
            // Também incluir codigos dos filhos agrupados
            if (c.codigos_agrupados) {
                (Array.isArray(c.codigos_agrupados) ? c.codigos_agrupados : []).forEach(code => consolidadosHashes.add(code));
            }
            if (c.codigos_filhos) {
                (Array.isArray(c.codigos_filhos) ? c.codigos_filhos : []).forEach(code => consolidadosHashes.add(code));
            }
        });

        const faltantes = pais.filter(p => !consolidadosHashes.has(p.transaction_hash));
        console.log(`\n--- PEDIDOS "PAI" FALTANTES NA CONSOLIDAÇÃO ---`);
        faltantes.forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.customer_name} | ${p.product_name} | ${p.offer_name} | hash: ${p.transaction_hash} | order_id: ${p.order_id}`);
        });
    } else if (diff < 0) {
        console.log(`\n🤔 Há MAIS consolidados (${consolidados.length}) do que pais (${pais.length}). Talvez pedidos de outro dia foram agrupados aqui.`);
    } else {
        console.log(`\n✅ Contagem bate: ${pais.length} pais = ${consolidados.length} consolidados`);
    }

    // 3. Listar TODOS os pais aprovados para comparação
    console.log(`\n\n--- TODOS OS PEDIDOS "PAI" APROVADOS (dia 18/02) ---`);
    pais.forEach((p, i) => {
        const inConsolidado = consolidadosHashes(p.transaction_hash) ? '✅' : '❌';
        console.log(`  ${i + 1}. ${p.customer_name} | ${p.product_name} | ${p.offer_name} | status: ${p.status}`);
    });

    console.log('\n=== FIM DO DIAGNÓSTICO ===');
}

// Helper
let consolidadosHashes;

main().catch(console.error);
