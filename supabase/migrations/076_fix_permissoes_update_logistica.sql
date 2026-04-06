-- ================================================================
-- MIGRATION: Fix permissões UPDATE para logística
-- Permite UPDATE direto nas colunas de logística da tabela pedidos_consolidados_v3
-- ================================================================

-- Drop policy existente se houver
DROP POLICY IF EXISTS pedidos_consolidados_v3_update_logistica ON pedidos_consolidados_v3;

-- Criar policy específica para atualização de colunas de logística
CREATE POLICY pedidos_consolidados_v3_update_logistica ON pedidos_consolidados_v3
FOR UPDATE TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- Garantir que as policies gerais também estão ativas
DROP POLICY IF EXISTS "allow_update_auth" ON pedidos_consolidados_v3;
DROP POLICY IF EXISTS "allow_update_anon" ON pedidos_consolidados_v3;

CREATE POLICY "allow_update_auth" ON pedidos_consolidados_v3 
FOR UPDATE TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "allow_update_anon" ON pedidos_consolidados_v3 
FOR UPDATE TO anon 
USING (true) 
WITH CHECK (true);

-- Recarregar schema
NOTIFY pgrst, 'reload schema';

SELECT 'Permissões de UPDATE atualizadas com sucesso!' as resultado;
