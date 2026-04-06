import fetch from 'node-fetch';

const URL = "https://cgyxinpejaoadsqrxbhy.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA";

async function analyzeAnomalies() {
    console.log("--- Analisando Anomalias para 17/03 ---");
    
    const resp = await fetch(`${URL}/rest/v1/pedidos_consolidados_v3?select=id,codigo_transacao,nome_cliente,cpf,data_venda,dia_despacho&dia_despacho=eq.2026-03-17&status_envio=eq.Pendente`, {
        headers: { "apikey": ANON_KEY }
    });
    
    const data = await resp.json();
    
    // 1. Checar por CPF repetido
    const cpfs = {};
    data.forEach(p => {
        const doc = p.cpf?.replace(/\D/g, '');
        if (doc) cpfs[doc] = (cpfs[doc] || []).concat(p);
    });
    
    console.log("\n--- Clientes com mais de 1 pedido hoje ---");
    Object.keys(cpfs).forEach(doc => {
        if (cpfs[doc].length > 1) {
            console.log(`CPF: ${doc} (${cpfs[doc][0].nome_cliente})`);
            cpfs[doc].forEach(p => console.log(`  - ${p.codigo_transacao} | ${p.data_venda} | ${p.id}`));
        }
    });

    // 2. Checar por data de venda "recente" (16 ou 17)
    console.log("\n--- Pedidos de ontem/hoje saindo hoje ---");
    data.forEach(p => {
        const dataVenda = p.data_venda.split('T')[0];
        if (dataVenda === '2026-03-16' || dataVenda === '2026-03-17') {
            console.log(`Recent: ${p.nome_cliente} | Venda: ${p.data_venda} | ID: ${p.id}`);
        }
    });
}

analyzeAnomalies();
