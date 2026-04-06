import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cgyxinpejaoadsqrxbhy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkCodes() {
    const id = '80ff9a13-b293-42fc-995f-7632fbb3dfa7';
    const { data, error } = await supabase
        .from('pedidos_consolidados_v3')
        .select('id, codigo_transacao, codigos_agrupados, codigos_filhos')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('--- Order Details ---');
        console.log('ID:', data.id);
        console.log('Codigo Transacao:', data.codigo_transacao);
        console.log('Agrupados:', data.codigos_agrupados);
        console.log('Filhos:', data.codigos_filhos);
    }
}

checkCodes();
