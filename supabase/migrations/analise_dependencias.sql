-- ================================================================
-- SCRIPT: Análise Completa de Dependências e Objetos
-- Objetivo: Identificar por que pedidos_consolidados_v2 não pode ser deletada
-- ================================================================

-- PARTE 1: LISTAR TODAS AS TABELAS E VIEWS
-- ================================================================

-- 1.1 Listar todas as tabelas
SELECT 
  'TABLE' as type,
  tablename as name,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size,
  (SELECT COUNT(*) FROM information_schema.table_constraints 
   WHERE table_name = tablename AND constraint_type = 'FOREIGN KEY') as fk_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 1.2 Listar todas as views
SELECT 
  'VIEW' as type,
  viewname as name,
  pg_size_pretty(pg_total_relation_size('public.'||viewname)) as size
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- PARTE 2: ANALISAR DEPENDÊNCIAS DE pedidos_consolidados_v2
-- ================================================================

-- 2.1 Verificar foreign keys que REFERENCIAM pedidos_consolidados_v2
SELECT
  tc.table_name as tabela_dependente,
  kcu.column_name as coluna,
  ccu.table_name as tabela_referenciada,
  ccu.column_name as coluna_referenciada
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'pedidos_consolidados_v2';

-- 2.2 Verificar views que DEPENDEM de pedidos_consolidados_v2
SELECT 
  v.viewname,
  v.definition
FROM pg_views v
WHERE v.schemaname = 'public'
  AND v.definition ILIKE '%pedidos_consolidados_v2%';

-- 2.3 Verificar políticas RLS em pedidos_consolidados_v2
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'pedidos_consolidados_v2';

-- 2.4 Verificar triggers em pedidos_consolidados_v2
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'pedidos_consolidados_v2';

-- PARTE 3: VERIFICAR OBJETOS FALTANTES EM TESTE
-- ================================================================

-- 3.1 Listar objetos que existem em produção mas podem não existir em teste
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'metas',
    'notificacoes',
    'pedidos_status_log',
    'pedidos_vendas',
    'ticto_logs',
    'feriados'
  )
ORDER BY tablename;

-- PARTE 4: SOLUÇÃO - REMOVER DEPENDÊNCIAS ANTES DE EXCLUIR
-- ================================================================

-- 4.1 Desabilitar RLS temporariamente (se necessário)
-- ALTER TABLE pedidos_consolidados_v2 DISABLE ROW LEVEL SECURITY;

-- 4.2 Remover políticas RLS
-- DROP POLICY IF EXISTS [nome_da_politica] ON pedidos_consolidados_v2;

-- 4.3 Remover foreign keys que apontam para v2
-- ALTER TABLE [tabela_dependente] DROP CONSTRAINT [nome_constraint];

-- 4.4 Agora sim, excluir a tabela
-- DROP TABLE IF EXISTS pedidos_consolidados_v2 CASCADE;

-- ================================================================
-- INSTRUÇÕES DE USO:
-- ================================================================
-- 1. Execute PARTE 1 para listar todos os objetos
-- 2. Execute PARTE 2 para identificar dependências
-- 3. Execute PARTE 3 para ver objetos faltantes
-- 4. Use os resultados para criar migration de sincronização
-- 5. Execute PARTE 4 (descomentando) para remover v2
