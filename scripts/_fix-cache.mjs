import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://vkeshyusimduiwjaijjv.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZXNoeXVzaW1kdWl3amFpamp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzU0NDk3NywiZXhwIjoyMDgzMTIwOTc3fQ.5HGMlM2WMTp9BYxSfPfo0YQQV5oy3ZPTWj0ZNHpZT8c'
);

// Reload PostgREST schema cache
console.log('Sending pg_notify to reload PostgREST schema...');
const { data, error } = await supabase.rpc('pg_notify', { channel: 'pgrst', payload: 'reload schema' });
if (error) {
    console.log('pg_notify RPC not available, trying raw SQL...');
    // Try via raw SQL
    const { data: d2, error: e2 } = await supabase.rpc('exec_sql', {
        sql_text: "NOTIFY pgrst, 'reload schema';"
    });
    console.log('exec_sql result:', e2 ? e2.message : 'OK');
}

// Check constraints
console.log('\nChecking constraints on ticto_pedidos...');
const { data: constraints, error: cError } = await supabase
    .from('ticto_pedidos')
    .upsert(
        { transaction_hash: 'CACHE_TEST_XYZ', offer_code: 'TEST', status: 'test', raw_payload: {} },
        { onConflict: 'transaction_hash,offer_code' }
    );

if (cError) {
    console.log('Upsert test error:', cError.message);
} else {
    console.log('Upsert test: OK!');
    // Cleanup
    await supabase.from('ticto_pedidos').delete().eq('transaction_hash', 'CACHE_TEST_XYZ');
    console.log('Cleanup done');
}
