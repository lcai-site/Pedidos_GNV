-- ================================================================
-- TESTE: Usar header 'apikey' em vez de 'Authorization'
-- ================================================================
-- O gateway do Supabase pode aceitar o header 'apikey' para chamadas internas

SELECT net.http_post(
    'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text,
    '{"automated": true}'::jsonb,
    '{}'::jsonb,
    '{
        "Content-Type": "application/json",
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneHhpbmBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA"
    }'::jsonb,
    30000::int
) AS request_id;

-- Verificar resultado:
-- SELECT id, status_code, LEFT(content, 500) FROM net._http_response ORDER BY created DESC LIMIT 3;
