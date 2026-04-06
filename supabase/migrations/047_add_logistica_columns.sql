-- Migration 047: Adiciona colunas de logística para armazenar os dados de etiquetas geradas pelos Correios
ALTER TABLE pedidos_consolidados_v3
ADD COLUMN IF NOT EXISTS logistica_etiqueta_url TEXT,
ADD COLUMN IF NOT EXISTS logistica_provider TEXT,
ADD COLUMN IF NOT EXISTS logistica_servico TEXT,
ADD COLUMN IF NOT EXISTS logistica_valor NUMERIC;

-- Adiciona um comentário sobre a função das colunas
COMMENT ON COLUMN pedidos_consolidados_v3.logistica_etiqueta_url IS 'URL do PDF da etiqueta gerada';
COMMENT ON COLUMN pedidos_consolidados_v3.logistica_provider IS 'Provedor logístico responsável pela etiqueta (ex: Correios Nativo)';
COMMENT ON COLUMN pedidos_consolidados_v3.logistica_servico IS 'Serviço escolhido (ex: PAC, SEDEX)';
COMMENT ON COLUMN pedidos_consolidados_v3.logistica_valor IS 'Valor final do custo do envio da etiqueta calculada';