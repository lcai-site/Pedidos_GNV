-- ================================================================
-- TESTE 1: Chamada SEM Authorization Header
-- ================================================================
-- A Edge Function já tem SUPABASE_SERVICE_ROLE_KEY nas env vars
-- Talvez não precise do header Authorization

SELECT net.http_post(
    'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text,
    '{"automated": true}'::jsonb,
    '{}'::jsonb,
    '{"Content-Type": "application/json"}'::jsonb,
    30000::int
) AS request_id;

-- Verificar resultado depois:
-- SELECT id, status_code, LEFT(content, 500), created FROM net._http_response ORDER BY created DESC LIMIT 3;
