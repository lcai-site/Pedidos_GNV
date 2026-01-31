-- ================================================================
-- MIGRATION: Sincronização de Schema - AMBIENTE DE TESTE
-- Data: 2026-01-30
-- Objetivo: Preparar ambiente de teste para sincronização com produção
-- ================================================================

-- PARTE 1: CRIAR ESTRUTURA FALTANTE
-- ================================================================

-- 1.1 Criar tabelas que existem em produção mas não em teste
CREATE TABLE IF NOT EXISTS solicitacoes_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID REFERENCES solicitacoes(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  usuario_id UUID,
  data_acao TIMESTAMPTZ DEFAULT NOW(),
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- 1.2 Adicionar índices
CREATE INDEX IF NOT EXISTS idx_solicitacoes_historico_solicitacao_id 
  ON solicitacoes_historico(solicitacao_id);

CREATE INDEX IF NOT EXISTS idx_assinaturas_status 
  ON assinaturas(status);

CREATE INDEX IF NOT EXISTS idx_assinaturas_created_at 
  ON assinaturas(created_at);

CREATE INDEX IF NOT EXISTS idx_carrinhos_abandonados_created_at 
  ON carrinhos_abandonados(created_at);

-- PARTE 2: VERIFICAÇÃO
-- ================================================================

-- 2.1 Verificar se pedidos_consolidados é uma VIEW
DO $$
DECLARE
  is_view BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname = 'pedidos_consolidados'
  ) INTO is_view;
  
  IF is_view THEN
    RAISE NOTICE '✅ pedidos_consolidados é uma VIEW';
  ELSE
    RAISE NOTICE '⚠️  pedidos_consolidados não encontrada';
  END IF;
END $$;

-- 2.2 Verificar se pedidos_consolidados_v3 existe
DO $$
DECLARE
  table_exists BOOLEAN;
  record_count INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'pedidos_consolidados_v3'
  ) INTO table_exists;
  
  IF table_exists THEN
    SELECT COUNT(*) INTO record_count FROM pedidos_consolidados_v3;
    RAISE NOTICE '✅ pedidos_consolidados_v3 existe com % registros', record_count;
  ELSE
    RAISE NOTICE '❌ pedidos_consolidados_v3 NÃO EXISTE!';
  END IF;
END $$;

-- PARTE 3: LIMPEZA (Opcional - apenas se VIEW antiga existir)
-- ================================================================

-- 3.1 Remover VIEW antiga se existir
-- DESCOMENTAR apenas se quiser remover a VIEW antiga
-- DROP VIEW IF EXISTS pedidos_consolidados CASCADE;

-- ================================================================
-- FIM DA MIGRATION - TESTE
-- ================================================================

-- RESULTADO ESPERADO:
-- ✅ Tabelas faltantes criadas
-- ✅ Índices adicionados
-- ✅ Verificações executadas
-- ⚠️  pedidos_consolidados_v2 NÃO será criada (não é necessária)
