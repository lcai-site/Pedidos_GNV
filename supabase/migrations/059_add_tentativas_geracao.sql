-- ================================================================
-- MIGRATION 059: Adicionar coluna tentativas_geracao
-- Data: 2026-03-12
--
-- O que essa migration resolve:
-- Quando a geração de etiquetas falha (CEP incorreto, etc.), o sistema
-- salva o erro gerado pela IA na coluna 'observacao' e incrementa a 
-- coluna 'tentativas_geracao'.
-- Como a coluna 'tentativas_geracao' não existia no banco de produção,
-- O UPDATE FALHAVA SILENCIOSAMENTE. Por isso, os erros de Correios
-- não apareciam na interface (ícone de Mensagem) como no Melhor Envio.
-- ================================================================

ALTER TABLE pedidos_consolidados_v3 
ADD COLUMN IF NOT EXISTS tentativas_geracao INTEGER DEFAULT 0;
