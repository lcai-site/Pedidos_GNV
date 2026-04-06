-- ================================================================
-- MIGRATION 034: Adicionar colunas faltantes em ticto_logs
-- Objetivo: Garantir paridade entre produção e staging
-- Aplicar em: Staging (se tabela já existir sem estas colunas)
-- ================================================================

-- Adicionar codigo_rastreio se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticto_logs' AND column_name = 'codigo_rastreio'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN codigo_rastreio TEXT;
        COMMENT ON COLUMN ticto_logs.codigo_rastreio IS 'Código de rastreio vinculado ao log (quando disponível)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticto_logs' AND column_name = 'resposta'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN resposta JSONB;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticto_logs' AND column_name = 'status_code'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN status_code INTEGER;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticto_logs' AND column_name = 'erro_processamento'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN erro_processamento TEXT;
        COMMENT ON COLUMN ticto_logs.erro_processamento IS 'Descrição do erro de processamento (quando aplicável)';
    END IF;
END $$;

SELECT 'Colunas adicionadas em ticto_logs!' as resultado;
