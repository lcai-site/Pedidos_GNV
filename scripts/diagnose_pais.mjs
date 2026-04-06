/**
 * Diagnóstico FINAL: Buscar os pedidos PAI dos Order Bumps órfãos
 * Verificar por order_id e CPF quem é o pai de cada OB faltante
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://cgyxinpejaoadsqrxbhy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA'
);

// Os Order Bumps "órfãos" encontrados
const ORDER_BUMPS = [
    { nome: 'Beatriz Depeder Lopes', nota: 'Não encontrado - vamos buscar de outra forma' },
    { nome: 'laercio Machado junior', order_id_18: '3810789', cpf: '34963429861', hash: 'TPC6E5F41802T6N46PWU' },
    { nome: 'valdirene dos santos schuch', order_id: '3811150', cpf: '03925953035', hash: 'TPC28E531802YYR40GQT' },
    { nome: 'Stephanie Palazon', order_id: '3812911', cpf: '42967440885', hash: 'TPC52E9C1802AMD396AK' },
];

async function main() {
    console.log('=== BUSCANDO PEDIDOS PAI DOS ORDER BUMPS ÓRFÃOS ===\n');

    // 1. Laercio - buscar por order_id 3810789
    console.log('🔍 LAERCIO MACHADO JUNIOR');
    console.log('   Order Bump do dia 18/02, order_id: 3810789, CPF: 34963429861');
    const { data: laercio } = await supabase
        .from('ticto_pedidos')
        .select('*')
        .eq('order_id', '3810789');
    console.log(`   Pedidos com order_id 3810789: ${laercio?.length || 0}`);
    laercio?.forEach(p => {
        const norm = (p.offer_name || '').toUpperCase().replace(/ /g, '');
        const tipo = norm.includes('ORDERBUMP') ? '👶 FILHO (OB)' : norm.includes('UPSELL') ? '👶 FILHO (US)' : '👨 PAI';
        console.log(`     ${tipo} | ${p.customer_name} | ${p.offer_name} | ${p.product_name} | data: ${p.order_date?.split('T')[0]} | status: ${p.status} | hash: ${p.transaction_hash}`);
    });

    // Buscar também por CPF no consolidado
    const { data: laercioCons } = await supabase
        .from('pedidos_consolidados_v3')
        .select('id, nome_cliente, descricao_pacote, dia_despacho, codigos_filhos, codigos_agrupados, data_venda')
        .eq('cpf', '34963429861');
    console.log(`   Consolidados com CPF 34963429861: ${laercioCons?.length || 0}`);
    laercioCons?.forEach(c => {
        console.log(`     📦 ${c.nome_cliente} | ${c.descricao_pacote} | venda: ${c.data_venda?.split('T')[0]} | despacho: ${c.dia_despacho}`);
        console.log(`        filhos: ${JSON.stringify(c.codigos_filhos)}`);
        console.log(`        agrupados: ${JSON.stringify(c.codigos_agrupados)}`);
    });

    // 2. Valdirene - buscar por order_id 3811150
    console.log('\n🔍 VALDIRENE DOS SANTOS SCHUCH');
    console.log('   Order Bump do dia 18/02, order_id: 3811150, CPF: 03925953035');
    const { data: valdirene } = await supabase
        .from('ticto_pedidos')
        .select('*')
        .eq('order_id', '3811150');
    console.log(`   Pedidos com order_id 3811150: ${valdirene?.length || 0}`);
    valdirene?.forEach(p => {
        const norm = (p.offer_name || '').toUpperCase().replace(/ /g, '');
        const tipo = norm.includes('ORDERBUMP') ? '👶 FILHO (OB)' : '👨 PAI';
        console.log(`     ${tipo} | ${p.customer_name} | ${p.offer_name} | ${p.product_name} | data: ${p.order_date?.split('T')[0]} | status: ${p.status} | hash: ${p.transaction_hash}`);
    });

    const { data: valdireneCons } = await supabase
        .from('pedidos_consolidados_v3')
        .select('id, nome_cliente, descricao_pacote, dia_despacho, codigos_filhos, codigos_agrupados, data_venda')
        .eq('cpf', '03925953035');
    console.log(`   Consolidados com CPF 03925953035: ${valdireneCons?.length || 0}`);
    valdireneCons?.forEach(c => {
        console.log(`     📦 ${c.nome_cliente} | ${c.descricao_pacote} | venda: ${c.data_venda?.split('T')[0]} | despacho: ${c.dia_despacho}`);
        console.log(`        filhos: ${JSON.stringify(c.codigos_filhos)}`);
    });

    // 3. Stephanie - buscar por order_id 3812911
    console.log('\n🔍 STEPHANIE PALAZON');
    console.log('   Order Bump do dia 18/02 (na verdade 19/02), order_id: 3812911, CPF: 42967240885');
    const { data: stephanie } = await supabase
        .from('ticto_pedidos')
        .select('*')
        .eq('order_id', '3812911');
    console.log(`   Pedidos com order_id 3812911: ${stephanie?.length || 0}`);
    stephanie?.forEach(p => {
        const norm = (p.offer_name || '').toUpperCase().replace(/ /g, '');
        const tipo = norm.includes('ORDERBUMP') ? '👶 FILHO (OB)' : '👨 PAI';
        console.log(`     ${tipo} | ${p.customer_name} | ${p.offer_name} | ${p.product_name} | data: ${p.order_date?.split('T')[0]} | status: ${p.status} | hash: ${p.transaction_hash}`);
    });

    const { data: stephCons } = await supabase
        .from('pedidos_consolidados_v3')
        .select('id, nome_cliente, descricao_pacote, dia_despacho, codigos_filhos, codigos_agrupados, data_venda')
        .eq('cpf', '42967240885');
    console.log(`   Consolidados com CPF 42967240885: ${stephCons?.length || 0}`);
    stephCons?.forEach(c => {
        console.log(`     📦 ${c.nome_cliente} | ${c.descricao_pacote} | venda: ${c.data_venda?.split('T')[0]} | despacho: ${c.dia_despacho}`);
        console.log(`        filhos: ${JSON.stringify(c.codigos_filhos)}`);
    });

    // 4. Beatriz Depeder Lopes - buscar por nome parcial
    console.log('\n🔍 BEATRIZ DEPEDER LOPES');
    const { data: beatriz } = await supabase
        .from('ticto_pedidos')
        .select('*')
        .ilike('customer_name', '%Depeder%');
    console.log(`   Pedidos com nome "Depeder": ${beatriz?.length || 0}`);
    beatriz?.forEach(p => {
        console.log(`     ${p.customer_name} | ${p.offer_name} | ${p.product_name} | data: ${p.order_date?.split('T')[0]} | status: ${p.status} | hash: ${p.transaction_hash} | order_id: ${p.order_id}`);
    });

    if (beatriz?.length === 0) {
        // Tentar buscar de outra forma
        const { data: beatriz2 } = await supabase
            .from('ticto_pedidos')
            .select('*')
            .ilike('customer_name', '%Beatriz%Lopes%');
        console.log(`   Pedidos com "Beatriz...Lopes": ${beatriz2?.length || 0}`);
        beatriz2?.forEach(p => {
            console.log(`     ${p.customer_name} | ${p.offer_name} | ${p.product_name} | data: ${p.order_date?.split('T')[0]} | status: ${p.status}`);
        });
    }

    // Buscar na consolidada
    const { data: beatrizCons } = await supabase
        .from('pedidos_consolidados_v3')
        .select('id, nome_cliente, descricao_pacote, dia_despacho, data_venda')
        .ilike('nome_cliente', '%Depeder%');
    console.log(`   Consolidados com "Depeder": ${beatrizCons?.length || 0}`);

    console.log('\n=== FIM ===');
}

main().catch(console.error);
