import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cgyxinpejaoadsqrxbhy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkFernanda() {
    const cpf = '04156520226';
    console.log(`🚀 Buscando pedidos para o CPF ${cpf} em Produção...`);
    
    // Check ticto_pedidos (source)
    const { data: raw, error: e1 } = await supabase
        .from('ticto_pedidos')
        .select('*')
        .ilike('customer_cpf', `%${cpf}%`);

    if (e1) console.error('Error ticto:', e1.message);
    else console.log(`Encontrados ${raw.length} pedidos na ticto_pedidos.`);

    // Check pedidos_consolidados_v3 (target)
    const { data: consolidated, error: e2 } = await supabase
        .from('pedidos_consolidados_v3')
        .select('*')
        .ilike('cpf', `%${cpf}%`);

    if (e2) console.error('Error v3:', e2.message);
    else console.log(`Encontrados ${consolidated.length} pedidos na v3.`);

    console.log('--- DETALHES TICTO ---');
    raw?.forEach(r => console.log(`ID: ${r.id}, Email: ${r.customer_email}, Status: ${r.status}, Data: ${r.order_date}`));
    
    console.log('--- DETALHES V3 ---');
    consolidated?.forEach(c => console.log(`ID: ${c.id}, Email: ${c.email}, Status: ${c.status_aprovacao}, Rastréio: ${c.codigo_rastreio}, Editado: ${c.foi_editado}`));
}

checkFernanda();
