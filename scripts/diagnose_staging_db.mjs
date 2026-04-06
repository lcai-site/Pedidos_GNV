import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.development');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Testing proximo_dia_util on Staging DB...');
    const { data, error } = await supabase.rpc('proximo_dia_util', { data_base: '2026-03-06' });
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('proximo_dia_util result for 2026-03-06:', data);
    }

    // Also manually pull one order to see if we can get the error
    console.log('Checking recent consolidation error logs...');
    const { data: orders, error: oErr } = await supabase.from('pedidos_consolidados_v3').select('id, data_venda, dia_despacho').order('data_venda', { ascending: false }).limit(5);
    console.log('Recent orders:', orders);
}

run();
