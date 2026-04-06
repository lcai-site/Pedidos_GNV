/**
 * Teste de Fluxo Completo: Webhook Ticto
 * 
 * Testa 4 cenários contra o Supabase (produção):
 * 1. POST authorized → registro criado
 * 2. POST mesmo payload → dedup (sem duplicata)  
 * 3. POST mesmo tx_hash + offer_code diferente → OB coexiste
 * 4. POST refunded → status atualizado
 * 
 * Uso: node scripts/test-webhook-flow.mjs
 */

import { createClient } from '@supabase/supabase-js';

const WEBHOOK_URL = 'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/quick-action';
const SUPABASE_URL = 'https://cgyxinpejaoadsqrxbhy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc';

const TEST_TX_HASH = `TEST_FLOW_${Date.now()}`;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let passed = 0;
let failed = 0;

function assert(condition, label) {
    if (condition) {
        console.log(`   ✅ ${label}`);
        passed++;
    } else {
        console.log(`   ❌ ${label}`);
        failed++;
    }
}

function buildPayload(txHash, offerCode, status = 'authorized') {
    return {
        version: '2.0',
        commission_type: 'producer',
        status,
        status_date: '2026-02-22 09:00:00',
        token: 'TEST_TOKEN_FLOW',
        payment_method: 'pix',
        checkout_url: 'https://checkout.ticto.app/TEST_FLOW',
        order: {
            id: 8888888,
            hash: 'TEST_FLOW_HASH',
            transaction_hash: txHash,
            paid_amount: 14700,
            installments: 1,
            order_date: '2026-02-22 09:00:00',
        },
        offer: {
            id: 888,
            code: offerCode,
            name: `Oferta Teste ${offerCode}`,
            price: 14700,
            is_subscription: false,
        },
        item: {
            product_name: 'Produto Teste Flow',
            product_id: 88888,
            offer_code: offerCode,
            offer_name: `Oferta Teste ${offerCode}`,
            offer_id: 888,
            quantity: 1,
            amount: 14700,
            refund_deadline: 7,
        },
        shipping: { amount: 899, type: 'fixed', delivery_days: 21 },
        customer: {
            cpf: '00000000000',
            code: 'TEST_FLOW_CUSTOMER',
            name: 'Cliente Teste Flow',
            type: 'person',
            email: 'flow-test@test.com',
            phone: { ddd: '11', ddi: '+55', number: '999999999' },
            address: {
                city: 'São Paulo',
                state: 'SP',
                street: 'Rua Teste Flow',
                country: 'Brasil',
                zip_code: '01001000',
                neighborhood: 'Centro',
                street_number: '100',
            },
            is_foreign: false,
            language: 'pt-BR',
        },
        producer: { id: 1, name: 'Teste', email: 'teste@teste.com', amount: 7619 },
        affiliates: [],
        coproducers: [],
        marketplace_commission: 881,
        tracking: {},
        transaction: { hash: txHash },
    };
}

async function sendWebhook(payload) {
    const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return { status: res.status, body: await res.json() };
}

async function countRecords(txHash) {
    const { data, error } = await supabase
        .from('ticto_pedidos')
        .select('transaction_hash, offer_code, status')
        .eq('transaction_hash', txHash);
    return data || [];
}

async function cleanup() {
    await supabase
        .from('ticto_pedidos')
        .delete()
        .eq('transaction_hash', TEST_TX_HASH);
}

async function main() {
    console.log('🧪 Teste de Fluxo Completo — Webhook Ticto');
    console.log(`   TX Hash: ${TEST_TX_HASH}\n`);

    // Cleanup prévio
    await cleanup();

    // ═══════════════════════════════════════
    // CENÁRIO 1: POST authorized (pedido pai)
    // ═══════════════════════════════════════
    console.log('📋 Cenário 1: POST authorized (pedido pai)');
    const payload1 = buildPayload(TEST_TX_HASH, 'OFFER_PAI_TEST');
    const res1 = await sendWebhook(payload1);

    assert(res1.status === 200, `HTTP 200 (recebido: ${res1.status})`);
    assert(res1.body.success === true, 'success: true');
    assert(res1.body.status === 'Aprovado', `status normalizado: ${res1.body.status}`);

    const records1 = await countRecords(TEST_TX_HASH);
    assert(records1.length === 1, `1 registro no banco (encontrado: ${records1.length})`);

    // ═══════════════════════════════════════
    // CENÁRIO 2: POST mesmo payload → dedup
    // ═══════════════════════════════════════
    console.log('\n📋 Cenário 2: POST mesmo payload (dedup)');
    const res2 = await sendWebhook(payload1);

    assert(res2.status === 200, `HTTP 200 (recebido: ${res2.status})`);

    const records2 = await countRecords(TEST_TX_HASH);
    assert(records2.length === 1, `Ainda 1 registro (sem duplicata) (encontrado: ${records2.length})`);

    // ═══════════════════════════════════════
    // CENÁRIO 3: POST OB (mesmo tx_hash, offer_code diferente)
    // ═══════════════════════════════════════
    console.log('\n📋 Cenário 3: POST Order Bump (mesmo tx_hash, offer diferente)');
    const payload3 = buildPayload(TEST_TX_HASH, 'OFFER_OB_TEST');
    const res3 = await sendWebhook(payload3);

    assert(res3.status === 200, `HTTP 200 (recebido: ${res3.status})`);

    const records3 = await countRecords(TEST_TX_HASH);
    assert(records3.length === 2, `2 registros (PAI + OB) (encontrado: ${records3.length})`);

    const offers = records3.map(r => r.offer_code).sort();
    assert(
        offers.includes('OFFER_PAI_TEST') && offers.includes('OFFER_OB_TEST'),
        `Offer codes corretos: ${offers.join(', ')}`
    );

    // ═══════════════════════════════════════
    // CENÁRIO 4: POST refunded → atualiza status
    // ═══════════════════════════════════════
    console.log('\n📋 Cenário 4: POST refunded (atualiza status do pai)');
    const payload4 = buildPayload(TEST_TX_HASH, 'OFFER_PAI_TEST', 'refunded');
    const res4 = await sendWebhook(payload4);

    assert(res4.status === 200, `HTTP 200 (recebido: ${res4.status})`);
    assert(res4.body.status === 'Reembolsado', `Status atualizado: ${res4.body.status}`);

    const records4 = await countRecords(TEST_TX_HASH);
    assert(records4.length === 2, `Ainda 2 registros (encontrado: ${records4.length})`);

    const paiRecord = records4.find(r => r.offer_code === 'OFFER_PAI_TEST');
    const obRecord = records4.find(r => r.offer_code === 'OFFER_OB_TEST');
    assert(paiRecord?.status === 'Reembolsado', `PAI status: ${paiRecord?.status}`);
    assert(obRecord?.status === 'Aprovado', `OB status mantido: ${obRecord?.status}`);

    // ═══════════════════════════════════════
    // RESULTADO
    // ═══════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log(`📊 RESULTADO: ${passed} passed, ${failed} failed`);
    console.log('══════════════════════════════════════');

    // Cleanup
    await cleanup();
    console.log('🧹 Registros de teste removidos');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('💥 Erro fatal:', err);
    cleanup().then(() => process.exit(1));
});
