-- ================================================================
-- MIGRATION 048: Adicionar observação na recuperação
-- Objetivo: Registrar observações sobre o contato de recuperação
-- ================================================================

-- Adicionar coluna de observação (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticto_pedidos' AND column_name='observacao_recuperacao') THEN
        ALTER TABLE ticto_pedidos ADD COLUMN observacao_recuperacao TEXT;
    END IF;
END $$;

-- Comentário
COMMENT ON COLUMN ticto_pedidos.observacao_recuperacao IS 'Observações sobre a tentativa de recuperação (ex: cliente já comprou, não atende, etc)';
