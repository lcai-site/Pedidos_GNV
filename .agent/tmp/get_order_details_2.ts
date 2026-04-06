import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const { data, error } = await supabase
    .from('ticto_pedidos')
    .select('id, status, offer_name, product_name, customer_email, item_quantity, order_id, order_date')
    .eq('id', '1631d600-f326-464d-be91-87423a4d06f7');

  if (error) console.error(error);
  else console.dir(data, { depth: null });
}

run();
