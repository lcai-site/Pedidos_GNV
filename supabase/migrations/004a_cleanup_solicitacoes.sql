-- =====================================================
-- LIMPEZA: Remover tabela solicitacoes e recomeçar
-- =====================================================

-- Remover políticas RLS
DROP POLICY IF EXISTS "Atendentes veem próprias solicitações" ON solicitacoes;
DROP POLICY IF EXISTS "Atendentes podem criar solicitações" ON solicitacoes;
DROP POLICY IF EXISTS "Atendentes atualizam próprias pendentes" ON solicitacoes;
DROP POLICY IF EXISTS "Apenas gestores deletam solicitações" ON solicitacoes;

-- Remover triggers
DROP TRIGGER IF EXISTS update_solicitacoes_updated_at ON solicitacoes;
DROP TRIGGER IF EXISTS trigger_log_solicitacao_status ON solicitacoes;
DROP TRIGGER IF EXISTS solicitacoes_audit ON solicitacoes;

-- Remover função (CASCADE remove triggers dependentes)
DROP FUNCTION IF EXISTS log_solicitacao_change() CASCADE;

-- Remover tabela (CASCADE remove índices automaticamente)
DROP TABLE IF EXISTS solicitacoes CASCADE;

-- Verificar se foi removida
SELECT tablename FROM pg_tables WHERE tablename = 'solicitacoes';
-- Deve retornar 0 resultados

-- =====================================================
-- Agora execute o script 004_create_solicitacoes_table.sql
-- =====================================================
