-- ================================================================
-- VERIFICAR RESULTADO DO TESTE
-- ================================================================

-- 1. Verificar o status da requisição HTTP
SELECT 
    id,
    status_code,
    content,
    created_at
FROM net.http_response_queue
WHERE id = 649
ORDER BY created_at DESC
LIMIT 1;

-- 2. Verificar todas as requisições recentes da função de relatório
SELECT 
    r.id,
    r.status_code,
    LEFT(r.content, 200) AS content_preview,
    r.created_at,
    j.jobname
FROM net.http_response_queue r
JOIN cron.job j ON r.id = j.jobid
WHERE j.jobname = 'job_relatorio_diario_automatizado'
   OR r.content LIKE '%relatorio-envios%'
ORDER BY r.created_at DESC
LIMIT 10;

-- 3. Verificar histórico completo do pg_net
SELECT 
    id,
    method,
    url,
    status_code,
    created_at
FROM net.http_response_queue
ORDER BY created_at DESC
LIMIT 20;
