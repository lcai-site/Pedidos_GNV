-- ================================================================
-- MIGRATION 125: Ajuste de Horário do Cron Job
-- ================================================================
-- Altera o disparo para as 08:35 BRT (11:35 UTC)
-- Continua sem enviar header Authorization
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    -- Desativar o antigo
    BEGIN
        PERFORM cron.unschedule('job_relatorio_diario_automatizado');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Criar no novo horário: 11:35 UTC (= 08:35 BRT)
    PERFORM cron.schedule(
        'job_relatorio_diario_automatizado',
        '35 11 * * 1-5',
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
    
    RAISE NOTICE 'Job atualizado com sucesso para 08:35 BRT';
END $$;
