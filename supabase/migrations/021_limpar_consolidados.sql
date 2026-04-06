-- ================================================================
-- RECRIAR MATERIALIZED VIEW pedidos_consolidados_v3
-- Com lógica de consolidação (OB, US, PV, 2 Cartões)
-- SOMENTE status Aprovado/Autorizado
-- ================================================================

-- Dropar a MView atual
DROP MATERIALIZED VIEW IF EXISTS pedidos_consolidados_v3;

-- Criar nova MView com lógica de consolidação
CREATE MATERIALIZED VIEW pedidos_consolidados_v3 AS
WITH 
-- ================================================================
-- 1. PEDIDOS APROVADOS/AUTORIZADOS
-- ================================================================
pedidos_aprovados AS (
  SELECT *,
    -- Normaliza CPF para busca
    REGEXP_REPLACE(COALESCE(cpf_cliente, ''), '[^0-9]', '', 'g') as cpf_limpo,
    -- Normaliza nome da oferta
    UPPER(COALESCE(nome_oferta, '')) as oferta_upper,
    -- Extrai prefixo do produto (DP, BF, BL)
    UPPER(LEFT(COALESCE(nome_produto, ''), 2)) as produto_prefixo,
    -- Data sem hora para comparações
    data_venda::DATE as data_venda_dia
  FROM pedidos
  WHERE status IN ('Aprovado', 'Autorizado')
    AND codigo_transacao IS NOT NULL
),

-- ================================================================
-- 2. IDENTIFICAR ORDER BUMPS (mesmo código + "ORDERBUMP" na oferta)
-- ================================================================
order_bumps AS (
  SELECT codigo_transacao, 
         array_agg(nome_oferta) as ofertas_ob
  FROM pedidos_aprovados
  WHERE oferta_upper LIKE '%ORDERBUMP%' 
     OR oferta_upper LIKE '%ORDER BUMP%'
     OR oferta_upper LIKE '%ORDER_BUMP%'
  GROUP BY codigo_transacao
),

-- ================================================================
-- 3. IDENTIFICAR UPSELLS (mesmo CPF + até +1 dia + "UPSELL")
-- ================================================================
upsells AS (
  SELECT p1.codigo_transacao as codigo_principal,
         array_agg(p2.nome_oferta) as ofertas_us
  FROM pedidos_aprovados p1
  JOIN pedidos_aprovados p2 ON p2.cpf_limpo = p1.cpf_limpo
    AND p2.codigo_transacao != p1.codigo_transacao
    AND p2.data_venda_dia BETWEEN p1.data_venda_dia AND p1.data_venda_dia + INTERVAL '1 day'
    AND (p2.oferta_upper LIKE '%UPSELL%' OR p2.oferta_upper LIKE '%UP SELL%')
  WHERE p1.produto_prefixo IN ('DP', 'DE', 'BF', 'BE', 'BL')
    AND p1.oferta_upper NOT LIKE '%ORDERBUMP%'
    AND p1.oferta_upper NOT LIKE '%UPSELL%'
    AND p1.oferta_upper NOT LIKE '%CC%'
  GROUP BY p1.codigo_transacao
),

-- ================================================================
-- 4. IDENTIFICAR PÓS VENDAS (mesmo CPF + 2 a 4 dias + "CC" na oferta)
-- ================================================================
pos_vendas AS (
  SELECT p1.codigo_transacao as codigo_principal,
         array_agg(p2.nome_oferta) as ofertas_pv,
         array_agg(UPPER(LEFT(p2.nome_produto, 2))) as produtos_pv
  FROM pedidos_aprovados p1
  JOIN pedidos_aprovados p2 ON p2.cpf_limpo = p1.cpf_limpo
    AND p2.codigo_transacao != p1.codigo_transacao
    AND p2.data_venda_dia > p1.data_venda_dia
    AND p2.data_venda_dia <= p1.data_venda_dia + INTERVAL '4 days'
    AND p2.oferta_upper LIKE '%CC%'
  WHERE p1.produto_prefixo IN ('DP', 'DE', 'BF', 'BE', 'BL')
    AND p1.oferta_upper NOT LIKE '%ORDERBUMP%'
    AND p1.oferta_upper NOT LIKE '%UPSELL%'
    AND p1.oferta_upper NOT LIKE '%CC%'
  GROUP BY p1.codigo_transacao
),

-- ================================================================
-- 5. PEDIDOS PRINCIPAIS (não são OB, US nem CC)
-- ================================================================
pedidos_principais AS (
  SELECT p.*
  FROM pedidos_aprovados p
  WHERE p.oferta_upper NOT LIKE '%ORDERBUMP%'
    AND p.oferta_upper NOT LIKE '%ORDER BUMP%'
    AND p.oferta_upper NOT LIKE '%UPSELL%'
    AND p.oferta_upper NOT LIKE '%UP SELL%'
    -- CC pode ser principal se não tiver pedido pai
)

-- ================================================================
-- 6. SELECT FINAL COM CONSOLIDAÇÃO
-- ================================================================
SELECT 
  pp.id,
  pp.codigo_transacao,
  'Aprovado' as status_aprovacao,  -- Padroniza para Aprovado
  pp.nome_produto,
  -- Nome da oferta consolidado
  pp.nome_oferta || 
    COALESCE(' + ' || array_length(ob.ofertas_ob, 1)::TEXT || ' Order Bump', '') ||
    COALESCE(' + ' || array_length(us.ofertas_us, 1)::TEXT || ' UPSELL', '') ||
    COALESCE(' + ' || array_length(pv.ofertas_pv, 1)::TEXT || ' PV', '') as nome_oferta,
  pp.valor_total,
  pp.forma_pagamento,
  pp.parcelas,
  pp.nome_cliente,
  pp.email_cliente as email,
  pp.cpf_cliente as cpf,
  pp.telefone_cliente as telefone,
  pp.cep,
  pp.rua as logradouro,
  pp.numero,
  pp.complemento,
  pp.bairro,
  pp.cidade,
  pp.estado,
  CONCAT_WS(', ', pp.rua, pp.numero, pp.bairro, pp.cidade, pp.estado) as endereco_completo,
  pp.data_venda,
  pp.created_at,
  pp.metadata,
  pp.nome_produto as descricao_pacote,
  -- Códigos agrupados
  ARRAY[pp.codigo_transacao] || 
    COALESCE((SELECT array_agg(codigo_transacao) FROM pedidos_aprovados WHERE cpf_limpo = pp.cpf_limpo AND codigo_transacao != pp.codigo_transacao), ARRAY[]::TEXT[]) as codigos_agrupados,
  1 + COALESCE(array_length(ob.ofertas_ob, 1), 0) + 
      COALESCE(array_length(us.ofertas_us, 1), 0) + 
      COALESCE(array_length(pv.ofertas_pv, 1), 0) as quantidade_pedidos,
  pp.nome_produto as produto_principal,
  -- Calcula dia de despacho (próximo dia útil + 1)
  pp.data_venda::DATE + INTERVAL '2 days' as dia_despacho,
  pp.data_envio,
  pp.codigo_rastreio,
  NULL as status_envio,
  NULL as observacao,
  FALSE as foi_editado,
  pp.metadata->>'customer' as customer,
  pp.metadata->>'shipping' as shipping,
  NULL as dados_entrega,
  NULL as endereco_json,
  pp.updated_at
FROM pedidos_principais pp
LEFT JOIN order_bumps ob ON ob.codigo_transacao = pp.codigo_transacao
LEFT JOIN upsells us ON us.codigo_principal = pp.codigo_transacao
LEFT JOIN pos_vendas pv ON pv.codigo_principal = pp.codigo_transacao
ORDER BY pp.data_venda DESC;

-- Criar índice para performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_consolidados_v3_id ON pedidos_consolidados_v3 (id);
CREATE INDEX IF NOT EXISTS idx_consolidados_v3_codigo ON pedidos_consolidados_v3 (codigo_transacao);
CREATE INDEX IF NOT EXISTS idx_consolidados_v3_email ON pedidos_consolidados_v3 (email);
CREATE INDEX IF NOT EXISTS idx_consolidados_v3_cpf ON pedidos_consolidados_v3 (cpf);

-- Verificar resultado
SELECT 
    COUNT(*) as total_consolidados,
    (SELECT COUNT(*) FROM pedidos WHERE status IN ('Aprovado', 'Autorizado')) as pedidos_aprovados
FROM pedidos_consolidados_v3;
