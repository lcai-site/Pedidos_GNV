import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cgyxinpejaoadsqrxbhy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA'
);

async function check() {
  // 1. Buscar qualquer registro com "XPTO"
  console.log('=== Buscando "XPTO" no banco ===');
  const { data: xpto } = await supabase
    .from('pedidos_consolidados_v3')
    .select('id, descricao_pacote, foi_editado, updated_at')
    .ilike('descricao_pacote', '%XPTO%');
  
  if (xpto?.length) {
    console.log(`✅ Encontrado ${xpto.length} registro(s) com XPTO:`);
    xpto.forEach(r => console.log(`  - ${r.id}: "${r.descricao_pacote}" (editado: ${r.foi_editado}, updated: ${r.updated_at})`));
  } else {
    console.log('❌ Nenhum registro com "XPTO" no banco');
  }

  // 2. Mostrar os 5 pedidos mais recentemente atualizados
  console.log('\n=== 5 pedidos atualizados mais recentemente ===');
  const { data: recent } = await supabase
    .from('pedidos_consolidados_v3')
    .select('id, descricao_pacote, foi_editado, updated_at')
    .order('updated_at', { ascending: false })
    .limit(5);

  recent?.forEach(r => {
    console.log(`  ${r.updated_at} | ${r.foi_editado ? '✏️' : '  '} | "${r.descricao_pacote}"`);
  });

  // 3. Verificar se a RPC existe
  console.log('\n=== Teste RPC rápido (dry run) ===');
  const { data, error } = await supabase.rpc('atualizar_descricao_pacote', {
    p_id: '00000000-0000-0000-0000-000000000000',
    p_descricao: 'teste'
  });
  console.log('RPC responde:', JSON.stringify(data), error ? `ERRO: ${error.message}` : '');
}

check();
