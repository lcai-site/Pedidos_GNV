import fetch from 'node-fetch';

const URL = "https://cgyxinpejaoadsqrxbhy.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA";

async function deepSearchDuplicates() {
    console.log("--- Analisando Duplicatas por Nome/Telefone para 17/03 ---");
    
    const resp = await fetch(`${URL}/rest/v1/pedidos_consolidados_v3?select=id,codigo_transacao,nome_cliente,telefone,cpf,data_venda&dia_despacho=eq.2026-03-17&status_envio=eq.Pendente`, {
        headers: { "apikey": ANON_KEY }
    });
    
    const data = await resp.json();
    
    // 1. Por Nome (Simples)
    const names = {};
    data.forEach(p => {
        const name = p.nome_cliente?.toLowerCase().trim();
        if (name) names[name] = (names[name] || []).concat(p);
    });
    
    console.log("\n--- Clientes com mesmo NOME hoje ---");
    Object.keys(names).forEach(name => {
        if (names[name].length > 1) {
            console.log(`Nome: ${name}`);
            names[name].forEach(p => console.log(`  - ${p.codigo_transacao} | CPF: ${p.cpf} | ID: ${p.id}`));
        }
    });

    // 2. Por Telefone
    const phones = {};
    data.forEach(p => {
        const phone = p.telefone?.replace(/\D/g, '');
        if (phone && phone.length > 8) phones[phone] = (phones[phone] || []).concat(p);
    });
    
    console.log("\n--- Clientes com mesmo TELEFONE hoje ---");
    Object.keys(phones).forEach(phone => {
        if (phones[phone].length > 1) {
            console.log(`Telefone: ${phone} (${phones[phone][0].nome_cliente})`);
            phones[phone].forEach(p => console.log(`  - ${p.codigo_transacao} | ID: ${p.id}`));
        }
    });
}

deepSearchDuplicates();
