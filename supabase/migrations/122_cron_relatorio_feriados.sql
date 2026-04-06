-- ================================================================
-- MIGRATION 122 (TESTE): Agendamento Relatório Diário - TESTE 15:00
-- ================================================================
-- Horário: 18:00 UTC = 15:00 BRT
-- Expressão Cron: '0 18 * * 1-5' (Segunda a Sexta)

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN

  -- Limpeza
  BEGIN
    PERFORM cron.unschedule('job_relatorio_diario_oficial');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Agendamento de TESTE
  PERFORM cron.schedule(
    'job_relatorio_diario_oficial',
    '0 18 * * 1-5',
    $cron$
    SELECT net.http_post(
        url := 'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('vault.service_role_key', true) || '"}',
        body := '{"automated": true}'
    )
    WHERE 
        NOT EXISTS (SELECT 1 FROM public.feriados WHERE data = CURRENT_DATE)
        AND
        EXISTS (SELECT 1 FROM public.pedidos_consolidados_v3 WHERE status_envio = 'pronto')
    $cron$
  );

END $$;
