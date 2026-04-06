import { createClient } from '@supabase/supabase-js';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getEnv } from './environments.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const OUTPUT_FILE = join(ROOT, '00_setup_teste_completo.sql');

const env = getEnv('production');
const supabase = createClient(env.supabaseUrl, env.serviceKey);

function escapeSqlValue(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number' || typeof val === 'boolean') return val;
    if (Array.isArray(val)) {
        if (val.length === 0) return "ARRAY[]::TEXT[]";
        const escaped = val.map(v => `'${String(v).replace(/'/g, "''")}'`);
        return `ARRAY[${escaped.join(',')}]::TEXT[]`;
    }
    if (typeof val === 'object') {
        return `'${JSON.stringify(val).replace(/'/g, "''")}'::JSONB`;
    }
    return `'${String(val).replace(/'/g, "''")}'`;
}

async function fetchAllRecords(table) {
    let allData = [];
    let page = 0;
    const limit = 1000;
    while (true) {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .range(page * limit, (page + 1) * limit - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allData = allData.concat(data);
        if (data.length < limit) break;
        page++;
    }
    return allData;
}

function generateInsertQuery(table, rows) {
    if (rows.length === 0) return '';
    let sql = `-- Inserindo ${rows.length} registros na tabela ${table}\n`;

    // Pegar chaves
    const keys = Object.keys(rows[0]);
    const cols = keys.map(k => `"${k}"`).join(', ');

    // Agrupar inserts em blocos de 100 para não estourar memoria do editor
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const values = chunk.map(row => {
            const vals = keys.map(k => escapeSqlValue(row[k])).join(', ');
            return `(${vals})`;
        }).join(',\n  ');

        sql += `INSERT INTO ${table} (${cols}) VALUES\n  ${values};\n\n`;
    }
    return sql;
}

async function main() {
    console.log("⏳ Lendo estrutura (migrations)...");
    const files = readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort((a, b) => {
            const numA = parseInt(a.split('_')[0], 10);
            const numB = parseInt(b.split('_')[0], 10);
            return numA - numB;
        });

    let combinedSql = `-- ==========================================\n`;
    combinedSql += `-- REPLICAÇÃO: PRODUÇÃO -> AMBIENTE DE TESTES\n`;
    combinedSql += `-- Gerado automaticamente (${new Date().toISOString()})\n`;
    combinedSql += `-- ==========================================\n\n`;

    // Concatena schema
    for (const file of files) {
        combinedSql += `-- ==========================================\n`;
        combinedSql += `-- SCHEMA: ${file}\n`;
        combinedSql += `-- ==========================================\n\n`;
        const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
        combinedSql += content + '\n\n';
    }

    console.log("⏳ Baixando dados da Production: ticto_pedidos...");
    const tictoPedidos = await fetchAllRecords('ticto_pedidos');

    console.log("⏳ Baixando dados da Production: pedidos_consolidados_v3...");
    const consolidados = await fetchAllRecords('pedidos_consolidados_v3');

    // Tabelas extras caso necessárias: feriados, etc.
    console.log("⏳ Baixando dados da Production: feriados...");
    const feriados = await fetchAllRecords('feriados');

    combinedSql += `-- ==========================================\n`;
    combinedSql += `-- DADOS DE PRODUÇÃO (BACKUP / CLONE)\n`;
    combinedSql += `-- ==========================================\n\n`;

    combinedSql += `TRUNCATE TABLE ticto_pedidos CASCADE;\n`;
    combinedSql += `TRUNCATE TABLE pedidos_consolidados_v3 CASCADE;\n`;
    combinedSql += `TRUNCATE TABLE feriados CASCADE;\n\n`;

    combinedSql += generateInsertQuery('feriados', feriados);
    combinedSql += generateInsertQuery('ticto_pedidos', tictoPedidos);
    combinedSql += generateInsertQuery('pedidos_consolidados_v3', consolidados);

    writeFileSync(OUTPUT_FILE, combinedSql, 'utf8');
    console.log(`✅ ARQUIVO ÚNICO CONCLUÍDO! Salvo em: ${OUTPUT_FILE}`);
    console.log(`Tamanho final aproximado: ${(combinedSql.length / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(err => console.error("Erro fatal:", err));
