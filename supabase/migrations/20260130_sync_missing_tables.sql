-- ================================================================
-- MIGRATION: Sincronização Completa Produção → Teste
-- Data: 2026-01-30
-- Objetivo: Criar todas as tabelas que existem em produção mas não em teste
-- ================================================================

-- PARTE 1: CRIAR TABELAS FALTANTES
-- ================================================================

-- 1.1 Tabela: feriados (64 kB)
CREATE TABLE IF NOT EXISTS feriados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL UNIQUE,
  nome TEXT,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('nacional', 'estadual', 'municipal')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feriados_data ON feriados(data);

COMMENT ON TABLE feriados IS 'Feriados nacionais, estaduais (SP) e municipais (Indaiatuba)';

-- 1.2 Tabela: metas (16 kB)
CREATE TABLE IF NOT EXISTS metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo TEXT NOT NULL, -- Ex: '2026-01', 'Q1-2026'
  tipo TEXT NOT NULL, -- 'mensal', 'trimestral', 'anual'
  valor_meta DECIMAL(10,2) NOT NULL,
  valor_realizado DECIMAL(10,2) DEFAULT 0,
  percentual_atingido DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN valor_meta > 0 THEN (valor_realizado / valor_meta * 100) ELSE 0 END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metas_periodo ON metas(periodo);

COMMENT ON TABLE metas IS 'Metas de faturamento e acompanhamento de performance';

-- 1.3 Tabela: notificacoes (32 kB)
CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID,
  tipo TEXT NOT NULL, -- 'info', 'warning', 'error', 'success'
  titulo TEXT NOT NULL,
  mensagem TEXT,
  lida BOOLEAN DEFAULT FALSE,
  data_leitura TIMESTAMPTZ,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON notificacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_created ON notificacoes(created_at);

COMMENT ON TABLE notificacoes IS 'Sistema de notificações para usuários';

-- 1.4 Tabela: pedidos_status_log (120 kB)
CREATE TABLE IF NOT EXISTS pedidos_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  usuario_id UUID,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_status_log_pedido ON pedidos_status_log(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status_log_created ON pedidos_status_log(created_at);

COMMENT ON TABLE pedidos_status_log IS 'Histórico de mudanças de status de pedidos';

-- 1.5 Tabela: pedidos_vendas (640 kB)
CREATE TABLE IF NOT EXISTS pedidos_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_transacao TEXT UNIQUE,
  status TEXT,
  nome_produto TEXT,
  valor_total DECIMAL(10,2),
  forma_pagamento TEXT,
  nome_cliente TEXT,
  email_cliente TEXT,
  cpf_cliente TEXT,
  telefone_cliente TEXT,
  data_venda TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_vendas_codigo ON pedidos_vendas(codigo_transacao);
CREATE INDEX IF NOT EXISTS idx_pedidos_vendas_status ON pedidos_vendas(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_vendas_cpf ON pedidos_vendas(cpf_cliente);
CREATE INDEX IF NOT EXISTS idx_pedidos_vendas_data ON pedidos_vendas(data_venda);

COMMENT ON TABLE pedidos_vendas IS 'Registro de vendas e transações';

-- 1.6 Tabela: ticto_logs (3784 kB - maior tabela)
CREATE TABLE IF NOT EXISTS ticto_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento TEXT NOT NULL,
  tipo TEXT, -- 'webhook', 'api', 'sync', 'error'
  payload JSONB,
  resposta JSONB,
  status_code INTEGER,
  sucesso BOOLEAN DEFAULT TRUE,
  erro TEXT,
  duracao_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticto_logs_evento ON ticto_logs(evento);
CREATE INDEX IF NOT EXISTS idx_ticto_logs_tipo ON ticto_logs(tipo);
CREATE INDEX IF NOT EXISTS idx_ticto_logs_sucesso ON ticto_logs(sucesso);
CREATE INDEX IF NOT EXISTS idx_ticto_logs_created ON ticto_logs(created_at);

COMMENT ON TABLE ticto_logs IS 'Logs de integração com Ticto e outros sistemas externos';

-- PARTE 2: HABILITAR RLS (Row Level Security)
-- ================================================================

-- 2.1 Habilitar RLS nas tabelas sensíveis
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_vendas ENABLE ROW LEVEL SECURITY;

-- 2.2 Criar políticas básicas (ajustar conforme necessidade)
-- Exemplo: notificacoes - usuário vê apenas suas notificações
CREATE POLICY notificacoes_select_own ON notificacoes
  FOR SELECT
  USING (usuario_id = auth.uid());

-- PARTE 3: VERIFICAÇÃO
-- ================================================================

-- 3.1 Listar todas as tabelas criadas
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'feriados',
    'metas',
    'notificacoes',
    'pedidos_status_log',
    'pedidos_vendas',
    'ticto_logs'
  )
ORDER BY tablename;

-- ================================================================
-- FIM DA MIGRATION
-- ================================================================

-- RESULTADO ESPERADO:
-- ✅ 6 tabelas criadas em teste
-- ✅ Índices adicionados para performance
-- ✅ RLS habilitado onde necessário
-- ✅ Teste agora tem mesma estrutura que produção
