import { createClient } from '@supabase/supabase-js';
import { getEnv } from './environments.mjs';

const prodEnv = getEnv('production');
const stagingEnv = getEnv('staging');

const prodSupabase = createClient(prodEnv.supabaseUrl, prodEnv.serviceKey);
const stagingSupabase = createClient(stagingEnv.supabaseUrl, stagingEnv.serviceKey);

async function checkCols() {
    const { data: prodCols, error: e1 } = await prodSupabase.rpc('exec_sql', { sql_text: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pedidos_consolidados_v3';` });

    // We can't use exec_sql on prod if it doesn't exist. Prod might not have exec_sql.
}

checkCols();
