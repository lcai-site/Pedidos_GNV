import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getEnv } from './environments.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const env = getEnv('production');
const supabase = createClient(env.supabaseUrl, env.serviceKey);

async function executeSqlViaAPI(sql) {
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

async function main() {
    console.log("🚀 Aplicando Migration 058 no Produção...");

    // 1. Ler arquivo SQL
    const filePath = join(ROOT, 'supabase', 'migrations', '058_fix_foi_editado_override.sql');
    const sql = readFileSync(filePath, 'utf-8');

    // 2. Executar SQL
    const result = await executeSqlViaAPI(sql);
    if (!result.success) {
        console.error("❌ Erro ao aplicar SQL:", result.error);
        return;
    } else {
        console.log("✅ Migration 058 aplicada com sucesso via Management API.");
    }
}

main().catch(err => console.error(err));
