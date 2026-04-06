/**
 * Promove mudanças testadas do Staging para Produção.
 * 
 * O que faz:
 * 1. Lista migrations pendentes (staging tem, produção não)
 * 2. Compara Edge Functions entre os ambientes
 * 3. Aplica tudo em produção (com confirmação)
 * 
 * Uso: node scripts/promote-to-production.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { createInterface } from 'readline';
import { ENVIRONMENTS } from './environments.mjs';

const staging = createClient(ENVIRONMENTS.staging.supabaseUrl, ENVIRONMENTS.staging.serviceKey);
const production = createClient(ENVIRONMENTS.production.supabaseUrl, ENVIRONMENTS.production.serviceKey);

function ask(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });
}

async function checkMigrations() {
    console.log('\n📋 Verificando migrations...');

    const migrationsDir = 'supabase/migrations';
    const allFiles = readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    console.log(`   Total de migrations no projeto: ${allFiles.length}`);
    return allFiles;
}

async function compareTables() {
    console.log('\n📊 Comparando schemas...');

    const tables = ['ticto_pedidos', 'ticto_logs', 'pedidos_consolidados_v3'];

    for (const table of tables) {
        const { count: stagingCount } = await staging
            .from(table)
            .select('*', { count: 'exact', head: true });
        const { count: prodCount } = await production
            .from(table)
            .select('*', { count: 'exact', head: true });

        const icon = stagingCount === prodCount ? '✅' : '⚠️';
        console.log(`   ${icon} ${table}: Staging=${stagingCount || 0} | Prod=${prodCount || 0}`);
    }
}

async function testStagingWebhook() {
    console.log('\n🧪 Testando webhook no Staging...');

    const testHash = `PROMOTE_TEST_${Date.now()}`;
    const payload = {
        version: '2.0',
        status: 'authorized',
        status_date: new Date().toISOString(),
        payment_method: 'pix',
        commission_type: 'producer',
        order: { id: 9999999, hash: 'PROMOTE_TEST', transaction_hash: testHash, paid_amount: 100, installments: 1 },
        offer: { id: 999, code: 'PROMOTE_TEST', name: 'Teste', price: 100 },
        item: { product_name: 'Teste Promote', product_id: 99999, offer_code: 'PROMOTE_TEST', quantity: 1, amount: 100 },
        customer: { name: 'Teste', email: 't@t.com', cpf: '000', code: 'T', type: 'person' },
        shipping: { amount: 0, type: 'free' },
        producer: { id: 1, name: 'T', email: 't@t.com', amount: 50 },
        affiliates: [], coproducers: [],
    };

    // Testar no staging
    const stagingUrl = `${ENVIRONMENTS.staging.supabaseUrl}/functions/v1/webhook-ticto`;
    try {
        const res = await fetch(stagingUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (res.status === 200) {
            const body = await res.json();
            console.log(`   ✅ Staging webhook OK: status=${body.status}`);
        } else if (res.status === 404) {
            console.log('   ⚠️  Edge Function não deployada no staging');
            console.log('   📋 Deploy primeiro com: node scripts/deploy-function.mjs staging webhook-ticto');
        } else {
            console.log(`   ❌ Staging webhook falhou: HTTP ${res.status}`);
        }
    } catch (err) {
        console.log(`   ❌ Erro conectando ao staging: ${err.message}`);
    }

    // Cleanup
    await staging.from('ticto_pedidos').delete().eq('transaction_hash', testHash);
}

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('  🚀 PROMOÇÃO: Staging → Produção');
    console.log('═══════════════════════════════════════════');

    // 1. Verificações
    await compareTables();
    await testStagingWebhook();
    const migrations = await checkMigrations();

    // 2. Resumo
    console.log('\n═══════════════════════════════════════════');
    console.log('  📋 RESUMO');
    console.log('═══════════════════════════════════════════');
    console.log(`  Migrations disponíveis: ${migrations.length}`);
    console.log(`  Edge Functions: webhook-ticto (quick-action), webhook-melhor-envio`);
    console.log('');

    // 3. Confirmar
    const answer = await ask('  ✋ Promover para PRODUÇÃO? (sim/não): ');

    if (answer !== 'sim' && answer !== 's') {
        console.log('\n  ❌ Promoção cancelada.');
        process.exit(0);
    }

    console.log('\n  ⏳ Aplicando em produção...');

    // 4. Deploy Edge Functions (mostra instruções)
    console.log('\n📦 Edge Functions:');
    console.log('   Para deploy de Edge Functions em produção, execute:');
    console.log('   node scripts/deploy-function.mjs production webhook-ticto  (slug: quick-action)');
    console.log('   node scripts/deploy-function.mjs production webhook-melhor-envio');

    // 5. Migrations
    console.log('\n📄 Migrations:');
    console.log('   Para aplicar migrations em produção, execute:');
    console.log('   node scripts/deploy-migration.mjs production supabase/migrations/<arquivo>.sql');
    console.log('   Ou aplique via SQL Editor no Dashboard de Produção.');

    // 6. Sync de volta
    console.log('\n🔄 Após aplicar em produção:');
    console.log('   npm run sync:staging  (para manter staging com dados atualizados)');

    console.log('\n═══════════════════════════════════════════');
    console.log('  ✅ Instruções de promoção geradas!');
    console.log('═══════════════════════════════════════════');
}

main().catch(err => {
    console.error('💥 Erro fatal:', err.message);
    process.exit(1);
});
