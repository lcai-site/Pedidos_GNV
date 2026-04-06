-- ================================================================
-- MIGRATION 123 (FINAL CORRETO): Usar Anon Key em vez de Service Role
-- ================================================================
-- O frontend usa a Anon Key para chamar a função
-- O cron também deve usar a Anon Key
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    -- ================================================
    -- LIMPEZA: Remover TODOS os jobs antigos
    -- ================================================
    BEGIN
        PERFORM cron.unschedule('job_relatorio_diario_envios');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        PERFORM cron.unschedule('job_relatorio_diario_retry');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        PERFORM cron.unschedule('job_relatorio_diario_oficial');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        PERFORM cron.unschedule('job_relatorio_diario_automatizado');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- ================================================
    -- NOVO JOB: Relatório Diário Automático
    -- ================================================
    -- Horário: 11:30 UTC = 08:30 BRT (Segunda a Sexta)
    -- Usa Anon Key (mesmo que o frontend)
    -- ================================================

    PERFORM cron.schedule(
        'job_relatorio_diario_automatizado',
        '30 11 * * 1-5',
        $cron$
        SELECT net.http_post(
            'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text,
            '{"automated": true}'::jsonb,
            '{}'::jsonb,
            '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneHhpbmBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA"}'::jsonb,
            30000::int
        );
        $cron$
    );
    
    RAISE NOTICE 'Job "job_relatorio_diario_automatizado" criado com sucesso!';
    RAISE NOTICE 'Horario: Seg-Sex as 11:30 UTC (08:30 BRT)';
    RAISE NOTICE 'Usando Anon Key (mesmo que o frontend)';

END $$;

-- ================================================================
-- VERIFICAÇÃO: O job foi criado corretamente?
-- ================================================================
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    LEFT(command, 150) AS command_preview
FROM cron.job 
WHERE jobname = 'job_relatorio_diario_automatizado';

-- ================================================================
-- TESTE IMEDIATO: Com Anon Key
-- ================================================================
SELECT net.http_post(
    'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text,
    '{"automated": true}'::jsonb,
    '{}'::jsonb,
    '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneHhpbmBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA"}'::jsonb,
    30000::int
) AS request_id;

-- Após executar, verifique o resultado:
-- SELECT id, status_code, LEFT(content, 500) FROM net._http_response ORDER BY created DESC LIMIT 3;
