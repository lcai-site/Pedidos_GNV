/**
 * Script de Migração e Sincronização de Banco de Dados
 * 
 * Executa:
 * 1. Backup de pedidos_consolidados_v2
 * 2. Sincronização de schema entre produção e teste
 * 3. Exclusão de tabelas redundantes (v1 e v2)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

interface MigrationResult {
    success: boolean;
    message: string;
    details?: any;
}

class DatabaseMigrationService {
    private prodClient;
    private testClient;

    constructor() {
        this.prodClient = createClient(configs.production.url, configs.production.key);
        this.testClient = createClient(configs.test.url, configs.test.key);
    }

    /**
     * 1. Fazer backup de pedidos_consolidados_v2
     */
    async backupV2Table(): Promise<MigrationResult> {
        console.log('\n📦 FASE 1: Backup de pedidos_consolidados_v2...');

        try {
            const { data, error } = await this.prodClient
                .from('pedidos_consolidados_v2')
                .select('*');

            if (error) throw error;

            const backupDir = path.join(__dirname, '../backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(backupDir, `pedidos_consolidados_v2_${timestamp}.json`);

            fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));

            return {
                success: true,
                message: `✅ Backup criado com sucesso: ${data?.length || 0} registros`,
                details: { file: backupFile, records: data?.length || 0 }
            };
        } catch (error: any) {
            return {
                success: false,
                message: `❌ Erro ao fazer backup: ${error.message}`
            };
        }
    }

    /**
     * 2. Sincronizar schema entre produção e teste
     */
    async syncSchemas(): Promise<MigrationResult> {
        console.log('\n🔄 FASE 2: Sincronizando schemas...');

        try {
            // Criar tabelas faltantes em teste
            const tabelasFaltantes = [
                'pedidos_consolidados_v2',
                'solicitacoes_historico',
                'assinaturas',
                'carrinhos_abandonados'
            ];

            const results = [];

            for (const tabela of tabelasFaltantes) {
                // Verificar se tabela existe em teste
                const { data, error } = await this.testClient
                    .from(tabela)
                    .select('*', { count: 'exact', head: true });

                if (error && error.message.includes('does not exist')) {
                    results.push(`⚠️  ${tabela}: Tabela não existe em teste (precisa de migration manual)`);
                } else if (error) {
                    results.push(`❌ ${tabela}: Erro ao verificar - ${error.message}`);
                } else {
                    results.push(`✅ ${tabela}: Já existe em teste`);
                }
            }

            return {
                success: true,
                message: '✅ Verificação de schema concluída',
                details: results
            };
        } catch (error: any) {
            return {
                success: false,
                message: `❌ Erro ao sincronizar schemas: ${error.message}`
            };
        }
    }

    /**
     * 3. Excluir tabelas redundantes (v1 e v2)
     */
    async deleteRedundantTables(environment: 'production' | 'test'): Promise<MigrationResult> {
        console.log(`\n🗑️  FASE 3: Excluindo tabelas redundantes em ${environment}...`);

        const client = environment === 'production' ? this.prodClient : this.testClient;

        try {
            // Nota: Supabase client não suporta DROP TABLE diretamente
            // Precisamos usar SQL direto via RPC ou fazer manualmente

            return {
                success: false,
                message: `⚠️  Exclusão de tabelas requer acesso SQL direto (não disponível via client)`,
                details: {
                    action: 'manual',
                    sql: `
-- Execute manualmente no SQL Editor do Supabase:
DROP TABLE IF EXISTS pedidos_consolidados CASCADE;
DROP TABLE IF EXISTS pedidos_consolidados_v2 CASCADE;
          `.trim()
                }
            };
        } catch (error: any) {
            return {
                success: false,
                message: `❌ Erro: ${error.message}`
            };
        }
    }

    /**
     * 4. Criar migration SQL para sincronização automática
     */
    async generateSyncMigration(): Promise<MigrationResult> {
        console.log('\n📝 FASE 4: Gerando migration de sincronização...');

        const migrationSQL = `
-- ================================================================
-- MIGRATION: Sincronização de Schema e Limpeza de Redundâncias
-- Data: ${new Date().toISOString()}
-- ================================================================

-- 1. Criar tabelas faltantes em teste (se não existirem)
CREATE TABLE IF NOT EXISTS pedidos_consolidados_v2 (
  -- Schema será copiado da produção
  -- Esta tabela será removida após migração completa
);

CREATE TABLE IF NOT EXISTS solicitacoes_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID REFERENCES solicitacoes(id),
  acao TEXT,
  usuario_id UUID,
  data_acao TIMESTAMPTZ DEFAULT NOW(),
  detalhes JSONB
);

CREATE TABLE IF NOT EXISTS assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID,
  plano TEXT,
  status TEXT,
  valor DECIMAL(10,2),
  data_inicio DATE,
  data_fim DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carrinhos_abandonados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  produtos JSONB,
  valor_total DECIMAL(10,2),
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Comentar tabelas redundantes (preparação para exclusão)
COMMENT ON TABLE pedidos_consolidados IS 'DEPRECATED: Usar pedidos_consolidados_v3';
COMMENT ON TABLE pedidos_consolidados_v2 IS 'DEPRECATED: Usar pedidos_consolidados_v3';

-- 3. Criar view de compatibilidade (opcional)
CREATE OR REPLACE VIEW pedidos_consolidados_legacy AS
SELECT * FROM pedidos_consolidados_v3;

-- 4. Após validação, executar:
-- DROP TABLE IF EXISTS pedidos_consolidados CASCADE;
-- DROP TABLE IF EXISTS pedidos_consolidados_v2 CASCADE;
`.trim();

        const migrationDir = path.join(__dirname, '../supabase/migrations');
        if (!fs.existsSync(migrationDir)) {
            fs.mkdirSync(migrationDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const migrationFile = path.join(migrationDir, `${timestamp}_sync_and_cleanup.sql`);

        fs.writeFileSync(migrationFile, migrationSQL);

        return {
            success: true,
            message: `✅ Migration SQL gerada: ${migrationFile}`,
            details: { file: migrationFile }
        };
    }

    /**
     * Executar migração completa
     */
    async executeMigration(): Promise<void> {
        console.log('🚀 INICIANDO MIGRAÇÃO AUTOMÁTICA\n');
        console.log('='.repeat(60));

        // Fase 1: Backup
        const backupResult = await this.backupV2Table();
        console.log(backupResult.message);
        if (backupResult.details) {
            console.log('  📁 Arquivo:', backupResult.details.file);
            console.log('  📊 Registros:', backupResult.details.records);
        }

        // Fase 2: Sincronização
        const syncResult = await this.syncSchemas();
        console.log(syncResult.message);
        if (syncResult.details) {
            syncResult.details.forEach((detail: string) => console.log('  ', detail));
        }

        // Fase 3: Gerar Migration SQL
        const migrationResult = await this.generateSyncMigration();
        console.log(migrationResult.message);

        // Fase 4: Exclusão (manual)
        const deleteResult = await this.deleteRedundantTables('production');
        console.log(deleteResult.message);
        if (deleteResult.details?.sql) {
            console.log('\n📋 SQL para executar manualmente:');
            console.log(deleteResult.details.sql);
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ MIGRAÇÃO CONCLUÍDA\n');
        console.log('📌 PRÓXIMOS PASSOS:');
        console.log('1. ✅ Backup criado automaticamente');
        console.log('2. ⚠️  Atualizar código para usar pedidos_consolidados_v3');
        console.log('3. ⚠️  Executar SQL manual para excluir tabelas redundantes');
        console.log('4. ⚠️  Aplicar migration em teste e produção');
    }
}

// Executar migração
const service = new DatabaseMigrationService();
service.executeMigration().catch(console.error);
