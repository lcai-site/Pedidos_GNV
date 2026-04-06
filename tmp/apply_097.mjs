import { readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getEnv } from '../scripts/environments.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const env = getEnv('production');

async function main() {
    console.log("🚀 Aplicando Migration 097 (Unificação Rigorosa + Divergência) em Produção...");

    const filePath = join(ROOT, 'supabase', 'migrations', '097_unificacao_e_divergencia.sql');
    const sql = readFileSync(filePath, 'utf-8');

    const url = `https://api.supabase.com/v1/projects/${env.projectRef}/database/query`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.serviceKey}`,
            },
            body: JSON.stringify({ query: sql }),
        });

        if (res.ok) {
            console.log("✅ Migration 097 aplicada com sucesso!");
        } else {
            const body = await res.json().catch(() => ({ message: res.statusText }));
            console.error("❌ Erro via Management API:", body.message || body.error || JSON.stringify(body));
        }
    } catch (e) {
        console.error("❌ Erro de rede:", e.message);
    }
}

main().catch(err => console.error(err));
