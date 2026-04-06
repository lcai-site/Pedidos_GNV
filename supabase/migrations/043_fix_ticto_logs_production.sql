-- ================================================================
-- MIGRATION 043: Corrigir tabela ticto_logs em produção
-- Data: 2026-02-20
-- Problema: O webhook smooth-function tenta inserir logs com
--   colunas (payload, erro, duracao_ms) que NÃO existem na produção.
--   Isso faz 100% dos logs falharem silenciosamente.
-- ================================================================

-- 1. Adicionar colunas faltantes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ticto_logs' AND column_name = 'payload'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN payload JSONB;
        COMMENT ON COLUMN ticto_logs.payload IS 'Dados do payload recebido pelo webhook';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ticto_logs' AND column_name = 'erro'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN erro TEXT;
        COMMENT ON COLUMN ticto_logs.erro IS 'Mensagem de erro quando o webhook falha';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ticto_logs' AND column_name = 'duracao_ms'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN duracao_ms INTEGER;
        COMMENT ON COLUMN ticto_logs.duracao_ms IS 'Tempo de processamento em milissegundos';
    END IF;
END $$;

-- 2. Garantir que a service_role pode inserir (bypassa RLS, mas vamos criar policy explícita)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'ticto_logs' AND policyname = 'service_role_full_access'
    ) THEN
        CREATE POLICY service_role_full_access ON ticto_logs
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- 3. Recarregar o schema cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- 4. Verificação
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'ticto_logs'
ORDER BY ordinal_position;
