-- ================================================================
-- MIGRATION 049: Schema completo do CRM com Z-API (CORRIGIDO)
-- ================================================================

-- 1. Tabela de Leads (CRM) - APENAS SE NÃO EXISTIR
CREATE TABLE IF NOT EXISTS crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Dados do Lead
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT NOT NULL,
    cpf TEXT,
    
    -- Endereço
    endereco TEXT,
    cidade TEXT,
    estado TEXT,
    cep TEXT,
    
    -- Origem
    origem TEXT DEFAULT 'recovery',
    origem_detalhe TEXT,
    utm_source TEXT,
    utm_campaign TEXT,
    
    -- Status do Lead
    status TEXT DEFAULT 'novo',
    temperatura TEXT DEFAULT 'morna',
    
    -- Dados de compra
    produto_interesse TEXT,
    valor_interesse DECIMAL(10,2),
    ultimo_contato TIMESTAMPTZ,
    data_conversao TIMESTAMPTZ,
    
    -- Observações
    observacoes TEXT,
    tags TEXT[],
    
    -- Relacionamentos
    pedido_origem_id UUID REFERENCES ticto_pedidos(id),
    responsavel_id UUID REFERENCES auth.users(id),
    
    -- Controle
    enviar_cupom BOOLEAN DEFAULT false,
    cupom_enviado BOOLEAN DEFAULT false,
    descartado BOOLEAN DEFAULT false,
    motivo_descarte TEXT
);

-- Adicionar colunas se não existirem (para tabela já existente)
DO $$
BEGIN
    -- Adicionar colunas que podem estar faltando
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='status') THEN
        ALTER TABLE crm_leads ADD COLUMN status TEXT DEFAULT 'novo';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='temperatura') THEN
        ALTER TABLE crm_leads ADD COLUMN temperatura TEXT DEFAULT 'morna';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='tags') THEN
        ALTER TABLE crm_leads ADD COLUMN tags TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='enviar_cupom') THEN
        ALTER TABLE crm_leads ADD COLUMN enviar_cupom BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='cupom_enviado') THEN
        ALTER TABLE crm_leads ADD COLUMN cupom_enviado BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='descartado') THEN
        ALTER TABLE crm_leads ADD COLUMN descartado BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='motivo_descarte') THEN
        ALTER TABLE crm_leads ADD COLUMN motivo_descarte TEXT;
    END IF;
END $$;

-- 2. Tabela de Templates de Mensagem
CREATE TABLE IF NOT EXISTS crm_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    nome TEXT NOT NULL,
    descricao TEXT,
    categoria TEXT DEFAULT 'geral',
    
    assunto TEXT,
    corpo TEXT NOT NULL,
    variaveis TEXT[],
    
    ativo BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    
    created_by UUID REFERENCES auth.users(id)
);

-- 3. Tabela de Campanhas
CREATE TABLE IF NOT EXISTS crm_campanhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    nome TEXT NOT NULL,
    descricao TEXT,
    
    filtro_status TEXT[],
    filtro_origem TEXT[],
    filtro_temperatura TEXT[],
    filtro_tags TEXT[],
    
    template_id UUID REFERENCES crm_templates(id),
    mensagem_personalizada TEXT,
    
    status_campanha TEXT DEFAULT 'rascunho',
    data_agendamento TIMESTAMPTZ,
    data_inicio TIMESTAMPTZ,
    data_fim TIMESTAMPTZ,
    
    total_leads INTEGER DEFAULT 0,
    enviados INTEGER DEFAULT 0,
    entregues INTEGER DEFAULT 0,
    lidos INTEGER DEFAULT 0,
    respostas INTEGER DEFAULT 0,
    conversoes INTEGER DEFAULT 0,
    
    intervalo_segundos INTEGER DEFAULT 10,
    horario_inicio TIME DEFAULT '08:00',
    horario_fim TIME DEFAULT '20:00',
    apenas_dias_uteis BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES auth.users(id)
);

-- 4. Tabela de Histórico de Mensagens
CREATE TABLE IF NOT EXISTS crm_mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
    campanha_id UUID REFERENCES crm_campanhas(id),
    template_id UUID REFERENCES crm_templates(id),
    
    tipo TEXT DEFAULT 'whatsapp',
    direcao TEXT DEFAULT 'saida',
    mensagem TEXT NOT NULL,
    mensagem_enviada TEXT,
    
    status TEXT DEFAULT 'pendente',
    message_id TEXT,
    error_message TEXT,
    
    midia_url TEXT,
    midia_tipo TEXT,
    
    enviado_at TIMESTAMPTZ,
    entregue_at TIMESTAMPTZ,
    lida_at TIMESTAMPTZ,
    
    resposta TEXT,
    resposta_at TIMESTAMPTZ,
    
    created_by UUID REFERENCES auth.users(id)
);

-- 5. Tabela de Automações/Fluxos
CREATE TABLE IF NOT EXISTS crm_automacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    nome TEXT NOT NULL,
    descricao TEXT,
    ativo BOOLEAN DEFAULT true,
    
    gatilho_tipo TEXT NOT NULL,
    gatilho_condicao JSONB,
    
    acoes JSONB[],
    
    disparos INTEGER DEFAULT 0,
    
    created_by UUID REFERENCES auth.users(id)
);

-- 6. Tabela de Configurações Z-API
CREATE TABLE IF NOT EXISTS crm_config_zapi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    instance_id TEXT,
    instance_token TEXT,
    api_token TEXT,
    
    conectado BOOLEAN DEFAULT false,
    qr_code TEXT,
    telefone_conectado TEXT,
    
    webhook_url TEXT,
    
    mensagens_dia INTEGER DEFAULT 0,
    limite_dia INTEGER DEFAULT 500,
    
    updated_by UUID REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_temperatura ON crm_leads(temperatura);
CREATE INDEX IF NOT EXISTS idx_crm_leads_origem ON crm_leads(origem);
CREATE INDEX IF NOT EXISTS idx_crm_leads_telefone ON crm_leads(telefone);
CREATE INDEX IF NOT EXISTS idx_crm_leads_responsavel ON crm_leads(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_pedido ON crm_leads(pedido_origem_id);

CREATE INDEX IF NOT EXISTS idx_crm_mensagens_lead ON crm_mensagens(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_mensagens_campanha ON crm_mensagens(campanha_id);
CREATE INDEX IF NOT EXISTS idx_crm_mensagens_status ON crm_mensagens(status);

CREATE INDEX IF NOT EXISTS idx_crm_campanhas_status ON crm_campanhas(status_campanha);

-- Inserir templates padrão (apenas se não existirem)
INSERT INTO crm_templates (nome, descricao, categoria, corpo, variaveis, is_default)
SELECT 
    'Recuperação de Carrinho',
    'Mensagem padrão para recuperação de carrinhos abandonados',
    'recuperacao',
    'Olá {nome}! Tudo bem?

Notamos que você iniciou uma compra de {produto}{valor} mas não conseguiu finalizar.

Posso ajudar com alguma informação ou tirar alguma dúvida? Estamos aqui para garantir que você tenha a melhor experiência!

Aguardo seu retorno.',
    ARRAY['nome', 'produto', 'valor'],
    true
WHERE NOT EXISTS (SELECT 1 FROM crm_templates WHERE nome = 'Recuperação de Carrinho');

INSERT INTO crm_templates (nome, descricao, categoria, corpo, variaveis, is_default)
SELECT 
    'Cupom de Desconto',
    'Oferecer cupom para conversão',
    'campanha',
    'Oi {nome}! Tudo bem por aí?

Vimos que você tem interesse em {produto}. Que tal um cupom exclusivo de 10% de desconto para finalizar sua compra?

Use o código: CUPOM10

Válido por 24 horas. Aproveite!',
    ARRAY['nome', 'produto'],
    false
WHERE NOT EXISTS (SELECT 1 FROM crm_templates WHERE nome = 'Cupom de Desconto');

INSERT INTO crm_templates (nome, descricao, categoria, corpo, variaveis, is_default)
SELECT 
    'Pós-Venda',
    'Acompanhar satisfação após compra',
    'pos_venda',
    'Oi {nome}! Espero que esteja tudo bem!

Passando para saber se você já recebeu seu {produto} e se está tudo certo com o pedido.

Qualquer coisa, estamos por aqui!',
    ARRAY['nome', 'produto'],
    false
WHERE NOT EXISTS (SELECT 1 FROM crm_templates WHERE nome = 'Pós-Venda');

-- RLS Policies
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_automacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_config_zapi ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes para evitar erros
DROP POLICY IF EXISTS "Allow all" ON crm_leads;
DROP POLICY IF EXISTS "Allow all" ON crm_templates;
DROP POLICY IF EXISTS "Allow all" ON crm_campanhas;
DROP POLICY IF EXISTS "Allow all" ON crm_mensagens;
DROP POLICY IF EXISTS "Allow all" ON crm_automacoes;
DROP POLICY IF EXISTS "Allow all" ON crm_config_zapi;

-- Criar políticas
CREATE POLICY "Allow all" ON crm_leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON crm_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON crm_campanhas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON crm_mensagens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON crm_automacoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON crm_config_zapi FOR ALL USING (true) WITH CHECK (true);

-- Permissões
GRANT ALL ON crm_leads TO authenticated;
GRANT ALL ON crm_templates TO authenticated;
GRANT ALL ON crm_campanhas TO authenticated;
GRANT ALL ON crm_mensagens TO authenticated;
GRANT ALL ON crm_automacoes TO authenticated;
GRANT ALL ON crm_config_zapi TO authenticated;
GRANT ALL ON crm_leads TO service_role;
GRANT ALL ON crm_templates TO service_role;
GRANT ALL ON crm_campanhas TO service_role;
GRANT ALL ON crm_mensagens TO service_role;
GRANT ALL ON crm_automacoes TO service_role;
GRANT ALL ON crm_config_zapi TO service_role;

-- Função para converter pedidos em leads automaticamente
CREATE OR REPLACE FUNCTION create_lead_from_pedido()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('cart_abandoned', 'abandoned', 'waiting_payment', 'pending', 'refused', 'denied', 'failed') THEN
        INSERT INTO crm_leads (
            nome,
            email,
            telefone,
            cpf,
            origem,
            origem_detalhe,
            utm_source,
            utm_campaign,
            produto_interesse,
            valor_interesse,
            pedido_origem_id,
            tags
        ) VALUES (
            COALESCE(NEW.customer_name, 'Cliente'),
            NEW.customer_email,
            NEW.customer_phone,
            NEW.customer_cpf,
            'recovery',
            CASE 
                WHEN NEW.status IN ('cart_abandoned', 'abandoned') THEN 'Carrinho Abandonado'
                WHEN NEW.status IN ('waiting_payment', 'pending') THEN 'Pagamento Pendente'
                WHEN NEW.status IN ('refused', 'denied', 'failed') THEN 'Pagamento Recusado'
            END,
            NEW.utm_source,
            NEW.utm_campaign,
            NEW.product_name,
            NEW.paid_amount,
            NEW.id,
            ARRAY['auto_importado']
        )
        ON CONFLICT DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comentários
COMMENT ON TABLE crm_leads IS 'Base de leads do CRM para recuperação e marketing';
COMMENT ON TABLE crm_templates IS 'Templates de mensagens para campanhas';
COMMENT ON TABLE crm_campanhas IS 'Campanhas de envio em massa';
COMMENT ON TABLE crm_mensagens IS 'Histórico de mensagens enviadas/recebidas';
COMMENT ON TABLE crm_automacoes IS 'Fluxos automáticos de mensagens';
COMMENT ON TABLE crm_config_zapi IS 'Configurações da integração Z-API';
