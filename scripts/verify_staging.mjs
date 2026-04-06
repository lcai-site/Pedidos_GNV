/**
 * Aplica a migration 046 no staging (vkeshyusimduiwjaijjv)
 * e verifica a estrutura resultante.
 * 
 * Usa uma abordagem alternativa já que não pode rodar DDL via JS:
 * - Verifica quais colunas existem no staging
 * - Lista as constraints
 * - Reporta o que precisa ser feito manualmente
 */
import { createClient } from '@supabase/supabase-js';

const STAGING = {
    url: 'https://vkeshyusimduiwjaijjv.supabase.co',
    serviceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZXNoeXVzaW1kdWl3amFpamp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzU0NDk3NywiZXhwIjoyMDgzMTIwOTc3fQ.5HGMlM2WMTp9BYxSfPfo0YQQV5oy3ZPTWj0ZNHpZT8c'
};

const staging = createClient(STAGING.url, STAGING.serviceKey);

async function main() {
    console.log('=== VERIFICAÇÃO DO STAGING (vkeshyusimduiwjaijjv) ===\n');

    // 1. Verificar se as tabelas existem
    const tabelas = ['ticto_pedidos', 'ticto_logs', 'pedidos_consolidados_v3'];

    for (const t of tabelas) {
        const { count, error } = await staging
            .from(t)
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.log(`❌ ${t}: ${error.message}`);
        } else {
            console.log(`✅ ${t}: ${count} registros`);
        }
    }

    // 2. Testar colunas do ticto_logs
    console.log('\n--- Testando colunas de ticto_logs ---');
    const logCols = ['evento', 'tipo', 'payload', 'resposta', 'status_code', 'sucesso', 'erro', 'duracao_ms', 'created_at'];

    for (const col of logCols) {
        const testVal = col === 'sucesso' ? true : col === 'duracao_ms' || col === 'status_code' ? 1 : col === 'payload' || col === 'resposta' ? {} : 'test';
        const { error } = await staging
            .from('ticto_logs')
            .insert({ [col]: testVal })
            .select();

        if (error?.message?.includes('not find')) {
            console.log(`  ❌ ${col}: NÃO EXISTE`);
        } else if (error?.message?.includes('row-level security')) {
            console.log(`  ✅ ${col}: existe (RLS bloqueou, normal com service_role)`);
        } else if (error) {
            console.log(`  ⚠️  ${col}: ${error.message.substring(0, 50)}`);
        } else {
            console.log(`  ✅ ${col}: existe e insert OK`);
        }
    }

    // 3. Testar insert completo no ticto_logs (usando service_role que bypassa RLS)
    console.log('\n--- Teste de insert completo no ticto_logs ---');
    const { data: logInsert, error: logErr } = await staging
        .from('ticto_logs')
        .insert({
            evento: 'staging_test_046',
            tipo: 'test',
            payload: { test: true, migration: '046' },
            sucesso: true,
            duracao_ms: 0,
        })
        .select();

    if (logErr) {
        console.log(`❌ Insert ticto_logs falhou: ${logErr.message}`);
    } else {
        console.log(`✅ Insert ticto_logs OK!`);
        // Limpar teste
        if (logInsert?.[0]?.id) {
            await staging.from('ticto_logs').delete().eq('id', logInsert[0].id);
        }
    }

    // 4. Testar constraint do ticto_pedidos
    console.log('\n--- Testando constraint UNIQUE do ticto_pedidos ---');

    // Inserir dois registros com mesmo transaction_hash mas offer_code diferente
    const testHash = 'TEST_HASH_046_' + Date.now();

    const { error: ins1 } = await staging
        .from('ticto_pedidos')
        .insert({
            transaction_hash: testHash,
            offer_code: 'OFFER_PAI',
            offer_name: 'Compre 1 Leve 2',
            customer_name: 'Teste Pai',
            status: 'Aprovado',
        });

    const { error: ins2 } = await staging
        .from('ticto_pedidos')
        .insert({
            transaction_hash: testHash,
            offer_code: 'OFFER_OB',
            offer_name: 'Order Bump 1 frasco',
            customer_name: 'Teste OB',
            status: 'Aprovado',
        });

    if (!ins1 && !ins2) {
        console.log('✅ Constraint composta OK! PAI e OB com mesmo hash coexistem');

        // Verificar se terceiro insert com mesmo hash+offer FALHA (deveria fazer upsert)
        const { error: ins3 } = await staging
            .from('ticto_pedidos')
            .upsert({
                transaction_hash: testHash,
                offer_code: 'OFFER_PAI',
                offer_name: 'Compre 1 Leve 2 ATUALIZADO',
                customer_name: 'Teste Pai Atualizado',
                status: 'Aprovado',
            }, { onConflict: 'transaction_hash,offer_code' });

        if (!ins3) {
            console.log('✅ Upsert com chave composta OK!');
        } else {
            console.log(`❌ Upsert falhou: ${ins3.message}`);
        }
    } else {
        if (ins1) console.log(`❌ Insert PAI falhou: ${ins1.message}`);
        if (ins2) console.log(`❌ Insert OB falhou: ${ins2.message}`);
    }

    // Limpar testes
    await staging.from('ticto_pedidos').delete().eq('transaction_hash', testHash);

    console.log('\n=== FIM ===');
}

main().catch(console.error);
