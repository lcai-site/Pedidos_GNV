import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmail() {
  const email = 'tecdeenfermagemhannaoliveira@gmail.com';
  console.log(`Checking email: ${email}`);

  // Check ticto_pedidos
  const { data: ticto, error: errTicto } = await supabase
    .from('ticto_pedidos')
    .select('id, created_at, order_id, customer_name, customer_email, status, webhook_origin, metadata')
    .eq('customer_email', email);
    // .ilike('customer_email', `%${email}%`); // sometimes case is different or whitespace

  if (errTicto) console.error('Error fetching ticto_pedidos:', errTicto);
  else console.log('ticto_pedidos count:', ticto.length, ticto);

  // Check pedidos_consolidados_v3
  const { data: v3, error: errV3 } = await supabase
    .from('pedidos_consolidados_v3')
    .select('*')
    .eq('email', email);

  if (errV3) console.error('Error fetching v3:', errV3);
  else console.log('pedidos_consolidados_v3 count:', v3.length, v3);

  // Check crm_atendimentos (which also has email)
  const { data: crm, error: errCrm } = await supabase
    .from('crm_atendimentos')
    .select('*')
    .eq('email', email);

  if (errCrm) console.error('Error fetching CRM:', errCrm);
  else console.log('crm_atendimentos count:', crm.length);
  
  // also try case-insensitive check in ticto, just in case
  const { data: tictoIlike } = await supabase
    .from('ticto_pedidos')
    .select('id, customer_email')
    .ilike('customer_email', `%hannaoliveira%`);
  console.log('ilike search ticto_pedidos count:', tictoIlike?.length, tictoIlike);
}

checkEmail();
