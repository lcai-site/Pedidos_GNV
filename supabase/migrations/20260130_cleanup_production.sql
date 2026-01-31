-- ================================================================
-- MIGRATION: Limpeza de Redundâncias - AMBIENTE DE PRODUÇÃO
-- Data: 2026-01-30
-- Objetivo: Remover tabelas e views obsoletas de produção
-- ================================================================

-- ⚠️ ATENÇÃO: EXECUTAR APENAS EM PRODUÇÃO
-- ⚠️ FAZER BACKUP COMPLETO ANTES DE EXECUTAR

-- PARTE 1: VALIDAÇÃO PRÉ-EXCLUSÃO
-- ================================================================

-- 1.1 Verificar contagem de registros
DO $$
DECLARE
  v2_count INTEGER;
  v3_count INTEGER;
BEGIN
  -- Verificar se v2 existe
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'pedidos_consolidados_v2'
  ) THEN
    SELECT COUNT(*) INTO v2_count FROM pedidos_consolidados_v2;
    RAISE NOTICE 'Registros em v2: %', v2_count;
  ELSE
    RAISE NOTICE 'pedidos_consolidados_v2 não existe';
    v2_count := 0;
  END IF;
  
  -- Verificar v3
  SELECT COUNT(*) INTO v3_count FROM pedidos_consolidados_v3;
  RAISE NOTICE 'Registros em v3: %', v3_count;
  
  IF v2_count > v3_count THEN
    RAISE WARNING '⚠️  ATENÇÃO: v2 tem mais registros que v3! NÃO PROSSIGA COM A EXCLUSÃO.';
  ELSIF v2_count > 0 THEN
    RAISE NOTICE '✅ v3 tem >= registros que v2. Seguro prosseguir.';
  END IF;
END $$;

-- 1.2 Listar objetos que serão removidos
SELECT 
  'VIEW' as type,
  viewname as name,
  schemaname,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||viewname)) as size
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('pedidos_consolidados')
UNION ALL
SELECT 
  'TABLE' as type,
  tablename as name,
  schemaname,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('pedidos_consolidados_v2')
ORDER BY type, name;

-- PARTE 2: BACKUP (Executar ANTES da exclusão)
-- ================================================================

-- 2.1 Criar backup de pedidos_consolidados_v2 como tabela temporária
-- DESCOMENTAR para criar backup
/*
CREATE TABLE pedidos_consolidados_v2_backup AS
SELECT * FROM pedidos_consolidados_v2;

COMMENT ON TABLE pedidos_consolidados_v2_backup IS 
  'Backup de pedidos_consolidados_v2 antes da exclusão - ' || NOW()::TEXT;
*/

-- PARTE 3: EXCLUSÃO (Executar APENAS após validação e backup)
-- ================================================================

-- ⚠️ DESCOMENTAR APENAS APÓS:
-- 1. Backup completo do banco
-- 2. Validação de que v3 >= v2
-- 3. Aprovação final

-- 3.1 Remover VIEW antiga
-- DROP VIEW IF EXISTS pedidos_consolidados CASCADE;

-- 3.2 Remover tabela v2
-- DROP TABLE IF EXISTS pedidos_consolidados_v2 CASCADE;

-- PARTE 4: LIMPEZA PÓS-EXCLUSÃO
-- ================================================================

-- 4.1 Vacuum para liberar espaço
-- VACUUM ANALYZE pedidos_consolidados_v3;

-- 4.2 Remover backup temporário (após validação de 7 dias)
-- DROP TABLE IF EXISTS pedidos_consolidados_v2_backup;

-- ================================================================
-- FIM DA MIGRATION - PRODUÇÃO
-- ================================================================

-- CHECKLIST DE EXECUÇÃO:
-- [ ] Backup completo do banco criado
-- [ ] PARTE 1 executada - validação OK
-- [ ] PARTE 2 executada - backup criado
-- [ ] Aplicação testada e funcionando
-- [ ] PARTE 3 executada - objetos removidos
-- [ ] Aplicação validada após remoção
-- [ ] PARTE 4 executada - limpeza concluída
