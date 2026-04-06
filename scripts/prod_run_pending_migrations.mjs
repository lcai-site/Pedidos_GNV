import { readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getEnv } from './environments.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const env = getEnv('production');

async function executeSqlViaAPI(sql, filename) {
    if (!env.managementToken) {
        return { success: false, error: "Nenhum SUPABASE_ACCESS_TOKEN encontrado no .env" };
    }

    const url = `https://api.supabase.com/v1/projects/${env.projectRef}/database/query`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.managementToken}`,
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

async function runMigration(filename) {
    console.log(`\n🚀 Iniciando deploy de: ${filename}...`);
    const filePath = join(ROOT, 'supabase', 'migrations', filename);
    
    try {
        const sql = readFileSync(filePath, 'utf-8');
        const result = await executeSqlViaAPI(sql, filename);
        
        if (!result.success) {
            console.error(`❌ Falha ao aplicar ${filename}:`, result.error);
            return false;
        } else {
            console.log(`✅ Sucesso! Migration ${filename} aplicada.`);
            return true;
        }
    } catch (e) {
        console.error(`❌ Erro ao ler o arquivo ${filename}:`, e.message);
        return false;
    }
}

async function main() {
    console.log("=== INICIANDO DEPLOY DE MIGRATIONS PENDENTES ===");
    
    // Roda a migration da validação editado 058
    await runMigration('058_fix_foi_editado_override.sql');
    
    // Roda a migration 059 
    await runMigration('059_add_tentativas_geracao.sql');
    
    // Roda a migration 060
    await runMigration('060_fix_pv_orderbumps.sql');
    
    console.log("\n=== DEPLOY FINALIZADO ===");
}

main().catch(err => console.error(err));
