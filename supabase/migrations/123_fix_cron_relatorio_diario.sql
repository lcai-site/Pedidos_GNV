-- ================================================================
-- MIGRATION 123 (CORREÇÃO): Unificação do Cron Job - Relatório Diário
-- ================================================================
-- Problema: Existiam 2 jobs conflitantes (065 e 122) com horários e parâmetros diferentes
-- Solução: Unificar em um único job com horário correto e parâmetro automated: true
-- Horário: 11:30 UTC = 08:30 BRT (Segunda a Sexta)
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
    service_role_key TEXT;
    auth_header TEXT;
BEGIN
    -- Obter a service role key do vault
    service_role_key := current_setting('vault.service_role_key', true);
    
    -- Construir o header de autorização
    IF service_role_key IS NOT NULL AND service_role_key != '' THEN
        auth_header := 'Bearer ' || service_role_key;
    ELSE
        -- Fallback: Se vault não disponível, usar chave hardcoded
        auth_header := 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneHhpbmBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc';
        RAISE NOTICE 'AVISO: vault.service_role_key não disponível, usando chave fallback';
    END IF;

    -- ================================================
    -- LIMPEZA: Remover TODOS os jobs antigos conflitantes
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

    -- ================================================
    -- NOVO JOB: Relatório Diário Automático
    -- ================================================
    -- Horário: 11:30 UTC = 08:30 BRT (Segunda a Sexta)
    -- Envia parâmetro automated: true para ativar filtros corretos
    -- ================================================

    PERFORM cron.schedule(
        'job_relatorio_diario_automatizado',
        '30 11 * * 1-5',
        $cron$
        SELECT net.http_post(
            'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text,
            '{"automated": true}'::jsonb,
            '{}'::jsonb,
            ('{"Content-Type": "application/json", "Authorization": "' || auth_header || '"}')::jsonb,
            30000::int
        );
        $cron$
    );
    
    RAISE NOTICE 'Job "job_relatorio_diario_automatizado" criado com sucesso para Seg-Sex às 11:30 UTC (08:30 BRT)';

END $$;

-- ================================================================
-- COMANDOS ÚTEIS PARA DEBUG (executar no SQL Editor do Supabase):
-- ================================================================
-- Ver jobs agendados:
-- SELECT * FROM cron.job;
--
-- Ver logs de execução:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--
-- Remover job se necessário:
-- SELECT cron.unschedule('job_relatorio_diario_automatizado');
--
-- Testar execução manual:
-- SELECT net.http_post(
--     url := 'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios',
--     headers := '{"Content-Type": "application/json", "Authorization": "Bearer SUA_SERVICE_ROLE_KEY"}',
--     body := '{"automated": true}'::jsonb
-- );
-- ================================================================
