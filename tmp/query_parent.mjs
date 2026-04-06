import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cgyxinpejaoadsqrxbhy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const hash = 'TPP97B32403DKW26ZVO';
  
  const { data } = await supabase
    .from('ticto_pedidos')
    .select('id, transaction_hash, offer_name')
    .eq('transaction_hash', hash);
  
  console.log('Parent in ticto_pedidos:', data);
}
main();
