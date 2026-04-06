import { createClient } from '@supabase/supabase-js';
import { getEnv } from './environments.mjs';

const prodEnv = getEnv('production');
const stagingEnv = getEnv('staging');

const prodSupabase = createClient(prodEnv.supabaseUrl, prodEnv.serviceKey);
const stagingSupabase = createClient(stagingEnv.supabaseUrl, stagingEnv.serviceKey);

async function syncCols() {
    console.log("Baixando 1 registro da PROD para ver o schema real...");
    const { data: prodData } = await prodSupabase.from('pedidos_consolidados_v3').select('*').limit(1);
    const { data: stgData } = await stagingSupabase.from('pedidos_consolidados_v3').select('*').limit(1);

    const prodKeys = Object.keys(prodData[0] || {});
    const stgKeys = Object.keys(stgData[0] || {});

    const missing = prodKeys.filter(k => !stgKeys.includes(k));
    console.log("Colunas faltando no STAGING:", missing);

    if (missing.length === 0) {
        console.log("Nenhuma coluna faltando.");
        return;
    }

    // Descobrir o tipo basico avaliando o valor em Prod
    let alters = [];
    for (const col of missing) {
        if (col === 'pv_observacao') alters.push(`ALTER TABLE pedidos_consolidados_v3 ADD COLUMN IF NOT EXISTS pv_observacao TEXT;`);
        if (col === 'data_entrega') alters.push(`ALTER TABLE pedidos_consolidados_v3 ADD COLUMN IF NOT EXISTS data_entrega TIMESTAMPTZ;`);
        if (col === 'pv_realizado') alters.push(`ALTER TABLE pedidos_consolidados_v3 ADD COLUMN IF NOT EXISTS pv_realizado BOOLEAN DEFAULT FALSE;`);
        if (col === 'pv_realizado_at') alters.push(`ALTER TABLE pedidos_consolidados_v3 ADD COLUMN IF NOT EXISTS pv_realizado_at TIMESTAMPTZ;`);
        // Add other common guesses
    }

    // Tentar um fallback se tiver mais mistérios
    for (const col of missing) {
        if (!alters.some(a => a.includes(col))) {
            alters.push(`ALTER TABLE pedidos_consolidados_v3 ADD COLUMN IF NOT EXISTS ${col} TEXT;`); // default text
        }
    }

    const sql = alters.join('\n');
    console.log("\nAplicando SQL no STAGING:\n", sql);

    const { error } = await stagingSupabase.rpc('exec_sql', { sql_text: sql });
    if (error) console.error("Erro ao aplicar ALTERS:", error);
    else {
        console.log("✅ Colunas recriadas com sucesso!");
        // Reload Postgrest
        await stagingSupabase.rpc('exec_sql', { sql_text: 'NOTIFY pgrst, "reload schema";' });
    }
}

syncCols();
