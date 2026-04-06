import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cgyxinpejaoadsqrxbhy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc'
);

async function check() {
  const { data: ticto } = await supabase.from('ticto_pedidos')
    .select('transaction_hash, status, product_name, offer_name, created_at, order_id, order_date')
    .in('status', ['authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago'])
    .gte('order_date', '2026-03-12T00:00:00-03:00');

  const { data: cons } = await supabase.from('pedidos_consolidados_v3')
    .select('codigo_transacao')
    .gte('created_at', '2026-03-12T00:00:00-03:00');

  const consHashes = new Set(cons?.map(c => c.codigo_transacao) || []);

  const missing = ticto?.filter(t => !consHashes.has(t.transaction_hash));

  console.log('Total em ticto de hoje (status OK):', ticto?.length || 0);
  console.log('Total em consolidados:', cons?.length || 0);
  console.log('Faltando (pais e filhos):', missing?.length || 0);

  if (missing?.length > 0) {
      console.log('\nFaltantes (Amostra 20):');
      missing.slice(0,20).forEach(m => {
          let isPai = true;
          let pNameStr = m.product_name?.toUpperCase() || '';
          let oNameStr = m.offer_name?.toUpperCase().replace(/ /g, '') || '';
          
          if (oNameStr.includes('ORDERBUMP') || oNameStr.includes('UPSELL') || (m.offer_name?.toUpperCase() || '').includes('CC')) {
              isPai = false;
          }
          
          console.log(`- ${m.transaction_hash.slice(0,12)} | ${m.order_date.slice(11,19)} | PAI: ${isPai} | Prod: ${m.product_name.slice(0,10)}... | Offer: ${m.offer_name}`);
      });
  }
}

check().catch(console.error);
