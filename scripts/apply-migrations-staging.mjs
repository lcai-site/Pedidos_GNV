// ================================================================
// APPLY MIGRATIONS TO STAGING
// Execução: node scripts/apply-migrations-staging.mjs
// ================================================================

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ENVIRONMENTS } from './environments.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stagingEnv = ENVIRONMENTS.staging;
const client = createClient(stagingEnv.supabaseUrl, stagingEnv.serviceKey);

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const migrationsToApply = [
    '044_fix_ticto_logs_remaining.sql',
    '045_fix_transaction_hash_collision.sql',
    '047_fix_marcar_etiqueta_gerada.sql',
    '048_fix_pv_locked_parents.sql',
    '049_unificar_pedidos.sql'
];

async function applyMigrations() {
    console.log('═══════════════════════════════════════════════════');
    console.log('🔄 APLICANDO MIGRATIONS NO STAGING');
    console.log(`   Ambiente: ${stagingEnv.name} (${stagingEnv.supabaseUrl})`);
    console.log('═══════════════════════════════════════════════════\n');

    let successCount = 0;

    for (const filename of migrationsToApply) {
        const filePath = path.join(migrationsDir, filename);
        if (!fs.existsSync(filePath)) {
            console.error(`❌ Arquivo não encontrado: ${filename}`);
            continue;
        }

        const sql = fs.readFileSync(filePath, 'utf8');
        console.log(`⏳ Aplicando: ${filename}...`);

        try {
            // Usa o helper de query raw ou rpc genérico se disponível, ou tenta via REST se possível.
            // A forma mais segura de rodar DDL/SQL puro no Supabase via JS Client é usando a função postgres via psql,
            // ou usando uma extensão/função RPC caso exista.
            // Vamos testar se a API expõe um endpoint para queries cruas (normalmente não nativo).
            // A melhor alternativa nativa via client JS sem um query builder direto é via RPC 'exec_sql' se existir.

            const { data, error } = await client.rpc('run_sql', { sql_query: sql });

            if (error) {
                // Fallback para tentar query simples se for uma API que suporte.
                throw error;
            }

            console.log(`✅ Sucesso: ${filename}\n`);
            successCount++;
        } catch (error) {
            console.error(`❌ Erro ao aplicar ${filename}:`);
            console.error(error.message || error);
            console.log('\n--- Tentando via endpoint REST direto (PostgREST) ---');

            // Tentativa via fetch direto para o endpoint de graphql/pgmeta (Aviso: Pode falhar por política de segurança)
            try {
                const res = await fetch(`${stagingEnv.supabaseUrl}/rest/v1/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${stagingEnv.serviceKey}`,
                        'apikey': stagingEnv.serviceKey,
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({ query: sql })
                });
                if (res.ok) {
                    console.log(`✅ Sucesso (REST fallback): ${filename}\n`);
                    successCount++;
                } else {
                    console.error(`❌ Erro (REST fallback):`, await res.text());
                    console.warn('⚠️ Se todas as abordagens via API falharem, será necessário aplicar manualmente pelo SQL Editor do painel.');
                }
            } catch (e) {
                console.error('Falhou rest fallback', e);
            }
        }
    }

    console.log(`\n🏁 Processo concluído. Migrations com sucesso: ${successCount}/${migrationsToApply.length}`);
}

applyMigrations();
