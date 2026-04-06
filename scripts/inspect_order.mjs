import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cgyxinpejaoadsqrxbhy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function inspectOrder() {
    const hash = 'TPP21EA1903UFZ9RIP';
    const { data, error } = await supabase
        .from('ticto_pedidos')
        .select('*')
        .eq('transaction_hash', hash)
        .single();

    if (error) {
        console.error('Erro:', error.message);
    } else {
        console.log('--- Raw Order Details ---');
        console.log('ID:', data.id);
        console.log('Offer Name:', data.offer_name);
        console.log('Product Name:', data.product_name);
        console.log('Status:', data.status);
        console.log('Order Date:', data.order_date);
    }
}

inspectOrder();
