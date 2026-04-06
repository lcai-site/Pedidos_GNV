-- ================================================================
-- DIAGNÓSTICO - RELATÓRIO DIÁRIO AUTOMÁTICO
-- ================================================================
-- Execute CADA BLOCO separadamente no SQL Editor do Supabase
-- ================================================================

-- ================================================================
-- BLOCO 1: O job está agendado?
-- ================================================================
SELECT 
    jobid,
    jobname,
    schedule,
    command,
    active
FROM cron.job 
WHERE jobname LIKE '%relatorio%';

-- ✅ Esperado: Ver "job_relatorio_diario_automatizado" com schedule "30 11 * * 1-5" e active = true

-- ================================================================
-- BLOCO 2: O job executou? (Logs de execução)
-- ================================================================
SELECT 
    j.jobname,
    r.start_time,
    r.status,
    r.return_message
FROM cron.job_run_details r
JOIN cron.job j ON r.jobid = j.jobid
WHERE j.jobname = 'job_relatorio_diario_automatizado'
ORDER BY r.start_time DESC 
LIMIT 10;

-- ✅ status = 's' → sucesso
-- ❌ status = 'f' → falhou (veja return_message)
-- ⚠️ sem registros → job nunca executou

-- ================================================================
-- BLOCO 3: Extensões estão habilitadas?
-- ================================================================
SELECT 
    extname,
    extversion
FROM pg_extension 
WHERE extname IN ('pg_cron', 'pg_net');

-- ✅ Esperado: Ver ambas as extensões listadas

-- ================================================================
-- BLOCO 4: Vault está disponível?
-- ================================================================
SELECT 
    current_setting('vault.service_role_key', true) AS service_role_key;

-- ✅ Esperado: Ver a chave (começa com "eyJ...")
-- ⚠️ NULL → Vault não configurado (use migration 123b)

-- ================================================================
-- BLOCO 5: Teste de conectividade HTTP
-- ================================================================
SELECT net.http_get('https://httpbin.org/get'::text) AS test_id;

-- ✅ Esperado: Um número (request_id)
-- ❌ Erro → pg_net não está funcionando

-- ================================================================
-- BLOCO 6: Testar chamada da função (substitua a chave se necessário)
-- ================================================================
-- Sintaxe: net.http_post(url, body, params, headers, timeout_milliseconds)
SELECT net.http_post(
    'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text,
    '{"automated": true}'::jsonb,
    '{}'::jsonb,
    ('{"Content-Type": "application/json", "Authorization": "Bearer ' || COALESCE(current_setting('vault.service_role_key', true), 'SUA_SERVICE_ROLE_KEY_AQUI') || '"}')::jsonb,
    30000::int
) AS request_id;

-- ✅ Esperado: Um número (request_id) → Ver logs da Edge Function
-- ❌ Erro → Ver mensagem de erro

-- ================================================================
-- BLOCO 7: Há pedidos prontos para envio?
-- ================================================================
SELECT 
    COUNT(*) AS total_pedidos,
    MIN(dia_despacho) AS primeiro_dia,
    MAX(dia_despacho) AS ultimo_dia
FROM pedidos_consolidados_v3
WHERE status_envio = 'pronto';

-- ✅ Esperado: total_pedidos > 0 para o relatório enviar algo
-- ⚠️ total_pedidos = 0 → Relatório vai retornar "Nenhum pedido"

-- ================================================================
-- BLOCO 8: Hoje é feriado ou fim de semana?
-- ================================================================
SELECT 
    CURRENT_DATE AS hoje,
    CASE EXTRACT(DOW FROM CURRENT_DATE)
        WHEN 0 THEN 'Domingo'
        WHEN 1 THEN 'Segunda'
        WHEN 2 THEN 'Terça'
        WHEN 3 THEN 'Quarta'
        WHEN 4 THEN 'Quinta'
        WHEN 5 THEN 'Sexta'
        WHEN 6 THEN 'Sábado'
    END AS dia_semana,
    (SELECT nome FROM feriados WHERE data = CURRENT_DATE) AS feriado;

-- ✅ Esperado: Dia útil (Segunda a Sexta) e sem feriado
-- ⚠️ Fim de semana ou feriado → Job pula o envio

-- ================================================================
-- BLOCO 9: Todos os jobs do cron
-- ================================================================
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    LEFT(command, 80) || '...' AS command
FROM cron.job
ORDER BY jobid;

-- ================================================================
-- BLOCO 10: Limpar jobs antigos (USE COM CAUTELA)
-- ================================================================
-- Descomente apenas se quiser remover jobs antigos
-- SELECT cron.unschedule('job_relatorio_diario_envios');
-- SELECT cron.unschedule('job_relatorio_diario_retry');
-- SELECT cron.unschedule('job_relatorio_diario_oficial');

-- ================================================================
-- RESUMO DO DIAGNÓSTICO:
-- ================================================================
-- 1. Execute Bloco 1 → Confirma que job existe
-- 2. Execute Bloco 2 → Vê se executou e status
-- 3. Execute Bloco 6 → Testa chamada manual
-- 4. Veja logs da Edge Function em:
--    https://supabase.com/dashboard/project/cgyxinpejaoadsqrxbhy/functions/logs
-- ================================================================
