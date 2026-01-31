-- ================================================================
-- MIGRATION 013: Adicionar Colunas de Rastreio e Envio
-- Descrição: Adiciona colunas para rastrear data de envio e código de rastreio
-- Data: 2026-01-27
-- ================================================================

-- ================================================================
-- ADICIONAR COLUNAS NA TABELA PEDIDOS
-- ================================================================

ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS data_envio TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS codigo_rastreio TEXT;

-- Criar índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_pedidos_data_envio ON pedidos(data_envio) WHERE data_envio IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_codigo_rastreio ON pedidos(codigo_rastreio) WHERE codigo_rastreio IS NOT NULL;

-- ================================================================
-- COMENTÁRIOS
-- ================================================================

COMMENT ON COLUMN pedidos.data_envio IS 
'Data e hora em que o pedido foi enviado/despachado';

COMMENT ON COLUMN pedidos.codigo_rastreio IS 
'Código de rastreio dos Correios ou transportadora';

-- ================================================================
-- MARCAR PVs ÓRFÃOS COMO ENVIADOS (já despachados no dia 26/01)
-- ================================================================

UPDATE pedidos
SET 
  data_envio = '2026-01-26 18:00:00-03',
  codigo_rastreio = 'DESPACHADO_26/01'
WHERE codigo_transacao IN (
  'TOCDFBF22301YZA73YH',
  'TOCE4E932301BTA6IJ'
)
AND data_envio IS NULL;  -- Só atualizar se ainda não foi marcado

-- ================================================================
-- FIM DA MIGRATION 013
-- ================================================================
