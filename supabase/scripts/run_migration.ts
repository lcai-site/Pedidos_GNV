/**
 * Script para executar a migration de feriados e dias úteis
 * Execute com: npx tsx supabase/scripts/run_migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Erro: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem estar definidos');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    console.log('🚀 Executando migration de feriados e dias úteis...\n');

    try {
        // Ler o arquivo SQL
        const migrationPath = path.join(__dirname, '../migrations/007_create_pedidos_consolidados_view.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');

        // Dividir em comandos individuais (separados por ponto-e-vírgula)
        const commands = sql
            .split(';')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

        console.log(`📝 Encontrados ${commands.length} comandos SQL\n`);

        // Executar cada comando
        for (let i = 0; i < commands.length; i++) {
            const cmd = commands[i];
            console.log(`⏳ Executando comando ${i + 1}/${commands.length}...`);

            const { error } = await supabase.rpc('exec_sql', { sql_query: cmd });

            if (error) {
                console.error(`❌ Erro no comando ${i + 1}:`, error.message);
                console.error('Comando:', cmd.substring(0, 100) + '...');
                throw error;
            }

            console.log(`✅ Comando ${i + 1} executado com sucesso\n`);
        }

        console.log('✅ Migration executada com sucesso!\n');

        // Testar a VIEW
        console.log('🧪 Testando VIEW...\n');

        const { data, error } = await supabase
            .from('pedidos_consolidados_v2')
            .select('codigo_transacao, data_venda, dia_pos_vendas, dia_despacho, corte_pv')
            .gte('data_venda', '2026-01-23')
            .lte('data_venda', '2026-01-27')
            .limit(5);

        if (error) {
            console.error('❌ Erro ao testar VIEW:', error.message);
            throw error;
        }

        console.log('📊 Primeiros 5 pedidos:');
        console.table(data);

        console.log('\n✅ Tudo funcionando corretamente!');

    } catch (error) {
        console.error('\n❌ Erro ao executar migration:', error);
        process.exit(1);
    }
}

runMigration();
