import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cgyxinpejaoadsqrxbhy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function check() {
  console.log('--- BUSCANDO LOGS DO WEBHOOK MELHOR ENVIO ---');
  const { data: logs, error: logsError } = await supabase
    .from('ticto_logs')
    .select('*')
    .like('evento', 'webhook_me%')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (logsError) {
    console.error('Erro ao buscar logs:', logsError);
  } else {
    for (const log of logs) {
      console.log(`[${log.created_at}] ${log.evento} | sucesso: ${log.sucesso} | erro: ${log.erro}`);
      console.log('Payload:', JSON.stringify(log.payload, null, 2));
    }
  }

  console.log('\n--- BUSCANDO PEDIDOS COM MELHOR ENVIO PENDENTE ---');
  const { data: pedidos, error: pedidosError } = await supabase
    .from('pedidos_consolidados_v3')
    .select('id, codigo_rastreio, melhor_envio_id, status_envio, logistica_provider')
    .eq('logistica_provider', 'Melhor Envio')
    .order('created_at', { ascending: false })
    .limit(5);

  if (pedidosError) {
    console.error('Erro:', pedidosError);
    return;
  }
  
  console.log('Pedidos recentes:', pedidos);
}

check();
