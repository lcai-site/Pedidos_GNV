import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cgyxinpejaoadsqrxbhy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function findHash() {
    const hash = 'TPP21EA1903UFZ9RIP';
    console.log(`🚀 Procurando hash ${hash} em codigos_agrupados de v3...`);
    
    const { data, error } = await supabase
        .from('pedidos_consolidados_v3')
        .select('id, email, cpf, codigos_agrupados')
        .contains('codigos_agrupados', [hash]);

    if (error) {
        console.error('Erro:', error.message);
    } else if (data && data.length > 0) {
        console.log(`✅ ENCONTRADO no ID ${data[0].id} (Email: ${data[0].email})`);
        console.log('Agrupados:', data[0].codigos_agrupados);
    } else {
        console.log('❌ Não encontrado em nenhum codigos_agrupados.');
    }
}

findHash();
