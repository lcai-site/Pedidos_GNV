import { createClient } from '@supabase/supabase-js';

const PROD = {
    url: 'https://cgyxinpejaoadsqrxbhy.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc'
};

const STAGING = {
    url: 'https://vkeshyusimduiwjaijjv.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZXNoeXVzaW1kdWl3amFpamp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzU0NDk3NywiZXhwIjoyMDgzMTIwOTc3fQ.5HGMlM2WMTp9BYxSfPfo0YQQV5oy3ZPTWj0ZNHpZT8c'
};

async function checkDiff() {
    const prodSupa = createClient(PROD.url, PROD.key);
    const stgSupa = createClient(STAGING.url, STAGING.key);

    // 1. Contagem ticto_pedidos (hoje ou no geral)
    const { count: countProdTicto, error: e1 } = await prodSupa.from('ticto_pedidos').select('*', { count: 'exact', head: true });
    const { count: countStgTicto, error: e2 } = await stgSupa.from('ticto_pedidos').select('*', { count: 'exact', head: true });

    console.log(`=== TICTO PEDIDOS (RAW) ===`);
    console.log(`Produção: ${countProdTicto}`);
    console.log(`Staging:  ${countStgTicto}`);
    console.log(`Diferença: ${countProdTicto - countStgTicto}`);

    // 2. Contagem consolidados
    const { count: countProdCons, error: e3 } = await prodSupa.from('pedidos_consolidados_v3').select('*', { count: 'exact', head: true });
    const { count: countStgCons, error: e4 } = await stgSupa.from('pedidos_consolidados_v3').select('*', { count: 'exact', head: true });

    console.log(`\n=== PEDIDOS CONSOLIDADOS ===`);
    console.log(`Produção: ${countProdCons}`);
    console.log(`Staging:  ${countStgCons}`);
    console.log(`Diferença: ${countProdCons - countStgCons}`);

    // 3. Verificando o dia 04/03 especificamente
    const { data: p04, error: e5 } = await prodSupa.from('pedidos_consolidados_v3').select('id').gte('created_at', '2026-03-04').lt('created_at', '2026-03-05');
    const { data: s04, error: e6 } = await stgSupa.from('pedidos_consolidados_v3').select('id').gte('created_at', '2026-03-04').lt('created_at', '2026-03-05');

    console.log(`\n=== CRIADOS EM 04/03 ===`);
    console.log(`Produção: ${p04?.length || 0}`);
    console.log(`Staging:  ${s04?.length || 0}`);
}

checkDiff();
