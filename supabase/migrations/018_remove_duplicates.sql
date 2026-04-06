-- ================================================================
-- REMOVER DUPLICATAS DE PEDIDOS
-- ATENÇÃO: Execute APENAS após verificar o script 017_identify_duplicates.sql
-- ================================================================

-- PASSO 1: Criar tabela temporária com IDs a MANTER
CREATE TEMP TABLE ids_para_manter AS
SELECT DISTINCT ON (email_cliente, nome_produto, DATE(data_venda)) 
    id,
    email_cliente,
    nome_produto,
    DATE(data_venda) as dia_venda,
    created_at
FROM pedidos
WHERE email_cliente IS NOT NULL
ORDER BY email_cliente, nome_produto, DATE(data_venda), created_at DESC;

-- PASSO 2: Contar quantos serão deletados
SELECT 
    (SELECT COUNT(*) FROM pedidos) as "Total antes",
    (SELECT COUNT(*) FROM ids_para_manter) as "Total após limpeza",
    (SELECT COUNT(*) FROM pedidos) - (SELECT COUNT(*) FROM ids_para_manter) as "Serão removidos";

-- PASSO 3: Deletar duplicatas (mantém apenas o mais recente de cada grupo)
-- DESCOMENTE AS LINHAS ABAIXO APENAS SE TIVER CERTEZA!

/*
DELETE FROM pedidos
WHERE id NOT IN (SELECT id FROM ids_para_manter)
AND email_cliente IS NOT NULL;
*/

-- PASSO 4: Verificação final
-- SELECT COUNT(*) as "Total final" FROM pedidos;

-- ================================================================
-- ALTERNATIVA: Se preferir manter o registro do WEBHOOK (não do CSV)
-- Use esta query em vez da anterior
-- ================================================================

/*
-- Manter pedidos que NÃO começam com SHEETS- (são do webhook/N8N)
-- e também os do CSV que não tem equivalente no webhook

DELETE FROM pedidos p1
WHERE EXISTS (
    SELECT 1 FROM pedidos p2
    WHERE p2.email_cliente = p1.email_cliente
    AND p2.nome_produto = p1.nome_produto
    AND DATE(p2.data_venda) = DATE(p1.data_venda)
    AND p2.created_at > p1.created_at
    AND p1.id != p2.id
);
*/
