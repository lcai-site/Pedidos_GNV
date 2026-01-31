-- ================================================================
-- SCRIPT: Excluir pedidos_consolidados_v2 (VIEW)
-- DESCOBERTA: pedidos_consolidados_v2 é uma VIEW, não uma TABLE!
-- ================================================================

-- PASSO 1: VERIFICAR TIPO DO OBJETO
-- ================================================================

-- 1.1 Confirmar que é uma VIEW
SELECT 
  'VIEW' as tipo,
  viewname as nome,
  pg_size_pretty(pg_total_relation_size('public.'||viewname)) as tamanho
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'pedidos_consolidados_v2';

-- PASSO 2: BACKUP (Criar tabela a partir da VIEW)
-- ================================================================

-- 2.1 Criar backup materializando os dados da VIEW
CREATE TABLE IF NOT EXISTS pedidos_consolidados_v2_backup AS
SELECT * FROM pedidos_consolidados_v2;

-- 2.2 Verificar backup
SELECT 
  COUNT(*) as total_registros,
  pg_size_pretty(pg_total_relation_size('pedidos_consolidados_v2_backup')) as tamanho
FROM pedidos_consolidados_v2_backup;

-- PASSO 3: IDENTIFICAR VIEWS DEPENDENTES
-- ================================================================

-- 3.1 Verificar se outras views dependem de pedidos_consolidados_v2
SELECT 
  v.viewname as view_dependente,
  v.definition
FROM pg_views v
WHERE v.schemaname = 'public'
  AND v.definition ILIKE '%pedidos_consolidados_v2%'
  AND v.viewname != 'pedidos_consolidados_v2';

-- PASSO 4: EXCLUIR A VIEW
-- ================================================================

-- 4.1 Excluir a VIEW com CASCADE (remove views dependentes também)
DROP VIEW IF EXISTS pedidos_consolidados_v2 CASCADE;

-- PASSO 5: VERIFICAÇÃO
-- ================================================================

-- 5.1 Confirmar que foi removida
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname = 'pedidos_consolidados_v2'
  ) THEN
    RAISE EXCEPTION '❌ VIEW pedidos_consolidados_v2 AINDA EXISTE!';
  ELSE
    RAISE NOTICE '✅ VIEW pedidos_consolidados_v2 foi REMOVIDA com sucesso!';
  END IF;
END $$;

-- 5.2 Verificar backup
SELECT 
  'Backup criado com sucesso!' as status,
  COUNT(*) as registros,
  pg_size_pretty(pg_total_relation_size('pedidos_consolidados_v2_backup')) as tamanho
FROM pedidos_consolidados_v2_backup;

-- ================================================================
-- RESUMO DA DESCOBERTA
-- ================================================================

-- pedidos_consolidados (v1) = VIEW
-- pedidos_consolidados_v2 = VIEW (não TABLE!)
-- pedidos_consolidados_v3 = TABLE (versão atual)

-- CONCLUSÃO:
-- Ambas v1 e v2 são VIEWS, não tabelas físicas.
-- Apenas v3 é uma tabela real com dados.

-- ================================================================
-- FIM DO SCRIPT
-- ================================================================
