import fetch from 'node-fetch';

const URL = "https://cgyxinpejaoadsqrxbhy.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA";

async function analyzeCustomer(email) {
    console.log(`\n--- Analisando Cliente: ${email} ---`);
    const resp = await fetch(`${URL}/rest/v1/ticto_pedidos?customer_email=eq.${email}&select=transaction_hash,order_id,product_name,offer_name,status,order_date,paid_amount`, {
        headers: {
            "apikey": ANON_KEY,
            "Authorization": `Bearer ${ANON_KEY}`
        }
    });
    const data = await resp.json();
    console.table(data);
    
    // Ver se tem consolidado para esses hashes
    for (const item of data) {
        const cResp = await fetch(`${URL}/rest/v1/pedidos_consolidados_v3?codigo_transacao=eq.${item.transaction_hash}&select=codigo_transacao,codigos_agrupados,descricao_pacote`, {
            headers: {
                "apikey": ANON_KEY,
                "Authorization": `Bearer ${ANON_KEY}`
            }
        });
        const cData = await cResp.json();
        if (cData.length > 0) {
            console.log(`Consolidado para ${item.transaction_hash}:`, JSON.stringify(cData[0], null, 2));
        } else {
            // Ver se ele é filho de alguém
            const fResp = await fetch(`${URL}/rest/v1/pedidos_consolidados_v3?codigos_agrupados=cs.{${item.transaction_hash}}&select=codigo_transacao,descricao_pacote`, {
                headers: {
                    "apikey": ANON_KEY,
                    "Authorization": `Bearer ${ANON_KEY}`
                }
            });
            const fData = await fResp.json();
            if (fData.length > 0) {
                console.log(`- Hash ${item.transaction_hash} encontrado como filho de ${fData[0].codigo_transacao} ("${fData[0].descricao_pacote}")`);
            } else {
                console.log(`- Hash ${item.transaction_hash} ÓRFÃO (não é pai nem filho)`);
            }
        }
    }
}

async function run() {
    // Pegar alguns emails de quem teve bump do script anterior
    const emailsResp = await fetch(`${URL}/rest/v1/ticto_pedidos?order_date=gte.2026-03-13T00:00:00&order_date=lt.2026-03-15T23:59:59&status=eq.Aprovado&select=customer_email,offer_name`, {
        headers: {
            "apikey": ANON_KEY,
            "Authorization": `Bearer ${ANON_KEY}`
        }
    });
    const data = await emailsResp.json();
    const bumpEmails = [...new Set(data.filter(p => (p.offer_name||"").toUpperCase().includes("BUMP")).map(p => p.customer_email))];
    
    console.log("Emails com Bumps encontrados:", bumpEmails);
    
    for (const email of bumpEmails.slice(0, 3)) {
        await analyzeCustomer(email);
    }
}

run();
