-- ================================================================
-- SCRIPT DE TESTES: Validação da VIEW Pedidos Consolidados V3
-- Descrição: Testes comparativos entre v2 e v3, validação de regras
-- Data: 2026-01-27
-- ================================================================

-- ================================================================
-- TESTE 1: COMPARAÇÃO DE CONTAGENS (V2 vs V3)
-- ================================================================

SELECT 
  'v2' as versao,
  COUNT(*) as pedidos_consolidados,
  SUM(quantidade_pedidos) as total_registros,
  SUM(quantidade_pedidos) - COUNT(*) as registros_consolidados
FROM pedidos_consolidados_v2
WHERE data_venda::DATE BETWEEN '2026-01-23' AND '2026-01-25'

UNION ALL

SELECT 
  'v3' as versao,
  COUNT(*) as pedidos_consolidados,
  SUM(quantidade_pedidos) as total_registros,
  SUM(quantidade_pedidos) - COUNT(*) as registros_consolidados
FROM pedidos_consolidados_v3
WHERE data_venda::DATE BETWEEN '2026-01-23' AND '2026-01-25';

-- ================================================================
-- TESTE 2: VALIDAÇÃO DE JANELA PV (THU/FRI vs OUTROS)
-- ================================================================

SELECT 
  data_venda::DATE as dia,
  TO_CHAR(data_venda, 'Day') AS dia_semana,
  EXTRACT(DOW FROM data_venda) AS dow,
  calcular_janela_pv_segura(data_venda) AS janela_pv,
  calcular_janela_pv_segura(data_venda) - data_venda AS intervalo,
  CASE 
    WHEN EXTRACT(DOW FROM data_venda) IN (4, 5) THEN '4 dias (Thu/Fri)'
    ELSE '2 dias (outros)'
  END AS regra_esperada,
  CASE 
    WHEN EXTRACT(DOW FROM data_venda) IN (4, 5) 
      AND calcular_janela_pv_segura(data_venda) - data_venda = INTERVAL '4 days'
    THEN '✅ CORRETO'
    WHEN EXTRACT(DOW FROM data_venda) NOT IN (4, 5) 
      AND calcular_janela_pv_segura(data_venda) - data_venda = INTERVAL '2 days'
    THEN '✅ CORRETO'
    ELSE '❌ INCORRETO'
  END AS validacao
FROM pedidos
WHERE data_venda >= '2026-01-20'
  AND status = 'Aprovado'
ORDER BY data_venda DESC
LIMIT 20;

-- ================================================================
-- TESTE 3: DETECÇÃO DE FRAUDE (MESMO ENDEREÇO)
-- ================================================================

-- Listar endereços com múltiplos CPFs
SELECT 
  cep,
  rua,
  numero,
  cidade,
  estado,
  COUNT(DISTINCT cpf_cliente) as cpfs_distintos,
  ARRAY_AGG(DISTINCT cpf_cliente ORDER BY cpf_cliente) as cpfs,
  ARRAY_AGG(DISTINCT nome_cliente ORDER BY nome_cliente) as nomes,
  COUNT(*) as total_pedidos
FROM pedidos
WHERE cep IS NOT NULL
  AND status = 'Aprovado'
GROUP BY cep, rua, numero, cidade, estado
HAVING COUNT(DISTINCT cpf_cliente) > 1
ORDER BY total_pedidos DESC
LIMIT 10;

-- ================================================================
-- TESTE 4: VALIDAÇÃO DE DATA PV (> NÃO >=)
-- ================================================================

-- Verificar se há PVs do mesmo dia sendo consolidados (NÃO DEVERIA)
WITH pvs_mesmo_dia AS (
  SELECT 
    p1.id AS pedido_principal,
    p1.data_venda::DATE AS data_principal,
    p2.id AS pedido_pv,
    p2.data_venda::DATE AS data_pv,
    p2.nome_oferta
  FROM pedidos p1
  JOIN pedidos p2 
    ON p2.cpf_cliente = p1.cpf_cliente
    AND p2.id != p1.id
    AND p2.nome_oferta ILIKE '%cc%'
    AND p2.data_venda::DATE = p1.data_venda::DATE  -- MESMO DIA
  WHERE p1.data_venda >= CURRENT_DATE - INTERVAL '30 days'
    AND p1.status = 'Aprovado'
    AND p2.status = 'Aprovado'
)
SELECT 
  COUNT(*) as pvs_mesmo_dia_encontrados,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ CORRETO: Nenhum PV do mesmo dia'
    ELSE '❌ ERRO: ' || COUNT(*) || ' PVs do mesmo dia encontrados'
  END AS validacao
FROM pvs_mesmo_dia;

-- ================================================================
-- TESTE 5: ESTATÍSTICAS POR PRODUTO (DP/BF/BL)
-- ================================================================

SELECT 
  produto_principal,
  COUNT(*) AS total_pedidos,
  SUM(quantidade_pedidos) AS total_registros,
  SUM(quantidade_pedidos) - COUNT(*) AS registros_consolidados,
  ROUND(AVG(valor_total), 2) AS valor_medio,
  SUM(valor_total) AS valor_total_produto
FROM pedidos_consolidados_v3
WHERE data_venda::DATE BETWEEN '2026-01-23' AND '2026-01-25'
GROUP BY produto_principal
ORDER BY produto_principal;

-- ================================================================
-- TESTE 6: COMPARAÇÃO DETALHADA DE UM PEDIDO ESPECÍFICO
-- ================================================================

-- Substituir 'CODIGO_EXEMPLO' por um código real de teste
WITH pedido_v2 AS (
  SELECT 
    'v2' as versao,
    *
  FROM pedidos_consolidados_v2
  WHERE codigo_transacao = 'CODIGO_EXEMPLO'
),
pedido_v3 AS (
  SELECT 
    'v3' as versao,
    *
  FROM pedidos_consolidados_v3
  WHERE codigo_transacao = 'CODIGO_EXEMPLO'
)
SELECT * FROM pedido_v2
UNION ALL
SELECT * FROM pedido_v3;

-- ================================================================
-- TESTE 7: PERFORMANCE (TEMPO DE EXECUÇÃO)
-- ================================================================

-- Medir tempo de execução da VIEW v2
EXPLAIN ANALYZE
SELECT COUNT(*) 
FROM pedidos_consolidados_v2
WHERE data_venda >= CURRENT_DATE - INTERVAL '7 days';

-- Medir tempo de execução da VIEW v3
EXPLAIN ANALYZE
SELECT COUNT(*) 
FROM pedidos_consolidados_v3
WHERE data_venda >= CURRENT_DATE - INTERVAL '7 days';

-- ================================================================
-- TESTE 8: VALIDAÇÃO DE CONSOLIDAÇÃO POR CPF
-- ================================================================

-- Verificar se pedidos do mesmo CPF estão sendo consolidados corretamente
SELECT 
  cpf_cliente,
  COUNT(*) as pedidos_consolidados,
  SUM(quantidade_pedidos) as total_pedidos,
  ARRAY_AGG(codigo_transacao ORDER BY data_venda) as codigos,
  ARRAY_AGG(data_venda::DATE ORDER BY data_venda) as datas,
  MIN(data_venda) as primeira_compra,
  MAX(data_venda) as ultima_compra,
  MAX(data_venda) - MIN(data_venda) as intervalo
FROM pedidos_consolidados_v3
WHERE data_venda >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY cpf_cliente
HAVING COUNT(*) > 1
ORDER BY total_pedidos DESC
LIMIT 10;

-- ================================================================
-- TESTE 9: VERIFICAR PEDIDOS EXCLUÍDOS POR FRAUDE
-- ================================================================

-- Contar pedidos que foram excluídos da consolidação por fraude
WITH pedidos_fraude AS (
  SELECT 
    p.id,
    p.codigo_transacao,
    p.cpf_cliente,
    p.cep,
    p.rua,
    p.numero,
    p.cidade,
    p.estado
  FROM pedidos p
  WHERE EXISTS (
    SELECT 1 FROM pedidos p2
    WHERE p2.cep = p.cep
      AND p2.rua = p.rua
      AND p2.numero = p.numero
      AND p2.cpf_cliente != p.cpf_cliente
      AND p2.status = 'Aprovado'
  )
  AND p.status = 'Aprovado'
  AND p.data_venda >= CURRENT_DATE - INTERVAL '30 days'
)
SELECT 
  COUNT(*) as total_pedidos_fraude,
  COUNT(DISTINCT cpf_cliente) as cpfs_envolvidos,
  COUNT(DISTINCT (cep || '|' || rua || '|' || numero)) as enderecos_suspeitos
FROM pedidos_fraude;

-- ================================================================
-- TESTE 10: RESUMO GERAL DE VALIDAÇÃO
-- ================================================================

SELECT 
  '1. Contagem Total' as teste,
  (SELECT COUNT(*) FROM pedidos_consolidados_v3 
   WHERE data_venda::DATE BETWEEN '2026-01-23' AND '2026-01-25')::TEXT as resultado,
  '106 esperado' as esperado

UNION ALL

SELECT 
  '2. Janela PV Thu/Fri',
  CASE 
    WHEN (SELECT COUNT(*) FROM pedidos 
          WHERE EXTRACT(DOW FROM data_venda) IN (4,5)
          AND calcular_janela_pv_segura(data_venda) - data_venda != INTERVAL '4 days') = 0
    THEN '✅ Todas corretas'
    ELSE '❌ Erro detectado'
  END,
  '✅ Todas corretas'

UNION ALL

SELECT 
  '3. PVs Mesmo Dia',
  CASE 
    WHEN (SELECT COUNT(*) FROM pedidos p1
          JOIN pedidos p2 ON p2.cpf_cliente = p1.cpf_cliente
          AND p2.data_venda::DATE = p1.data_venda::DATE
          AND p2.nome_oferta ILIKE '%cc%') = 0
    THEN '✅ Nenhum encontrado'
    ELSE '❌ Encontrados'
  END,
  '✅ Nenhum encontrado'

UNION ALL

SELECT 
  '4. Detecção Fraude',
  (SELECT COUNT(DISTINCT (cep || rua || numero)) 
   FROM pedidos 
   WHERE EXISTS (
     SELECT 1 FROM pedidos p2
     WHERE p2.cep = pedidos.cep
     AND p2.rua = pedidos.rua
     AND p2.numero = pedidos.numero
     AND p2.cpf_cliente != pedidos.cpf_cliente
   ))::TEXT || ' endereços',
  'Variável';

-- ================================================================
-- FIM DOS TESTES
-- ================================================================
