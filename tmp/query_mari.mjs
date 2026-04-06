import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cgyxinpejaoadsqrxbhy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const email = 'mari_straiotto@yahoo.com.br'.toLowerCase();

  console.log('--- Buscando em ticto_pedidos ---');
  let { data: tictoData, error: tictoErr } = await supabase
    .from('ticto_pedidos')
    .select('*')
    .ilike('customer_email', `%${email}%`);
  
  if (tictoErr) {
    console.error('Erro em ticto customer_email:', tictoErr);
    // tentar cpf
    console.log('Tirando CPF de pedidos_consolidados_v3...');
  } else {
    console.log(`Encontrados ${tictoData?.length || 0} pedidos em ticto_pedidos.`);
    for (const p of (tictoData || [])) {
        console.log(p);
    }
  }

  console.log('\n--- Buscando em pedidos_consolidados_v3 ---');
  const { data: consData, error: consErr } = await supabase
    .from('pedidos_consolidados_v3')
    .select('*')
    .ilike('email', `%${email}%`);
  
  if (consErr) {
    console.error('Erro em consolidados:', consErr);
  } else {
    console.log(`Encontrados ${consData?.length || 0} pedidos em pedidos_consolidados_v3.`);
    for (const p of (consData || [])) {
        console.log(JSON.stringify(p, null, 2));
    }
    
    // IF we have a CPF, search by CPF in ticto_pedidos too
    if (consData && consData.length > 0) {
      const cpf = consData[0].cpf;
      console.log(`\n--- Buscando em ticto_pedidos por CPF ${cpf} ---`);
      const { data: tcpf, error: eCpf } = await supabase
        .from('ticto_pedidos')
        .select('*')
        .ilike('customer_document', `%${cpf}%`);
        
      if (!eCpf) {
        console.log(`Encontrados ${tcpf?.length || 0} pedidos em ticto_pedidos (via CPF).`);
        for (const p of (tcpf || [])) {
           console.log(JSON.stringify(p, null, 2));
        }
      }
    }
  }
}

main();
