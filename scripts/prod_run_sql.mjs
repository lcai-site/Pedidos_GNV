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
                'Authorization': `Bearer ${env.serviceKey}`,
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
    console.log("🚀 Aplicando Migration 057 no Produção...");

    // 1. Ler arquivo SQL
    const filePath = join(ROOT, 'supabase', 'migrations', '057_fix_pv_limite_fds.sql');
    const sql = readFileSync(filePath, 'utf-8');

    // 2. Executar SQL
    const result = await executeSqlViaAPI(sql);
    if (!result.success) {
        console.error("❌ Erro ao aplicar SQL:", result.error);

        // Tentar via RPC fallback (apenas se existir exec_sql, o que não existe no prod)
        // return;
    } else {
        console.log("✅ Migration 057 aplicada com sucesso via Management API.");
    }

    console.log("🔄 Rodando consolidar_pedidos_ticto()...");
    const { data, error } = await supabase.rpc('consolidar_pedidos_ticto');

    if (error) {
        console.error("❌ Erro na consolidação:", error);
    } else {
        console.log("✅ Consolidação finalizada:", data);

        // 3. Verificar resultados para os 7 clientes
        const emails = [
            'tami_15mp@hotmail.com',
            'milenehelena282828@gmail.com',
            'ligiabeatriz774@gmail.com',
            'maiara.murinelli@outlook.com',
            'weverton9196@gmail.com',
            'jaquelineoliveiraalves97@gmail.com',
            'gaby.wp@hotmail.com'
        ];

        const { data: results, error: resError } = await supabase
            .from('pedidos_consolidados_v3')
            .select('nome_cliente, nome_oferta, descricao_pacote, order_bumps')
            .in('email', emails);

        if (resError) {
            console.error("Erro ao puxar consolidados:", resError);
        } else {
            console.log("\n📊 RESULTADOS DA CONSOLIDAÇÃO:");
            results.forEach(d => {
                console.log(`- ${d.nome_cliente}: ${d.descricao_pacote}`);
            });
        }
    }
}

main().catch(err => console.error(err));
