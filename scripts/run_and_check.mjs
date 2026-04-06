import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cgyxinpejaoadsqrxbhy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function runConsolidation() {
    console.log('🚀 Rodando consolidar_pedidos_ticto()...');
    const { data, error } = await supabase.rpc('consolidar_pedidos_ticto');

    if (error) {
        console.error('❌ Erro:', error.message);
    } else {
        console.log('✅ Resultado:', JSON.stringify(data, null, 2));
    }
    
    // Check Fernanda again immediately after
    console.log('🔎 Verificando se TPP21EA1903UFZ9RIP apareceu na v3...');
    const { data: v3 } = await supabase.from('pedidos_consolidados_v3').select('*').eq('codigo_transacao', 'TPP21EA1903UFZ9RIP');
    console.log(v3 && v3.length > 0 ? '✅ APARECEU!' : '❌ CONTINUA SUMIDO.');
}

runConsolidation();
