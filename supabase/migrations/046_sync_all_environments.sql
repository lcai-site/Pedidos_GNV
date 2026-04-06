-- ================================================================
-- MIGRATION 046: Sincronização completa ticto_pedidos + ticto_logs
-- Data: 2026-02-21
-- Objetivo: Garantir que QUALQUER ambiente (produção/testes) tenha
--   a estrutura correta. Idempotente — pode rodar múltiplas vezes.
-- Consolida: migrations 043, 044, 045
-- ================================================================

-- ========================================
-- PARTE 1: TABELA ticto_logs
-- ========================================

-- 1.1 Garantir todas as colunas necessárias
DO $$
BEGIN
    -- Colunas usadas pelo webhook (smooth-function / webhook-ticto)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'payload') THEN
        ALTER TABLE ticto_logs ADD COLUMN payload JSONB;
        COMMENT ON COLUMN ticto_logs.payload IS 'Dados do payload recebido pelo webhook';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'erro') THEN
        ALTER TABLE ticto_logs ADD COLUMN erro TEXT;
        COMMENT ON COLUMN ticto_logs.erro IS 'Mensagem de erro quando o webhook falha';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'duracao_ms') THEN
        ALTER TABLE ticto_logs ADD COLUMN duracao_ms INTEGER;
        COMMENT ON COLUMN ticto_logs.duracao_ms IS 'Tempo de processamento em milissegundos';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'tipo') THEN
        ALTER TABLE ticto_logs ADD COLUMN tipo TEXT;
        COMMENT ON COLUMN ticto_logs.tipo IS 'Tipo do log: webhook, api, sync, error';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'sucesso') THEN
        ALTER TABLE ticto_logs ADD COLUMN sucesso BOOLEAN DEFAULT TRUE;
        COMMENT ON COLUMN ticto_logs.sucesso IS 'Se a operação foi bem-sucedida';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'resposta') THEN
        ALTER TABLE ticto_logs ADD COLUMN resposta JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'status_code') THEN
        ALTER TABLE ticto_logs ADD COLUMN status_code INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'codigo_rastreio') THEN
        ALTER TABLE ticto_logs ADD COLUMN codigo_rastreio TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'erro_processamento') THEN
        ALTER TABLE ticto_logs ADD COLUMN erro_processamento TEXT;
    END IF;
END $$;

-- 1.2 Garantir índices
CREATE INDEX IF NOT EXISTS idx_ticto_logs_evento ON ticto_logs(evento);
CREATE INDEX IF NOT EXISTS idx_ticto_logs_tipo ON ticto_logs(tipo);
CREATE INDEX IF NOT EXISTS idx_ticto_logs_sucesso ON ticto_logs(sucesso);
CREATE INDEX IF NOT EXISTS idx_ticto_logs_created ON ticto_logs(created_at);

-- 1.3 Garantir RLS + policy para service_role
ALTER TABLE ticto_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'ticto_logs' AND policyname = 'service_role_full_access'
    ) THEN
        EXECUTE 'CREATE POLICY service_role_full_access ON ticto_logs FOR ALL TO service_role USING (true) WITH CHECK (true)';
    END IF;
END $$;

-- ========================================
-- PARTE 2: TABELA ticto_pedidos
-- ========================================

-- 2.1 Remover constraint UNIQUE antiga (apenas transaction_hash)
DO $$
DECLARE
    v_constraint TEXT;
    v_index TEXT;
BEGIN
    -- Verificar se existe constraint UNIQUE só em transaction_hash (sem offer_code)
    SELECT c.conname INTO v_constraint
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'ticto_pedidos'
      AND c.contype = 'u'
      AND array_length(c.conkey, 1) = 1  -- constraint de 1 coluna só
      AND EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = t.oid
            AND a.attnum = ANY(c.conkey)
            AND a.attname = 'transaction_hash'
      );

    IF v_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE ticto_pedidos DROP CONSTRAINT %I', v_constraint);
        RAISE NOTICE 'Removida constraint antiga: %', v_constraint;
    END IF;

    -- Também remover índices UNIQUE de transaction_hash sozinho
    FOR v_index IN
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'ticto_pedidos'
          AND indexdef LIKE '%UNIQUE%transaction_hash%'
          AND indexdef NOT LIKE '%offer_code%'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', v_index);
        RAISE NOTICE 'Removido índice antigo: %', v_index;
    END LOOP;
END $$;

-- 2.2 Criar constraint UNIQUE composta (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'ticto_pedidos'::regclass
          AND conname = 'ticto_pedidos_tx_hash_offer_unique'
    ) THEN
        ALTER TABLE ticto_pedidos
            ADD CONSTRAINT ticto_pedidos_tx_hash_offer_unique
            UNIQUE (transaction_hash, offer_code);
        RAISE NOTICE 'Criada constraint composta: ticto_pedidos_tx_hash_offer_unique';
    ELSE
        RAISE NOTICE 'Constraint composta já existe — OK';
    END IF;
END $$;

-- 2.3 Garantir índice de busca por transaction_hash (performance)
CREATE INDEX IF NOT EXISTS idx_ticto_pedidos_tx_hash ON ticto_pedidos(transaction_hash);

-- ========================================
-- PARTE 3: RECARREGAR SCHEMA + VERIFICAÇÃO
-- ========================================

NOTIFY pgrst, 'reload schema';

-- Verificar estrutura da ticto_logs
SELECT 'ticto_logs' AS tabela, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ticto_logs'
ORDER BY ordinal_position;

-- Verificar constraints da ticto_pedidos
SELECT 'ticto_pedidos' AS tabela, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'ticto_pedidos'::regclass
  AND contype = 'u';
