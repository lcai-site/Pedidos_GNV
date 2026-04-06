import fetch from 'node-fetch';

const URL = "https://cgyxinpejaoadsqrxbhy.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA";

async function measureConsolidation() {
    console.log("--- Medindo Performance da Consolidação ---");
    
    const start = Date.now();
    const rpcResp = await fetch(`${URL}/rest/v1/rpc/consolidar_pedidos_ticto`, {
        method: "POST",
        headers: {
            "apikey": ANON_KEY,
            "Authorization": `Bearer ${ANON_KEY}`,
            "Content-Type": "application/json"
        }
    });
    const end = Date.now();
    
    console.log(`Tempo total: ${(end - start) / 1000}s`);
    
    if (rpcResp.ok) {
        const result = await rpcResp.json();
        console.log("Resultado:", JSON.stringify(result, null, 2));
    } else {
        console.log("Erro:", rpcResp.status, await rpcResp.text());
    }

    // Checar volume total
    const rawCountResp = await fetch(`${URL}/rest/v1/ticto_pedidos?select=count`, {
        headers: { "apikey": ANON_KEY, "Prefer": "count=exact" }
    });
    console.log("Total ticto_pedidos:", rawCountResp.headers.get('content-range')?.split('/')[1]);

    const consCountResp = await fetch(`${URL}/rest/v1/pedidos_consolidados_v3?select=count`, {
        headers: { "apikey": ANON_KEY, "Prefer": "count=exact" }
    });
    console.log("Total pedidos_consolidados_v3:", consCountResp.headers.get('content-range')?.split('/')[1]);
}

measureConsolidation();
