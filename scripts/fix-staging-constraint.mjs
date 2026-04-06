/**
 * Diagnóstico v2: Investigar constraint "fantasma" no staging
 */

import { createClient } from '@supabase/supabase-js';

const STAGING = {
    url: 'https://vkeshyusimduiwjaijjv.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZXNoeXVzaW1kdWl3amFpamp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzU0NDk3NywiZXhwIjoyMDgzMTIwOTc3fQ.5HGMlM2WMTp9BYxSfPfo0YQQV5oy3ZPTWj0ZNHpZT8c'
};

const supabase = createClient(STAGING.url, STAGING.key);

async function main() {
    const testHash = 'DIAG_V2_' + Date.now();

    // Primeiro, consultar quantos registros já existem com offer_code NULL
    // O problema pode ser que registros antigos têm offer_code=NULL e a constraint 
    // UNIQUE (transaction_hash, offer_code) trata NULLs de forma especial
    console.log('🔍 Checando registros com offer_code NULL...');
    const { data: nullOffers, error: nErr } = await supabase
        .from('ticto_pedidos')
        .select('id, transaction_hash, offer_code', { count: 'exact' })
        .is('offer_code', null)
        .limit(5);

    if (nErr) {
        console.log('❌ Erro:', nErr.message);
    } else {
        console.log(`   Registros com offer_code=NULL: ${nullOffers?.length || 0}`);
        if (nullOffers?.length > 0) {
            console.log('   Exemplos:', nullOffers.slice(0, 3).map(r => r.transaction_hash));
        }
    }

    // Teste 1: Insert com offer_code preenchido
    console.log('\n🧪 Teste 1: Dois inserts com mesmo tx_hash, offer_codes DIFERENTES...');

    const { error: e1 } = await supabase
        .from('ticto_pedidos')
        .insert({
            transaction_hash: testHash,
            offer_code: 'PAI_001',
            status: 'Teste',
            product_name: 'Diag v2 PAI',
        });
    console.log('   Insert PAI:', e1 ? `❌ ${e1.message}` : '✅ OK');

    const { error: e2 } = await supabase
        .from('ticto_pedidos')
        .insert({
            transaction_hash: testHash,
            offer_code: 'OB_001',
            status: 'Teste',
            product_name: 'Diag v2 OB',
        });
    console.log('   Insert OB:', e2 ? `❌ ${e2.message}` : '✅ OK');

    // Teste 2: Insert com offer_code NULL (simula registros legados)
    const testHash2 = 'DIAG_V2_NULL_' + Date.now();
    console.log('\n🧪 Teste 2: Dois inserts com mesmo tx_hash, offer_code=NULL...');

    const { error: e3 } = await supabase
        .from('ticto_pedidos')
        .insert({
            transaction_hash: testHash2,
            offer_code: null,
            status: 'Teste',
            product_name: 'Diag v2 NULL 1',
        });
    console.log('   Insert NULL 1:', e3 ? `❌ ${e3.message}` : '✅ OK');

    const { error: e4 } = await supabase
        .from('ticto_pedidos')
        .insert({
            transaction_hash: testHash2,
            offer_code: null,
            status: 'Teste',
            product_name: 'Diag v2 NULL 2',
        });
    console.log('   Insert NULL 2:', e4 ? `❌ ${e4.message}` : '✅ OK');

    // Verificar o que temos
    const { data: results } = await supabase
        .from('ticto_pedidos')
        .select('transaction_hash, offer_code, product_name')
        .in('transaction_hash', [testHash, testHash2]);

    console.log('\n📋 Registros criados:', results?.length || 0);
    results?.forEach(r => console.log(`   ${r.transaction_hash} | ${r.offer_code} | ${r.product_name}`));

    // Limpeza
    await supabase.from('ticto_pedidos').delete().eq('transaction_hash', testHash);
    await supabase.from('ticto_pedidos').delete().eq('transaction_hash', testHash2);
    console.log('\n🧹 Limpeza concluída');
}

main().catch(console.error);
