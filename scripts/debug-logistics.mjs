import { createClient } from '@supabase/supabase-js';

const sb = createClient(
    'https://cgyxinpejaoadsqrxbhy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA'
);

// Bug 1: Verificar quantos pedidos existem para despacho em 20/02/2026
const { data: allOrders, error: err1 } = await sb
    .from('pedidos_consolidados_v3')
    .select('id, dia_despacho, data_envio, descricao_pacote, codigo_rastreio, status_envio, data_venda, pv_realizado')
    .order('data_venda', { ascending: false })
    .limit(5000);

if (err1) { console.log('ERR', err1); process.exit(1); }

const today = '2026-02-20';
const totalOrders = allOrders.length;

// Count by dia_despacho
const byDate = new Map();
allOrders.forEach(o => {
    const dd = o.dia_despacho ? o.dia_despacho.split('T')[0] : '(null)';
    byDate.set(dd, (byDate.get(dd) || 0) + 1);
});

console.log('=== DIAGNÓSTICO: CONTAGEM DE PEDIDOS ===');
console.log('Total pedidos no banco:', totalOrders);
console.log('');
console.log('Pedidos por dia_despacho:');
[...byDate.entries()].sort().forEach(([d, c]) => console.log('  ' + d + ': ' + c + ' pedidos'));

// Simulate the categorization logic
const todayOrders = allOrders.filter(o => {
    const dd = o.dia_despacho ? o.dia_despacho.split('T')[0] : null;
    return dd && dd <= today;
});

const readyNoSent = todayOrders.filter(o => !o.data_envio && !o.codigo_rastreio);
const labeled = allOrders.filter(o => o.codigo_rastreio && !o.data_envio);
const sent = todayOrders.filter(o => o.data_envio);

console.log('');
console.log('=== SIMULAÇÃO DA CATEGORIZAÇÃO (data ref: ' + today + ') ===');
console.log('Prontos para envio (dia_despacho <= hoje, sem envio, sem etiqueta):', readyNoSent.length);
console.log('Já enviados (com data_envio):', sent.length);
console.log('Com etiqueta (codigo_rastreio preenchido, sem data_envio):', labeled.length);
console.log('Total na aba "ready" seria:', readyNoSent.length + sent.length);
console.log('');

// Check for orders where dia_despacho IS today but they are NOT showing
const todayExact = allOrders.filter(o => {
    const dd = o.dia_despacho ? o.dia_despacho.split('T')[0] : null;
    return dd === today;
});
console.log('=== PEDIDOS COM dia_despacho = HOJE (' + today + ') ===');
console.log('Total:', todayExact.length);
todayExact.forEach(o => {
    console.log('  ID:', o.id?.substring(0, 8), '| Pacote:', o.descricao_pacote, '| Envio:', o.data_envio || '(pendente)', '| Rastreio:', o.codigo_rastreio || '(sem)', '| PV:', o.pv_realizado);
});

// Check for null dia_despacho orders
const nullDespacho = allOrders.filter(o => !o.dia_despacho && !o.data_envio);
console.log('');
console.log('=== PEDIDOS SEM dia_despacho (e sem envio) ===');
console.log('Total:', nullDespacho.length);
nullDespacho.forEach(o => {
    console.log('  ID:', o.id?.substring(0, 8), '| Pacote:', o.descricao_pacote, '| Status envio:', o.status_envio, '| Data venda:', o.data_venda);
});

// Bug 2: Check if codigo_rastreio = 'MANUAL' orders exist
const manualLabeled = allOrders.filter(o => o.codigo_rastreio === 'MANUAL');
console.log('');
console.log('=== PEDIDOS COM codigo_rastreio = MANUAL ===');
console.log('Total:', manualLabeled.length);
manualLabeled.forEach(o => {
    console.log('  ID:', o.id?.substring(0, 8), '| Pacote:', o.descricao_pacote, '| Status:', o.status_envio, '| dia_despacho:', o.dia_despacho);
});
