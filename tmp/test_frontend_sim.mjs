import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cgyxinpejaoadsqrxbhy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA'
);

async function test() {
  // Simular exatamente o que o frontend faz
  const orderId = 'cd2125aa-68c6-46c6-9385-08f81d75ce7b';

  // 1. Buscar valor atual
  const { data: before } = await supabase
    .from('pedidos_consolidados_v3')
    .select('descricao_pacote')
    .eq('id', orderId)
    .single();
  console.log('ANTES:', before?.descricao_pacote);

  // 2. Chamar RPC exatamente como o frontend faz
  const newVal = 'TESTE FRONTEND SIM';
  console.log('Chamando RPC com:', newVal);
  
  const { data, error } = await supabase.rpc('atualizar_descricao_pacote', { 
    p_id: orderId, 
    p_descricao: newVal 
  });
  
  console.log('data:', JSON.stringify(data));
  console.log('error:', error);
  console.log('data?.status:', data?.status);
  console.log('data?.status === "error":', data?.status === 'error');

  // 3. Verificar IMEDIATAMENTE
  const { data: after } = await supabase
    .from('pedidos_consolidados_v3')
    .select('descricao_pacote')
    .eq('id', orderId)
    .single();
  console.log('DEPOIS:', after?.descricao_pacote);
  console.log('SALVOU?', after?.descricao_pacote === newVal ? '✅' : '❌');

  // 4. Reverter
  await supabase.rpc('atualizar_descricao_pacote', { 
    p_id: orderId, 
    p_descricao: before?.descricao_pacote 
  });
  console.log('Revertido.');
}

test();
