-- ================================================================
-- MIGRATION 038: FIX CPFs MISSING LEADING ZEROS
-- ================================================================
-- Problema: A Ticto envia CPFs como número, perdendo zeros à esquerda.
-- Ex: CPF "02345678901" chega como "2345678901" (10 dígitos).
-- Solução:
--   1. Corrigir CPFs existentes com LPAD (pad até 11 dígitos)
--   2. Garantir que futuras consolidações preservem zeros
-- ================================================================

-- PASSO 1: Corrigir CPFs existentes na pedidos_consolidados_v3
-- Apenas CPFs com 10 dígitos (faltando 1 zero à esquerda)
UPDATE pedidos_consolidados_v3
SET cpf = LPAD(cpf, 11, '0'),
    updated_at = NOW()
WHERE cpf IS NOT NULL 
  AND cpf != ''
  AND cpf ~ '^\d+$'
  AND LENGTH(cpf) = 10;

-- Também corrigir CPFs com 9 dígitos (faltando 2 zeros)
UPDATE pedidos_consolidados_v3
SET cpf = LPAD(cpf, 11, '0'),
    updated_at = NOW()
WHERE cpf IS NOT NULL 
  AND cpf != ''
  AND cpf ~ '^\d+$'
  AND LENGTH(cpf) = 9;

-- PASSO 2: Corrigir CPFs na tabela ticto_pedidos (fonte)
UPDATE ticto_pedidos
SET customer_cpf = LPAD(customer_cpf, 11, '0')
WHERE customer_cpf IS NOT NULL 
  AND customer_cpf != ''
  AND customer_cpf ~ '^\d+$'
  AND LENGTH(customer_cpf) BETWEEN 9 AND 10;

-- PASSO 3: TRIGGER para auto-corrigir CPFs futuros
-- Qualquer INSERT ou UPDATE na pedidos_consolidados_v3 terá CPF padronizado
CREATE OR REPLACE FUNCTION pad_cpf_zeros()
RETURNS TRIGGER AS $$
DECLARE
  cpf_limpo TEXT;
BEGIN
  IF NEW.cpf IS NOT NULL AND NEW.cpf != '' THEN
    cpf_limpo := REGEXP_REPLACE(NEW.cpf, '[^0-9]', '', 'g');
    IF LENGTH(cpf_limpo) BETWEEN 9 AND 10 THEN
      NEW.cpf := LPAD(cpf_limpo, 11, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pad_cpf_consolidados ON pedidos_consolidados_v3;
CREATE TRIGGER trg_pad_cpf_consolidados
  BEFORE INSERT OR UPDATE ON pedidos_consolidados_v3
  FOR EACH ROW
  EXECUTE FUNCTION pad_cpf_zeros();

-- PASSO 4: Corrigir normalizar_documento (usada na migration 028)
-- Troca LTRIM(doc_limpo, '0') por LPAD para preservar zeros
CREATE OR REPLACE FUNCTION normalizar_documento(doc_raw TEXT)
RETURNS TEXT AS $$
DECLARE doc_limpo TEXT;
BEGIN
    IF doc_raw IS NULL OR doc_raw = '' THEN RETURN ''; END IF;
    doc_limpo := REGEXP_REPLACE(doc_raw, '[^0-9]', '', 'g');
    IF doc_limpo = '' THEN RETURN ''; END IF;
    RETURN LPAD(doc_limpo, 11, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- PASSO 5: Relatório
SELECT 
  'CPFs corrigidos + trigger ativo!' as resultado,
  (SELECT COUNT(*) FROM pedidos_consolidados_v3 WHERE cpf IS NOT NULL AND LENGTH(cpf) < 11 AND cpf ~ '^\d+$') as cpfs_ainda_curtos;
