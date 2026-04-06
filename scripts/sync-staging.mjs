/**
 * sync-staging.mjs
 * Aplica TODAS as migrations de supabase/migrations/ no ambiente de STAGING,
 * na ordem correta, usando a API REST do Supabase (service key).
 * 
 * Uso:
 *   node scripts/sync-staging.mjs
 *   node scripts/sync-staging.mjs --dry-run   (mostra quais seriam aplicadas)
 *   node scripts/sync-staging.mjs --from 048  (aplica a partir da migration 048)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const isDryRun = process.argv.includes('--dry-run');
const fromArg = process.argv.find(a => a.startsWith('--from'));
const fromNum = fromArg ? parseInt(fromArg.split('=')[1] || process.argv[process.argv.indexOf(fromArg) + 1], 10) : 0;

// ─── Credenciais ──────────────────────────────────────────────────────────────
const STAGING = {
    url: 'https://vkeshyusimduiwjaijjv.supabase.co',
    serviceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZXNoeXVzaW1kdWl3amFpamp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzU0NDk3NywiZXhwIjoyMDgzMTIwOTc3fQ.5HGMlM2WMTp9BYxSfPfo0YQQV5oy3ZPTWj0ZNHpZT8c',
    projectRef: 'vkeshyusimduiwjaijjv',
};

// ─── Supabase client (service role) ────────────────────────────────────────
const supabase = createClient(STAGING.url, STAGING.serviceKey, {
    auth: { persistSession: false }
});

// ─── Helper: executar SQL via Management API ────────────────────────────────
// A Management API do Supabase permite executar SQL direto no banco.
async function executeSqlViaAPI(sql, fileName) {
    const url = `https://api.supabase.com/v1/projects/${STAGING.projectRef}/database/query`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${STAGING.serviceKey}`,
            },
            body: JSON.stringify({ query: sql }),
        });

        if (res.ok) {
            return { success: true };
        }
        const body = await res.json().catch(() => ({ message: res.statusText }));
        return { success: false, error: body.message || body.error || JSON.stringify(body) };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ─── Helper: executar SQL via RPC (fallback) ───────────────────────────────
// Divide SQL em statements separados e executa via supabase.rpc ou método direto
async function executeSqlViaRPC(sql, fileName) {
    // Tenta executar via pg_query ou exec_sql se existir
    const { data, error } = await supabase.rpc('exec_sql', { sql_text: sql });
    if (!error) return { success: true };
    return { success: false, error: error.message };
}

// ─── Cores no terminal ────────────────────────────────────────────────────
const c = {
    green: s => `\x1b[32m${s}\x1b[0m`,
    red: s => `\x1b[31m${s}\x1b[0m`,
    yellow: s => `\x1b[33m${s}\x1b[0m`,
    cyan: s => `\x1b[36m${s}\x1b[0m`,
    bold: s => `\x1b[1m${s}\x1b[0m`,
    dim: s => `\x1b[2m${s}\x1b[0m`,
};

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
    console.log(c.bold('\n🔄 SYNC STAGING ← PRODUCTION MIGRATIONS'));
    console.log(c.dim(`   Destino: ${STAGING.url}`));
    if (isDryRun) console.log(c.yellow('   Modo: DRY RUN (não aplica nada)\n'));
    else console.log(c.dim('   Modo: Aplicação real\n'));

    // Listar migrations em ordem
    const migrationsDir = join(ROOT, 'supabase', 'migrations');
    const files = readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    // Filtrar a partir de --from se especificado
    const toApply = fromNum > 0
        ? files.filter(f => {
            const num = parseInt(f.split('_')[0], 10);
            return num >= fromNum;
        })
        : files;

    console.log(c.cyan(`📁 Total de migrations: ${files.length}`));
    console.log(c.cyan(`📋 A aplicar: ${toApply.length}${fromNum > 0 ? ` (a partir de ${fromNum})` : ''}\n`));
    console.log('─'.repeat(60));

    let applied = 0;
    let failed = 0;
    let skipped = 0;
    const errors = [];

    for (const file of toApply) {
        const num = parseInt(file.split('_')[0], 10);
        const filePath = join(migrationsDir, file);
        const sql = readFileSync(filePath, 'utf-8');

        process.stdout.write(`  ${c.dim(String(num).padStart(3, '0'))} ${file.padEnd(50)} `);

        if (isDryRun) {
            console.log(c.yellow('[ DRY RUN ]'));
            skipped++;
            continue;
        }

        // Tentar aplicar via Management API primeiro
        let result = await executeSqlViaAPI(sql, file);

        // Se falhou, tentar via RPC como fallback
        if (!result.success) {
            result = await executeSqlViaRPC(sql, file);
        }

        if (result.success) {
            console.log(c.green('✅ OK'));
            applied++;
        } else {
            const errMsg = result.error || 'Erro desconhecido';
            // Ignorar erros esperados (objeto já existe = idempotente)
            const isIdempotent = [
                'already exists',
                'duplicate key value',
                'relation already exists',
                'function already exists',
                'column already exists',
            ].some(s => errMsg.toLowerCase().includes(s));

            if (isIdempotent) {
                console.log(c.yellow('⚡ SKIP (já existe)'));
                applied++;
            } else {
                console.log(c.red(`❌ ERRO`));
                console.log(c.red(`     → ${errMsg.slice(0, 120)}`));
                errors.push({ file, error: errMsg });
                failed++;
            }
        }
    }

    // Resumo
    console.log('\n' + '─'.repeat(60));
    console.log(c.bold('\n📊 RESULTADO FINAL:'));
    console.log(`   ${c.green('✅ Aplicadas/OK:')} ${applied}`);
    if (failed > 0) {
        console.log(`   ${c.red('❌ Falhas:')}       ${failed}`);
        console.log(c.red('\n⚠️  Migrations com erro:'));
        errors.forEach(e => {
            console.log(c.red(`   • ${e.file}`));
            console.log(c.dim(`     ${e.error.slice(0, 200)}`));
        });
    }
    if (skipped > 0) {
        console.log(`   ${c.yellow('⏭️  DRY RUN:')}      ${skipped}`);
    }

    if (failed === 0 && !isDryRun) {
        console.log(c.green(c.bold('\n🎉 Staging sincronizado com sucesso!\n')));
        console.log('   Próximos passos:');
        console.log('   1. Execute: npm run dev');
        console.log('   2. Acesse: http://localhost:3000');
        console.log('   3. Faça login e valide que tudo funciona\n');
    } else if (failed > 0) {
        console.log(c.yellow('\n⚠️  Há erros. Verifique os detalhes acima.'));
        console.log('   Dica: Algunas migrations podem requerer execução manual');
        console.log('   via SQL Editor do Supabase:\n');
        console.log(`   🔗 https://supabase.com/dashboard/project/${STAGING.projectRef}/sql/new\n`);
    }
}

main().catch(err => {
    console.error('💥 Erro fatal:', err.message);
    process.exit(1);
});
