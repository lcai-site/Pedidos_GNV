-- ================================================================
-- MIGRATION 123B (ALTERNATIVA): Cron Job - Relatório Diário (Sem Vault)
-- ================================================================
-- Use ESTE ARQUIVO se o migration 123 falhar porque o Vault não está disponível
-- Horário: 11:30 UTC = 08:30 BRT (Segunda a Sexta)
-- ================================================================
-- ⚠️ ATENÇÃO: Substitua SUA_SERVICE_ROLE_KEY_AQUI pela sua chave real
-- Pegue em: https://supabase.com/dashboard/project/cgyxinpejaoadsqrxbhy/settings/api
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
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

    BEGIN
        PERFORM cron.unschedule('job_relatorio_diario_automatizado');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- ================================================
    -- NOVO JOB ÚNICO: Relatório Diário Automático
    -- ================================================
    -- Horário: 11:30 UTC = 08:30 BRT (Segunda a Sexta)
    -- Envia parâmetro automated: true para ativar filtros corretos
    -- ⚠️ SUBSTITUA SUA_SERVICE_ROLE_KEY_AQUI PELA CHAVE REAL
    -- ================================================
    
    PERFORM cron.schedule(
        'job_relatorio_diario_automatizado',
        '30 11 * * 1-5',
        $cron$
        SELECT net.http_post(
            'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios'::text,
            '{"automated": true}'::jsonb,
            '{}'::jsonb,
            '{"Content-Type": "application/json", "Authorization": "Bearer SUA_SERVICE_ROLE_KEY_AQUI"}'::jsonb,
            30000::int
        );
        $cron$
    );
    
    RAISE NOTICE 'Job "job_relatorio_diario_automatizado" criado com sucesso para Seg-Sex às 11:30 UTC (08:30 BRT)';
    RAISE NOTICE '⚠️ Lembre-se: Substitua SUA_SERVICE_ROLE_KEY_AQUI pela chave real se ainda não fez!';

END $$;

-- ================================================================
-- INSTRUÇÕES PARA OBTER A SERVICE ROLE KEY:
-- ================================================================
-- 1. Acesse: https://supabase.com/dashboard/project/cgyxinpejaoadsqrxbhy/settings/api
-- 2. Copie a chave "service_role" (NÃO é a anon/public)
-- 3. Substitua no SQL acima onde diz "SUA_SERVICE_ROLE_KEY_AQUI"
-- 4. Execute o SQL no Editor do Supabase
-- ================================================================
-- COMANDOS ÚTEIS PARA DEBUG:
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
-- Testar execução manual (substitua a chave):
-- SELECT net.http_post(
--     url := 'https://cgyxinpejaoadsqrxbhy.supabase.co/functions/v1/relatorio-envios',
--     headers := '{"Content-Type": "application/json", "Authorization": "Bearer SUA_SERVICE_ROLE_KEY_AQUI"}',
--     body := '{"automated": true}'::jsonb
-- );
-- ================================================================
