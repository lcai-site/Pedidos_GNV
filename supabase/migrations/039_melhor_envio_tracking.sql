-- ================================================================
-- MIGRATION 039: MELHOR ENVIO TRACKING COLUMNS
-- ================================================================
-- Adiciona colunas para suportar rastreio automático via webhook
-- da Melhor Envio, separando o UUID do carrinho do tracking real.
-- ================================================================

-- Coluna para guardar o UUID original do Melhor Envio
-- (quando o tracking real substituir o codigo_rastreio)
ALTER TABLE pedidos_consolidados_v3
ADD COLUMN IF NOT EXISTS melhor_envio_id TEXT;

-- URL de rastreio do Melhor Envio
ALTER TABLE pedidos_consolidados_v3
ADD COLUMN IF NOT EXISTS tracking_url TEXT;

-- Data de entrega confirmada (via webhook)
ALTER TABLE pedidos_consolidados_v3
ADD COLUMN IF NOT EXISTS data_entrega TIMESTAMPTZ;

-- Índice para busca rápida por melhor_envio_id (usado pelo webhook)
CREATE INDEX IF NOT EXISTS idx_consolidados_melhor_envio_id
ON pedidos_consolidados_v3 (melhor_envio_id)
WHERE melhor_envio_id IS NOT NULL;
