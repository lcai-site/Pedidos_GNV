-- ================================================================
-- SCRIPT SIMPLES: Remover Views em TESTE
-- ================================================================

-- Remover views (se existirem)
DROP VIEW IF EXISTS pedidos_consolidados CASCADE;
DROP VIEW IF EXISTS pedidos_consolidados_v2 CASCADE;

-- Confirmar
SELECT 'Views removidas com sucesso!' as status;
