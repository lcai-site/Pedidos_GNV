-- ================================================================
-- IDENTIFICAR E REMOVER DUPLICATAS DE PEDIDOS
-- Critério: mesmo email_cliente + nome_produto + data_venda (dia)
-- Mantém: o registro mais recente (created_at mais recente)
-- ================================================================

-- PASSO 1: Ver quantas duplicatas existem (APENAS VISUALIZAÇÃO)
WITH duplicatas AS (
    SELECT 
        email_cliente,
        nome_produto,
        DATE(data_venda) as dia_venda,
        COUNT(*) as total,
        array_agg(id ORDER BY created_at DESC) as ids,
        array_agg(codigo_transacao ORDER BY created_at DESC) as codigos,
        array_agg(status ORDER BY created_at DESC) as statuses,
        array_agg(created_at ORDER BY created_at DESC) as datas_criacao
    FROM pedidos
    WHERE email_cliente IS NOT NULL
    GROUP BY email_cliente, nome_produto, DATE(data_venda)
    HAVING COUNT(*) > 1
)
SELECT 
    email_cliente,
    nome_produto,
    dia_venda,
    total as "Qtd Duplicatas",
    codigos[1] as "Código Mantido",
    codigos[2] as "Código Removido",
    statuses[1] as "Status Mantido",
    statuses[2] as "Status Removido"
FROM duplicatas
ORDER BY total DESC
LIMIT 20;

-- ================================================================
-- PASSO 2: Contar total de duplicatas
-- ================================================================
SELECT 
    'Total de grupos com duplicatas' as metrica,
    COUNT(*) as valor
FROM (
    SELECT email_cliente, nome_produto, DATE(data_venda)
    FROM pedidos
    WHERE email_cliente IS NOT NULL
    GROUP BY email_cliente, nome_produto, DATE(data_venda)
    HAVING COUNT(*) > 1
) as grupos

UNION ALL

SELECT 
    'Registros que serão removidos' as metrica,
    (SELECT COUNT(*) FROM pedidos) - (
        SELECT COUNT(*) FROM (
            SELECT DISTINCT ON (email_cliente, nome_produto, DATE(data_venda)) id
            FROM pedidos
            WHERE email_cliente IS NOT NULL
            ORDER BY email_cliente, nome_produto, DATE(data_venda), created_at DESC
        ) as unicos
    ) as valor;
