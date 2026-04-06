-- ==============================================================================
-- 119_crm_atendimentos_email.sql
-- Propósito: Adicionar coluna email à tabela crm_atendimentos para que
--            os dados do cliente possam ser editados e persistidos diretamente
--            no ticket de atendimento, sem depender de pedidos_consolidados_v3.
-- ==============================================================================

BEGIN;

ALTER TABLE public.crm_atendimentos
  ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN public.crm_atendimentos.email IS
  'Email do cliente do atendimento. Pode ser preenchido manualmente ou merge de pedidos_consolidados_v3.';

-- Backfill: tentar preencher emails já existentes cruzando pelo telefone
-- (últimos 8 dígitos para tolerar variações de DDI +55)
UPDATE public.crm_atendimentos a
SET email = sub.email
FROM (
  SELECT DISTINCT ON (right(telefone, 8)) right(telefone, 8) AS tail, email
  FROM public.pedidos_consolidados_v3
  WHERE email IS NOT NULL AND email <> ''
  ORDER BY right(telefone, 8), data_venda DESC
) sub
WHERE a.email IS NULL
  AND right(a.telefone, 8) = sub.tail;

COMMIT;
, sigla 