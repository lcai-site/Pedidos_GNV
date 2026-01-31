-- ================================================================
-- MIGRATION FINAL: Excluir Apenas Views Obsoletas
-- Data: 2026-01-30
-- Objetivo: Remover pedidos_consolidados (v1) e pedidos_consolidados_v2 (v2)
-- Decisão: Manter TODAS as tabelas para desenvolvimento futuro
-- ================================================================

-- CONTEXTO:
-- - pedidos_consolidados (v1) = VIEW obsoleta
-- - pedidos_consolidados_v2 (v2) = VIEW obsoleta
-- - pedidos_consolidados_v3 = TABLE ativa (manter)
-- - Código já migrado 100% para v3

-- ================================================================
-- PASSO 1: BACKUP (Materializar dados das views)
-- ================================================================

-- 1.1 Backup da VIEW v1 (se tiver dados)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'pedidos_consolidados') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS pedidos_consolidados_v1_backup AS SELECT * FROM pedidos_consolidados';
    RAISE NOTICE '✅ Backup de pedidos_consolidados (v1) criado';
  ELSE
    RAISE NOTICE '⚠️  VIEW pedidos_consolidados (v1) não existe';
  END IF;
END $$;

-- 1.2 Backup da VIEW v2 (se tiver dados)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'pedidos_consolidados_v2') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS pedidos_consolidados_v2_backup AS SELECT * FROM pedidos_consolidados_v2';
    RAISE NOTICE '✅ Backup de pedidos_consolidados_v2 criado';
  ELSE
    RAISE NOTICE '⚠️  VIEW pedidos_consolidados_v2 não existe';
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
    RAISE NOTICE '✅ SUCESSO! Ambas as views foram removidas';
  ELSE
    IF v1_exists THEN
      RAISE WARNING '❌ pedidos_consolidados (v1) ainda existe!';
    END IF;
    IF v2_exists THEN
      RAISE WARNING '❌ pedidos_consolidados_v2 ainda existe!';
    END IF;
  END IF;
END $$;

-- 3.2 Confirmar que v3 (TABLE) ainda existe
DO $$
DECLARE
  v3_exists BOOLEAN;
  v3_count INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'pedidos_consolidados_v3'
  ) INTO v3_exists;
  
  IF v3_exists THEN
    SELECT COUNT(*) INTO v3_count FROM pedidos_consolidados_v3;
    RAISE NOTICE '✅ pedidos_consolidados_v3 (TABLE) mantida com % registros', v3_count;
  ELSE
    RAISE EXCEPTION '❌ ERRO CRÍTICO! pedidos_consolidados_v3 não existe!';
  END IF;
END $$;

-- 3.3 Listar backups criados (se existirem)
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as tamanho
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('pedidos_consolidados_v1_backup', 'pedidos_consolidados_v2_backup')
ORDER BY tablename;

-- ================================================================
-- RESULTADO ESPERADO
-- ================================================================

-- ✅ pedidos_consolidados (VIEW v1) - REMOVIDA
-- ✅ pedidos_consolidados_v2 (VIEW v2) - REMOVIDA
-- ✅ pedidos_consolidados_v3 (TABLE) - MANTIDA
-- ✅ Backups criados (se views tinham dados)
-- ✅ Todas as outras tabelas mantidas para desenvolvimento futuro

-- ================================================================
-- TABELAS MANTIDAS PARA DESENVOLVIMENTO FUTURO:
-- ================================================================

-- Essenciais (em uso):
-- - pedidos, pedidos_consolidados_v3, pedidos_unificados, pedidos_agrupados
-- - profiles, solicitacoes, solicitacoes_historico, feriados

-- Planejadas (features futuras):
-- - assinaturas, carrinhos_abandonados

-- Infraestrutura (podem ser úteis):
-- - ticto_logs (logs de integração)
-- - pedidos_vendas (vendas)
-- - pedidos_status_log (histórico de status)
-- - notificacoes (sistema de notificações)
-- - metas (sistema de metas)

-- ================================================================
-- FIM DA MIGRATION
-- ================================================================
