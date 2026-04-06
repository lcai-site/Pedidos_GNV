import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cgyxinpejaoadsqrxbhy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkHash() {
    const hash = 'ee72e2d7-860e-421b-86c3-23e3fd7ca4e5'; // This was the ID, not hash.
    // Let's get the hash from raw first.
    const { data: raw } = await supabase.from('ticto_pedidos').select('transaction_hash').eq('id', 'ee72e2d7-860e-421b-86c3-23e3fd7ca4e5').single();
    
    if (raw) {
        console.log('Hash da Fernanda (19/03):', raw.transaction_hash);
        // Check if this hash is in v3
        const { data: v3 } = await supabase.from('pedidos_consolidados_v3').select('id').eq('codigo_transacao', raw.transaction_hash).single();
        console.log('Está na v3?', v3 ? 'SIM (ID: ' + v3.id + ')' : 'NÃO');
    }
}

checkHash();
