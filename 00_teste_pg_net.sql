-- ================================================================
-- TESTE DE CHAMADA HTTP - VERSÕES DIFERENTES DO PG_NET
-- ================================================================
-- Tente cada uma até funcionar
-- ================================================================

-- ================================================================
-- OPÇÃO 1: Formato com named parameters (pg_net moderno)
-- ================================================================
SELECT net.http_post(
    url := 'https://httpbin.org/post'::text,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"test": true}'::jsonb,
    timeout_milliseconds := 5000::integer
) AS test_request_id;

-- ================================================================
-- OPÇÃO 2: Formato posicional (pg_net antigo)
-- ================================================================
SELECT net.http_post(
    'https://httpbin.org/post'::text,
    '{"Content-Type": "application/json"}'::jsonb,
    '{"test": true}'::jsonb,
    5000::integer
) AS test_request_id;

-- ================================================================
-- OPÇÃO 3: Apenas URL e body (algumas versões)
-- ================================================================
SELECT net.http_post(
    'https://httpbin.org/post'::text,
    '{"test": true}'::jsonb
) AS test_request_id;

-- ================================================================
-- OPÇÃO 4: Usando http_get para teste de conectividade
-- ================================================================
SELECT net.http_get(
    'https://httpbin.org/get'::text
) AS test_request_id;

-- ================================================================
-- VERIFICAR VERSÃO DO PG_NET
-- ================================================================
SELECT 
    extname,
    extversion
FROM pg_extension 
WHERE extname = 'pg_net';

-- ================================================================
-- LISTAR TODAS AS FUNÇÕES DO SCHEMA NET
-- ================================================================
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_schema = 'net'
ORDER BY routine_name;

-- ================================================================
-- VER DETALHES DAS FUNÇÕES HTTP_POST
-- ================================================================
SELECT 
    proname AS function_name,
    proargnames AS argument_names,
    proargtypes::regtype[] AS argument_types,
    pronargs AS num_args
FROM pg_proc 
WHERE pronamespace = 'net'::regnamespace 
    AND proname LIKE '%http%'
ORDER BY proname, pronargs;
