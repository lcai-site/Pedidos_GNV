-- ==============================================================================
-- MIGRATION 120: Formatar Telefones com DDI 55
-- ==============================================================================
-- Adiciona o DDI '55' (Brasil) a todos os números de telefone nas tabelas principais
-- caso possuam 10 ou 11 dígitos na parte numérica e não comecem com 55.

-- 1. pedidos_consolidados_v3
UPDATE pedidos_consolidados_v3
SET telefone = '55' || REGEXP_REPLACE(telefone, '\D', '', 'g')
WHERE 
  telefone IS NOT NULL 
  AND length(REGEXP_REPLACE(telefone, '\D', '', 'g')) IN (10, 11)
  AND NOT REGEXP_REPLACE(telefone, '\D', '', 'g') LIKE '55%';

-- 2. ticto_pedidos
UPDATE ticto_pedidos
SET customer_phone = '55' || REGEXP_REPLACE(customer_phone, '\D', '', 'g')
WHERE 
  customer_phone IS NOT NULL 
  AND length(REGEXP_REPLACE(customer_phone, '\D', '', 'g')) IN (10, 11)
  AND NOT REGEXP_REPLACE(customer_phone, '\D', '', 'g') LIKE '55%';

-- 3. crm_atendimentos
UPDATE crm_atendimentos
SET telefone = '55' || REGEXP_REPLACE(telefone, '\D', '', 'g')
WHERE 
  telefone IS NOT NULL 
  AND length(REGEXP_REPLACE(telefone, '\D', '', 'g')) IN (10, 11)
  AND NOT REGEXP_REPLACE(telefone, '\D', '', 'g') LIKE '55%';

-- 4. crm_leads
UPDATE crm_leads
SET telefone = '55' || REGEXP_REPLACE(telefone, '\D', '', 'g')
WHERE 
  telefone IS NOT NULL 
  AND length(REGEXP_REPLACE(telefone, '\D', '', 'g')) IN (10, 11)
  AND NOT REGEXP_REPLACE(telefone, '\D', '', 'g') LIKE '55%';
