-- ================================================================
-- VERIFICAR RESULTADO DO TESTE (CORRIGIDO v3)
-- ================================================================

-- 1. Verificar o status da requisição 649
SELECT 
    id,
    status_code,
    content,
    created
FROM net._http_response
WHERE id = 649
ORDER BY created DESC
LIMIT 1;

-- 2. Verificar todas as requisições recentes
SELECT 
    id,
    status_code,
    LEFT(content, 200) AS content_preview,
    created
FROM net._http_response
ORDER BY created DESC
LIMIT 10;

-- 3. Verificar histórico completo
SELECT 
    id,
    status_code,
    LEFT(content, 100) AS content_preview,
    created
FROM net._http_response
ORDER BY created DESC
LIMIT 20;

-- 4. Verificar requisições PENDENTES (sem status_code ainda)
SELECT 
    id,
    created
FROM net._http_response
WHERE status_code IS NULL
ORDER BY created DESC
LIMIT 10;
