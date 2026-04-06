-- =====================================================
-- Adicionar colunas de rastreio dos Correios
-- Execute no SQL Editor do Supabase
-- =====================================================

ALTER TABLE pedidos_consolidados_v3
  ADD COLUMN IF NOT EXISTS status_rastreio TEXT DEFAULT NULL,      -- Ex: 'Postado', 'Em Trânsito', 'Saiu para Entrega', 'Entregue'
  ADD COLUMN IF NOT EXISTS ultimo_evento_correios TEXT DEFAULT NULL, -- Descrição legível do último evento
  ADD COLUMN IF NOT EXISTS data_ultimo_evento TIMESTAMPTZ DEFAULT NULL, -- Timestamp do último evento
  ADD COLUMN IF NOT EXISTS data_entrega TIMESTAMPTZ DEFAULT NULL;  -- Preenchido quando BDE (entregue)

-- Índice para facilitar a busca dos pedidos a rastrear
CREATE INDEX IF NOT EXISTS idx_pedidos_rastreio_correios
  ON pedidos_consolidados_v3 (logistica_provider, status_rastreio)
  WHERE logistica_provider = 'Correios Nativo';

-- =====================================================
-- Registrar pg_cron para rodar a cada hora
-- (Adicionar após fazer o deploy da Edge Function)
-- =====================================================

SELECT cron.schedule(
  'sync-correios-tracking-hora',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/sync-correios-tracking',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
