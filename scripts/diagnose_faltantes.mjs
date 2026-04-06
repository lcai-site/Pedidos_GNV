/**
 * Diagnóstico: Buscar os 4 pedidos faltantes
 * Nomes que a Camila informou mas NÃO apareceram na consolidação
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://cgyxinpejaoadsqrxbhy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA'
);

const FALTANTES = [
    'Beatriz Depeder Lopes',
    'laercio Machado junior',
    'valdirene dos santos schuch',
    'Stephanie Palazon'
];

async function main() {
    console.log('=== BUSCANDO OS 4 PEDIDOS FALTANTES ===\n');

    for (const nome of FALTANTES) {
        console.log(`\n🔍 Buscando: "${nome}"`);
        console.log('─'.repeat(60));

        // 1. Buscar na ticto_pedidos (dados brutos)
        const { data: ticto, error: e1 } = await supabase
            .from('ticto_pedidos')
            .select('id, transaction_hash, order_id, product_name, offer_name, customer_name, customer_email, customer_cpf, order_date, status, payment_method')
            .ilike('customer_name', `%${nome.split(' ')[0]}%`)
            .order('order_date', { ascending: false })
            .limit(10);

        if (e1) { console.error('  Erro ticto:', e1.message); continue; }

        if (ticto.length === 0) {
            console.log('  ❌ NÃO encontrado na ticto_pedidos');
        } else {
            console.log(`  📋 Encontrado na ticto_pedidos: ${ticto.length} registro(s)`);
            ticto.forEach((p, i) => {
                const dateStr = p.order_date ? new Date(p.order_date).toISOString().split('T')[0] : 'N/A';
                console.log(`    ${i + 1}. Nome: ${p.customer_name}`);
                console.log(`       Produto: ${p.product_name}`);
                console.log(`       Oferta: ${p.offer_name}`);
                console.log(`       Data: ${dateStr}`);
                console.log(`       Status: ${p.status}`);
                console.log(`       Pagamento: ${p.payment_method}`);
                console.log(`       Hash: ${p.transaction_hash}`);
                console.log(`       Order ID: ${p.order_id}`);
                console.log(`       CPF: ${p.customer_cpf}`);

                // Verificar se a oferta é OB/Upsell/CC
                const norm = (p.offer_name || '').toUpperCase().replace(/ /g, '');
                if (norm.includes('ORDERBUMP')) console.log('       ⚠️ CLASSIFICADO COMO: Order Bump (filho)');
                if (norm.includes('UPSELL')) console.log('       ⚠️ CLASSIFICADO COMO: Upsell (filho)');
                if (norm.includes('CC')) console.log('       ⚠️ CLASSIFICADO COMO: Pós-Venda CC (filho)');
            });
        }

        // 2. Buscar na pedidos_consolidados_v3
        const { data: consolidados, error: e2 } = await supabase
            .from('pedidos_consolidados_v3')
            .select('id, codigo_transacao, descricao_pacote, nome_cliente, data_venda, dia_despacho, codigo_rastreio, status_envio, data_envio, codigos_filhos')
            .ilike('nome_cliente', `%${nome.split(' ')[0]}%`)
            .order('data_venda', { ascending: false })
            .limit(10);

        if (e2) { console.error('  Erro consolidados:', e2.message); continue; }

        if (consolidados.length === 0) {
            console.log('  ❌ NÃO encontrado na pedidos_consolidados_v3');
        } else {
            console.log(`\n  📦 Encontrado na consolidados: ${consolidados.length} registro(s)`);
            consolidados.forEach((c, i) => {
                const vendaStr = c.data_venda ? new Date(c.data_venda).toISOString().split('T')[0] : 'N/A';
                console.log(`    ${i + 1}. Nome: ${c.nome_cliente}`);
                console.log(`       Pacote: ${c.descricao_pacote}`);
                console.log(`       Venda: ${vendaStr}`);
                console.log(`       Despacho: ${c.dia_despacho}`);
                console.log(`       Rastreio: ${c.codigo_rastreio || 'N/A'}`);
                console.log(`       Status: ${c.status_envio}`);
                console.log(`       Data envio: ${c.data_envio || 'N/A'}`);
            });
        }
    }

    console.log('\n\n=== FIM DA BUSCA ===');
}

main().catch(console.error);
