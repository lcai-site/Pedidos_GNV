import { createClient } from '@supabase/supabase-js';

// Usar o Staging
const url = 'https://vkeshyusimduiwjaijjv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZXNoeXVzaW1kdWl3amFpamp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzU0NDk3NywiZXhwIjoyMDgzMTIwOTc3fQ.5HGMlM2WMTp9BYxSfPfo0YQQV5oy3ZPTWj0ZNHpZT8c';

const supabase = createClient(url, key);

async function checkErrors() {
    const { data, error } = await supabase
        .from('pedidos_consolidados_v3')
        .select('id, nome_cliente, observacao, updated_at')
        .not('observacao', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Erro na query:', error.message);
        return;
    }

    console.log('--- ÚLTIMOS ERROS REGISTRADOS NA GERAÇÃO DE ETIQUETAS (STAGING) ---');
    data.forEach(d => {
        console.log(`[${d.updated_at}] ${d.nome_cliente}:`);
        console.log(`  -> ${d.observacao}`);
    });
}

checkErrors();
