-- ================================================================
-- MIGRATION 065: Agendamento Automático — Consolidação + Relatório
-- ================================================================
-- 1. Consolidação de pedidos: a cada hora (minuto 0)
-- 2. Relatório diário de envios: 8:30 e 8:35 (Seg-Sex)
-- Horários em UTC: BRT -3h → 08:30 BRT = 11:30 UTC

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN

  -- ================================================
  -- JOB 1: CONSOLIDAÇÃO DE PEDIDOS (a cada hora)
  -- ================================================
  BEGIN
    PERFORM cron.unschedule('job_consolidar_pedidos_hora');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Roda a cada hora no minuto 0 — chama a RPC diretamente via SQL
  PERFORM cron.schedule(
    'job_consolidar_pedidos_hora',
    '0 * * * *',
    'SELECT public.consolidar_pedidos_ticto();'
  );

  -- ================================================
  -- JOB 2: RELATÓRIO DIÁRIO — 08:30 BRT (11:30 UTC)
  -- ================================================
  BEGIN
    PERFORM cron.unschedule('job_relatorio_diario_envios');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM cron.schedule(
    'job_relatorio_diario_envios',
    '30 11 * * 1-5',
    'SELECT net.http_post(
        url := ''https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'',
        headers := ''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA"}'',
        body := ''{}''
    );'
  );

  -- ================================================
  -- JOB 3: RELATÓRIO RETRY — 08:35 BRT (11:35 UTC)
  -- ================================================
  BEGIN
    PERFORM cron.unschedule('job_relatorio_diario_retry');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM cron.schedule(
    'job_relatorio_diario_retry',
    '35 11 * * 1-5',
    'SELECT net.http_post(
        url := ''https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'',
        headers := ''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA"}'',
        body := ''{}''
    );'
  );

END $$;
