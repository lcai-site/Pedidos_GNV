-- ================================================================
-- TESTE COM VAULT DIRETO
-- ================================================================

-- 1. Tentar acessar o segredo diretamente da tabela vault.secrets
SELECT 
    name,
    description,
    created_at
FROM vault.secrets 
WHERE name = 'service_role_key';

-- 2. Se funcionar, usar o valor em uma chamada HTTP
-- Primeiro, vamos criar uma função que usa o vault diretamente
SELECT 
    vault.get_secret('service_role_key') AS secret_value;

-- 3. Se o get_secret funcionar, testar a chamada
-- (Este bloco só funciona se o passo 2 retornar a chave)
/*
DO $$
DECLARE
    secret_val TEXT;
    request_id BIGINT;
BEGIN
    SELECT vault.get_secret('service_role_key') INTO secret_val;
    
    IF secret_val IS NOT NULL THEN
        SELECT net.http_post(
            'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text,
            '{"automated": true}'::jsonb,
            '{}'::jsonb,
            ('{"Content-Type": "application/json", "Authorization": "Bearer ' || secret_val || '"}')::jsonb,
            30000::int
        ) INTO request_id;
        
        RAISE NOTICE 'Request ID: %', request_id;
    ELSE
        RAISE NOTICE 'Segredo não encontrado no vault';
    END IF;
END $$;
*/
