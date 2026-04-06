/**
 * Sync dedicado para ticto_pedidos: Produção → Staging
 * 
 * Workaround para o cache do PgBouncer que ainda enforça a constraint
 * antiga (ticto_pedidos_transaction_hash_key) apesar de removida.
 * 
 * Estratégia: Limpar staging e inserir sem campo 'id'
 * (deixa o staging gerar novos UUIDs) para evitar
 * qualquer conflito de constraint.
 */

import { createClient } from '@supabase/supabase-js';

const PRODUCAO = {
    url: 'https://cgyxinpejaoadsqrxbhy.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc'
};

const STAGING = {
    url: 'https://vkeshyusimduiwjaijjv.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZXNoeXVzaW1kdWl3amFpamp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzU0NDk3NywiZXhwIjoyMDgzMTIwOTc3fQ.5HGMlM2WMTp9BYxSfPfo0YQQV5oy3ZPTWj0ZNHpZT8c'
};

async function main() {
    console.log('🔄 Sync dedicado: ticto_pedidos Produção → Staging\n');

    const prod = createClient(PRODUCAO.url, PRODUCAO.key);
    const staging = createClient(STAGING.url, STAGING.key);

    // 1. Buscar dados de produção
    console.log('📥 Lendo dados de produção...');
    const { data: prodData, error: prodErr } = await prod
        .from('ticto_pedidos')
        .select('*');

    if (prodErr) {
        console.log('❌ Erro lendo produção:', prodErr.message);
        return;
    }
    console.log(`   ${prodData.length} registros encontrados`);

    // 2. Limpar staging completamente
    console.log('🗑️  Limpando staging...');
    const { error: delErr } = await staging
        .from('ticto_pedidos')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

    if (delErr) {
        console.log('⚠️  Erro ao limpar:', delErr.message);
    }

    // Verificar quantos restaram
    const { count } = await staging
        .from('ticto_pedidos')
        .select('*', { count: 'exact', head: true });
    console.log(`   ${count || 0} registros restantes no staging`);

    // 3. Remover 'id' dos dados (staging gera novos UUIDs)
    //    E remover 'created_at' e 'updated_at' para usar defaults
    const cleanData = prodData.map(row => {
        const { id, created_at, updated_at, ...rest } = row;
        return rest;
    });

    // 4. Inserir em batches pequenos
    const BATCH_SIZE = 50;
    let totalInserted = 0;
    let errors = 0;

    for (let i = 0; i < cleanData.length; i += BATCH_SIZE) {
        const batch = cleanData.slice(i, i + BATCH_SIZE);
        const { error } = await staging
            .from('ticto_pedidos')
            .insert(batch);

        if (error) {
            console.log(`   ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
            errors++;

            // Tentar um por um para identificar o problemático
            if (errors <= 2) {
                let batchInserted = 0;
                for (const row of batch) {
                    const { error: singleErr } = await staging
                        .from('ticto_pedidos')
                        .insert(row);
                    if (singleErr) {
                        console.log(`      ↳ ${row.transaction_hash} | ${row.offer_code}: ${singleErr.message}`);
                    } else {
                        batchInserted++;
                    }
                }
                totalInserted += batchInserted;
                console.log(`      ↳ Inseridos ${batchInserted}/${batch.length} individualmente`);
            }
        } else {
            totalInserted += batch.length;
            process.stdout.write(`   ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} registros\r`);
        }
    }

    console.log(`\n\n📋 RESULTADO:`);
    console.log(`   ✅ Inseridos: ${totalInserted} de ${cleanData.length}`);
    if (errors > 0) console.log(`   ❌ Batches com erro: ${errors}`);

    // 5. Verificação final
    const { count: finalCount } = await staging
        .from('ticto_pedidos')
        .select('*', { count: 'exact', head: true });
    console.log(`   📊 Total no staging: ${finalCount}`);
}

main().catch(console.error);
