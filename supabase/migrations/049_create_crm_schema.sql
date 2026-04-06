-- ================================================================
-- MIGRATION 049: Schema completo do CRM com Z-API
-- ================================================================

-- 1. Tabela de Leads (CRM)
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
    origem TEXT DEFAULT 'recovery', -- recovery, site, indicacao, campanha, manual
    origem_detalhe TEXT, -- Ex: "Carrinho Abandonado - DP", "Campanha Black Friday"
    utm_source TEXT,
    utm_campaign TEXT,
    
    -- Status do Lead
    status TEXT DEFAULT 'novo', -- novo, contatado, interessado, conversao, descartado
    temperatura TEXT DEFAULT 'morna', -- fria, morna, quente
    
    -- Dados de compra
    produto_interesse TEXT,
    valor_interesse DECIMAL(10,2),
    ultimo_contato TIMESTAMPTZ,
    data_conversao TIMESTAMPTZ,
    
    -- Observações
    observacoes TEXT,
    tags TEXT[], -- Array de tags
    
    -- Relacionamentos
    pedido_origem_id UUID REFERENCES ticto_pedidos(id),
    responsavel_id UUID REFERENCES auth.users(id),
    
    -- Controle
    enviar_cupom BOOLEAN DEFAULT false,
    cupom_enviado BOOLEAN DEFAULT false,
    descartado BOOLEAN DEFAULT false,
    motivo_descarte TEXT
);

-- 2. Tabela de Templates de Mensagem
CREATE TABLE IF NOT EXISTS crm_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    nome TEXT NOT NULL,
    descricao TEXT,
    categoria TEXT DEFAULT 'geral', -- geral, recuperacao, pos_venda, campanha
    
    -- Conteúdo
    assunto TEXT,
    corpo TEXT NOT NULL,
    variaveis TEXT[], -- [nome, produto, valor, etc]
    
    -- Configurações
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
    
    -- Segmentação
    filtro_status TEXT[], -- ['novo', 'morna']
    filtro_origem TEXT[], -- ['recovery', 'site']
    filtro_temperatura TEXT[], -- ['quente', 'morna']
    filtro_tags TEXT[],
    
    -- Mensagem
    template_id UUID REFERENCES crm_templates(id),
    mensagem_personalizada TEXT,
    
    -- Agendamento
    status_campanha TEXT DEFAULT 'rascunho', -- rascunho, agendada, executando, pausada, finalizada
    data_agendamento TIMESTAMPTZ,
    data_inicio TIMESTAMPTZ,
    data_fim TIMESTAMPTZ,
    
    -- Estatísticas
    total_leads INTEGER DEFAULT 0,
    enviados INTEGER DEFAULT 0,
    entregues INTEGER DEFAULT 0,
    lidos INTEGER DEFAULT 0,
    respostas INTEGER DEFAULT 0,
    conversoes INTEGER DEFAULT 0,
    
    -- Configurações de envio
    intervalo_segundos INTEGER DEFAULT 10, -- Intervalo entre mensagens
    horario_inicio TIME DEFAULT '08:00', -- Início do envio
    horario_fim TIME DEFAULT '20:00', -- Fim do envio
    apenas_dias_uteis BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES auth.users(id)
);

-- 4. Tabela de Histórico de Mensagens
CREATE TABLE IF NOT EXISTS crm_mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Relacionamentos
    lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
    campanha_id UUID REFERENCES crm_campanhas(id),
    template_id UUID REFERENCES crm_templates(id),
    
    -- Conteúdo
    tipo TEXT DEFAULT 'whatsapp', -- whatsapp, email, sms
    direcao TEXT DEFAULT 'saida', -- saida, entrada
    mensagem TEXT NOT NULL,
    mensagem_enviada TEXT, -- Mensagem após substituir variáveis
    
    -- Status (Z-API)
    status TEXT DEFAULT 'pendente', -- pendente, enviada, entregue, lida, falha
    message_id TEXT, -- ID retornado pelo Z-API
    error_message TEXT,
    
    -- Metadados
    midia_url TEXT,
    midia_tipo TEXT,
    
    -- Timestamps
    enviado_at TIMESTAMPTZ,
    entregue_at TIMESTAMPTZ,
    lida_at TIMESTAMPTZ,
    
    -- Resposta
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
    
    -- Gatilho
    gatilho_tipo TEXT NOT NULL, -- lead_novo, status_change, inatividade, aniversario
    gatilho_condicao JSONB,
    
    -- Ações (array de ações a executar)
    acoes JSONB[], -- [{tipo: 'mensagem', template_id: '...', delay: 3600}, ...]
    
    -- Estatísticas
    disparos INTEGER DEFAULT 0,
    
    created_by UUID REFERENCES auth.users(id)
);

-- 6. Tabela de Configurações Z-API
CREATE TABLE IF NOT EXISTS crm_config_zapi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Credenciais (criptografar em produção!)
    instance_id TEXT,
    instance_token TEXT,
    api_token TEXT,
    
    -- Status
    conectado BOOLEAN DEFAULT false,
    qr_code TEXT,
    telefone_conectado TEXT,
    
    -- Configurações
    webhook_url TEXT,
    
    -- Limites
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

-- Inserir templates padrão
INSERT INTO crm_templates (nome, descricao, categoria, corpo, variaveis, is_default) VALUES
(
    'Recuperação de Carrinho',
    'Mensagem padrão para recuperação de carrinhos abandonados',
    'recuperacao',
    'Olá {nome}! Tudo bem?\n\nNotamos que você iniciou uma compra de {produto}{valor} mas não conseguiu finalizar.\n\nPosso ajudar com alguma informação ou tirar alguma dúvida? Estamos aqui para garantir que você tenha a melhor experiência!\n\nAguardo seu retorno.',
    ARRAY['nome', 'produto', 'valor'],
    true
),
(
    'Cupom de Desconto',
    'Oferecer cupom para conversão',
    'campanha',
    'Oi {nome}! Tudo bem por aí?\n\nVimos que você tem interesse em {produto}. Que tal um cupom exclusivo de 10% de desconto para finalizar sua compra?\n\nUse o código: CUPOM10\n\nVálido por 24 horas. Aproveite!',
    ARRAY['nome', 'produto'],
    false
),
(
    'Pós-Venda',
    'Acompanhar satisfação após compra',
    'pos_venda',
    'Oi {nome}! Espero que esteja tudo bem!\n\nPassando para saber se você já recebeu seu {produto} e se está tudo certo com o pedido.\n\nQualquer coisa, estamos por aqui!',
    ARRAY['nome', 'produto'],
    false
);

-- RLS Policies
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_automacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_config_zapi ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (ajustar conforme necessidade)
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
    -- Criar lead apenas para status de recuperação
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
        ON CONFLICT DO NOTHING; -- Evitar duplicatas
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger (descomentar se quiser importação automática)
-- CREATE TRIGGER trigger_create_lead_from_pedido
-- AFTER INSERT ON ticto_pedidos
-- FOR EACH ROW
-- EXECUTE FUNCTION create_lead_from_pedido();

-- Comentários
COMMENT ON TABLE crm_leads IS 'Base de leads do CRM para recuperação e marketing';
COMMENT ON TABLE crm_templates IS 'Templates de mensagens para campanhas';
COMMENT ON TABLE crm_campanhas IS 'Campanhas de envio em massa';
COMMENT ON TABLE crm_mensagens IS 'Histórico de mensagens enviadas/recebidas';
COMMENT ON TABLE crm_automacoes IS 'Fluxos automáticos de mensagens';
COMMENT ON TABLE crm_config_zapi IS 'Configurações da integração Z-API';
