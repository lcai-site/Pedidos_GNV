-- ================================================================
-- REPROCESSAR LOGS DA TABELA ticto_logs PARA pedidos
-- Este SQL extrai dados dos logs brutos e insere na tabela pedidos
-- Usa UPSERT para não duplicar pedidos existentes
-- ================================================================

-- Função para limpar CPF
CREATE OR REPLACE FUNCTION clean_cpf(cpf_raw TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN regexp_replace(COALESCE(cpf_raw, ''), '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para formatar telefone
CREATE OR REPLACE FUNCTION clean_phone(phone_raw TEXT) RETURNS TEXT AS $$
BEGIN
  IF phone_raw IS NULL OR phone_raw = 'Não informado' THEN
    RETURN NULL;
  END IF;
  RETURN regexp_replace(phone_raw, '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para mapear status
CREATE OR REPLACE FUNCTION map_status(status_raw TEXT) RETURNS TEXT AS $$
BEGIN
  IF status_raw IN ('approved', 'authorized', 'succeeded', 'completed') THEN
    RETURN 'Aprovado';
  ELSIF status_raw IN ('refused', 'denied', 'failed') THEN
    RETURN 'Recusado';
  ELSIF status_raw IN ('pending', 'waiting_payment', 'pix_created') THEN
    RETURN 'Pendente';
  ELSIF status_raw = 'expired' THEN
    RETURN 'Expirado';
  ELSIF status_raw = 'refunded' THEN
    RETURN 'Reembolsado';
  ELSIF status_raw = 'abandoned_cart' THEN
    RETURN 'Carrinho Abandonado';
  ELSE
    RETURN 'Pendente';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Inserir dados faltantes (UPSERT baseado em email + produto + data)
-- Isso evita duplicatas
INSERT INTO pedidos (
  codigo_transacao,
  status,
  nome_produto,
  nome_oferta,
  valor_total,
  forma_pagamento,
  parcelas,
  nome_cliente,
  email_cliente,
  cpf_cliente,
  telefone_cliente,
  cep,
  rua,
  numero,
  complemento,
  bairro,
  cidade,
  estado,
  data_venda,
  metadata,
  created_at
)
SELECT 
  COALESCE(
    (json_completo->>'transaction_hash'),
    (json_completo->'order'->>'hash'),
    ('LOG-' || id)
  ) as codigo_transacao,
  
  map_status(json_completo->>'status') as status,
  
  COALESCE(
    json_completo->>'product_name',
    json_completo->'item'->>'product_name'
  ) as nome_produto,
  
  json_completo->'item'->>'offer_name' as nome_oferta,
  
  CASE 
    WHEN json_completo->'item'->>'amount' IS NOT NULL 
    THEN (json_completo->'item'->>'amount')::numeric / 100
    WHEN json_completo->'order'->>'paid_amount' IS NOT NULL 
    THEN (json_completo->'order'->>'paid_amount')::numeric / 100
    ELSE NULL
  END as valor_total,
  
  COALESCE(json_completo->>'payment_method', 'Não informado') as forma_pagamento,
  
  (json_completo->'order'->>'installments')::integer as parcelas,
  
  COALESCE(
    json_completo->>'name',
    json_completo->'customer'->>'name'
  ) as nome_cliente,
  
  COALESCE(
    json_completo->>'email',
    json_completo->'customer'->>'email'
  ) as email_cliente,
  
  clean_cpf(COALESCE(
    json_completo->>'document',
    json_completo->'customer'->>'cpf'
  )) as cpf_cliente,
  
  clean_phone(COALESCE(
    json_completo->>'phone',
    CONCAT(
      COALESCE(json_completo->'customer'->'phone'->>'ddi', ''),
      COALESCE(json_completo->'customer'->'phone'->>'ddd', ''),
      COALESCE(json_completo->'customer'->'phone'->>'number', '')
    )
  )) as telefone_cliente,
  
  json_completo->'customer'->'address'->>'zip_code' as cep,
  json_completo->'customer'->'address'->>'street' as rua,
  json_completo->'customer'->'address'->>'street_number' as numero,
  json_completo->'customer'->'address'->>'complement' as complemento,
  json_completo->'customer'->'address'->>'neighborhood' as bairro,
  json_completo->'customer'->'address'->>'city' as cidade,
  json_completo->'customer'->'address'->>'state' as estado,
  
  COALESCE(
    (json_completo->>'created_at')::timestamp,
    (json_completo->'order'->>'order_date')::timestamp,
    created_at
  ) as data_venda,
  
  json_completo as metadata,
  
  created_at

FROM ticto_logs
WHERE 
  -- Ignora carrinhos abandonados (opcional - remova esta linha se quiser incluí-los)
  evento != 'abandoned_cart'
  -- Não processa logs que já existem em pedidos (baseado em email + produto + data aproximada)
  AND NOT EXISTS (
    SELECT 1 FROM pedidos p 
    WHERE p.email_cliente = COALESCE(json_completo->>'email', json_completo->'customer'->>'email')
    AND p.nome_produto = COALESCE(json_completo->>'product_name', json_completo->'item'->>'product_name')
    AND DATE(p.data_venda) = DATE(COALESCE(
      (json_completo->>'created_at')::timestamp,
      (json_completo->'order'->>'order_date')::timestamp,
      ticto_logs.created_at
    ))
  )
ON CONFLICT (codigo_transacao) DO UPDATE SET
  status = EXCLUDED.status,
  nome_cliente = COALESCE(EXCLUDED.nome_cliente, pedidos.nome_cliente),
  telefone_cliente = COALESCE(EXCLUDED.telefone_cliente, pedidos.telefone_cliente),
  updated_at = now();

-- Mostrar quantos foram inseridos
SELECT 
  (SELECT count(*) FROM pedidos) as total_pedidos_depois,
  (SELECT count(*) FROM ticto_logs WHERE evento != 'abandoned_cart') as total_logs_processaveis;
