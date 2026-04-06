-- =========================================================
-- Migration 109: CRM Rodada 1 — Z-API Config + WhatsApp Templates
-- Data: 2026-03-26
-- Impacto: ZERO em tabelas existentes. Tabelas 100% novas.
-- =========================================================

-- ===================
-- 1) TABELA: zapi_config
-- Armazena credenciais e status da instância Z-API
-- ===================
CREATE TABLE IF NOT EXISTS zapi_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id text NOT NULL,
  token text NOT NULL,
  client_token text DEFAULT '',
  nome_instancia text DEFAULT 'Principal',
  status text DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'connecting')),
  phone_connected text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- RLS: apenas adm pode ver/editar
ALTER TABLE zapi_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zapi_config_select_adm" ON zapi_config;
CREATE POLICY "zapi_config_select_adm" ON zapi_config
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'adm'
      AND profiles.ativo = true
    )
  );

DROP POLICY IF EXISTS "zapi_config_all_adm" ON zapi_config;
CREATE POLICY "zapi_config_all_adm" ON zapi_config
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'adm'
      AND profiles.ativo = true
    )
  );

-- ===================
-- 2) TABELA: whatsapp_templates
-- Templates de mensagens com variáveis dinâmicas
-- ===================
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'geral',
  conteudo text NOT NULL,
  variaveis text[] DEFAULT '{}',
  ativo boolean DEFAULT true,
  gatilho_automatico text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- RLS: adm e gestor podem gerenciar
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_templates_select" ON whatsapp_templates;
CREATE POLICY "whatsapp_templates_select" ON whatsapp_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('adm', 'gestor')
      AND profiles.ativo = true
    )
  );

DROP POLICY IF EXISTS "whatsapp_templates_all" ON whatsapp_templates;
CREATE POLICY "whatsapp_templates_all" ON whatsapp_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('adm', 'gestor')
      AND profiles.ativo = true
    )
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_categoria ON whatsapp_templates(categoria);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_gatilho ON whatsapp_templates(gatilho_automatico) WHERE gatilho_automatico IS NOT NULL;

-- ===================
-- Templates padrão (seed)
-- ===================
INSERT INTO whatsapp_templates (nome, categoria, conteudo, variaveis, gatilho_automatico) VALUES
  ('Pedido Postado', 'rastreio', 
   'Olá {{primeiro_nome}}! 📦

Seu pedido *{{produto}}* acabou de ser postado!

🔍 Código de rastreio: *{{rastreio}}*
🚚 Transportadora: {{transportadora}}

Acompanhe a entrega pelo link:
{{link_rastreio}}

Qualquer dúvida, estamos à disposição! 😊',
   ARRAY['primeiro_nome', 'produto', 'rastreio', 'transportadora', 'link_rastreio'],
   'pedido_postado'),

  ('Em Trânsito', 'rastreio',
   'Oi {{primeiro_nome}}! 🚚

Seu pedido *{{produto}}* está a caminho!

📍 Status: *{{status_entrega}}*
📅 Previsão: {{data_previsao}}

Rastreio: {{rastreio}}

Logo logo chega! 🎉',
   ARRAY['primeiro_nome', 'produto', 'status_entrega', 'data_previsao', 'rastreio'],
   'em_transito'),

  ('Saiu para Entrega', 'rastreio',
   '{{primeiro_nome}}, seu pedido está *saindo para entrega hoje*! 🎉🏠

📦 *{{produto}}*
🔍 Rastreio: {{rastreio}}

Fique atento(a) para receber! 😊',
   ARRAY['primeiro_nome', 'produto', 'rastreio'],
   'saiu_para_entrega'),

  ('Pedido Entregue', 'rastreio',
   'Oi {{primeiro_nome}}! ✅

Seu pedido *{{produto}}* foi *entregue com sucesso*!

Esperamos que goste! Se precisar de qualquer ajuda, estamos aqui. 💚

Obrigado(a) pela confiança! 🙏',
   ARRAY['primeiro_nome', 'produto'],
   'entregue'),

  ('Boas-vindas Compra', 'boas_vindas',
   'Olá {{primeiro_nome}}! 🎉

Bem-vindo(a)! Sua compra de *{{produto}}* no valor de *{{valor}}* foi confirmada!

Em breve seu pedido será preparado e enviado. 📦

Acompanhe tudo direitinho por aqui! 😊',
   ARRAY['primeiro_nome', 'produto', 'valor'],
   'compra_aprovada'),

  ('Carrinho Abandonado', 'recuperacao',
   'Oi {{primeiro_nome}}, tudo bem? 👋

Percebi que você deixou o *{{produto}}* no carrinho e ainda não finalizou! 🛒

Que tal garantir o seu agora? 😉

Se tiver qualquer dúvida, me chama aqui! 💬',
   ARRAY['primeiro_nome', 'produto'],
   'carrinho_abandonado')

ON CONFLICT DO NOTHING;
