-- ================================================================
-- MIGRATION 044: Adicionar colunas faltantes restantes em ticto_logs
-- Data: 2026-02-20
-- Problema: A migration 043 adicionou payload/erro/duracao_ms,
--   mas ainda faltam: tipo, sucesso, resposta, status_code
-- ================================================================

-- 1. Adicionar colunas faltantes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ticto_logs' AND column_name = 'tipo'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN tipo TEXT;
        COMMENT ON COLUMN ticto_logs.tipo IS 'Tipo do log: webhook, api, sync, error';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ticto_logs' AND column_name = 'sucesso'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN sucesso BOOLEAN DEFAULT TRUE;
        COMMENT ON COLUMN ticto_logs.sucesso IS 'Se a operação foi bem-sucedida';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ticto_logs' AND column_name = 'resposta'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN resposta JSONB;
        COMMENT ON COLUMN ticto_logs.resposta IS 'Resposta recebida (quando aplicável)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ticto_logs' AND column_name = 'status_code'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN status_code INTEGER;
        COMMENT ON COLUMN ticto_logs.status_code IS 'Código HTTP da resposta';
    END IF;
END $$;

-- 2. Recarregar o schema cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- 3. Verificação final
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'ticto_logs'
ORDER BY ordinal_position;
