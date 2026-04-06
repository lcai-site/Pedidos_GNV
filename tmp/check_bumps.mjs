import fetch from 'node-fetch';

const URL = "https://cgyxinpejaoadsqrxbhy.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA";

async function checkRange(startDate, endDate) {
    console.log(`--- Investigando de ${startDate} a ${endDate} ---`);
    
    // Checar consolidados usando data_venda
    const consResp = await fetch(`${URL}/rest/v1/pedidos_consolidados_v3?data_venda=gte.${startDate}T00:00:00&data_venda=lt.${endDate}T23:59:59&select=codigo_transacao,codigos_agrupados,order_bumps,descricao_pacote`, {
        headers: {
            "apikey": ANON_KEY,
            "Authorization": `Bearer ${ANON_KEY}`
        }
    });
    const consolidated = await consResp.json();
    if (Array.isArray(consolidated)) {
        console.log(`Total Consolidados: ${consolidated.length}`);
        
        consolidated.forEach(c => {
            const hasBumpsInArray = c.order_bumps && c.order_bumps.length > 0;
            const hasBumpInText = (c.descricao_pacote || "").toUpperCase().includes("BUMP");
            
            if (hasBumpsInArray || hasBumpInText) {
                console.log(`Pedido ${c.codigo_transacao}:`);
                console.log(`  - Bumps no Array: ${JSON.stringify(c.order_bumps)}`);
                console.log(`  - Descrição: "${c.descricao_pacote}"`);
                console.log(`  - Tem "BUMP" no texto? ${hasBumpInText}`);
            }
        });
    } else {
        console.log("Erro ao buscar consolidados:", consolidated);
    }
}

async function run() {
    await checkRange("2026-03-13", "2026-03-15");
}

run();
