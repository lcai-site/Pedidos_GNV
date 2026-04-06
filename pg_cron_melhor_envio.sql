-- Script para criar o job no pg_cron executando de hora em hora
-- SUBSTITUA OS VALORES ABAIXO ANTES DE EXECUTAR

-- Descomente a linha abaixo para desativar a extensão se der algum erro e tentar de novo, porém a `pg_cron` já deve estar habilitada
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;

-- (O comando de unschedule foi removido pois causava erro na primeira vez que rodava)

-- Criando o novo job para rodar a cada hora (minuto 0)
SELECT
  cron.schedule(
    'sync-rastreio-melhor-envio-hora', 
    '0 * * * *', -- Cron expression para rodar de hora em hora (ex: 01:00, 02:00, etc.)
    $$
    SELECT
      net.http_post(
          url:='https://SUA_PROJECT_URL_AQUI.supabase.co/functions/v1/sync-melhor-envio-tracking',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer SUA_SERVICE_ROLE_KEY_AQUI"}'::jsonb,
          timeout_milliseconds:=10000
      ) AS request_id;
    $$
  );

-- Comandos Úteis:
-- Para ver os jobs agendados:
-- select * from cron.job;

-- Para tentar deletar se resolver trocar depois:
-- SELECT cron.unschedule('sync-rastreio-melhor-envio-hora');
