/**
 * Gera SQL INSERTs para os registros de ticto_pedidos que falharam no sync via API.
 * Estes registros compartilham transaction_hash com outros (Order Bumps).
 * 
 * Output: arquivo SQL para rodar no SQL Editor do Staging.
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const PRODUCAO = {
    url: 'https://cgyxinpejaoadsqrxbhy.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc'
};

const STAGING = {
    url: 'https://vkeshyusimduiwjaijjv.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZXNoeXVzaW1kdWl3amFpamp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzU0NDk3NywiZXhwIjoyMDgzMTIwOTc3fQ.5HGMlM2WMTp9BYxSfPfo0YQQV5oy3ZPTWj0ZNHpZT8c'
};

function escapeSQL(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
    return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
    console.log('🔍 Identificando registros faltantes...\n');

    const prod = createClient(PRODUCAO.url, PRODUCAO.key);
    const staging = createClient(STAGING.url, STAGING.key);

    // Buscar todos os transaction_hash do staging
    const { data: stagingData } = await staging
        .from('ticto_pedidos')
        .select('transaction_hash, offer_code');

    const stagingKeys = new Set(
        stagingData.map(r => `${r.transaction_hash}__${r.offer_code}`)
    );

    // Buscar todos de produção
    const { data: prodData } = await prod
        .from('ticto_pedidos')
        .select('*');

    // Identificar faltantes
    const missing = prodData.filter(r =>
        !stagingKeys.has(`${r.transaction_hash}__${r.offer_code}`)
    );

    console.log(`📊 Staging: ${stagingData.length} registros`);
    console.log(`📊 Produção: ${prodData.length} registros`);
    console.log(`📊 Faltantes: ${missing.length} registros\n`);

    if (missing.length === 0) {
        console.log('✅ Tudo sincronizado!');
        return;
    }

    // Gerar SQL
    const columns = Object.keys(missing[0]).filter(k => k !== 'id');

    let sql = `-- ================================================================\n`;
    sql += `-- INSERT dos ${missing.length} registros faltantes (Order Bumps)\n`;
    sql += `-- Gerado em: ${new Date().toISOString()}\n`;
    sql += `-- ================================================================\n\n`;

    for (const row of missing) {
        const values = columns.map(col => escapeSQL(row[col]));
        sql += `INSERT INTO ticto_pedidos (${columns.join(', ')})\n`;
        sql += `VALUES (${values.join(', ')})\n`;
        sql += `ON CONFLICT (transaction_hash, offer_code) DO NOTHING;\n\n`;
    }

    sql += `-- Verificação\n`;
    sql += `SELECT count(*) as total FROM ticto_pedidos;\n`;

    const outPath = 'scripts/staging-missing-inserts.sql';
    writeFileSync(outPath, sql);
    console.log(`✅ SQL gerado: ${outPath}`);
    console.log(`   ${missing.length} INSERTs para ${columns.length} colunas`);
    console.log(`\n👉 Cole o conteúdo no SQL Editor do Staging e rode!`);
}

main().catch(console.error);
