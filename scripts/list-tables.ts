import { createClient } from '@supabase/supabase-js';

// Configurações dos bancos
const configs = {
    production: {
        url: 'https://cgyxinpejaoadsqrxbhy.supabase.co',
        key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA'
    },
    test: {
        url: 'https://vkeshyusimduiwjaijjv.supabase.co',
        key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZXNoeXVzaW1kdWl3amFpamp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NDQ5NzcsImV4cCI6MjA4MzEyMDk3N30.54dikLQBkzT2dBJzuupaVcK3_vlchWVI08TQ2cxCgJw'
    }
};

async function listTables(env: 'production' | 'test') {
    const config = configs[env];
    const supabase = createClient(config.url, config.key);

    console.log(`\n========== ${env.toUpperCase()} ==========`);

    try {
        // Query para listar todas as tabelas do schema public
        const { data, error } = await supabase.rpc('exec_sql', {
            query: `
        SELECT 
          table_name,
          (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `
        });

        if (error) {
            // Tentar abordagem alternativa se RPC não funcionar
            console.log('Tentando abordagem alternativa...');

            // Listar tabelas conhecidas do código
            const knownTables = [
                'profiles',
                'pedidos',
                'pedidos_consolidados',
                'pedidos_consolidados_v2',
                'pedidos_consolidados_v3',
                'pedidos_unificados',
                'pedidos_agrupados',
                'solicitacoes',
                'solicitacoes_historico',
                'assinaturas',
                'carrinhos_abandonados'
            ];

            for (const table of knownTables) {
                const { count, error: countError } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true });

                if (!countError) {
                    console.log(`✓ ${table} (${count} registros)`);
                } else {
                    console.log(`✗ ${table} - ${countError.message}`);
                }
            }
        } else {
            console.log(data);
        }
    } catch (err) {
        console.error(`Erro ao acessar ${env}:`, err);
    }
}

async function main() {
    await listTables('production');
    await listTables('test');
}

main();
