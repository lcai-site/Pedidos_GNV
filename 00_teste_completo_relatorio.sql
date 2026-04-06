-- ================================================================
-- TESTE COMPLETO - RELATÓRIO DIÁRIO (CORRIGIDO)
-- ================================================================
-- A tabela correta é net._http_response (com underscore)
-- ================================================================

-- ================================================================
-- BLOCO 1: Verificar resposta da requisição anterior (649)
-- ================================================================
SELECT 
    id,
    status_code,
    LEFT(content, 500) AS content_preview,
    LENGTH(content) AS content_length,
    created
FROM net._http_response
WHERE id = 649;

-- ================================================================
-- BLOCO 2: Verificar TODAS as respostas recentes
-- ================================================================
SELECT 
    id,
    status_code,
    LEFT(content, 200) AS content_preview,
    created
FROM net._http_response
ORDER BY created DESC
LIMIT 10;

-- ================================================================
-- BLOCO 3: Testar chamada AGORA (novo request)
-- ================================================================
SELECT net.http_post(
    'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text,
    '{"automated": true}'::jsonb,
    '{}'::jsonb,
    ('{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('vault.service_role_key', true) || '"}')::jsonb,
    30000::int
) AS novo_request_id;

-- Anote o número retornado acima e use no BLOCO 4

-- ================================================================
-- BLOCO 4: Verificar resposta do NOVO teste (substitua 999 pelo ID retornado)
-- ================================================================
-- DESCOMENTE E SUBSTITUA PELO ID RETORNADO
-- SELECT 
--     id,
--     status_code,
--     content,
--     created,
--     message
-- FROM net._http_response
-- WHERE id = 999; -- SUBSTITUA PELO ID RETORNADO

-- ================================================================
-- BLOCO 5: Verificar jobs do cron
-- ================================================================
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    LEFT(command, 100) AS command
FROM cron.job
WHERE jobname LIKE '%relatorio%';

-- ================================================================
-- BLOCO 6: Verificar execuções do job
-- ================================================================
SELECT 
    j.jobname,
    r.start_time,
    r.end_time,
    r.status,
    r.return_message
FROM cron.job_run_details r
JOIN cron.job j ON r.jobid = j.jobid
WHERE j.jobname = 'job_relatorio_diario_automatizado'
ORDER BY r.start_time DESC
LIMIT 10;

-- ================================================================
-- BLOCO 7: Verificar pedidos prontos para envio
-- ================================================================
SELECT 
    COUNT(*) AS total_pedidos_prontos,
    MIN(dia_despacho) AS primeiro_dia,
    MAX(dia_despacho) AS ultimo_dia
FROM pedidos_consolidados_v3
WHERE status_envio = 'pronto';

-- ================================================================
-- BLOCO 8: Verificar se hoje é dia útil
-- ================================================================
SELECT 
    CURRENT_DATE AS hoje,
    EXTRACT(DOW FROM CURRENT_DATE) AS dia_semana_numero,
    CASE EXTRACT(DOW FROM CURRENT_DATE)
        WHEN 0 THEN 'Domingo'
        WHEN 1 THEN 'Segunda'
        WHEN 2 THEN 'Terça'
        WHEN 3 THEN 'Quarta'
        WHEN 4 THEN 'Quinta'
        WHEN 5 THEN 'Sexta'
        WHEN 6 THEN 'Sábado'
    END AS dia_semana,
    CASE 
        WHEN EXISTS (SELECT 1 FROM feriados WHERE data = CURRENT_DATE) 
        THEN 'É FERIADO'
        ELSE 'NÃO é feriado'
    END AS situacao_feriado,
    CASE 
        WHEN EXTRACT(DOW FROM CURRENT_DATE) IN (0, 6) THEN 'FIM DE SEMANA'
        ELSE 'DIA ÚTIL'
    END AS tipo_dia;

-- ================================================================
-- INTERPRETAÇÃO DOS RESULTADOS:
-- ================================================================
-- status_code = 200 → Sucesso!
-- status_code = 500 → Erro na função Edge (veja content)
-- status_code = 401/403 → Erro de autenticação
-- status_code = NULL → Requisição ainda não completou
--
-- Se o job está ativo mas não executa:
-- - Verificar se pg_cron está rodando
-- - Verificar se há pedidos com status_envio = 'pronto'
-- - Verificar se não é fim de semana/feriado
-- ================================================================
