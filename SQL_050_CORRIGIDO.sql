-- ================================================================
-- MIGRATION 050: CRM Kanban Completo (CORRIGIDO)
-- ================================================================

-- 1. TABELA DE PIPELINES
CREATE TABLE IF NOT EXISTS crm_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    nome TEXT NOT NULL,
    descricao TEXT,
    cor TEXT DEFAULT '#10b981',
    
    ativo BOOLEAN DEFAULT true,
    ordem INTEGER DEFAULT 0,
    
    campos_custom JSONB DEFAULT '[]',
    automacoes JSONB DEFAULT '[]',
    
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT unique_pipeline_nome UNIQUE (nome, created_by)
);

-- 2. TABELA DE ETAPAS
CREATE TABLE IF NOT EXISTS crm_etapas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    pipeline_id UUID NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
    
    nome TEXT NOT NULL,
    descricao TEXT,
    cor TEXT DEFAULT '#64748b',
    
    ordem INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    
    tipo TEXT DEFAULT 'manual',
    
    regras_entrada JSONB DEFAULT '[]',
    
    sla_horas INTEGER,
    alerta_sla BOOLEAN DEFAULT true,
    
    probabilidade DECIMAL(5,2) DEFAULT 0,
    
    CONSTRAINT unique_etapa_ordem UNIQUE (pipeline_id, ordem)
);

-- 3. TABELA DE TAGS
CREATE TABLE IF NOT EXISTS crm_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    nome TEXT NOT NULL,
    cor TEXT DEFAULT '#64748b',
    icone TEXT,
    
    categoria TEXT DEFAULT 'geral',
    
    regra_auto JSONB,
    
    ativo BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id)
);

-- 4. TABELA DE LEADS (Kanban completo) - ADICIONAR COLUNAS SE NÃO EXISTIREM
DO $$
BEGIN
    -- Adicionar colunas do Kanban se não existirem
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='pipeline_id') THEN
        ALTER TABLE crm_leads ADD COLUMN pipeline_id UUID REFERENCES crm_pipelines(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='etapa_id') THEN
        ALTER TABLE crm_leads ADD COLUMN etapa_id UUID REFERENCES crm_etapas(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='titulo') THEN
        ALTER TABLE crm_leads ADD COLUMN titulo TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='valor') THEN
        ALTER TABLE crm_leads ADD COLUMN valor DECIMAL(12,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='valor_real') THEN
        ALTER TABLE crm_leads ADD COLUMN valor_real DECIMAL(12,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='prioridade') THEN
        ALTER TABLE crm_leads ADD COLUMN prioridade INTEGER DEFAULT 2;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='origem') THEN
        ALTER TABLE crm_leads ADD COLUMN origem TEXT DEFAULT 'manual';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='origem_detalhe') THEN
        ALTER TABLE crm_leads ADD COLUMN origem_detalhe TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='utm_medium') THEN
        ALTER TABLE crm_leads ADD COLUMN utm_medium TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='responsavel_id') THEN
        ALTER TABLE crm_leads ADD COLUMN responsavel_id UUID REFERENCES auth.users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='historico_compras') THEN
        ALTER TABLE crm_leads ADD COLUMN historico_compras JSONB DEFAULT '{
            "primeira_compra": null,
            "ultima_compra": null,
            "total_compras": 0,
            "valor_total": 0,
            "ticket_medio": 0,
            "produtos_comprados": [],
            "e_cliente": false
        }';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='campos_custom') THEN
        ALTER TABLE crm_leads ADD COLUMN campos_custom JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='anotacoes') THEN
        ALTER TABLE crm_leads ADD COLUMN anotacoes TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='motivo_perda') THEN
        ALTER TABLE crm_leads ADD COLUMN motivo_perda TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='motivo_perda_detalhe') THEN
        ALTER TABLE crm_leads ADD COLUMN motivo_perda_detalhe TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='data_entrada_etapa') THEN
        ALTER TABLE crm_leads ADD COLUMN data_entrada_etapa TIMESTAMPTZ DEFAULT now();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='data_ultimo_contato') THEN
        ALTER TABLE crm_leads ADD COLUMN data_ultimo_contato TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='data_prevista_fechamento') THEN
        ALTER TABLE crm_leads ADD COLUMN data_prevista_fechamento TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='data_fechamento') THEN
        ALTER TABLE crm_leads ADD COLUMN data_fechamento TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='arquivado') THEN
        ALTER TABLE crm_leads ADD COLUMN arquivado BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='telefone_hash') THEN
        ALTER TABLE crm_leads ADD COLUMN telefone_hash TEXT GENERATED ALWAYS AS (md5(lower(regexp_replace(telefone, '[^0-9]', '', 'g')))) STORED;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='email_hash') THEN
        ALTER TABLE crm_leads ADD COLUMN email_hash TEXT GENERATED ALWAYS AS (md5(lower(email))) STORED;
    END IF;
    
    -- Alterar tipo de endereco para JSONB se for TEXT
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='endereco' AND data_type='text') THEN
        ALTER TABLE crm_leads ALTER COLUMN endereco TYPE JSONB USING '{}'::jsonb;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='endereco') THEN
        ALTER TABLE crm_leads ADD COLUMN endereco JSONB DEFAULT '{}';
    END IF;
END $$;

-- 5. TABELA DE RELACIONAMENTO LEADS x TAGS
CREATE TABLE IF NOT EXISTS crm_lead_tags (
    lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES crm_tags(id) ON DELETE CASCADE,
    adicionado_em TIMESTAMPTZ DEFAULT now(),
    adicionado_por UUID REFERENCES auth.users(id),
    
    PRIMARY KEY (lead_id, tag_id)
);

-- 6. TABELA DE HISTÓRICO DE MOVIMENTAÇÃO
CREATE TABLE IF NOT EXISTS crm_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    
    tipo TEXT NOT NULL,
    
    titulo TEXT NOT NULL,
    descricao TEXT,
    
    pipeline_id UUID REFERENCES crm_pipelines(id),
    etapa_origem_id UUID REFERENCES crm_etapas(id),
    etapa_destino_id UUID REFERENCES crm_etapas(id),
    
    canal TEXT,
    direcao TEXT,
    
    metadata JSONB DEFAULT '{}',
    
    usuario_id UUID REFERENCES auth.users(id),
    
    parent_id UUID REFERENCES crm_historico(id),
    
    anexos JSONB DEFAULT '[]'
);

-- 7. TABELA DE TAREFAS/FOLLOW-UP
CREATE TABLE IF NOT EXISTS crm_tarefas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    
    titulo TEXT NOT NULL,
    descricao TEXT,
    
    tipo TEXT DEFAULT 'followup',
    
    data_vencimento TIMESTAMPTZ NOT NULL,
    data_conclusao TIMESTAMPTZ,
    
    prioridade TEXT DEFAULT 'normal',
    
    responsavel_id UUID REFERENCES auth.users(id),
    
    status TEXT DEFAULT 'pendente',
    
    lembrar_minutos INTEGER DEFAULT 15,
    lembrete_enviado BOOLEAN DEFAULT false,
    
    recorrente BOOLEAN DEFAULT false,
    recorrencia_regra JSONB
);

-- 8. TABELA DE AUTOMACOES (atualizar se já existir do SQL 049)
DO $$
BEGIN
    -- Verificar se a tabela já existe do SQL 049
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_automacoes') THEN
        -- Adicionar colunas que podem estar faltando
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_automacoes' AND column_name='condicoes') THEN
            ALTER TABLE crm_automacoes ADD COLUMN condicoes JSONB DEFAULT '[]';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_automacoes' AND column_name='pipeline_id') THEN
            ALTER TABLE crm_automacoes ADD COLUMN pipeline_id UUID REFERENCES crm_pipelines(id);
        END IF;
    END IF;
END $$;

-- 9. TABELA DE PRODUTOS/SERVIÇOS
CREATE TABLE IF NOT EXISTS crm_produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    nome TEXT NOT NULL,
    descricao TEXT,
    
    valor DECIMAL(12,2),
    custo DECIMAL(12,2),
    
    categoria TEXT,
    
    controle_estoque BOOLEAN DEFAULT false,
    quantidade_estoque INTEGER DEFAULT 0,
    
    ativo BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES auth.users(id)
);

-- 10. TABELA DE RELACIONAMENTO LEAD x PRODUTOS
CREATE TABLE IF NOT EXISTS crm_lead_produtos (
    lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES crm_produtos(id) ON DELETE CASCADE,
    
    quantidade INTEGER DEFAULT 1,
    valor_unitario DECIMAL(12,2),
    desconto DECIMAL(12,2) DEFAULT 0,
    valor_total DECIMAL(12,2),
    
    interesse TEXT DEFAULT 'medio',
    adicionado_em TIMESTAMPTZ DEFAULT now(),
    
    PRIMARY KEY (lead_id, produto_id)
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_crm_leads_pipeline ON crm_leads(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_etapa ON crm_leads(etapa_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_responsavel ON crm_leads(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(ativo, arquivado);
CREATE INDEX IF NOT EXISTS idx_crm_leads_telefone_hash ON crm_leads(telefone_hash);
CREATE INDEX IF NOT EXISTS idx_crm_leads_email_hash ON crm_leads(email_hash);
CREATE INDEX IF NOT EXISTS idx_crm_leads_data_entrada ON crm_leads(data_entrada_etapa);
CREATE INDEX IF NOT EXISTS idx_crm_leads_valor ON crm_leads(valor DESC);

CREATE INDEX IF NOT EXISTS idx_crm_historico_lead ON crm_historico(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_historico_data ON crm_historico(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_historico_tipo ON crm_historico(tipo);

CREATE INDEX IF NOT EXISTS idx_crm_tarefas_lead ON crm_tarefas(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_tarefas_vencimento ON crm_tarefas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_crm_tarefas_responsavel ON crm_tarefas(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_crm_tarefas_status ON crm_tarefas(status);

-- ============================================
-- FUNCTIONS E TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION crm_on_etapa_change()
RETURNS TRIGGER AS $$
DECLARE
    v_pipeline_nome TEXT;
    v_etapa_origem_nome TEXT;
    v_etapa_destino_nome TEXT;
BEGIN
    IF OLD.etapa_id IS DISTINCT FROM NEW.etapa_id THEN
        SELECT nome INTO v_pipeline_nome FROM crm_pipelines WHERE id = NEW.pipeline_id;
        SELECT nome INTO v_etapa_origem_nome FROM crm_etapas WHERE id = OLD.etapa_id;
        SELECT nome INTO v_etapa_destino_nome FROM crm_etapas WHERE id = NEW.etapa_id;
        
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
        
        NEW.data_entrada_etapa := now();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_crm_etapa_change ON crm_leads;
CREATE TRIGGER trigger_crm_etapa_change
    BEFORE UPDATE OF etapa_id ON crm_leads
    FOR EACH ROW
    EXECUTE FUNCTION crm_on_etapa_change();

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

CREATE OR REPLACE FUNCTION crm_update_historico_compras(p_lead_id UUID)
RETURNS VOID AS $$
DECLARE
    v_telefone TEXT;
    v_email TEXT;
    v_historico JSONB;
BEGIN
    SELECT telefone, email INTO v_telefone, v_email
    FROM crm_leads WHERE id = p_lead_id;
    
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
    
    UPDATE crm_leads 
    SET historico_compras = v_historico
    WHERE id = p_lead_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DADOS INICIAIS (SEED)
-- ============================================
INSERT INTO crm_pipelines (nome, descricao, cor, ordem) VALUES
('Vendas', 'Funil padrão de vendas', '#10b981', 1),
('Pós-Venda', 'Acompanhamento de clientes', '#3b82f6', 2),
('Recuperação', 'Recuperação de carrinhos', '#f59e0b', 3)
ON CONFLICT DO NOTHING;

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

INSERT INTO crm_produtos (nome, descricao, valor, categoria) VALUES
('Desejo Proibido - Compre 2 Leve 3', 'Kit DP 3 unidades', 297.00, 'DP'),
('Bela Forma - Kit Completo', 'Kit BF completo', 197.00, 'BF'),
('Bela Lumi - Cápsulas', 'BL Cápsulas 30 dias', 149.00, 'BL'),
('DP + BF Combo', 'Combo Desejo Proibido + Bela Forma', 397.00, 'Combo')
ON CONFLICT DO NOTHING;

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

DROP POLICY IF EXISTS "Allow all crm" ON crm_pipelines;
DROP POLICY IF EXISTS "Allow all crm" ON crm_etapas;
DROP POLICY IF EXISTS "Allow all crm" ON crm_tags;
DROP POLICY IF EXISTS "Allow all crm" ON crm_leads;
DROP POLICY IF EXISTS "Allow all crm" ON crm_lead_tags;
DROP POLICY IF EXISTS "Allow all crm" ON crm_historico;
DROP POLICY IF EXISTS "Allow all crm" ON crm_tarefas;
DROP POLICY IF EXISTS "Allow all crm" ON crm_automacoes;
DROP POLICY IF EXISTS "Allow all crm" ON crm_produtos;
DROP POLICY IF EXISTS "Allow all crm" ON crm_lead_produtos;

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
