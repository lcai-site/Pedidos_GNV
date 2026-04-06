/**
 * Aplica a migration 096 diretamente via conexão Supabase (sem Management API)
 * Divide o SQL em blocos menores para execução segura
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getEnv } from '../scripts/environments.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const env = getEnv('production');
const supabase = createClient(env.supabaseUrl, env.serviceKey);

async function execSQL(label, sql) {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();
    if (error) {
        // exec_sql pode não existir — tenta via supabase functions
        console.error(`❌ [${label}] Erro:`, error.message);
        return false;
    }
    console.log(`✅ [${label}] OK`);
    return true;
}

async function main() {
    console.log('🚀 Aplicando Migration 096 via Supabase Client...\n');

    // ===========================
    // BLOCO 1: Recalcular dia_despacho incorretos
    // ===========================
    console.log('📋 Passo 1: Recalculando dia_despacho incorretos...');
    const { error: err1 } = await supabase.rpc('exec_sql', {
        sql_query: `
            UPDATE pedidos_consolidados_v3 c
            SET dia_despacho = (
                SELECT proximo_dia_util(proximo_dia_util(COALESCE(tp.status_date, tp.order_date)::DATE))
                FROM ticto_pedidos tp
                WHERE tp.transaction_hash = c.codigo_transacao
                LIMIT 1
            )
            WHERE c.dia_despacho = CURRENT_DATE
              AND (c.pv_realizado IS NULL OR c.pv_realizado = FALSE)
              AND c.codigo_rastreio IS NULL
              AND c.data_postagem IS NULL
              AND EXISTS (
                SELECT 1 FROM ticto_pedidos tp
                WHERE tp.transaction_hash = c.codigo_transacao
              );
        `
    });

    if (err1) {
        console.error('❌ exec_sql não disponível. Verifique se a function existe no banco.');
        console.log('\n⚠️  Cole o SQL abaixo no Supabase Dashboard > SQL Editor:');
        const sql = readFileSync(join(ROOT, 'supabase', 'migrations', '096_fix_consolidar_e_despachos.sql'), 'utf-8');
        console.log('\n' + '='.repeat(60));
        console.log(sql.substring(0, 500) + '...');
        console.log('='.repeat(60));
        console.log('\n📁 Arquivo completo: supabase/migrations/096_fix_consolidar_e_despachos.sql');
        process.exit(1);
    }

    console.log('✅ Passo 1: dia_despacho recalculado!');

    // ===========================
    // VERIFICAÇÃO: estado atual
    // ===========================
    console.log('\n🔍 Verificando estado após correção...');
    
    const { data: hoje_errados, error: e2 } = await supabase
        .from('pedidos_consolidados_v3')
        .select('id, nome_cliente, dia_despacho, data_venda, pv_realizado')
        .eq('dia_despacho', '2026-03-19')
        .is('codigo_rastreio', null)
        .is('data_postagem', null)
        .limit(15);

    if (!e2) {
        console.log(`\nPedidos com dia_despacho = 19/03 (devem ser ZERO ou apenas pv_realizado=TRUE):`);
        if (hoje_errados?.length === 0) {
            console.log('  ✅ Nenhum pedido incorreto com dia_despacho = hoje!');
        } else {
            hoje_errados?.forEach(p => {
                const ok = p.pv_realizado === true;
                console.log(`  ${ok ? '✅ (pv_done)' : '❌'} ${p.nome_cliente} | venda: ${p.data_venda?.split('T')[0]} | pv_realizado: ${p.pv_realizado} | despacho: ${p.dia_despacho}`);
            });
        }
    }

    const { data: vendas19, error: e3 } = await supabase
        .from('pedidos_consolidados_v3')
        .select('nome_cliente, dia_despacho, data_venda')
        .gte('data_venda', '2026-03-19T00:00:00')
        .lt('data_venda', '2026-03-20T00:00:00')
        .is('codigo_rastreio', null)
        .limit(5);

    if (!e3) {
        console.log(`\nPedidos de 19/03 (quarta) → dia_despacho esperado: 2026-03-21 (sexta)`);
        vendas19?.forEach(p => {
            console.log(`  - ${p.nome_cliente} → ${p.dia_despacho}`);
        });
    }
}

main().catch(err => console.error(err));
