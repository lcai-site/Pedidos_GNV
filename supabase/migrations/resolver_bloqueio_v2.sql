-- ================================================================
-- SCRIPT: Resolver Bloqueio de pedidos_consolidados_v2
-- Objetivo: Identificar e remover dependências para permitir exclusão
-- ================================================================

-- PASSO 1: IDENTIFICAR DEPENDÊNCIAS
-- ================================================================

-- 1.1 Verificar se há foreign keys apontando para v2
SELECT
  tc.table_name as tabela_dependente,
  tc.constraint_name,
  kcu.column_name as coluna,
  ccu.table_name as tabela_referenciada,
  ccu.column_name as coluna_referenciada
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'pedidos_consolidados_v2';

-- 1.2 Verificar views que dependem de v2
SELECT 
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND definition ILIKE '%pedidos_consolidados_v2%';

-- 1.3 Verificar políticas RLS em v2
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'pedidos_consolidados_v2';

-- PASSO 2: REMOVER DEPENDÊNCIAS
-- ================================================================

-- 2.1 Se houver foreign keys, remover (DESCOMENTAR após identificar)
-- ALTER TABLE [tabela_dependente] DROP CONSTRAINT [nome_constraint];

-- 2.2 Se houver views dependentes, recriar apontando para v3
-- DROP VIEW IF EXISTS [nome_view] CASCADE;
-- CREATE VIEW [nome_view] AS SELECT * FROM pedidos_consolidados_v3;

-- 2.3 Remover políticas RLS de v2
-- DROP POLICY IF EXISTS [nome_politica] ON pedidos_consolidados_v2;

-- 2.4 Desabilitar RLS temporariamente
-- ALTER TABLE pedidos_consolidados_v2 DISABLE ROW LEVEL SECURITY;

-- PASSO 3: TENTAR EXCLUSÃO
-- ================================================================

-- 3.1 Criar backup antes de excluir
CREATE TABLE IF NOT EXISTS pedidos_consolidados_v2_backup AS
SELECT * FROM pedidos_consolidados_v2;

-- Adicionar comentário ao backup
DO $$
BEGIN
  EXECUTE format(
    'COMMENT ON TABLE pedidos_consolidados_v2_backup IS %L',
    'Backup de pedidos_consolidados_v2 antes da exclusão - ' || NOW()::TEXT
  );
END $$;

-- 3.2 Excluir a tabela (DESCOMENTAR após remover dependências)
-- DROP TABLE IF EXISTS pedidos_consolidados_v2 CASCADE;

-- PASSO 4: VERIFICAÇÃO
-- ================================================================

-- 4.1 Verificar se v2 foi removida
SELECT 
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'pedidos_consolidados_v2';

-- Se retornar vazio, exclusão foi bem-sucedida!

-- ================================================================
-- INSTRUÇÕES DE USO:
-- ================================================================
-- 1. Execute PASSO 1 para identificar dependências
-- 2. Use os resultados para descomentar comandos do PASSO 2
-- 3. Execute PASSO 2 para remover dependências
-- 4. Execute PASSO 3 para criar backup e excluir
-- 5. Execute PASSO 4 para confirmar exclusão
