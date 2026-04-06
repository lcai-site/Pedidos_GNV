import { createClient } from '@supabase/supabase-js';
import { getEnv } from './environments.mjs';

const prodEnv = getEnv('production');
const stagingEnv = getEnv('staging');

const prodSupabase = createClient(prodEnv.supabaseUrl, prodEnv.serviceKey);
const stagingSupabase = createClient(stagingEnv.supabaseUrl, stagingEnv.serviceKey);

async function fetchAllRecords(supabase, table) {
    let allData = [];
    let page = 0;
    const limit = 1000;
    while (true) {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .range(page * limit, (page + 1) * limit - 1);

        if (error) {
            console.error(`Erro buscando ${table}:`, error.message);
            throw error;
        }
        if (!data || data.length === 0) break;

        allData = allData.concat(data);
        if (data.length < limit) break;
        page++;
    }
    return allData;
}

async function insertRecordsInChunks(supabase, table, data) {
    // Apagar tudo primeiro
    console.log(`🧹 Limpando tabela ${table} no Staging...`);
    // Isso requer uma procedure 'exec_sql' ou permissão de TRUNCATE. 
    // Como estamos na service_role, um DELETE funciona para essas tabelas pequenas.
    const { error: delErr } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // hack para deletar tudo
    if (delErr) console.warn(`   Aviso ao limpar ${table}: ${delErr.message}`);

    if (data.length === 0) return;

    console.log(`🚀 Inserindo ${data.length} registros na ${table}...`);
    const chunkSize = 500;
    for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);

        const { error } = await supabase.from(table).insert(chunk);
        if (error) {
            console.error(`   ❌ Falha ao inserir lote ${i} - ${i + chunk.length}:`, error.message);
            throw error;
        }
        process.stdout.write(`   ... ${Math.min(i + chunkSize, data.length)} / ${data.length}\r`);
    }
    console.log(`\n✅ ${table} clonada com sucesso!`);
}

async function main() {
    console.log("=========================================");
    console.log("   CLONE DE DADOS: PROD -> STAGING       ");
    console.log("=========================================\n");

    try {
        const tables = ['feriados', 'ticto_pedidos', 'pedidos_consolidados_v3'];

        for (const table of tables) {
            console.log(`\n⏳ Baixando [${table}] da Produção...`);
            const records = await fetchAllRecords(prodSupabase, table);

            await insertRecordsInChunks(stagingSupabase, table, records);
        }

        console.log("\n🎉 TODOS OS DADOS CLONADOS PARA O AMBIENTE DE TESTES!");
        console.log("  ⚠️ Lembre-se: O código da aplicação (a 'estrutura') deve ser atualizado rodando:");
        console.log("  > node scripts/sync-staging.mjs\n");

    } catch (err) {
        console.error("\n💥 Erro Fatal:", err);
    }
}

main();
