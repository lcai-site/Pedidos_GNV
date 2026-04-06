import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getEnv } from '../scripts/environments.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const env = getEnv('production');
const supabase = createClient(env.supabaseUrl, env.serviceKey);

async function main() {
    console.log("🚀 Aplicando Migration 094 (fix descricao_pacote override) no Produção...");

    const filePath = join(ROOT, 'supabase', 'migrations', '094_fix_descricao_pacote_override.sql');
    const sql = readFileSync(filePath, 'utf-8');

    // Executar via Management API
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
            console.log("✅ Migration 094 aplicada com sucesso!");
        } else {
            const body = await res.json().catch(() => ({ message: res.statusText }));
            console.error("❌ Erro via Management API:", body.message || body.error || JSON.stringify(body));
            console.log("⚠️ Tente executar o SQL diretamente no Supabase Dashboard > SQL Editor");
        }
    } catch (e) {
        console.error("❌ Erro de rede:", e.message);
    }

    // Verificar pedidos editados que seriam afetados
    console.log("\n🔍 Verificando pedidos editados SEM rastreio (os vulneráveis ao bug)...");
    const { data: editados, error: editErr } = await supabase
        .from('pedidos_consolidados_v3')
        .select('id, descricao_pacote, foi_editado, codigo_rastreio')
        .eq('foi_editado', true)
        .is('codigo_rastreio', null)
        .limit(5);

    if (editErr) {
        console.error("Erro:", editErr);
    } else {
        console.log(`Encontrados ${editados?.length || 0} pedidos editados SEM rastreio:`);
        editados?.forEach(p => {
            console.log(`  - ${p.id}: "${p.descricao_pacote}"`);
        });
    }
}

main().catch(err => console.error(err));
