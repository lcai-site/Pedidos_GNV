import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://cgyxinpejaoadsqrxbhy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA'
);

async function main() {
    console.log('=== DIAGNÓSTICO: TABELA ticto_logs ===\n');

    // 1. Contar registros existentes
    const { count, error: countErr } = await supabase
        .from('ticto_logs')
        .select('*', { count: 'exact', head: true });

    console.log(`📊 Total de registros na ticto_logs: ${count}`);
    if (countErr) console.log(`   Erro ao contar: ${countErr.message}`);

    // 2. Tentar inserir um registro de teste
    console.log('\n🧪 Tentando inserir registro de teste...');
    const { data: insertData, error: insertErr } = await supabase
        .from('ticto_logs')
        .insert({
            evento: 'test_diagnostic',
            tipo: 'test',
            payload: { test: true, timestamp: new Date().toISOString() },
            sucesso: true,
            duracao_ms: 0,
        })
        .select()
        .single();

    if (insertErr) {
        console.log(`   ❌ ERRO ao inserir: ${insertErr.message}`);
        console.log(`   Code: ${insertErr.code}`);
        console.log(`   Details: ${insertErr.details}`);
        console.log(`   Hint: ${insertErr.hint}`);
    } else {
        console.log(`   ✅ Inserido com sucesso! ID: ${insertData?.id}`);
        console.log(`   Dados: ${JSON.stringify(insertData)}`);
    }

    // 3. Verificar se o registro aparece
    const { data: readBack, error: readErr } = await supabase
        .from('ticto_logs')
        .select('*')
        .eq('evento', 'test_diagnostic')
        .order('created_at', { ascending: false })
        .limit(1);

    if (readErr) {
        console.log(`\n   ❌ ERRO ao ler: ${readErr.message}`);
    } else {
        console.log(`\n   📖 Lendo de volta: ${readBack?.length} registro(s)`);
        if (readBack?.length > 0) {
            console.log(`   ✅ Registro de teste ENCONTRADO`);
        } else {
            console.log(`   ❌ Registro de teste NÃO ENCONTRADO (RLS pode estar bloqueando leitura)`);
        }
    }

    // 4. Verificar as colunas que a tabela espera
    console.log('\n📋 Tentando inserir com o mesmo formato que o webhook usa...');
    const { error: webhookInsertErr } = await supabase
        .from('ticto_logs')
        .insert({
            evento: 'webhook_authorized',
            tipo: 'webhook',
            payload: {
                transaction_hash: 'TEST_HASH',
                order_hash: 'TEST_ORDER',
                status: 'Aprovado',
                product_name: 'Teste',
                customer_email: 'test@test.com',
                paid_amount: 99.90,
            },
            sucesso: true,
            duracao_ms: 42,
        });

    if (webhookInsertErr) {
        console.log(`   ❌ ERRO: ${webhookInsertErr.message}`);
        console.log(`   Code: ${webhookInsertErr.code}`);
        console.log(`   Details: ${webhookInsertErr.details}`);
    } else {
        console.log('   ✅ Insert no formato webhook OK!');
    }

    // 5. Verificar erro de insert com campo 'erro'
    console.log('\n📋 Testando insert com campo erro (formato de erro)...');
    const { error: errInsertErr } = await supabase
        .from('ticto_logs')
        .insert({
            evento: 'webhook_error_test',
            tipo: 'error',
            payload: { transaction_hash: 'TEST', status: 'test', error: 'test error' },
            sucesso: false,
            erro: 'DB upsert failed: test',
            duracao_ms: 100,
        });

    if (errInsertErr) {
        console.log(`   ❌ ERRO: ${errInsertErr.message}`);
        console.log(`   Code: ${errInsertErr.code}`);
    } else {
        console.log('   ✅ Insert com campo erro OK!');
    }

    // 6. Contar de novo
    const { count: count2 } = await supabase
        .from('ticto_logs')
        .select('*', { count: 'exact', head: true });
    console.log(`\n📊 Total após testes: ${count2}`);

    console.log('\n=== FIM ===');
}

main().catch(console.error);
