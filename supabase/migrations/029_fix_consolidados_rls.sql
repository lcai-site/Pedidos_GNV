-- ================================================================
-- FIX: RLS policies faltantes para pedidos_consolidados_v3
-- Execute no SQL Editor do Supabase Produção
-- ================================================================

-- INSERT policy (necessário para consolidar_pedidos e operações do front)
DROP POLICY IF EXISTS "Insert autenticado consolidados" ON pedidos_consolidados_v3;
CREATE POLICY "Insert autenticado consolidados" ON pedidos_consolidados_v3
    FOR INSERT WITH CHECK (true);

-- DELETE policy (necessário para re-processamento incremental)
DROP POLICY IF EXISTS "Delete autenticado consolidados" ON pedidos_consolidados_v3;
CREATE POLICY "Delete autenticado consolidados" ON pedidos_consolidados_v3
    FOR DELETE USING (true);

-- Garantir que service_role e anon têm permissões DML
GRANT SELECT, INSERT, UPDATE, DELETE ON pedidos_consolidados_v3 TO anon, authenticated, service_role;

-- Índice extra para performance do dia_despacho (filtro mais usado na Logística)
CREATE INDEX IF NOT EXISTS idx_consolidados_dia_despacho ON pedidos_consolidados_v3 (dia_despacho);
CREATE INDEX IF NOT EXISTS idx_consolidados_status_envio ON pedidos_consolidados_v3 (status_envio);

NOTIFY pgrst, 'reload schema';
SELECT 'RLS e índices fix aplicados!' as resultado;
