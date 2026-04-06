import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const { data, error } = await supabase
    .from('ticto_pedidos')
    .select('*')
    .eq('id', '3bca970c-6cf4-4c8f-ba14-7cf2eb2fcb11');

  if (error) console.error(error);
  else console.dir(data, { depth: null });
}

run();
