-- Migration 126: Adicionar marcação de erro na geração de etiqueta
-- Propósito: Identificar pedidos que falharam na geração para destaque no dashboard e relatórios

ALTER TABLE pedidos_consolidados_v3 
ADD COLUMN IF NOT EXISTS error_geracao_etiqueta BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN pedidos_consolidados_v3.error_geracao_etiqueta IS 'Marcação se o pedido deu erro na última tentativa de gerar etiqueta';

-- Criar índice para performance nos relatórios
CREATE INDEX IF NOT EXISTS idx_pedidos_erro_etiqueta ON pedidos_consolidados_v3(error_geracao_etiqueta) WHERE error_geracao_etiqueta = TRUE;
