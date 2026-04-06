-- ================================================================
-- DESCOBRIR TABELAS DO SCHEMA NET
-- ================================================================

-- 1. Listar todas as tabelas do schema net
SELECT 
    table_schema,
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'net'
ORDER BY table_name;

-- 2. Listar todas as views do schema net
SELECT 
    table_schema,
    table_name
FROM information_schema.views 
WHERE table_schema = 'net'
ORDER BY table_name;

-- 3. Verificar versão do pg_net
SELECT 
    extname,
    extversion
FROM pg_extension 
WHERE extname = 'pg_net';

-- 4. Listar todas as funções do schema net
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_schema = 'net'
ORDER BY routine_name, routine_type;

-- 5. Tentar encontrar tabelas com 'response' no nome
SELECT 
    table_schema,
    table_name
FROM information_schema.tables 
WHERE table_name ILIKE '%response%'
   OR table_name ILIKE '%http%'
   OR table_name ILIKE '%request%'
ORDER BY table_name;

-- 6. Verificar se existe a tabela request
SELECT * FROM net.http_request_queue LIMIT 1;

-- 7. Verificar se existe a tabela response
SELECT * FROM net.http_response LIMIT 1;

-- 8. Listar TODAS as tabelas do banco que podem ser do pg_net
SELECT 
    schemaname,
    tablename
FROM pg_tables 
WHERE tablename LIKE '%http%' 
   OR tablename LIKE '%response%'
   OR tablename LIKE '%request%'
ORDER BY schemaname, tablename;
