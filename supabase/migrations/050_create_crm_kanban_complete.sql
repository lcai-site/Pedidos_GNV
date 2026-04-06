-- ================================================================
-- MIGRATION 050: CRM Kanban Completo
-- Sistema de gestão de leads com Kanban, tags e automações
-- ================================================================

-- 1. TABELA DE PIPELINES (Funis/Kanbans personalizáveis)
CREATE TABLE IF NOT EXISTS crm_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    nome TEXT NOT NULL,
    descricao TEXT,
    cor TEXT DEFAULT '#10b981', -- Cor identificadora
    
    -- Configurações
    ativo BOOLEAN DEFAULT true,
    ordem INTEGER DEFAULT 0, -- Ordem de exibição
    
    -- Campos personalizados para este pipeline
    campos_custom JSONB DEFAULT '[]', -- [{nome: 'CPF', tipo: 'text', obrigatorio: true}]
    
    -- Regras de automação específicas do pipeline
    automacoes JSONB DEFAULT '[]',
    
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT unique_pipeline_nome UNIQUE (nome, created_by)
);

-- 2. TABELA DE ETAPAS (Colunas do Kanban)
CREATE TABLE IF NOT EXISTS crm_etapas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    pipeline_id UUID NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
    
    nome TEXT NOT NULL, -- Ex: "Novo Lead", "Qualificado", "Proposta", "Fechamento"
    descricao TEXT,
    cor TEXT DEFAULT '#64748b', -- Cor da coluna
    
    -- Configurações
    ordem INTEGER NOT NULL DEFAULT 0, -- Posição da esquerda para direita
    ativo BOOLEAN DEFAULT true,
    
    -- Comportamento
    tipo TEXT DEFAULT 'manual', -- manual, automatico, finalizacao, descarte
    
    -- Regras de entrada
    regras_entrada JSONB DEFAULT '[]', -- [{condicao: 'tem_telefone', acao: 'mover'}]
    
    -- SLA (tempo máximo na etapa)
    sla_horas INTEGER, -- NULL = sem limite
    alerta_sla BOOLEAN DEFAULT true,
    
    -- Probabilidade de fechamento (para forecast)
    probabilidade DECIMAL(5,2) DEFAULT 0, -- 0 a 100%
    
    CONSTRAINT unique_etapa_ordem UNIQUE (pipeline_id, ordem)
);

-- 3. TABELA DE TAGS (Sistema avançado)
CREATE TABLE IF NOT EXISTS crm_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    nome TEXT NOT NULL,
    cor TEXT DEFAULT '#64748b', -- Tailwind color class
    icone TEXT, -- Lucide icon name
    
    -- Categorização
    categoria TEXT DEFAULT 'geral', -- geral, origem, produto, comportamento, prioridade
    
    -- Regras automáticas
    regra_auto JSONB, -- {condicao: 'comprou_produto_X', aplicar: true}
    
    ativo BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id)
);

-- 4. TABELA DE LEADS (Versão Kanban completa)
CREATE TABLE IF NOT EXISTS crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Dados básicos
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT NOT NULL,
    cpf TEXT,
    
    -- Endereço completo
    endereco JSONB DEFAULT '{}', -- {logradouro, numero, complemento, bairro, cidade, estado, cep}
    
    -- Posicionamento Kanban
    pipeline_id UUID REFERENCES crm_pipelines(id),
    etapa_id UUID REFERENCES crm_etapas(id),
    
    -- Dados do negócio
    titulo TEXT, -- Título do negócio (ex: "Venda DP - João")
    valor DECIMAL(12,2), -- Valor estimado
    valor_real DECIMAL(12,2), -- Valor real quando fechar
    
    -- Prioridade
    prioridade INTEGER DEFAULT 2, -- 1=Baixa, 2=Normal, 3=Alta, 4=Urgente
    
    -- Origem
    origem TEXT DEFAULT 'manual', -- manual, recovery, site, facebook, instagram, indicacao, parceiro
    origem_detalhe TEXT,
    utm_source TEXT,
    utm_campaign TEXT,
    utm_medium TEXT,
    
    -- Relacionamentos
    responsavel_id UUID REFERENCES auth.users(id), -- Vendedor/Responsável
    pedido_origem_id UUID REFERENCES ticto_pedidos(id),
    
    -- Histórico de compras (dados consolidados)
    historico_compras JSONB DEFAULT '{
        "primeira_compra": null,
        "ultima_compra": null,
        "total_compras": 0,
        "valor_total": 0,
        "ticket_medio": 0,
        "produtos_comprados": [],
        "e_cliente": false
    }',
    
    -- Campos customizados (dinâmicos por pipeline)
    campos_custom JSONB DEFAULT '{}',
    
    -- Anotações
    anotacoes TEXT,
    
    -- Motivo de perda (se descartado)
    motivo_perda TEXT,
    motivo_perda_detalhe TEXT,
    
    -- Datas importantes
    data_entrada_etapa TIMESTAMPTZ DEFAULT now(),
    data_ultimo_contato TIMESTAMPTZ,
    data_prevista_fechamento TIMESTAMPTZ,
    data_fechamento TIMESTAMPTZ,
    
    -- Controle
    ativo BOOLEAN DEFAULT true,
    arquivado BOOLEAN DEFAULT false,
    
    -- Campos de controle de duplicidade
    telefone_hash TEXT GENERATED ALWAYS AS (md5(lower(regexp_replace(telefone, '[^0-9]', '', 'g')))) STORED,
    email_hash TEXT GENERATED ALWAYS AS (md5(lower(email))) STORED
);

-- 5. TABELA DE RELACIONAMENTO LEADS x TAGS (N:N)
CREATE TABLE IF NOT EXISTS crm_lead_tags (
    lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES crm_tags(id) ON DELETE CASCADE,
    adicionado_em TIMESTAMPTZ DEFAULT now(),
    adicionado_por UUID REFERENCES auth.users(id),
    
    PRIMARY KEY (lead_id, tag_id)
);

-- 6. TABELA DE HISTÓRICO DE MOVIMENTAÇÃO (Timeline)
CREATE TABLE IF NOT EXISTS crm_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    
    tipo TEXT NOT NULL, -- movimentacao, anotacao, ligacao, whatsapp, email, reuniao, status_change
    
    -- Dados do evento
    titulo TEXT NOT NULL,
    descricao TEXT,
    
    -- Para movimentações entre etapas
    pipeline_id UUID REFERENCES crm_pipelines(id),
    etapa_origem_id UUID REFERENCES crm_etapas(id),
    etapa_destino_id UUID REFERENCES crm_etapas(id),
    
    -- Para comunicações
    canal TEXT, -- whatsapp, email, telefone, reuniao
    direcao TEXT, -- entrada, saida
    
    -- Metadados
    metadata JSONB DEFAULT '{}', -- {duracao, resultado, arquivo_url, etc}
    
    -- Responsável
    usuario_id UUID REFERENCES auth.users(id),
    
    -- Sistema de comentários
    parent_id UUID REFERENCES crm_historico(id), -- Para threads
    
    -- Anexos
    anexos JSONB DEFAULT '[]'
);

-- 7. TABELA DE TAREFAS/FOLLOW-UP
CREATE TABLE IF NOT EXISTS crm_tarefas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    
    titulo TEXT NOT NULL,
    descricao TEXT,
    
    tipo TEXT DEFAULT 'followup', -- followup, ligacao, email, reuniao, envio_proposta
    
    data_vencimento TIMESTAMPTZ NOT NULL,
    data_conclusao TIMESTAMPTZ,
    
    prioridade TEXT DEFAULT 'normal', -- baixa, normal, alta, urgente
    
    responsavel_id UUID REFERENCES auth.users(id),
    
    status TEXT DEFAULT 'pendente', -- pendente, em_andamento, concluida, cancelada
    
    -- Lembrete
    lembrar_minutos INTEGER DEFAULT 15, -- Antes do vencimento
    lembrete_enviado BOOLEAN DEFAULT false,
    
    -- Recorrência
    recorrente BOOLEAN DEFAULT false,
    recorrencia_regra JSONB -- {tipo: 'diaria', intervalo: 2}
);

-- 8. TABELA DE AUTOMACOES
CREATE TABLE IF NOT EXISTS crm_automacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    nome TEXT NOT NULL,
    descricao TEXT,
    ativo BOOLEAN DEFAULT true,
    
    -- Gatilho (quando executar)
    gatilho_tipo TEXT NOT NULL, -- lead_criado, etapa_alterada, status_change, tarefa_vencida, sem_contato_X_dias, compra_realizada
    gatilho_condicao JSONB, -- {pipeline_id: '...', etapa_id: '...', dias: 3}
    
    -- Condições (opcional)
    condicoes JSONB DEFAULT '[]', -- [{campo: 'valor', operador: 'maior_que', valor: 100}]
    
    -- Ações (o que fazer)
    acoes JSONB NOT NULL, -- [
                          --   {tipo: 'mover_etapa', params: {etapa_id: '...'}},
                          --   {tipo: 'enviar_whatsapp', params: {template_id: '...'}},
                          --   {tipo: 'criar_tarefa', params: {titulo: '...', data: '+2dias'}},
                          --   {tipo: 'adicionar_tag', params: {tag_id: '...'}},
                          --   {tipo: 'atribuir_responsavel', params: {user_id: '...'}},
                          --   {tipo: 'enviar_email', params: {template_id: '...'}}
                          -- ]
    
    -- Escopo
    pipeline_id UUID REFERENCES crm_pipelines(id), -- NULL = todas
    
    created_by UUID REFERENCES auth.users(id)
);

-- 9. TABELA DE PRODUTOS/SERVIÇOS (Catálogo interno)
CREATE TABLE IF NOT EXISTS crm_produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    nome TEXT NOT NULL,
    descricao TEXT,
    
    valor DECIMAL(12,2),
    custo DECIMAL(12,2),
    
    categoria TEXT,
    
    -- Estoque
    controle_estoque BOOLEAN DEFAULT false,
    quantidade_estoque INTEGER DEFAULT 0,
    
    ativo BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES auth.users(id)
);

-- 10. TABELA DE RELACIONAMENTO LEAD x PRODUTOS (Interesse)
CREATE TABLE IF NOT EXISTS crm_lead_produtos (
    lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES crm_produtos(id) ON DELETE CASCADE,
    
    quantidade INTEGER DEFAULT 1,
    valor_unitario DECIMAL(12,2),
    desconto DECIMAL(12,2) DEFAULT 0,
    valor_total DECIMAL(12,2),
    
    interesse TEXT DEFAULT 'medio', -- baixo, medio, alto
    adicionado_em TIMESTAMPTZ DEFAULT now(),
    
    PRIMARY KEY (lead_id, produto_id)
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

-- Leads
CREATE INDEX idx_crm_leads_pipeline ON crm_leads(pipeline_id);
CREATE INDEX idx_crm_leads_etapa ON crm_leads(etapa_id);
CREATE INDEX idx_crm_leads_responsavel ON crm_leads(responsavel_id);
CREATE INDEX idx_crm_leads_status ON crm_leads(ativo, arquivado);
CREATE INDEX idx_crm_leads_telefone_hash ON crm_leads(telefone_hash);
CREATE INDEX idx_crm_leads_email_hash ON crm_leads(email_hash);
CREATE INDEX idx_crm_leads_data_entrada ON crm_leads(data_entrada_etapa);
CREATE INDEX idx_crm_leads_valor ON crm_leads(valor DESC);

-- Histórico
CREATE INDEX idx_crm_historico_lead ON crm_historico(lead_id);
CREATE INDEX idx_crm_historico_data ON crm_historico(created_at DESC);
CREATE INDEX idx_crm_historico_tipo ON crm_historico(tipo);

-- Tarefas
CREATE INDEX idx_crm_tarefas_lead ON crm_tarefas(lead_id);
CREATE INDEX idx_crm_tarefas_vencimento ON crm_tarefas(data_vencimento);
CREATE INDEX idx_crm_tarefas_responsavel ON crm_tarefas(responsavel_id);
CREATE INDEX idx_crm_tarefas_status ON crm_tarefas(status);

-- ============================================
-- FUNCTIONS E TRIGGERS
-- ============================================

-- Função para atualizar histórico quando lead muda de etapa
CREATE OR REPLACE FUNCTION crm_on_etapa_change()
RETURNS TRIGGER AS $$
DECLARE
    v_pipeline_nome TEXT;
    v_etapa_origem_nome TEXT;
    v_etapa_destino_nome TEXT;
BEGIN
    -- Só registra se mudou de etapa
    IF OLD.etapa_id IS DISTINCT FROM NEW.etapa_id THEN
        -- Buscar nomes
        SELECT nome INTO v_pipeline_nome FROM crm_pipelines WHERE id = NEW.pipeline_id;
        SELECT nome INTO v_etapa_origem_nome FROM crm_etapas WHERE id = OLD.etapa_id;
        SELECT nome INTO v_etapa_destino_nome FROM crm_etapas WHERE id = NEW.etapa_id;
        
        -- Criar registro no histórico
        INSERT INTO crm_historico (
            lead_id,
            tipo,
            titulo,
            descricao,
            pipeline_id,
            etapa_origem_id,
            etapa_destino_id,
            metadata
        ) VALUES (
            NEW.id,
            'movimentacao',
            'Mudança de Etapa',
            COALESCE(v_etapa_origem_nome, 'Sem etapa') || ' → ' || COALESCE(v_etapa_destino_nome, 'Sem etapa'),
            NEW.pipeline_id,
            OLD.etapa_id,
            NEW.etapa_id,
            jsonb_build_object(
                'pipeline_nome', v_pipeline_nome,
                'etapa_origem_nome', v_etapa_origem_nome,
                'etapa_destino_nome', v_etapa_destino_nome
            )
        );
        
        -- Atualizar data de entrada na etapa
        NEW.data_entrada_etapa := now();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para mudança de etapa
DROP TRIGGER IF EXISTS trigger_crm_etapa_change ON crm_leads;
CREATE TRIGGER trigger_crm_etapa_change
    BEFORE UPDATE OF etapa_id ON crm_leads
    FOR EACH ROW
    EXECUTE FUNCTION crm_on_etapa_change();

-- Função para verificar SLA (pode ser chamada por cron job)
CREATE OR REPLACE FUNCTION crm_check_sla()
RETURNS TABLE (
    lead_id UUID,
    lead_nome TEXT,
    etapa_nome TEXT,
    horas_na_etapa INTEGER,
    sla_limite INTEGER,
    dias_atraso INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.nome,
        e.nome,
        EXTRACT(EPOCH FROM (now() - l.data_entrada_etapa))/3600::INTEGER,
        e.sla_horas,
        EXTRACT(DAY FROM (now() - l.data_entrada_etapa - (e.sla_horas || ' hours')::INTERVAL))::INTEGER
    FROM crm_leads l
    JOIN crm_etapas e ON l.etapa_id = e.id
    WHERE l.ativo = true
      AND e.sla_horas IS NOT NULL
      AND l.data_entrada_etapa < now() - (e.sla_horas || ' hours')::INTERVAL
      AND e.alerta_sla = true;
END;
$$ LANGUAGE plpgsql;

-- Função para consolidar histórico de compras do cliente
CREATE OR REPLACE FUNCTION crm_update_historico_compras(p_lead_id UUID)
RETURNS VOID AS $$
DECLARE
    v_telefone TEXT;
    v_email TEXT;
    v_historico JSONB;
BEGIN
    -- Buscar dados do lead
    SELECT telefone, email INTO v_telefone, v_email
    FROM crm_leads WHERE id = p_lead_id;
    
    -- Buscar compras na tabela ticto_pedidos
    SELECT jsonb_build_object(
        'primeira_compra', MIN(order_date),
        'ultima_compra', MAX(order_date),
        'total_compras', COUNT(*),
        'valor_total', COALESCE(SUM(paid_amount), 0),
        'ticket_medio', COALESCE(AVG(paid_amount), 0),
        'produtos_comprados', jsonb_agg(DISTINCT product_name),
        'e_cliente', COUNT(*) > 0
    )
    INTO v_historico
    FROM ticto_pedidos
    WHERE status IN ('authorized', 'approved', 'paid', 'completed')
      AND (customer_phone = v_telefone OR customer_email = v_email);
    
    -- Atualizar lead
    UPDATE crm_leads 
    SET historico_compras = v_historico
    WHERE id = p_lead_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DADOS INICIAIS (SEED)
-- ============================================

-- Pipeline padrão de Vendas
INSERT INTO crm_pipelines (nome, descricao, cor, ordem) VALUES
('Vendas', 'Funil padrão de vendas', '#10b981', 1),
('Pós-Venda', 'Acompanhamento de clientes', '#3b82f6', 2),
('Recuperação', 'Recuperação de carrinhos', '#f59e0b', 3)
ON CONFLICT DO NOTHING;

-- Etapas do pipeline de Vendas
DO $$
DECLARE
    v_pipeline_id UUID;
BEGIN
    SELECT id INTO v_pipeline_id FROM crm_pipelines WHERE nome = 'Vendas' LIMIT 1;
    
    IF v_pipeline_id IS NOT NULL THEN
        INSERT INTO crm_etapas (pipeline_id, nome, descricao, cor, ordem, tipo, probabilidade, sla_horas) VALUES
        (v_pipeline_id, 'Novo Lead', 'Leads recém chegados', '#3b82f6', 1, 'manual', 10, 24),
        (v_pipeline_id, 'Qualificado', 'Lead qualificado e com interesse', '#8b5cf6', 2, 'manual', 30, 48),
        (v_pipeline_id, 'Proposta Enviada', 'Aguardando resposta do cliente', '#f59e0b', 3, 'manual', 60, 72),
        (v_pipeline_id, 'Negociação', 'Em negociação de valores/condições', '#ec4899', 4, 'manual', 80, NULL),
        (v_pipeline_id, 'Fechamento', 'Negócio fechado com sucesso', '#10b981', 5, 'finalizacao', 100, NULL),
        (v_pipeline_id, 'Perdido', 'Negócio não concretizado', '#64748b', 6, 'descarte', 0, NULL)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Tags padrão
INSERT INTO crm_tags (nome, cor, categoria, icone) VALUES
('Cliente VIP', '#fbbf24', 'prioridade', 'crown'),
('Primeira Compra', '#10b981', 'comportamento', 'user-plus'),
('Cliente Recorrente', '#3b82f6', 'comportamento', 'repeat'),
('Indicação', '#8b5cf6', 'origem', 'users'),
('Urgente', '#ef4444', 'prioridade', 'alert-triangle'),
('Aguardando Pagamento', '#f59e0b', 'status', 'clock'),
('Não Atende', '#64748b', 'comportamento', 'phone-off'),
('Compra Cancelada', '#dc2626', 'comportamento', 'x-circle'),
('Desejo Proibido', '#ec4899', 'produto', 'heart'),
('Bela Forma', '#06b6d4', 'produto', 'sparkles'),
('Bela Lumi', '#a855f7', 'produto', 'sun')
ON CONFLICT DO NOTHING;

-- Produtos padrão (exemplos)
INSERT INTO crm_produtos (nome, descricao, valor, categoria) VALUES
('Desejo Proibido - Compre 2 Leve 3', 'Kit DP 3 unidades', 297.00, 'DP'),
('Bela Forma - Kit Completo', 'Kit BF completo', 197.00, 'BF'),
('Bela Lumi - Cápsulas', 'BL Cápsulas 30 dias', 149.00, 'BL'),
('DP + BF Combo', 'Combo Desejo Proibido + Bela Forma', 397.00, 'Combo')
ON CONFLICT DO NOTHING;

-- Automações de exemplo
DO $$
DECLARE
    v_pipeline_id UUID;
    v_etapa_novo UUID;
    v_etapa_qualificado UUID;
BEGIN
    SELECT id INTO v_pipeline_id FROM crm_pipelines WHERE nome = 'Vendas' LIMIT 1;
    SELECT id INTO v_etapa_novo FROM crm_etapas WHERE nome = 'Novo Lead' LIMIT 1;
    SELECT id INTO v_etapa_qualificado FROM crm_etapas WHERE nome = 'Qualificado' LIMIT 1;
    
    IF v_pipeline_id IS NOT NULL THEN
        INSERT INTO crm_automacoes (nome, descricao, gatilho_tipo, gatilho_condicao, acoes, pipeline_id) VALUES
        (
            'Mover para Qualificado após contato',
            'Quando houver histórico de WhatsApp/Ligação, move para Qualificado',
            'sem_contato_X_dias',
            jsonb_build_object('dias', 0, 'etapa_destino', v_etapa_qualificado),
            '[{"tipo": "mover_etapa", "params": {"etapa_id": "' || v_etapa_qualificado || '"}}]',
            v_pipeline_id
        );
    END IF;
END $$;

-- ============================================
-- PERMISSÕES
-- ============================================

ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_lead_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_automacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_lead_produtos ENABLE ROW LEVEL SECURITY;

-- Políticas (ajustar conforme necessidade de segurança)
CREATE POLICY "Allow all crm" ON crm_pipelines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all crm" ON crm_etapas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all crm" ON crm_tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all crm" ON crm_leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all crm" ON crm_lead_tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all crm" ON crm_historico FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all crm" ON crm_tarefas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all crm" ON crm_automacoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all crm" ON crm_produtos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all crm" ON crm_lead_produtos FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON crm_pipelines TO authenticated;
GRANT ALL ON crm_etapas TO authenticated;
GRANT ALL ON crm_tags TO authenticated;
GRANT ALL ON crm_leads TO authenticated;
GRANT ALL ON crm_lead_tags TO authenticated;
GRANT ALL ON crm_historico TO authenticated;
GRANT ALL ON crm_tarefas TO authenticated;
GRANT ALL ON crm_automacoes TO authenticated;
GRANT ALL ON crm_produtos TO authenticated;
GRANT ALL ON crm_lead_produtos TO authenticated;
GRANT ALL ON crm_pipelines TO service_role;
GRANT ALL ON crm_etapas TO service_role;
GRANT ALL ON crm_tags TO service_role;
GRANT ALL ON crm_leads TO service_role;
GRANT ALL ON crm_lead_tags TO service_role;
GRANT ALL ON crm_historico TO service_role;
GRANT ALL ON crm_tarefas TO service_role;
GRANT ALL ON crm_automacoes TO service_role;
GRANT ALL ON crm_produtos TO service_role;
GRANT ALL ON crm_lead_produtos TO service_role;

-- Comentários
COMMENT ON TABLE crm_pipelines IS 'Pipelines/Kanbans personalizáveis para gestão de leads';
COMMENT ON TABLE crm_etapas IS 'Colunas/Etapas de cada pipeline';
COMMENT ON TABLE crm_leads IS 'Base de leads com posicionamento Kanban';
COMMENT ON TABLE crm_historico IS 'Timeline de todas as ações dos leads';
COMMENT ON TABLE crm_tarefas IS 'Tarefas e follow-ups do time comercial';
COMMENT ON TABLE crm_automacoes IS 'Regras automáticas de workflow';
