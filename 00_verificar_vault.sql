-- ================================================================
-- VERIFICAR E CONFIGURAR VAULT
-- ================================================================

-- 1. Verificar se a service_role_key está no vault
SELECT current_setting('vault.service_role_key', true) AS service_role_key;

-- 2. Listar todos os segredos no vault (se tiver acesso)
SELECT * FROM vault.secrets;

-- 3. Verificar se a extensão está habilitada
SELECT * FROM pg_extension WHERE extname = 'supabase_vault';
