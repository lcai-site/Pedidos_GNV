import { createClient } from '@supabase/supabase-js';
import { getEnv } from './environments.mjs';

const env = getEnv('production');
const supabase = createClient(env.supabaseUrl, env.serviceKey);

async function checkTicto() {
    const { data: pedidos, error } = await supabase
        .from('ticto_pedidos')
        .select('transaction_hash, offer_name, product_name, order_date, customer_email, status')
        .ilike('customer_email', '%jessicacarolinajagasdasilva@gmail.com%')
        .order('order_date', { ascending: true });

    if (error) {
        console.error("Erro:", error);
        return;
    }

    console.log("\n=== PEDIDOS TICTO (JÉSSICA) ===");
    pedidos.forEach(p => {
        console.log(`Hash   : ${p.transaction_hash}`);
        console.log(`Data   : ${p.order_date}`);
        console.log(`Product: ${p.product_name}`);
        console.log(`Offer  : ${p.offer_name}`);
        console.log(`Status : ${p.status}`);
        console.log("------------------------------------------------");
    });
}

checkTicto();
