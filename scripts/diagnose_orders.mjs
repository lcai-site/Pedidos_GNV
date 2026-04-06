/**
 * Diagnostic script to analyze order distribution across Logistics tabs
 * Replicates the frontend categorization logic from Logistics.tsx
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cgyxinpejaoadsqrxbhy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Replicate the categorization logic from Logistics.tsx (lines 306-355)
function categorizeOrders(orders, refDateStr) {
    const refDate = new Date(refDateStr + 'T00:00:00');
    const result = { ready: [], labeled: [], waiting: [], pvDone: [] };

    for (const order of orders) {
        // 1. Already shipped (has data_envio)
        if (order.data_envio) {
            result.ready.push(order);
            continue;
        }

        // 2. Has label (codigo_rastreio) but not shipped
        if (order.codigo_rastreio && !order.data_envio) {
            result.labeled.push(order);
            continue;
        }

        // 3. Check dia_despacho
        if (order.dia_despacho) {
            const diaDespacho = new Date(order.dia_despacho + 'T00:00:00');

            if (diaDespacho <= refDate) {
                result.ready.push(order);
            } else if (order.pv_realizado) {
                result.pvDone.push(order);
            } else {
                result.waiting.push(order);
            }
        } else {
            // Fallback: use corte_pv or data_venda
            const cutoff = new Date(order.corte_pv || order.data_venda);
            const now = new Date();
            result.ready.push(order); // Simplified fallback
        }
    }

    return result;
}

async function main() {
    console.log('=== DIAGNÓSTICO DE PEDIDOS - LOGÍSTICA ===\n');

    // Fetch all orders (same as frontend)
    const { data: orders, error } = await supabase
        .from('pedidos_consolidados_v3')
        .select('id, codigo_transacao, descricao_pacote, nome_cliente, dia_despacho, data_envio, codigo_rastreio, status_envio, pv_realizado, pv_realizado_at, data_venda, produto_principal')
        .order('data_venda', { ascending: false })
        .limit(5000);

    if (error) {
        console.error('Erro ao buscar pedidos:', error.message);
        process.exit(1);
    }

    console.log(`Total de pedidos na tabela: ${orders.length}\n`);

    // Today's date as reference (same as default in Logistics.tsx)
    const today = new Date().toISOString().split('T')[0];
    console.log(`Data de referência (hoje): ${today}\n`);

    const categorized = categorizeOrders(orders, today);

    console.log('--- DISTRIBUIÇÃO POR ABA ---');
    console.log(`  ✅ Prontos para Envio: ${categorized.ready.length}`);
    console.log(`  🏷️  Etiqueta Gerada:   ${categorized.labeled.length}`);
    console.log(`  ⏳ Aguardando PV:      ${categorized.waiting.length}`);
    console.log(`  📋 PV Realizado:       ${categorized.pvDone.length}`);
    console.log(`  TOTAL:                 ${categorized.ready.length + categorized.labeled.length + categorized.waiting.length + categorized.pvDone.length}`);

    // Breakdown: Orders with dia_despacho = today
    const todayOrders = orders.filter(o => o.dia_despacho === today);
    console.log(`\n--- PEDIDOS COM dia_despacho = HOJE (${today}) ---`);
    console.log(`  Total: ${todayOrders.length}`);

    const todayWithLabel = todayOrders.filter(o => o.codigo_rastreio);
    const todayWithoutLabel = todayOrders.filter(o => !o.codigo_rastreio);
    const todayShipped = todayOrders.filter(o => o.data_envio);

    console.log(`  Com codigo_rastreio:   ${todayWithLabel.length}`);
    console.log(`  Sem codigo_rastreio:   ${todayWithoutLabel.length}`);
    console.log(`  Com data_envio:        ${todayShipped.length}`);

    // Orders that have dia_despacho <= today BUT went to labeled instead of ready
    const shouldBeReadyButLabeled = orders.filter(o => {
        if (!o.dia_despacho) return false;
        const dd = new Date(o.dia_despacho + 'T00:00:00');
        const ref = new Date(today + 'T00:00:00');
        return dd <= ref && o.codigo_rastreio && !o.data_envio;
    });

    console.log(`\n--- PEDIDOS QUE DEVERIAM ESTAR EM "PRONTOS" MAS ESTÃO EM "ETIQUETA GERADA" ---`);
    console.log(`  Total: ${shouldBeReadyButLabeled.length}`);
    if (shouldBeReadyButLabeled.length > 0) {
        shouldBeReadyButLabeled.forEach(o => {
            console.log(`  📦 ${o.descricao_pacote || 'N/A'} | ${o.nome_cliente || 'N/A'} | dia_despacho: ${o.dia_despacho} | rastreio: ${String(o.codigo_rastreio).substring(0, 20)}... | status: ${o.status_envio}`);
        });
    }

    // Orders with dia_despacho before today (backlog)
    const pastOrders = orders.filter(o => {
        if (!o.dia_despacho) return false;
        const dd = new Date(o.dia_despacho + 'T00:00:00');
        const ref = new Date(today + 'T00:00:00');
        return dd < ref && !o.data_envio && !o.codigo_rastreio;
    });

    console.log(`\n--- PEDIDOS ATRASADOS (dia_despacho < hoje, sem envio, sem rastreio) ---`);
    console.log(`  Total: ${pastOrders.length}`);
    if (pastOrders.length > 0) {
        pastOrders.forEach(o => {
            console.log(`  ⚠️ ${o.descricao_pacote || 'N/A'} | ${o.nome_cliente || 'N/A'} | dia_despacho: ${o.dia_despacho} | produto: ${o.produto_principal}`);
        });
    }

    // All labeled orders detail
    console.log(`\n--- DETALHE DOS PEDIDOS EM "ETIQUETA GERADA" ---`);
    categorized.labeled.forEach(o => {
        console.log(`  🏷️ ${o.descricao_pacote || 'N/A'} | ${o.nome_cliente || 'N/A'} | dia_despacho: ${o.dia_despacho} | rastreio: ${String(o.codigo_rastreio).substring(0, 30)} | status: ${o.status_envio}`);
    });

    // Ready orders breakdown by product type
    console.log(`\n--- PRONTOS POR TIPO DE PRODUTO ---`);
    const readyByProduct = {};
    categorized.ready.forEach(o => {
        const tipo = o.produto_principal || 'OUTRO';
        readyByProduct[tipo] = (readyByProduct[tipo] || 0) + 1;
    });
    Object.entries(readyByProduct).forEach(([tipo, count]) => {
        console.log(`  ${tipo}: ${count}`);
    });

    // Orders without dia_despacho
    const noDiaDespacho = orders.filter(o => !o.dia_despacho && !o.data_envio);
    console.log(`\n--- PEDIDOS SEM dia_despacho (fallback logic) ---`);
    console.log(`  Total: ${noDiaDespacho.length}`);
    if (noDiaDespacho.length > 0) {
        noDiaDespacho.forEach(o => {
            console.log(`  ❓ ${o.descricao_pacote || 'N/A'} | ${o.nome_cliente || 'N/A'} | data_venda: ${o.data_venda} | corte_pv: ${o.corte_pv}`);
        });
    }

    console.log('\n=== FIM DO DIAGNÓSTICO ===');
}

main().catch(console.error);
