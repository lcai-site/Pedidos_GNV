import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cgyxinpejaoadsqrxbhy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc'
);

async function check() {
  const faltantes = ['TPC5D9E11203', 'TPP06081203E', 'TPC638491203', 'TPC1280BE120', 'TPC2B6AD1203', 'TPC1260B7120'];
  console.log('Verificando faltantes em ticto_logs...');
  
  for (const f of faltantes) {
      const { data: lf } = await supabase.from('ticto_logs')
          .select('id, status, error, created_at')
          .like('payload', `%${f}%`)
          .limit(1);
      
      console.log(`Faltante ${f} nos logs?`, lf?.length > 0 ? `SIM (${lf[0].status}) | ${lf[0].created_at}` : 'NAO');
  }

  const { data: recentLogs } = await supabase.from('ticto_logs')
    .select('status, error, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('\nÚltimos 5 webhooks recebidos:');
  recentLogs?.forEach(l => {
      console.log(`- ${l.created_at.slice(11,19)} | Status: ${l.status} | Erro: ${l.error?.slice(0,30) || 'Nenhum'}`);
  });
}

check().catch(console.error);
