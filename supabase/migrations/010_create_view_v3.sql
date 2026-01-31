-- ================================================================
-- MIGRATION 010: VIEW Pedidos Consolidados V3
-- Descrição: Nova VIEW que replica a lógica do Google Apps Script
-- Inclui: Detecção de fraude, janela PV inteligente, consolidação por família
-- Data: 2026-01-27
-- ================================================================

-- ================================================================
-- CRIAR VIEW PEDIDOS_CONSOLIDADOS_V3
-- Nota: NÃO dropar v2, criar v3 em paralelo para testes
-- ================================================================

CREATE OR REPLACE VIEW pedidos_consolidados_v3 AS

WITH 
-- ================================================================
-- PASSO 1: DETECTAR FRAUDES (MESMO ENDEREÇO, CPFS DIFERENTES)
-- ================================================================
endereco_fraudes AS (
  SELECT 
    LOWER(TRIM(cep)) || '|' || 
    LOWER(TRIM(cidade)) || '|' || 
    LOWER(TRIM(estado)) || '|' || 
    LOWER(TRIM(rua)) || '|' || 
    LOWER(TRIM(numero)) AS chave_endereco,
    COUNT(DISTINCT REGEXP_REPLACE(cpf_cliente, '[^0-9]', '', 'g')) AS qtd_cpfs_distintos
  FROM pedidos
  WHERE cep IS NOT NULL 
    AND cidade IS NOT NULL 
    AND estado IS NOT NULL
    AND cpf_cliente IS NOT NULL
    AND status = 'Aprovado'
  GROUP BY chave_endereco
  HAVING COUNT(DISTINCT REGEXP_REPLACE(cpf_cliente, '[^0-9]', '', 'g')) > 1
),

-- ================================================================
-- PASSO 2: MARCAR PEDIDOS COM FRAUDE
-- ================================================================
pedidos_limpos AS (
  SELECT 
    p.*,
    CASE 
      WHEN ef.chave_endereco IS NOT NULL THEN TRUE 
      ELSE FALSE 
    END AS fraude_endereco_detectada
  FROM pedidos p
  LEFT JOIN endereco_fraudes ef 
    ON (LOWER(TRIM(p.cep)) || '|' || 
        LOWER(TRIM(p.cidade)) || '|' || 
        LOWER(TRIM(p.estado)) || '|' || 
        LOWER(TRIM(p.rua)) || '|' || 
        LOWER(TRIM(p.numero))) = ef.chave_endereco
  WHERE p.status = 'Aprovado'
    AND p.codigo_transacao IS NOT NULL  -- ⭐ Excluir pedidos sem código
    AND p.nome_produto NOT LIKE '%[Assinatura]%'
    AND p.nome_produto NOT LIKE '%[Afiliação]%'
),

-- ================================================================
-- PASSO 3: CALCULAR DATAS ÚTEIS E JANELAS
-- ================================================================
vendas_base AS (
  SELECT 
    p.*,
    proximo_dia_util(p.data_venda::DATE) as dia_pv,
    proximo_dia_util(proximo_dia_util(p.data_venda::DATE)) as dia_despacho,
    (proximo_dia_util(proximo_dia_util(p.data_venda::DATE))::TIMESTAMP + INTERVAL '8 hours 30 minutes') as corte_pv,
    calcular_janela_pv_segura(p.data_venda) as janela_pv_limite
  FROM pedidos_limpos p
  WHERE p.fraude_endereco_detectada = FALSE
),

-- ================================================================
-- PASSO 4: IDENTIFICAR VENDAS PRINCIPAIS E PÓS-VENDAS
-- ================================================================
pedidos_com_grupo AS (
  SELECT 
    v1.*,
    -- Encontra a venda principal para este pedido
    -- Se for um PV, encontra a venda anterior do mesmo CPF dentro da janela
    -- Se não for PV, o pedido é sua própria venda principal
    COALESCE(
      (
        SELECT v2.id
        FROM vendas_base v2
        WHERE v2.cpf_cliente = v1.cpf_cliente
          AND v2.id != v1.id
          -- ⭐ CRÍTICO: PV deve ser ESTRITAMENTE POSTERIOR (> não >=)
          AND v1.data_venda > v2.data_venda
          -- ⭐ CRÍTICO: PV deve estar dentro da janela inteligente
          AND v1.data_venda <= v2.janela_pv_limite
          -- Prioriza a venda mais recente anterior
        ORDER BY v2.data_venda DESC
        LIMIT 1
      ),
      v1.id  -- Se não encontrou venda anterior, é venda principal
    ) as venda_base_id
  FROM vendas_base v1
),

-- ================================================================
-- PASSO 5: AGRUPAMENTO E CONSOLIDAÇÃO
-- ================================================================
pedidos_agrupados AS (
  SELECT 
    venda_base_id as id,
    -- Dados do pedido principal (primeiro da lista)
    (ARRAY_AGG(cpf_cliente ORDER BY data_venda))[1] as cpf_cliente,
    (ARRAY_AGG(dia_despacho ORDER BY data_venda))[1] as dia_despacho,
    (ARRAY_AGG(codigo_transacao ORDER BY data_venda))[1] as codigo_transacao,
    (ARRAY_AGG(status ORDER BY data_venda))[1] as status,
    (ARRAY_AGG(nome_produto ORDER BY data_venda))[1] as nome_produto,
    (ARRAY_AGG(nome_oferta ORDER BY data_venda))[1] as nome_oferta,
    
    -- Valores agregados
    SUM(valor_total) as valor_total,
    
    -- Dados do cliente (do pedido principal)
    (ARRAY_AGG(forma_pagamento ORDER BY data_venda))[1] as forma_pagamento,
    (ARRAY_AGG(parcelas ORDER BY data_venda))[1] as parcelas,
    (ARRAY_AGG(nome_cliente ORDER BY data_venda))[1] as nome_cliente,
    (ARRAY_AGG(email_cliente ORDER BY data_venda))[1] as email_cliente,
    (ARRAY_AGG(telefone_cliente ORDER BY data_venda))[1] as telefone_cliente,
    
    -- Endereço (do pedido principal)
    (ARRAY_AGG(cep ORDER BY data_venda))[1] as cep,
    (ARRAY_AGG(rua ORDER BY data_venda))[1] as rua,
    (ARRAY_AGG(numero ORDER BY data_venda))[1] as numero,
    (ARRAY_AGG(complemento ORDER BY data_venda))[1] as complemento,
    (ARRAY_AGG(bairro ORDER BY data_venda))[1] as bairro,
    (ARRAY_AGG(cidade ORDER BY data_venda))[1] as cidade,
    (ARRAY_AGG(estado ORDER BY data_venda))[1] as estado,
    
    -- Datas
    (ARRAY_AGG(data_venda ORDER BY data_venda))[1] as data_venda,
    MIN(created_at) as created_at,
    
    -- Metadata
    (ARRAY_AGG(metadata ORDER BY data_venda))[1] as metadata,
    
    -- Descrição consolidada do pacote
    STRING_AGG(
      DISTINCT COALESCE(
        metadata->'offer'->>'name',
        nome_oferta,
        'Produto'
      ),
      ' + '
      ORDER BY COALESCE(
        metadata->'offer'->>'name',
        nome_oferta,
        'Produto'
      )
    ) as descricao_pacote,
    
    -- Array de códigos agrupados
    ARRAY_AGG(codigo_transacao ORDER BY data_venda) as codigos_agrupados,
    
    -- Quantidade de pedidos consolidados
    COUNT(*) as quantidade_pedidos,
    
    -- Identificar tipo de produto principal
    CASE 
      WHEN (ARRAY_AGG(nome_produto ORDER BY data_venda))[1] ILIKE '%desejo%' 
        OR (ARRAY_AGG(nome_produto ORDER BY data_venda))[1] ILIKE '%desejo proibido%' 
      THEN 'DP'
      WHEN (ARRAY_AGG(nome_produto ORDER BY data_venda))[1] ILIKE '%forma%' 
        OR (ARRAY_AGG(nome_produto ORDER BY data_venda))[1] ILIKE '%bela forma%' 
      THEN 'BF'
      WHEN (ARRAY_AGG(nome_produto ORDER BY data_venda))[1] ILIKE '%lumi%' 
        OR (ARRAY_AGG(nome_produto ORDER BY data_venda))[1] ILIKE '%bela lumi%' 
      THEN 'BL'
      ELSE 'OUTROS'
    END AS produto_principal,
    
    -- Rastreio e envio (pegar o primeiro valor, todos são iguais no grupo)
    (ARRAY_AGG(data_envio ORDER BY data_venda))[1] as data_envio,
    (ARRAY_AGG(codigo_rastreio ORDER BY data_venda))[1] as codigo_rastreio
    
  FROM pedidos_com_grupo
  GROUP BY venda_base_id
)

-- ================================================================
-- SELEÇÃO FINAL COM CAMPOS CALCULADOS
-- ================================================================
SELECT 
  pg.id,
  pg.codigo_transacao,
  pg.status,
  pg.nome_produto,
  pg.nome_oferta,
  pg.valor_total,
  pg.forma_pagamento,
  pg.parcelas,
  pg.nome_cliente,
  pg.email_cliente,
  pg.cpf_cliente,
  pg.telefone_cliente,
  pg.cep,
  pg.rua,
  pg.numero,
  pg.complemento,
  pg.bairro,
  pg.cidade,
  pg.estado,
  pg.data_venda,
  pg.created_at,
  pg.metadata,
  pg.descricao_pacote,
  pg.codigos_agrupados,
  pg.quantidade_pedidos,
  pg.produto_principal,
  
  -- Campos calculados de datas
  proximo_dia_util(pg.data_venda::DATE) as dia_pos_vendas,
  pg.dia_despacho,
  (pg.dia_despacho::TIMESTAMP + INTERVAL '8 hours 30 minutes') as corte_pv,
  calcular_janela_pv_segura(pg.data_venda) as janela_pv_limite,
  
  -- Rastreio e envio
  pg.data_envio,
  pg.codigo_rastreio,
  
  -- Detecção de fraude (mesmo endereço, CPFs diferentes)
  EXISTS (
    SELECT 1 FROM pedidos p2
    WHERE p2.cep = pg.cep
      AND p2.rua = pg.rua
      AND p2.numero = pg.numero
      AND p2.cpf_cliente != pg.cpf_cliente
      AND p2.status = 'Aprovado'
  ) as mesmo_endereco
  
FROM pedidos_agrupados pg
ORDER BY pg.data_venda DESC;

-- ================================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ================================================================

COMMENT ON VIEW pedidos_consolidados_v3 IS 
'VIEW que consolida pedidos replicando a lógica do Google Apps Script V25.
Inclui:
- Detecção de fraude (mesmo endereço, CPFs diferentes)
- Janela de PV inteligente (Thu/Fri = +4 dias, outros = +2 dias)
- Validação de data PV (estritamente maior que venda principal)
- Consolidação por CPF e janela de tempo
- Cálculo de dias úteis para despacho
Criada em paralelo com v2 para testes e migração gradual.';

-- ================================================================
-- FIM DA MIGRATION 010
-- ================================================================
