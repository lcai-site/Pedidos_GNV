import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cgyxinpejaoadsqrxbhy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA'
);

async function test() {
  // Buscar um pedido que tem foi_editado=true (os que aparecem na tela do user)
  const { data: orders, error: fetchErr } = await supabase
    .from('pedidos_consolidados_v3')
    .select('id, descricao_pacote, foi_editado, codigo_rastreio')
    .eq('foi_editado', true)
    .is('codigo_rastreio', null)
    .limit(1);

  if (fetchErr) { console.error('Fetch error:', fetchErr); return; }
  if (!orders?.length) { console.log('Nenhum pedido editado sem rastreio'); return; }

  const order = orders[0];
  console.log('=== PEDIDO DE TESTE ===');
  console.log('ID:', order.id);
  console.log('descricao_pacote ATUAL:', order.descricao_pacote);
  console.log('foi_editado:', order.foi_editado);

  // Testar: salvar um valor temporário
  const testVal = order.descricao_pacote + ' [TEST-SAVE]';
  console.log('\n--- Chamando RPC atualizar_descricao_pacote ---');
  console.log('Novo valor:', testVal);
  
  const { data: rpcData, error: rpcErr } = await supabase.rpc('atualizar_descricao_pacote', {
    p_id: order.id,
    p_descricao: testVal
  });

  console.log('RPC data:', JSON.stringify(rpcData));
  console.log('RPC error:', rpcErr ? JSON.stringify(rpcErr) : 'null');

  // Verificar se persistiu
  const { data: after } = await supabase
    .from('pedidos_consolidados_v3')
    .select('descricao_pacote, foi_editado')
    .eq('id', order.id)
    .single();

  console.log('\n--- RESULTADO ---');
  console.log('Valor no banco DEPOIS:', after?.descricao_pacote);
  console.log('PERSISTIU?', after?.descricao_pacote === testVal ? '✅ SIM' : '❌ NÃO');

  // Reverter
  await supabase.rpc('atualizar_descricao_pacote', {
    p_id: order.id,
    p_descricao: order.descricao_pacote
  });
  console.log('\nRevertido para valor original.');

  // Agora testar consolidação: o valor editado é protegido?
  console.log('\n--- TESTE CONSOLIDAÇÃO ---');
  const testVal2 = 'TESTE MANUAL EDIT';
  await supabase.rpc('atualizar_descricao_pacote', {
    p_id: order.id,
    p_descricao: testVal2
  });

  // Verificar
  const { data: preConsolidar } = await supabase
    .from('pedidos_consolidados_v3')
    .select('descricao_pacote')
    .eq('id', order.id)
    .single();
  console.log('Antes de consolidar:', preConsolidar?.descricao_pacote);

  // Rodar consolidação
  console.log('Rodando consolidar_pedidos_ticto()...');
  const { data: consolResult, error: consolErr } = await supabase.rpc('consolidar_pedidos_ticto');
  console.log('Consolid. resultado:', JSON.stringify(consolResult));
  if (consolErr) console.log('Consolid. erro:', consolErr.message);

  // Verificar se manteve
  const { data: posConsolidar } = await supabase
    .from('pedidos_consolidados_v3')
    .select('descricao_pacote, foi_editado')
    .eq('id', order.id)
    .single();
  console.log('Depois de consolidar:', posConsolidar?.descricao_pacote);
  console.log('PROTEGIDO?', posConsolidar?.descricao_pacote === testVal2 ? '✅ SIM' : '❌ NÃO - FOI SOBRESCRITO!');

  // Reverter
  await supabase.rpc('atualizar_descricao_pacote', {
    p_id: order.id,
    p_descricao: order.descricao_pacote
  });
  console.log('\nRevertido para valor original:', order.descricao_pacote);
}

test();
