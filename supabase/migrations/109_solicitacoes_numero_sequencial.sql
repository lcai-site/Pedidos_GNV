-- ================================================================
-- MIGRATION 109: NUMERAÇÃO SEQUENCIAL DE SOLICITAÇÕES
-- ================================================================
-- Adiciona número sequencial por tipo:
--   REE-00001 → Reembolsos
--   REC-00001 → Reclamações
--   CAN-00001 → Cancelamentos
-- ================================================================

-- 1. Coluna para armazenar o número sequencial gerado
ALTER TABLE solicitacoes
  ADD COLUMN IF NOT EXISTS numero_solicitacao TEXT;

-- 2. Coluna aprovado_em (caso ainda não exista)
ALTER TABLE solicitacoes
  ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;

-- 3. Função que gera o próximo número para um dado tipo
CREATE OR REPLACE FUNCTION gerar_numero_solicitacao(p_tipo TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix  TEXT;
  v_count   INTEGER;
  v_numero  TEXT;
BEGIN
  -- Prefixo por tipo
  CASE p_tipo
    WHEN 'reembolso'         THEN v_prefix := 'REE';
    WHEN 'reclamacao'        THEN v_prefix := 'REC';
    WHEN 'mudanca_produto'   THEN v_prefix := 'REC'; -- legado
    WHEN 'cancelamento'      THEN v_prefix := 'CAN';
    ELSE                          v_prefix := 'SOL';
  END CASE;

  -- Conta registros existentes do mesmo prefixo
  SELECT COUNT(*) INTO v_count
  FROM solicitacoes
  WHERE numero_solicitacao LIKE v_prefix || '-%';

  -- Gera número com 5 dígitos: REE-00001, REE-00002…
  v_numero := v_prefix || '-' || LPAD((v_count + 1)::TEXT, 5, '0');

  RETURN v_numero;
END;
$$;

-- 4. Trigger que chama a função antes de inserir
CREATE OR REPLACE FUNCTION trigger_set_numero_solicitacao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Só gera se ainda não foi definido manualmente
  IF NEW.numero_solicitacao IS NULL THEN
    NEW.numero_solicitacao := gerar_numero_solicitacao(NEW.tipo);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_numero_solicitacao ON solicitacoes;

CREATE TRIGGER trg_numero_solicitacao
  BEFORE INSERT ON solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_numero_solicitacao();

-- 5. Gera números retroativos para registros existentes (sem número)
UPDATE solicitacoes
SET numero_solicitacao = gerar_numero_solicitacao(tipo)
WHERE numero_solicitacao IS NULL;

-- 6. Permissões
GRANT EXECUTE ON FUNCTION gerar_numero_solicitacao(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trigger_set_numero_solicitacao() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 109: Numeração sequencial de solicitações criada!' AS resultado;
