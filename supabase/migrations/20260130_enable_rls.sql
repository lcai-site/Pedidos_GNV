-- ================================================================
-- RLS (Row Level Security) - Políticas de Segurança
-- Data: 2026-01-30
-- Objetivo: Proteger todas as tabelas com RLS
-- ================================================================

-- ================================================================
-- PARTE 1: HABILITAR RLS EM TODAS AS TABELAS
-- ================================================================

-- Tabelas principais
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_consolidados_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_unificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_agrupados ENABLE ROW LEVEL SECURITY;

-- Tabelas de usuários
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Tabelas de features
ALTER TABLE solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrinhos_abandonados ENABLE ROW LEVEL SECURITY;

-- Tabelas de sistema (less restrictive)
ALTER TABLE feriados ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- PARTE 2: POLÍTICAS PARA TABELAS PRINCIPAIS
-- ================================================================

-- 2.1 Profiles: Usuário vê apenas seu próprio perfil
DROP POLICY IF EXISTS profile_select_own ON profiles;
CREATE POLICY profile_select_own ON profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS profile_update_own ON profiles;
CREATE POLICY profile_update_own ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- 2.2 Pedidos: Todos os usuários autenticados podem ler
DROP POLICY IF EXISTS pedidos_select_authenticated ON pedidos;
CREATE POLICY pedidos_select_authenticated ON pedidos
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS pedidos_insert_authenticated ON pedidos;
CREATE POLICY pedidos_insert_authenticated ON pedidos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS pedidos_update_authenticated ON pedidos;
CREATE POLICY pedidos_update_authenticated ON pedidos
  FOR UPDATE
  TO authenticated
  USING (true);

-- 2.3 Pedidos Consolidados V3: Acesso para usuários autenticados
DROP POLICY IF EXISTS pedidos_consolidados_v3_select ON pedidos_consolidados_v3;
CREATE POLICY pedidos_consolidados_v3_select ON pedidos_consolidados_v3
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS pedidos_consolidados_v3_update ON pedidos_consolidados_v3;
CREATE POLICY pedidos_consolidados_v3_update ON pedidos_consolidados_v3
  FOR UPDATE
  TO authenticated
  USING (true);

-- 2.4 Pedidos Unificados: Acesso para usuários autenticados
DROP POLICY IF EXISTS pedidos_unificados_select ON pedidos_unificados;
CREATE POLICY pedidos_unificados_select ON pedidos_unificados
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS pedidos_unificados_update ON pedidos_unificados;
CREATE POLICY pedidos_unificados_update ON pedidos_unificados
  FOR UPDATE
  TO authenticated
  USING (true);

-- 2.5 Pedidos Agrupados: Acesso para usuários autenticados
DROP POLICY IF EXISTS pedidos_agrupados_select ON pedidos_agrupados;
CREATE POLICY pedidos_agrupados_select ON pedidos_agrupados
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS pedidos_agrupados_update ON pedidos_agrupados;
CREATE POLICY pedidos_agrupados_update ON pedidos_agrupados
  FOR UPDATE
  TO authenticated
  USING (true);

-- ================================================================
-- PARTE 3: POLÍTICAS PARA FEATURES
-- ================================================================

-- 3.1 Solicitações: Acesso para autenticados
DROP POLICY IF EXISTS solicitacoes_select ON solicitacoes;
CREATE POLICY solicitacoes_select ON solicitacoes
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS solicitacoes_insert ON solicitacoes;
CREATE POLICY solicitacoes_insert ON solicitacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS solicitacoes_update ON solicitacoes;
CREATE POLICY solicitacoes_update ON solicitacoes
  FOR UPDATE
  TO authenticated
  USING (true);

-- 3.2 Histórico de Solicitações
DROP POLICY IF EXISTS solicitacoes_historico_select ON solicitacoes_historico;
CREATE POLICY solicitacoes_historico_select ON solicitacoes_historico
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS solicitacoes_historico_insert ON solicitacoes_historico;
CREATE POLICY solicitacoes_historico_insert ON solicitacoes_historico
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3.3 Assinaturas
DROP POLICY IF EXISTS assinaturas_select ON assinaturas;
CREATE POLICY assinaturas_select ON assinaturas
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS assinaturas_all ON assinaturas;
CREATE POLICY assinaturas_all ON assinaturas
  FOR ALL
  TO authenticated
  USING (true);

-- 3.4 Carrinhos Abandonados
DROP POLICY IF EXISTS carrinhos_abandonados_select ON carrinhos_abandonados;
CREATE POLICY carrinhos_abandonados_select ON carrinhos_abandonados
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS carrinhos_abandonados_all ON carrinhos_abandonados;
CREATE POLICY carrinhos_abandonados_all ON carrinhos_abandonados
  FOR ALL
  TO authenticated
  USING (true);

-- ================================================================
-- PARTE 4: POLÍTICAS PARA TABELAS DE SISTEMA
-- ================================================================

-- 4.1 Feriados: Leitura pública, escrita para autenticados
DROP POLICY IF EXISTS feriados_select_public ON feriados;
CREATE POLICY feriados_select_public ON feriados
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS feriados_insert_authenticated ON feriados;
CREATE POLICY feriados_insert_authenticated ON feriados
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ================================================================
-- PARTE 5: PERMITIR SERVICE ROLE (WEBHOOKS)
-- ================================================================

-- Service role bypassa RLS automaticamente
-- Isso permite que webhooks (usando service_role key) funcionem

-- ================================================================
-- VERIFICAÇÃO
-- ================================================================

DO $$
DECLARE
  table_rec RECORD;
  rls_enabled BOOLEAN;
BEGIN
  FOR table_rec IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    AND tablename IN (
      'pedidos', 'pedidos_consolidados_v3', 'pedidos_unificados',
      'pedidos_agrupados', 'profiles', 'solicitacoes', 
      'solicitacoes_historico', 'assinaturas', 'carrinhos_abandonados',
      'feriados'
    )
  LOOP
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = table_rec.tablename;
    
    IF rls_enabled THEN
      RAISE NOTICE '✅ RLS ativo em: %', table_rec.tablename;
    ELSE
      RAISE WARNING '❌ RLS NÃO ativo em: %', table_rec.tablename;
    END IF;
  END LOOP;
END $$;

-- ================================================================
-- FIM
-- ================================================================
