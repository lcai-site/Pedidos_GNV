/**
 * Deploy SQL migration para Staging ou Produção.
 * 
 * Uso:
 *   node scripts/deploy-migration.mjs staging supabase/migrations/047_example.sql
 *   node scripts/deploy-migration.mjs production supabase/migrations/047_example.sql
 *   node scripts/deploy-migration.mjs staging --all   (aplica todas pendentes)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { basename } from 'path';
import { getEnv } from './environments.mjs';

const envName = process.argv[2];
const target = process.argv[3];

if (!envName || !target) {
    console.log('Uso: node scripts/deploy-migration.mjs <staging|production> <arquivo.sql|--all>');
    console.log('  Exemplos:');
    console.log('    node scripts/deploy-migration.mjs staging supabase/migrations/047_example.sql');
    console.log('    node scripts/deploy-migration.mjs staging --all');
    process.exit(1);
}

const env = getEnv(envName);

if (envName === 'production') {
    console.log('\n⚠️  ATENÇÃO: Você está aplicando em PRODUÇÃO!');
    console.log('   Certifique-se de que esta migration já foi testada no staging.');
    console.log('   Pressione Ctrl+C para cancelar ou aguarde 3 segundos...\n');
    await new Promise(r => setTimeout(r, 3000));
}

const supabase = createClient(env.supabaseUrl, env.serviceKey);

async function executeSql(sql, fileName) {
    console.log(`\n📄 Aplicando: ${fileName}`);

    const { data, error } = await supabase.rpc('exec_sql', { sql_text: sql });

    if (error) {
        // Se exec_sql não existe, informar o usuário
        if (error.message.includes('exec_sql')) {
            console.log('   ⚠️  Função exec_sql não existe neste projeto.');
            console.log('   📋 Copie o SQL abaixo e cole no SQL Editor do Dashboard:');
            console.log('   ─────────────────────────────────────────────');
            console.log(`   Arquivo: ${fileName}`);
            console.log(`   Ambiente: ${env.name}`);
            console.log(`   Dashboard: ${env.supabaseUrl.replace('.co', '.co')}/project/${env.projectRef}/sql`);
            console.log('   ─────────────────────────────────────────────\n');
            console.log(sql.slice(0, 500) + (sql.length > 500 ? '\n   ...(truncado, veja o arquivo completo)' : ''));
            return false;
        }
        console.log(`   ❌ Erro: ${error.message}`);
        return false;
    }

    console.log(`   ✅ Aplicada com sucesso em ${env.name}`);
    return true;
}

async function getAppliedMigrations() {
    const { data, error } = await supabase
        .from('schema_migrations')
        .select('version');

    if (error) return new Set();
    return new Set(data.map(r => r.version));
}

async function main() {
    console.log(`🚀 Deploy de Migration → ${env.name}`);
    console.log(`   URL: ${env.supabaseUrl}\n`);

    if (target === '--all') {
        const migrationsDir = 'supabase/migrations';
        const files = readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        console.log(`📁 Encontradas ${files.length} migrations`);

        let applied = 0;
        let failed = 0;

        for (const file of files) {
            const sql = readFileSync(`${migrationsDir}/${file}`, 'utf-8');
            const ok = await executeSql(sql, file);
            if (ok) applied++;
            else failed++;
        }

        console.log(`\n📋 Resultado: ${applied} aplicadas, ${failed} falharam`);
    } else {
        const sql = readFileSync(target, 'utf-8');
        await executeSql(sql, basename(target));
    }
}

main().catch(err => {
    console.error('💥 Erro fatal:', err.message);
    process.exit(1);
});
