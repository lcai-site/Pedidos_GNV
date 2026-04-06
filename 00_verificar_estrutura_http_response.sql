-- ================================================================
-- VERIFICAR ESTRUTURA DA TABELA net._http_response
-- ================================================================

-- 1. Verificar colunas da tabela
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'net' 
  AND table_name = '_http_response'
ORDER BY ordinal_position;

-- 2. Verificar dados recentes (sem filtro de colunas)
SELECT * FROM net._http_response 
ORDER BY id DESC 
LIMIT 10;
