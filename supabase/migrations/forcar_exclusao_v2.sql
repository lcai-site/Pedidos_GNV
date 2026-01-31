-- ================================================================
-- SCRIPT: Forçar Exclusão de pedidos_consolidados_v2
-- Objetivo: Remover TODAS as dependências e excluir a tabela
-- ================================================================

-- PASSO 1: BACKUP (CRÍTICO - NÃO PULE)
-- ================================================================

CREATE TABLE IF NOT EXISTS pedidos_consolidados_v2_backup AS
SELECT * FROM pedidos_consolidados_v2;

-- Verificar backup
SELECT COUNT(*) as registros_backup FROM pedidos_consolidados_v2_backup;

-- PASSO 2: REMOVER TODAS AS DEPENDÊNCIAS
-- ================================================================

-- 2.1 Desabilitar RLS
ALTER TABLE pedidos_consolidados_v2 DISABLE ROW LEVEL SECURITY;

-- 2.2 Remover TODAS as políticas RLS (se existirem)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'pedidos_consolidados_v2'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON pedidos_consolidados_v2', pol.policyname);
    RAISE NOTICE 'Removida política: %', pol.policyname;
  END LOOP;
END $$;

-- 2.3 Remover TODAS as foreign keys que apontam para v2
DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN 
    SELECT
      tc.table_name,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'pedidos_consolidados_v2'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I CASCADE', 
                   fk.table_name, fk.constraint_name);
    RAISE NOTICE 'Removida FK: % da tabela %', fk.constraint_name, fk.table_name;
  END LOOP;
END $$;

-- 2.4 Remover TODOS os triggers
DO $$
DECLARE
  trg RECORD;
BEGIN
  FOR trg IN 
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table = 'pedidos_consolidados_v2'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON pedidos_consolidados_v2 CASCADE', trg.trigger_name);
    RAISE NOTICE 'Removido trigger: %', trg.trigger_name;
  END LOOP;
END $$;

-- PASSO 3: EXCLUIR A TABELA
-- ================================================================

-- 3.1 Tentar exclusão com CASCADE (força remoção de dependências)
DROP TABLE IF EXISTS pedidos_consolidados_v2 CASCADE;

-- PASSO 4: VERIFICAÇÃO
-- ================================================================

-- 4.1 Verificar se foi removida
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'pedidos_consolidados_v2'
  ) THEN
    RAISE EXCEPTION '❌ pedidos_consolidados_v2 AINDA EXISTE!';
  ELSE
    RAISE NOTICE '✅ pedidos_consolidados_v2 foi REMOVIDA com sucesso!';
  END IF;
END $$;

-- 4.2 Verificar backup
SELECT 
  'pedidos_consolidados_v2_backup' as tabela,
  COUNT(*) as registros,
  pg_size_pretty(pg_total_relation_size('pedidos_consolidados_v2_backup')) as tamanho
FROM pedidos_consolidados_v2_backup;

-- ================================================================
-- FIM DO SCRIPT
-- ================================================================

-- RESULTADO ESPERADO:
-- ✅ Backup criado com 271 registros
-- ✅ Todas as dependências removidas
-- ✅ Tabela pedidos_consolidados_v2 excluída
-- ✅ Mensagem de sucesso exibida
