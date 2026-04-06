import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cgyxinpejaoadsqrxbhy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA'
);

async function test() {
  // 1. Buscar um pedido qualquer com descricao_pacote
  const { data: orders, error: fetchErr } = await supabase
    .from('pedidos_consolidados_v3')
    .select('id, descricao_pacote, foi_editado')
    .not('descricao_pacote', 'is', null)
    .limit(1);

  if (fetchErr) {
    console.error('Erro ao buscar pedido:', fetchErr);
    return;
  }

  if (!orders || orders.length === 0) {
    console.log('Nenhum pedido encontrado');
    return;
  }

  const order = orders[0];
  console.log('=== PEDIDO ENCONTRADO ===');
  console.log('ID:', order.id);
  console.log('descricao_pacote ANTES:', order.descricao_pacote);
  console.log('foi_editado ANTES:', order.foi_editado);

  // 2. Testar a RPC com um valor temporário
  const testValue = order.descricao_pacote + ' [TEST]';
  console.log('\n=== CHAMANDO RPC atualizar_descricao_pacote ===');
  console.log('Novo valor:', testValue);

  const { data: rpcResult, error: rpcErr } = await supabase.rpc('atualizar_descricao_pacote', {
    p_id: order.id,
    p_descricao: testValue
  });

  console.log('RPC resultado:', JSON.stringify(rpcResult));
  if (rpcErr) {
    console.error('RPC erro:', rpcErr);
  }

  // 3. Verificar se persistiu
  const { data: after, error: afterErr } = await supabase
    .from('pedidos_consolidados_v3')
    .select('id, descricao_pacote, foi_editado')
    .eq('id', order.id)
    .single();

  if (afterErr) {
    console.error('Erro ao verificar:', afterErr);
    return;
  }

  console.log('\n=== VERIFICAÇÃO ===');
  console.log('descricao_pacote DEPOIS:', after.descricao_pacote);
  console.log('foi_editado DEPOIS:', after.foi_editado);
  console.log('PERSISTIU?', after.descricao_pacote === testValue ? '✅ SIM' : '❌ NÃO');

  // 4. Reverter para o valor original
  console.log('\n=== REVERTENDO ===');
  const { data: revertResult } = await supabase.rpc('atualizar_descricao_pacote', {
    p_id: order.id,
    p_descricao: order.descricao_pacote
  });
  console.log('Revert resultado:', JSON.stringify(revertResult));

  // 5. Confirmar reversão
  const { data: final } = await supabase
    .from('pedidos_consolidados_v3')
    .select('descricao_pacote')
    .eq('id', order.id)
    .single();
  console.log('Valor final:', final?.descricao_pacote);
  console.log('Revertido?', final?.descricao_pacote === order.descricao_pacote ? '✅ SIM' : '❌ NÃO');
}

test();
