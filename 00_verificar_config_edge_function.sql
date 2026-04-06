-- ================================================================
-- VERIFICAR CONFIGURAÇÃO DA EDGE FUNCTION
-- ================================================================

-- 1. Verificar se há alguma configuração de JWT específica
SELECT 
    name,
    slug,
    created_at,
    updated_at
FROM vault.secrets 
WHERE name ILIKE '%jwt%' OR name ILIKE '%edge%' OR name ILIKE '%function%';

-- 2. Verificar secrets relacionados ao projeto
SELECT 
    name,
    description
FROM vault.secrets;

-- 3. Testar chamada SEM o header Authorization (usando apenas service role key das env vars)
-- A Edge Function já tem a SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente
SELECT net.http_post(
    'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text,
    '{"automated": true}'::jsonb,
    '{}'::jsonb,
    '{"Content-Type": "application/json"}'::jsonb,
    30000::int
) AS request_id;

-- 4. Após executar o teste 3, verificar resultado:
-- SELECT id, status_code, LEFT(content, 500), created FROM net._http_response ORDER BY created DESC LIMIT 3;
