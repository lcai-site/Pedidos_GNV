import fetch from 'node-fetch';

const URL = "https://cgyxinpejaoadsqrxbhy.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA";
const TARGET_DATE = "2026-03-17";

async function checkSales() {
    console.log(`--- Verificando Vendas em ${TARGET_DATE} ---`);
    
    // 1. Total em ticto_pedidos (Bruto)
    const rawResp = await fetch(`${URL}/rest/v1/ticto_pedidos?order_date=gte.${TARGET_DATE}T00:00:00&order_date=lt.${TARGET_DATE}T23:59:59&select=count`, {
        headers: {
            "apikey": ANON_KEY,
            "Authorization": `Bearer ${ANON_KEY}`,
            "Prefer": "count=exact"
        }
    });
    const rawCount = rawResp.headers.get('content-range')?.split('/')[1] || "0";
    console.log(`Total Bruto (ticto_pedidos): ${rawCount}`);

    // 2. Análise de Padrões em ticto_pedidos (Aprovados)
    const approvedResp = await fetch(`${URL}/rest/v1/ticto_pedidos?order_date=gte.${TARGET_DATE}T00:00:00&order_date=lt.${TARGET_DATE}T23:59:59&status=eq.Aprovado&select=product_name,offer_name,paid_amount`, {
        headers: {
            "apikey": ANON_KEY,
            "Authorization": `Bearer ${ANON_KEY}`
        }
    });
    const approvedData = await approvedResp.json();
    
    const productCounts = approvedData.reduce((acc, curr) => {
        acc[curr.product_name] = (acc[curr.product_name] || 0) + 1;
        return acc;
    }, {});
    console.log("Produtos (Aprovados):", JSON.stringify(productCounts, null, 2));

    const amountSummary = approvedData.map(o => o.paid_amount);
    console.log("Valores Pagos:", JSON.stringify(amountSummary, null, 2));

    const offerSummary = approvedData.slice(0, 10).map(o => `${o.product_name} | ${o.offer_name} | R$ ${o.paid_amount}`);
    console.log("Exemplos (Top 10):", JSON.stringify(offerSummary, null, 2));

    // 6. Simular Filtro de "Pedido Pai" da SQL
    const parentsData = approvedData.filter(p => {
        const offer = (p.offer_name || "").toUpperCase();
        const isBump = offer.includes("ORDERBUMP") || offer.includes("ORDER BUMP");
        const isUpsell = offer.includes("UPSELL");
        const isCC = offer.includes("CC");
        return !isBump && !isUpsell && !isCC;
    });

    console.log(`\nSimulação de Pedidos Pai (Sem Bump/Upsell/CC): ${parentsData.length}`);
    console.log("Candidatos a Pai (Aprovados):", JSON.stringify(parentsData.map(p => p.offer_name), null, 2));

    // 7. Inspecionar as 4 ordens consolidadas de 16/03
    const consDetailsResp = await fetch(`${URL}/rest/v1/pedidos_consolidados_v3?data_venda=gte.${TARGET_DATE}T00:00:00&data_venda=lt.${TARGET_DATE}T23:59:59&select=codigo_transacao,codigos_agrupados,codigos_filhos,descricao_pacote`, {
        headers: {
            "apikey": ANON_KEY,
            "Authorization": `Bearer ${ANON_KEY}`
        }
    });
    const consDetails = await consDetailsResp.json();
    console.log("Detalhes das 4 Consolidadas:", JSON.stringify(consDetails, null, 2));

    // 8. Tentar Trigger Consolidação (Opcional, se anon tiver permissão)
    console.log("\nTentando disparar consolidar_pedidos_ticto()...");
    const rpcResp = await fetch(`${URL}/rest/v1/rpc/consolidar_pedidos_ticto`, {
        method: "POST",
        headers: {
            "apikey": ANON_KEY,
            "Authorization": `Bearer ${ANON_KEY}`,
            "Content-Type": "application/json"
        }
    });
    if (rpcResp.ok) {
        const result = await rpcResp.json();
        console.log("Resultado RPC:", JSON.stringify(result, null, 2));
        
        // Re-verificar contagem
        const consolidatedCountFinal = await fetch(`${URL}/rest/v1/pedidos_consolidados_v3?data_venda=gte.${TARGET_DATE}T00:00:00&data_venda=lt.${TARGET_DATE}T23:59:59&select=count`, {
            headers: {
                "apikey": ANON_KEY,
                "Authorization": `Bearer ${ANON_KEY}`,
                "Prefer": "count=exact"
            }
        });
        const finalCount = consolidatedCountFinal.headers.get('content-range')?.split('/')[1] || "0";
        console.log(`\nTotal Consolidado APÓS RPC: ${finalCount}`);
    } else {
        console.log("Erro ao disparar RPC:", rpcResp.status, await rpcResp.text());
    }

    console.log("\n-------------------------------------------");
}

checkSales();
