/**
 * Investigação: Por que transaction_hash colide entre PAI e OB?
 * 
 * Hipótese: A Ticto envia o mesmo transaction_hash para o pai e seu OB.
 * O upsert ON CONFLICT(transaction_hash) sobrescreve um com o outro.
 * Se o OB chega DEPOIS do pai, o pai é sobrescrito e "desaparece".
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://cgyxinpejaoadsqrxbhy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA'
);

async function main() {
    console.log('=== INVESTIGAÇÃO: COLISÃO DE TRANSACTION_HASH ===\n');

    // 1. Ver os 4 pedidos que foram reenviados (agora são PAIs)
    // e verificar seus transaction_hash e payload_completo
    const cpfs = ['34963429861', '03925953035', '42967240885'];
    const names = ['laercio', 'valdirene', 'Stephanie'];

    for (let i = 0; i < cpfs.length; i++) {
        const { data } = await supabase
            .from('ticto_pedidos')
            .select('transaction_hash, order_id, order_hash, customer_name, offer_name, product_name, created_at, payload_completo')
            .eq('customer_cpf', cpfs[i])
            .order('created_at', { ascending: false });

        console.log(`\n🔍 ${names[i]} (CPF: ${cpfs[i]})`);
        console.log('─'.repeat(60));
        data?.forEach((p, j) => {
            const norm = (p.offer_name || '').toUpperCase();
            const tipo = norm.includes('ORDERBUMP') || norm.includes('ORDER BUMP') ? '👶 OB' : '👨 PAI';
            console.log(`  ${j + 1}. ${tipo} | ${p.customer_name} | ${p.offer_name}`);
            console.log(`     transaction_hash: ${p.transaction_hash}`);
            console.log(`     order_hash:       ${p.order_hash}`);
            console.log(`     order_id:         ${p.order_id}`);
            console.log(`     created_at:       ${p.created_at}`);

            // Verificar se no payload_completo temos mais info sobre os hashes
            if (p.payload_completo) {
                const pc = p.payload_completo;
                const order = pc.order || {};
                const transaction = pc.transaction || {};
                console.log(`     --- Payload bruto ---`);
                console.log(`     order.transaction_hash: ${order.transaction_hash || 'N/A'}`);
                console.log(`     order.hash:             ${order.hash || 'N/A'}`);
                console.log(`     order.id:               ${order.id || 'N/A'}`);
                console.log(`     transaction.hash:        ${transaction.hash || 'N/A'}`);
                console.log(`     item.offer_name:         ${pc.item?.offer_name || 'N/A'}`);
                console.log(`     offer.name:              ${pc.offer?.name || 'N/A'}`);
                console.log(`     commission_type:          ${pc.commission_type || 'N/A'}`);
            }
        });
    }

    // 2. Verificar padrão geral: existem outros casos onde order_id é compartilhado
    // entre registros com diferentes ofertas?
    console.log('\n\n=== VERIFICAÇÃO GERAL: PEDIDOS COM MESMO ORDER_ID ===\n');

    // Pegar pedidos recentes (últimos 3 dias) que têm order_id duplicado
    const { data: recentes } = await supabase
        .from('ticto_pedidos')
        .select('order_id, transaction_hash, customer_name, offer_name, created_at')
        .gte('order_date', '2026-02-18')
        .order('order_id', { ascending: true });

    // Agrupar por order_id
    const groups = {};
    recentes?.forEach(p => {
        if (!groups[p.order_id]) groups[p.order_id] = [];
        groups[p.order_id].push(p);
    });

    // Mostrar apenas order_ids com mais de 1 registro
    const duplicados = Object.entries(groups).filter(([_, items]) => items.length > 1);
    console.log(`Total order_ids com múltiplos registros: ${duplicados.length}`);

    duplicados.forEach(([oid, items]) => {
        console.log(`\n  order_id: ${oid} (${items.length} registros)`);
        items.forEach(p => {
            const hashShort = p.transaction_hash?.substring(0, 20) || 'N/A';
            console.log(`    ${hashShort}... | ${p.customer_name} | ${p.offer_name}`);
        });

        // Verificar se os hashes são iguais ou diferentes
        const hashes = new Set(items.map(p => p.transaction_hash));
        if (hashes.size === 1) {
            console.log(`    ⚠️ MESMO transaction_hash para todos! → COLISÃO`);
        } else {
            console.log(`    ✅ Hashes diferentes (${hashes.size}) → OK`);
        }
    });

    // 3. Verificar a Beatriz
    console.log('\n\n🔍 Beatriz Depeder Lopes:');
    const { data: beatriz } = await supabase
        .from('ticto_pedidos')
        .select('transaction_hash, order_id, order_hash, offer_name, payload_completo')
        .ilike('customer_name', '%depeder%');

    beatriz?.forEach(p => {
        console.log(`  transaction_hash: ${p.transaction_hash}`);
        console.log(`  order_id: ${p.order_id}`);
        console.log(`  order_hash: ${p.order_hash}`);
        console.log(`  offer_name: ${p.offer_name}`);
        if (p.payload_completo) {
            const order = p.payload_completo.order || {};
            console.log(`  order.transaction_hash: ${order.transaction_hash || 'N/A'}`);
            console.log(`  commission_type: ${p.payload_completo.commission_type || 'N/A'}`);
        }
    });

    console.log('\n=== FIM ===');
}

main().catch(console.error);
