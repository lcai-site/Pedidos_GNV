-- ================================================================
-- MIGRATION 124: Cron Job sem Autenticação (Após --no-verify-jwt)
-- ================================================================
-- Após fazer o deploy com --no-verify-jwt, atualize o cron job
-- para não enviar mais o header Authorization
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
    -- NOVO JOB: Sem header Authorization
    -- ================================================
    -- A função agora está com --no-verify-jwt
    -- Não precisa enviar header Authorization
    -- ================================================

    PERFORM cron.schedule(
        'job_relatorio_diario_automatizado',
        '30 11 * * 1-5',
        $cron$
        SELECT net.http_post(
            'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text,
            '{"automated": true}'::jsonb,
            '{}'::jsonb,
            '{"Content-Type": "application/json"}'::jsonb,
            30000::int
        );
        $cron$
    );
    
    RAISE NOTICE 'Job "job_relatorio_diario_automatizado" criado com sucesso!';
    RAISE NOTICE 'Horario: Seg-Sex as 11:30 UTC (08:30 BRT)';
    RAISE NOTICE 'Sem autenticação JWT (função deployada com --no-verify-jwt)';

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
-- TESTE IMEDIATO: Chamada sem autenticação
-- ================================================================
SELECT net.http_post(
    'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text,
    '{"automated": true}'::jsonb,
    '{}'::jsonb,
    '{"Content-Type": "application/json"}'::jsonb,
    30000::int
) AS request_id;

-- Após executar, verifique o resultado:
-- SELECT id, status_code, LEFT(content, 500) FROM net._http_response ORDER BY created DESC LIMIT 3;
