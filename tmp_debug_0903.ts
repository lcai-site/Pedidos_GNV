import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const hoje = new Date().toISOString().split('T')[0];

    console.log("Fetching orders with dia_despacho =", '2026-03-10');
    const { data: pedidos } = await supabase
        .from('pedidos_consolidados_v3')
        .select('codigos_agrupados')
        .eq('dia_despacho', '2026-03-10');

    if (!pedidos) {
        console.log("No orders found");
        return;
    }

    let allHashes: string[] = [];
    pedidos.forEach(p => {
        if (p.codigos_agrupados) {
            allHashes.push(...p.codigos_agrupados);
        }
    });

    const { data: rawOrders } = await supabase
        .from('ticto_pedidos')
        .select('order_date, offer_name, transaction_hash')
        .in('transaction_hash', allHashes);

    if (!rawOrders) return;

    console.log("All raw orders dates for 09:");
    rawOrders.forEach(o => {
        if (o.order_date.includes('-09T') || o.order_date.includes('-08T2') || o.order_date.includes('09/03')) {
            console.log(o.order_date, ' | ', o.offer_name, ' | ', o.transaction_hash);
        }
    });
}
check();
