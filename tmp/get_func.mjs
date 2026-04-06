import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cgyxinpejaoadsqrxbhy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data, error } = await supabase.rpc('get_function_def', { func_name: 'consolidar_pedidos_ticto' });
  
  if (error) {
    console.log('Cant call get_function_def, will try raw query via an edge function or another way.');
    // fallback, let's just make a POST to the graphql or standard REST if we can't raw query pg_proc.
    // wait, we don't have direct SQL access without a password or service_role key, we only have anon key!
    console.log(error);
  } else {
    console.log(data);
  }
}

main();
