import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://cgyxinpejaoadsqrxbhy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA'
);

// Primeiro, buscar o email de cada OB órfão
const OB_HASHES = [
    { nome: 'laercio Machado junior', hash: 'TPC6E5F41802T6N46PWU' },
    { nome: 'valdirene dos santos schuch', hash: 'TPC28E531802YYR40GQT' },
    { nome: 'Stephanie Palazon', hash: 'TPC52E9C1802AMD396AK' },
];

async function main() {
    console.log('=== BUSCANDO PEDIDOS PAI POR EMAIL ===\n');

    for (const ob of OB_HASHES) {
        console.log(`\n🔍 ${ob.nome}`);
        console.log('─'.repeat(60));

        // 1. Buscar email do OB
        const { data: obData } = await supabase
            .from('ticto_pedidos')
            .select('customer_email, customer_cpf, order_id, order_date')
            .eq('transaction_hash', ob.hash)
            .single();

        if (!obData) { console.log('  ❌ OB não encontrado'); continue; }

        const email = obData.customer_email;
        console.log(`  📧 Email: ${email}`);
        console.log(`  📋 CPF: ${obData.customer_cpf}`);
        console.log(`  🔢 Order ID do OB: ${obData.order_id}`);

        // 2. Buscar TODOS os pedidos com esse email
        const { data: pedidosEmail } = await supabase
            .from('ticto_pedidos')
            .select('id, transaction_hash, order_id, product_name, offer_name, customer_name, customer_email, order_date, status, payment_method')
            .ilike('customer_email', email)
            .order('order_date', { ascending: false });

        console.log(`\n  📋 Pedidos na ticto_pedidos com email ${email}: ${pedidosEmail?.length || 0}`);
        pedidosEmail?.forEach((p, i) => {
            const norm = (p.offer_name || '').toUpperCase().replace(/ /g, '');
            const tipo = norm.includes('ORDERBUMP') ? '👶 OB' : norm.includes('UPSELL') ? '👶 US' : norm.includes('CC') ? '👶 CC' : '👨 PAI';
            console.log(`    ${i + 1}. ${tipo} | oid:${p.order_id} | ${p.customer_name} | ${p.offer_name} | ${p.product_name}`);
            console.log(`       data: ${p.order_date?.split('T')[0]} | status: ${p.status} | pgto: ${p.payment_method}`);
        });

        // 3. Buscar na consolidada
        const { data: cons } = await supabase
            .from('pedidos_consolidados_v3')
            .select('id, nome_cliente, email, descricao_pacote, dia_despacho, data_venda, codigos_filhos, codigos_agrupados')
            .ilike('email', email);

        console.log(`\n  📦 Consolidados com email ${email}: ${cons?.length || 0}`);
        cons?.forEach((c, i) => {
            console.log(`    ${i + 1}. ${c.nome_cliente} | ${c.descricao_pacote} | venda: ${c.data_venda?.split('T')[0]} | despacho: ${c.dia_despacho}`);
            console.log(`       filhos: ${JSON.stringify(c.codigos_filhos)}`);
        });
    }

    // 4. Também buscar Beatriz Depeder Lopes
    console.log('\n\n🔍 Beatriz Depeder Lopes (busca ampla)');
    console.log('─'.repeat(60));
    const { data: beatriz } = await supabase
        .from('ticto_pedidos')
        .select('customer_name, customer_email, customer_cpf, offer_name, product_name, order_date, status, order_id')
        .or('customer_name.ilike.%Depeder%,customer_name.ilike.%Beatriz%Lopes%');

    console.log(`  Resultados: ${beatriz?.length || 0}`);
    beatriz?.forEach(p => {
        console.log(`  ${p.customer_name} | ${p.customer_email} | ${p.offer_name} | data: ${p.order_date?.split('T')[0]} | status: ${p.status}`);
    });

    console.log('\n=== FIM ===');
}

main().catch(console.error);
