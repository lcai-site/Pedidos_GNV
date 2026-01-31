-- ================================================================
-- MIGRATION: Sincronização de Schema e Limpeza de Redundâncias
-- Data: 2026-01-30
-- Objetivo: Alinhar ambientes de produção e teste, remover tabelas obsoletas
-- ================================================================

-- PARTE 1: SINCRONIZAÇÃO DE SCHEMA (Executar em TESTE primeiro)
-- ================================================================

-- 1.1 Verificar se tabelas faltantes existem
-- Estas tabelas existem em produção mas podem não existir em teste

-- Criar solicitacoes_historico se não existir
CREATE TABLE IF NOT EXISTS solicitacoes_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID REFERENCES solicitacoes(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  usuario_id UUID,
  data_acao TIMESTAMPTZ DEFAULT NOW(),
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar assinaturas se não existir
CREATE TABLE IF NOT EXISTS assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID,
  cliente_nome TEXT,
  cliente_email TEXT,
  plano TEXT,
  status TEXT DEFAULT 'Ativa',
  valor DECIMAL(10,2),
  data_inicio DATE,
  data_fim DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar carrinhos_abandonados se não existir
CREATE TABLE IF NOT EXISTS carrinhos_abandonados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  produtos JSONB,
  valor_total DECIMAL(10,2),
  email TEXT,
  telefone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_solicitacoes_historico_solicitacao_id 
  ON solicitacoes_historico(solicitacao_id);

CREATE INDEX IF NOT EXISTS idx_assinaturas_status 
  ON assinaturas(status);

CREATE INDEX IF NOT EXISTS idx_assinaturas_created_at 
  ON assinaturas(created_at);

CREATE INDEX IF NOT EXISTS idx_carrinhos_abandonados_created_at 
  ON carrinhos_abandonados(created_at);

-- PARTE 2: PREPARAÇÃO PARA LIMPEZA (Executar em PRODUÇÃO e TESTE)
-- ================================================================

-- 2.1 Marcar objetos redundantes como deprecated
-- NOTA: pedidos_consolidados é uma VIEW, não uma TABLE
COMMENT ON VIEW pedidos_consolidados IS 
  'DEPRECATED: View obsoleta. Usar pedidos_consolidados_v3 diretamente. Será removida em breve.';

COMMENT ON TABLE pedidos_consolidados_v2 IS 
  'DEPRECATED: Versão intermediária obsoleta. Usar pedidos_consolidados_v3. Será removida em breve.';

-- 2.2 Criar view de compatibilidade (opcional, para rollback se necessário)
CREATE OR REPLACE VIEW pedidos_consolidados_legacy AS
SELECT * FROM pedidos_consolidados_v3;

COMMENT ON VIEW pedidos_consolidados_legacy IS 
  'View de compatibilidade temporária. Aponta para pedidos_consolidados_v3.';

-- PARTE 3: VALIDAÇÃO (Executar ANTES de excluir)
-- ================================================================

-- 3.1 Verificar se há dados em v2 que não estão em v3
DO $$
DECLARE
  v2_count INTEGER;
  v3_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v2_count FROM pedidos_consolidados_v2;
  SELECT COUNT(*) INTO v3_count FROM pedidos_consolidados_v3;
  
  RAISE NOTICE 'Registros em v2: %', v2_count;
  RAISE NOTICE 'Registros em v3: %', v3_count;
  
  IF v2_count > v3_count THEN
    RAISE WARNING 'ATENÇÃO: v2 tem mais registros que v3! Verifique antes de excluir.';
  END IF;
END $$;

-- 3.2 Listar objetos que serão afetados (tabelas e views)
SELECT 
  'TABLE' as type,
  tablename as name,
  schemaname,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('pedidos_consolidados_v2')
UNION ALL
SELECT 
  'VIEW' as type,
  viewname as name,
  schemaname,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||viewname)) as size
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('pedidos_consolidados')
ORDER BY type, name;

-- PARTE 4: EXCLUSÃO DE TABELAS REDUNDANTES (Executar APENAS após validação)
-- ================================================================

-- ⚠️ ATENÇÃO: Executar APENAS após:
-- 1. Backup completo do banco
-- 2. Validação de que v3 contém todos os dados
-- 3. Testes em ambiente de staging
-- 4. Aprovação final

-- 4.1 Excluir pedidos_consolidados (v1) - É uma VIEW, não TABLE
-- DROP VIEW IF EXISTS pedidos_consolidados CASCADE;

-- 4.2 Excluir pedidos_consolidados_v2 - É uma TABLE
-- DROP TABLE IF EXISTS pedidos_consolidados_v2 CASCADE;

-- PARTE 5: LIMPEZA PÓS-EXCLUSÃO (Executar APÓS exclusão bem-sucedida)
-- ================================================================

-- 5.1 Remover view de compatibilidade (se não for mais necessária)
-- DROP VIEW IF EXISTS pedidos_consolidados_legacy;

-- 5.2 Vacuum para liberar espaço
-- VACUUM ANALYZE pedidos_consolidados_v3;

-- ================================================================
-- FIM DA MIGRATION
-- ================================================================

-- INSTRUÇÕES DE EXECUÇÃO:
-- 
-- 1. TESTE (vkeshyusimduiwjaijjv.supabase.co):
--    - Executar PARTE 1 (Sincronização)
--    - Executar PARTE 2 (Preparação)
--    - Executar PARTE 3 (Validação)
--    - Executar PARTE 4 (Exclusão) - DESCOMENTAR os DROPs
--    - Testar aplicação
--
-- 2. PRODUÇÃO (cgyxinpejaoadsqrxbhy.supabase.co):
--    - Fazer BACKUP COMPLETO
--    - Executar PARTE 2 (Preparação)
--    - Executar PARTE 3 (Validação)
--    - Aguardar janela de manutenção
--    - Executar PARTE 4 (Exclusão) - DESCOMENTAR os DROPs
--    - Validar aplicação
--    - Executar PARTE 5 (Limpeza)
