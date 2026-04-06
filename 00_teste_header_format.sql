-- ================================================================
-- TESTE COM FORMATO DIFERENTE DE HEADER
-- ================================================================
-- Tentar com formato de string escapada

-- Teste 1: Usando jsonb_build_object
SELECT net.http_post(
    'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text,
    '{"automated": true}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneHhpbmBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc'
    ),
    30000::int
) AS request_id;

-- Teste 2: Verificar se a função edge está esperando formato específico
-- Às vezes o problema é que a função espera um JWT de usuário, não service role
