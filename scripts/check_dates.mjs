import { createClient } from '@supabase/supabase-js';

const PROD = createClient(
  'https://cgyxinpejaoadsqrxbhy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA'
);
const STG = createClient(
  'https://vkeshyusimduiwjaijjv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZXNoeXVzaW1kdWl3amFpamp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NDQ5NzcsImV4cCI6MjA4MzEyMDk3N30.54dikLQBkzT2dBJzuupaVcK3_vlchWVI08TQ2cxCgJw'
);

// Verificar os extras do staging — existem em produção?
const stgExtras = [
  'TPC1260B7120', 'TPC3D3A01203', 'TPPCB0F1203F', 'TPC260561203', 'TPC2380B1203',
  'TPC2561B1203', 'TPPD83C1203J', 'TPC12FB5C120', 'TPC149F21203', 'TPC486EF1203',
  'TPC222FE1203', 'TPC19E031203', 'TPC120EA1203', 'TPPF1311203Z', 'TPC1AC111203',
  'TPC2B6AD1203', 'TPC1280BE120', 'TPC638491203', 'TPP06081203E', 'TPC5D9E11203',
];

// Buscar na produção por codigo_transacao
const { data: prodFound } = await PROD
  .from('pedidos_consolidados_v3')
  .select('codigo_transacao, data_venda, pv_realizado')
  .in('codigo_transacao', stgExtras);

console.log(`\nPedidos extras do staging encontrados em PRODUÇÃO: ${prodFound?.length || 0}/${stgExtras.length}`);
prodFound?.forEach(p => {
  console.log(`  ${p.codigo_transacao} | data_venda: ${p.data_venda} | pv_realizado: ${p.pv_realizado}`);
});
