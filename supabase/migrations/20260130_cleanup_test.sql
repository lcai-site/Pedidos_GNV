-- ================================================================
-- MIGRATION: Excluir Views Obsoletas - AMBIENTE DE TESTE
-- Data: 2026-01-30
-- Objetivo: Remover apenas views v1 e v2 em teste
-- NOTA: pedidos_consolidados_v3 NÃO EXISTE em teste (só em produção)
-- ================================================================

-- ================================================================
-- PASSO 1: BACKUP (Materializar dados das views se existirem)
-- ================================================================

-- 1.1 Backup da VIEW v1 (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'pedidos_consolidados') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS pedidos_consolidados_v1_backup AS SELECT * FROM pedidos_consolidados';
    RAISE NOTICE '✅ Backup de pedidos_consolidados (v1) criado';
  ELSE
    RAISE NOTICE '⚠️  VIEW pedidos_consolidados (v1) não existe em teste';
  END IF;
END $$;

-- 1.2 Backup da VIEW v2 (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'pedidos_consolidados_v2') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS pedidos_consolidados_v2_backup AS SELECT * FROM pedidos_consolidados_v2';
    RAISE NOTICE '✅ Backup de pedidos_consolidados_v2 criado';
  ELSE
    RAISE NOTICE '⚠️  VIEW pedidos_consolidados_v2 não existe em teste';
  END IF;
END $$;

-- ================================================================
-- PASSO 2: EXCLUIR VIEWS OBSOLETAS
-- ================================================================

-- 2.1 Excluir VIEW v1
DROP VIEW IF EXISTS pedidos_consolidados CASCADE;

-- 2.2 Excluir VIEW v2
DROP VIEW IF EXISTS pedidos_consolidados_v2 CASCADE;

-- ================================================================
-- PASSO 3: VERIFICAÇÃO
-- ================================================================

-- 3.1 Confirmar que views foram removidas
DO $$
DECLARE
  v1_exists BOOLEAN;
  v2_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'pedidos_consolidados') INTO v1_exists;
  SELECT EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'pedidos_consolidados_v2') INTO v2_exists;
  
  IF NOT v1_exists AND NOT v2_exists THEN
    RAISE NOTICE '✅ SUCESSO! Ambas as views foram removidas (ou não existiam)';
  ELSE
    IF v1_exists THEN
      RAISE WARNING '❌ pedidos_consolidados (v1) ainda existe!';
    END IF;
    IF v2_exists THEN
      RAISE WARNING '❌ pedidos_consolidados_v2 ainda existe!';
    END IF;
  END IF;
END $$;

-- 3.2 Listar backups criados (se existirem)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename IN ('pedidos_consolidados_v1_backup', 'pedidos_consolidados_v2_backup')
  ) THEN
    RAISE NOTICE '✅ Backups disponíveis:';
    PERFORM tablename FROM pg_tables 
    WHERE tablename IN ('pedidos_consolidados_v1_backup', 'pedidos_consolidados_v2_backup');
  ELSE
    RAISE NOTICE 'ℹ️  Nenhum backup criado (views não existiam)';
  END IF;
END $$;

-- ================================================================
-- RESULTADO ESPERADO
-- ================================================================

-- ✅ pedidos_consolidados (VIEW v1) - REMOVIDA (se existia)
-- ✅ pedidos_consolidados_v2 (VIEW v2) - REMOVIDA (se existia)
-- ℹ️  pedidos_consolidados_v3 - NÃO EXISTE em teste (normal)
-- ✅ Ambiente de teste limpo e pronto

-- ================================================================
-- FIM DA MIGRATION - TESTE
-- ================================================================
