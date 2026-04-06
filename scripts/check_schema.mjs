import { createClient } from '@supabase/supabase-js';
import { getEnv } from './environments.mjs';

const env = getEnv('production');
const supabase = createClient(env.supabaseUrl, env.serviceKey);

async function checkSchema() {
    const { data, error } = await supabase.rpc('get_schema_columns');
    
    const { data: colsResult, error: colsErr } = await supabase.rpc('get_schema_columns');
    
    // Fallback: Run direct query if possible, or use the REST endpoint
    const { data: cols, error: colErr } = await supabase
        .from('ticto_pedidos')
        .select('*')
        .limit(1);

    // Let's use the management API to run a raw SQL query to get exact types
    const url = `https://api.supabase.com/v1/projects/${env.projectRef}/database/query`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
        body: JSON.stringify({ query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ticto_pedidos' OR table_name = '_processed';" })
    });
    
    console.log(await res.json());
}

checkSchema();
