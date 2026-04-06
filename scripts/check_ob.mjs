import { createClient } from '@supabase/supabase-js';
import { getEnv } from './environments.mjs';

const env = getEnv('production');
const supabase = createClient(env.supabaseUrl, env.serviceKey);

async function check() {
    const { count: c1 } = await supabase.from('ticto_pedidos').select('*', { count: 'exact', head: true });
    const { count: c2 } = await supabase.from('pedidos_consolidados_v3').select('*', { count: 'exact', head: true });

    console.log(`ticto_pedidos: ${c1}`);
    console.log(`pedidos_consolidados_v3: ${c2}`);
}

check();
