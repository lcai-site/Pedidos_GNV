import fetch from 'node-fetch';

const URL = "https://cgyxinpejaoadsqrxbhy.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA";

async function verifyElaineCase() {
    console.log("--- Verificando Pedido da Elaine (status_date 17/03) ---");
    
    // Buscar o pedido consolidado da Elaine guimaraes (elaineguim369@gmail.com)
    const resp = await fetch(`${URL}/rest/v1/pedidos_consolidados_v3?email=eq.elaineguim369@gmail.com&select=*`, {
        headers: {
            "apikey": ANON_KEY,
            "Authorization": `Bearer ${ANON_KEY}`
        }
    });

    if (resp.ok) {
        const data = await resp.json();
        if (data.length > 0) {
            const order = data[0];
            console.log("Pedido encontrado:");
            console.log("- Data Venda (Original):", order.data_venda);
            console.log("- Dia Despacho Calculado:", order.dia_despacho);
            console.log("- Descrição Pacote:", order.descricao_pacote);
            
            const today = "2026-03-17";
            if (order.dia_despacho === today) {
                console.log("✅ SUCESSO: O dia de despacho foi corrigido para hoje!");
            } else {
                console.log("❌ FALHA: O dia de despacho ainda está incorreto:", order.dia_despacho);
            }
        } else {
            console.log("❌ Pedido não encontrado na tabela consolidada.");
        }
    } else {
        console.log("Erro ao buscar pedido:", await resp.text());
    }
}

verifyElaineCase();
