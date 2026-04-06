import fetch from 'node-fetch';

const URL = "https://cgyxinpejaoadsqrxbhy.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA";

async function checkTodayShipments() {
    console.log("--- Analisando Envios para 17/03 ---");
    
    // Buscar pedidos com dia_despacho = 17/03 e status Pendente
    const resp = await fetch(`${URL}/rest/v1/pedidos_consolidados_v3?select=id,codigo_transacao,nome_cliente,data_venda,descricao_pacote,dia_despacho,status_envio&dia_despacho=eq.2026-03-17&status_envio=eq.Pendente`, {
        headers: { "apikey": ANON_KEY }
    });
    
    const data = await resp.json();
    console.log(`Total encontrado: ${data.length}`);
    
    // Procurar por duplicatas ou anomalias
    const duplicates = data.reduce((acc, curr) => {
        acc[curr.codigo_transacao] = (acc[curr.codigo_transacao] || 0) + 1;
        return acc;
    }, {});
    
    Object.keys(duplicates).forEach(hash => {
        if (duplicates[hash] > 1) {
            console.log(`DUPLICATA ENCONTRADA: ${hash} (${duplicates[hash]} vezes)`);
        }
    });

    // Listar as 5 primeiras e as 5 últimas para ter uma ideia
    console.log("Exemplos (Início):");
    console.table(data.slice(0, 5));
    console.log("Exemplos (Fim):");
    console.table(data.slice(-5));
}

checkTodayShipments();
