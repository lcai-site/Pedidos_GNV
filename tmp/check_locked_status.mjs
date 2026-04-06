import fetch from 'node-fetch';

const URL = "https://cgyxinpejaoadsqrxbhy.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA";

async function checkLockedStatus() {
    console.log("--- Verificando Status Raw de Pedidos Travados (17/03) ---");
    
    const resp = await fetch(`${URL}/rest/v1/pedidos_consolidados_v3?select=id,codigo_transacao,nome_cliente,foi_editado&dia_despacho=eq.2026-03-17&status_envio=eq.Pendente&foi_editado=eq.true`, {
        headers: { "apikey": ANON_KEY }
    });
    
    const data = await resp.json();
    console.log(`Pedidos travados hoje: ${data.length}`);
    
    for (const p of data) {
        const rawResp = await fetch(`${URL}/rest/v1/ticto_pedidos?select=id,status,transaction_hash&id=eq.${p.id}`, {
            headers: { "apikey": ANON_KEY }
        });
        const raw = await rawResp.json();
        
        if (raw.length === 0) {
            console.log(`[ALERTA] Pedido Consolidado sem correspondente no RAW! ID: ${p.id} | Nome: ${p.nome_cliente}`);
        } else {
            const status = raw[0].status;
            if (!['authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago'].includes(status)) {
                console.log(`[ALERTA] Pedido Consolidado TRAVADO tem status RAW: ${status}! ID: ${p.id} | Nome: ${p.nome_cliente}`);
            }
        }
    }
}

checkLockedStatus();
