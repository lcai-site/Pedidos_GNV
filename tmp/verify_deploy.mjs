import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cgyxinpejaoadsqrxbhy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA'
);

async function verify() {
  console.log('=== VERIFICAÇÃO DO DEPLOY ===\n');

  // 1. Verificar coluna plataforma em ticto_pedidos
  console.log('1️⃣  Coluna plataforma em ticto_pedidos...');
  const { data: tp, error: tpErr } = await supabase
    .from('ticto_pedidos')
    .select('plataforma')
    .limit(1);
  
  if (tpErr) {
    console.log('   ❌ Erro:', tpErr.message);
  } else {
    console.log('   ✅ Coluna existe! Valor:', tp?.[0]?.plataforma || '(sem registros)');
  }

  // 2. Verificar coluna plataforma em pedidos_consolidados_v3
  console.log('\n2️⃣  Coluna plataforma em pedidos_consolidados_v3...');
  const { data: pc, error: pcErr } = await supabase
    .from('pedidos_consolidados_v3')
    .select('plataforma')
    .limit(1);
  
  if (pcErr) {
    console.log('   ❌ Erro:', pcErr.message);
  } else {
    console.log('   ✅ Coluna existe! Valor:', pc?.[0]?.plataforma || '(sem registros)');
  }

  // 3. Verificar distribuição
  console.log('\n3️⃣  Distribuição por plataforma em ticto_pedidos...');
  const { data: dist } = await supabase
    .from('ticto_pedidos')
    .select('plataforma')
    .limit(500);
  
  if (dist) {
    const counts = {};
    dist.forEach(r => { counts[r.plataforma || 'null'] = (counts[r.plataforma || 'null'] || 0) + 1; });
    Object.entries(counts).forEach(([k, v]) => console.log(`   ${k}: ${v} registros`));
  }

  // 4. Testar Edge Function webhook-viralmart (health check)
  console.log('\n4️⃣  Edge Function webhook-viralmart...');
  try {
    const res = await fetch('https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/webhook-viralmart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });
    const body = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Response:`, JSON.stringify(body));
    if (res.status === 400 && body.error?.includes('tid')) {
      console.log('   ✅ Função está rodando! (erro esperado: payload sem tid)');
    } else if (res.status === 404) {
      console.log('   ❌ Função NÃO encontrada (404). Verifique o deploy.');
    } else {
      console.log('   ℹ️  Resposta inesperada, mas a função respondeu.');
    }
  } catch (e) {
    console.log('   ❌ Erro de rede:', e.message);
  }

  // 5. Verificar fix do foi_editado
  console.log('\n5️⃣  Pedidos editados protegidos (fix descricao_pacote)...');
  const { data: editados } = await supabase
    .from('pedidos_consolidados_v3')
    .select('id, descricao_pacote, foi_editado')
    .eq('foi_editado', true)
    .is('codigo_rastreio', null)
    .limit(3);
  
  console.log(`   ${editados?.length || 0} pedidos editados sem rastreio (protegidos pelo fix)`);

  console.log('\n=== FIM DA VERIFICAÇÃO ===');
}

verify();
