-- ================================================================
-- CRM RESET COMPLETO - LIMPA E RECRIA TUDO
-- Execute este SQL apenas uma vez para resetar o CRM completo
-- ================================================================

-- DESATIVAR RLS TEMPORARIAMENTE
ALTER TABLE IF EXISTS crm_pipelines DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crm_etapas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crm_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crm_leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crm_lead_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crm_historico DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crm_tarefas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crm_produtos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crm_lead_produtos DISABLE ROW LEVEL SECURITY;

-- LIMPAR TODAS AS TABELAS (CUIDADO: APAGA TODOS OS DADOS)
TRUNCATE TABLE crm_lead_produtos CASCADE;
TRUNCATE TABLE crm_tarefas CASCADE;
TRUNCATE TABLE crm_historico CASCADE;
TRUNCATE TABLE crm_lead_tags CASCADE;
TRUNCATE TABLE crm_leads CASCADE;
TRUNCATE TABLE crm_etapas CASCADE;
TRUNCATE TABLE crm_produtos CASCADE;
TRUNCATE TABLE crm_tags CASCADE;
TRUNCATE TABLE crm_pipelines CASCADE;

-- REMOVER TABELAS ANTIGAS SE EXISTIREM (PARA RECRIAR DO ZERO)
DROP TABLE IF EXISTS crm_lead_produtos CASCADE;
DROP TABLE IF EXISTS crm_tarefas CASCADE;
DROP TABLE IF EXISTS crm_historico CASCADE;
DROP TABLE IF EXISTS crm_lead_tags CASCADE;
DROP TABLE IF EXISTS crm_leads CASCADE;
DROP TABLE IF EXISTS crm_etapas CASCADE;
DROP TABLE IF EXISTS crm_produtos CASCADE;
DROP TABLE IF EXISTS crm_tags CASCADE;
DROP TABLE IF EXISTS crm_pipelines CASCADE;

-- REMOVER FUNÇÕES
DROP FUNCTION IF EXISTS crm_on_etapa_change CASCADE;
DROP FUNCTION IF EXISTS crm_check_sla CASCADE;
DROP FUNCTION IF EXISTS crm_update_historico_compras CASCADE;

-- ================================================================
-- 1. TABELA DE PIPELINES
-- ================================================================
CREATE TABLE crm_pipelines (
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
    created_by UUID REFERENCES auth.users(id)
);

-- ================================================================
-- 2. TABELA DE ETAPAS
-- ================================================================
CREATE TABLE crm_etapas (
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
    probabilidade DECIMAL(5,2) DEFAULT 0
);

-- ================================================================
-- 3. TABELA DE TAGS
-- ================================================================
CREATE TABLE crm_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    nome TEXT NOT NULL UNIQUE,
    cor TEXT DEFAULT '#64748b',
    icone TEXT,
    categoria TEXT DEFAULT 'geral',
    regra_auto JSONB,
    ativo BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id)
);

-- ================================================================
-- 4. TABELA DE LEADS
-- ================================================================
CREATE TABLE crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT NOT NULL,
    cpf TEXT,
    endereco JSONB DEFAULT '{}',
    pipeline_id UUID REFERENCES crm_pipelines(id),
    etapa_id UUID REFERENCES crm_etapas(id),
    titulo TEXT,
    valor DECIMAL(12,2),
    valor_real DECIMAL(12,2),
    prioridade INTEGER DEFAULT 2,
    origem TEXT DEFAULT 'manual',
    origem_detalhe TEXT,
    utm_source TEXT,
    utm_campaign TEXT,
    utm_medium TEXT,
    responsavel_id UUID REFERENCES auth.users(id),
    pedido_origem_id UUID REFERENCES ticto_pedidos(id),
    historico_compras JSONB DEFAULT '{"primeira_compra": null, "ultima_compra": null, "total_compras": 0, "valor_total": 0, "ticket_medio": 0, "produtos_comprados": [], "e_cliente": false}'::jsonb,
    campos_custom JSONB DEFAULT '{}',
    anotacoes TEXT,
    motivo_perda TEXT,
    motivo_perda_detalhe TEXT,
    data_entrada_etapa TIMESTAMPTZ DEFAULT now(),
    data_ultimo_contato TIMESTAMPTZ,
    data_prevista_fechamento TIMESTAMPTZ,
    data_fechamento TIMESTAMPTZ,
    ativo BOOLEAN DEFAULT true,
    arquivado BOOLEAN DEFAULT false,
    telefone_hash TEXT GENERATED ALWAYS AS (md5(lower(regexp_replace(telefone, '[^0-9]', '', 'g')))) STORED,
    email_hash TEXT GENERATED ALWAYS AS (md5(lower(email))) STORED
);

-- ================================================================
-- 5. TABELA DE RELACIONAMENTO LEADS x TAGS
-- ================================================================
CREATE TABLE crm_lead_tags (
    lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES crm_tags(id) ON DELETE CASCADE,
    adicionado_em TIMESTAMPTZ DEFAULT now(),
    adicionado_por UUID REFERENCES auth.users(id),
    PRIMARY KEY (lead_id, tag_id)
);

-- ================================================================
-- 6. TABELA DE HISTÓRICO
-- ================================================================
CREATE TABLE crm_historico (
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

-- ================================================================
-- 7. TABELA DE TAREFAS
-- ================================================================
CREATE TABLE crm_tarefas (
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

-- ================================================================
-- ÍNDICES
-- ================================================================
CREATE INDEX idx_crm_leads_pipeline ON crm_leads(pipeline_id);
CREATE INDEX idx_crm_leads_etapa ON crm_leads(etapa_id);
CREATE INDEX idx_crm_leads_responsavel ON crm_leads(responsavel_id);
CREATE INDEX idx_crm_leads_ativo ON crm_leads(ativo, arquivado);
CREATE INDEX idx_crm_leads_telefone_hash ON crm_leads(telefone_hash);
CREATE INDEX idx_crm_historico_lead ON crm_historico(lead_id);
CREATE INDEX idx_crm_tarefas_lead ON crm_tarefas(lead_id);
CREATE INDEX idx_crm_tarefas_vencimento ON crm_tarefas(data_vencimento);

-- ================================================================
-- FUNCTIONS E TRIGGERS
-- ================================================================
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
        
        INSERT INTO crm_historico (lead_id, tipo, titulo, descricao, pipeline_id, etapa_origem_id, etapa_destino_id, metadata)
        VALUES (NEW.id, 'movimentacao', 'Mudança de Etapa',
            COALESCE(v_etapa_origem_nome, 'Sem etapa') || ' → ' || COALESCE(v_etapa_destino_nome, 'Sem etapa'),
            NEW.pipeline_id, OLD.etapa_id, NEW.etapa_id,
            jsonb_build_object('pipeline_nome', v_pipeline_nome, 'etapa_origem_nome', v_etapa_origem_nome, 'etapa_destino_nome', v_etapa_destino_nome));
        
        NEW.data_entrada_etapa := now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_crm_etapa_change
    BEFORE UPDATE OF etapa_id ON crm_leads
    FOR EACH ROW
    EXECUTE FUNCTION crm_on_etapa_change();

-- ================================================================
-- DADOS INICIAIS - APENAS SE ESTIVEREM VAZIOS
-- ================================================================

-- Verificar se já existe dados antes de inserir
DO $$
DECLARE
    v_count INTEGER;
    v_pipeline_vendas UUID;
    v_pipeline_pos UUID;
    v_pipeline_rec UUID;
BEGIN
    -- Verificar pipelines
    SELECT COUNT(*) INTO v_count FROM crm_pipelines;
    
    IF v_count = 0 THEN
        -- Inserir pipelines
        INSERT INTO crm_pipelines (nome, descricao, cor, ordem) VALUES
        ('Vendas', 'Funil padrão de vendas', '#10b981', 1)
        RETURNING id INTO v_pipeline_vendas;
        
        INSERT INTO crm_pipelines (nome, descricao, cor, ordem) VALUES
        ('Pós-Venda', 'Acompanhamento de clientes', '#3b82f6', 2)
        RETURNING id INTO v_pipeline_pos;
        
        INSERT INTO crm_pipelines (nome, descricao, cor, ordem) VALUES
        ('Recuperação', 'Recuperação de carrinhos', '#f59e0b', 3)
        RETURNING id INTO v_pipeline_rec;
        
        -- Inserir etapas do pipeline Vendas
        INSERT INTO crm_etapas (pipeline_id, nome, descricao, cor, ordem, tipo, probabilidade, sla_horas) VALUES
        (v_pipeline_vendas, 'Novo Lead', 'Leads recém chegados', '#3b82f6', 1, 'manual', 10, 24),
        (v_pipeline_vendas, 'Qualificado', 'Lead qualificado e com interesse', '#8b5cf6', 2, 'manual', 30, 48),
        (v_pipeline_vendas, 'Proposta Enviada', 'Aguardando resposta do cliente', '#f59e0b', 3, 'manual', 60, 72),
        (v_pipeline_vendas, 'Negociação', 'Em negociação de valores/condições', '#ec4899', 4, 'manual', 80, NULL),
        (v_pipeline_vendas, 'Fechamento', 'Negócio fechado com sucesso', '#10b981', 5, 'finalizacao', 100, NULL),
        (v_pipeline_vendas, 'Perdido', 'Negócio não concretizado', '#64748b', 6, 'descarte', 0, NULL);
    END IF;
    
    -- Verificar tags
    SELECT COUNT(*) INTO v_count FROM crm_tags;
    
    IF v_count = 0 THEN
        INSERT INTO crm_tags (nome, cor, categoria, icone) VALUES
        ('VIP', '#fbbf24', 'prioridade', 'crown'),
        ('Primeira Compra', '#10b981', 'comportamento', 'user-plus'),
        ('Recorrente', '#3b82f6', 'comportamento', 'repeat'),
        ('Indicação', '#8b5cf6', 'origem', 'users'),
        ('Urgente', '#ef4444', 'prioridade', 'alert-triangle'),
        ('Aguardando', '#f59e0b', 'status', 'clock'),
        ('Não Atende', '#64748b', 'comportamento', 'phone-off'),
        ('Desejo Proibido', '#ec4899', 'produto', 'heart'),
        ('Bela Forma', '#06b6d4', 'produto', 'sparkles'),
        ('Bela Lumi', '#a855f7', 'produto', 'sun');
    END IF;
END $$;

-- ================================================================
-- PERMISSÕES RLS
-- ================================================================
ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_lead_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON crm_pipelines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON crm_etapas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON crm_tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON crm_leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON crm_lead_tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON crm_historico FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON crm_tarefas FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON crm_pipelines TO authenticated;
GRANT ALL ON crm_etapas TO authenticated;
GRANT ALL ON crm_tags TO authenticated;
GRANT ALL ON crm_leads TO authenticated;
GRANT ALL ON crm_lead_tags TO authenticated;
GRANT ALL ON crm_historico TO authenticated;
GRANT ALL ON crm_tarefas TO authenticated;
GRANT ALL ON crm_pipelines TO service_role;
GRANT ALL ON crm_etapas TO service_role;
GRANT ALL ON crm_tags TO service_role;
GRANT ALL ON crm_leads TO service_role;
GRANT ALL ON crm_lead_tags TO service_role;
GRANT ALL ON crm_historico TO service_role;
GRANT ALL ON crm_tarefas TO service_role;

-- Verificação final
SELECT 'CRM Reset Completo! Total de pipelines: ' || COUNT(*)::text as status FROM crm_pipelines;
