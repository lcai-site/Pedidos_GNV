-- ================================================================
-- REAPLICAR MIGRATION 123 - CORRIGIR SINTAXE DO HTTP_POST
-- ================================================================
-- Este script recria o job com a sintaxe correta do pg_net
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
    -- NOVO JOB: Com sintaxe correta do pg_net
    -- ================================================
    -- Ordem dos parâmetros: url, body, params, headers, timeout_milliseconds
    PERFORM cron.schedule(
        'job_relatorio_diario_automatizado',
        '30 11 * * 1-5',
        $cron$
        SELECT net.http_post(
            'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text,
            '{"automated": true}'::jsonb,
            '{}'::jsonb,
            ('{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('vault.service_role_key', true) || '"}')::jsonb,
            30000::int
        );
        $cron$
    );
    
    RAISE NOTICE 'Job "job_relatorio_diario_automatizado" recriado com sucesso!';
    RAISE NOTICE 'Horario: Seg-Sex às 11:30 UTC (08:30 BRT)';

END $$;

-- ================================================================
-- VERIFICAÇÃO: O job foi criado corretamente?
-- ================================================================
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    LEFT(command, 100) AS command_preview
FROM cron.job 
WHERE jobname = 'job_relatorio_diario_automatizado';

-- ================================================================
-- TESTE IMEDIATO: Executar agora para validar
-- ================================================================
-- Descomente para testar manualmente:
/*
SELECT net.http_post(
    url::text,
    headers::jsonb,
    body::jsonb,
    timeout_milliseconds::integer
) AS request_id
FROM (
    SELECT 
        'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text AS url,
        ('{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('vault.service_role_key', true) || '"}')::jsonb AS headers,
        '{"automated": true}'::jsonb AS body,
        30000::integer AS timeout_milliseconds
) AS params;
*/
