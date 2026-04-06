-- ================================================================
-- CRM DEFINITIVO - SEM DUPLICATAS
-- Execute este SQL para resetar o CRM completo
-- ================================================================

-- 1. LIMPAR TUDO (CUIDADO: APAGA TODOS OS DADOS DO CRM)
DROP TABLE IF EXISTS crm_lead_tags CASCADE;
DROP TABLE IF EXISTS crm_tarefas CASCADE;
DROP TABLE IF EXISTS crm_historico CASCADE;
DROP TABLE IF EXISTS crm_lead_produtos CASCADE;
DROP TABLE IF EXISTS crm_leads CASCADE;
DROP TABLE IF EXISTS crm_etapas CASCADE;
DROP TABLE IF EXISTS crm_produtos CASCADE;
DROP TABLE IF EXISTS crm_tags CASCADE;
DROP TABLE IF EXISTS crm_pipelines CASCADE;
DROP FUNCTION IF EXISTS crm_on_etapa_change CASCADE;

-- 2. TABELA DE PIPELINES (COM UNIQUE NO NOME)
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
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(nome)
);

-- 3. TABELA DE ETAPAS
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
    probabilidade DECIMAL(5,2) DEFAULT 0,
    UNIQUE(pipeline_id, nome)
);

-- 4. TABELA DE TAGS (COM UNIQUE NO NOME)
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

-- 5. TABELA DE LEADS
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

-- 6. TABELAS RELACIONAMENTO
CREATE TABLE crm_lead_tags (
    lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES crm_tags(id) ON DELETE CASCADE,
    adicionado_em TIMESTAMPTZ DEFAULT now(),
    adicionado_por UUID REFERENCES auth.users(id),
    PRIMARY KEY (lead_id, tag_id)
);

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

-- 7. ÍNDICES
CREATE INDEX idx_crm_leads_pipeline ON crm_leads(pipeline_id);
CREATE INDEX idx_crm_leads_etapa ON crm_leads(etapa_id);
CREATE INDEX idx_crm_leads_ativo ON crm_leads(ativo, arquivado);
CREATE INDEX idx_crm_historico_lead ON crm_historico(lead_id);
CREATE INDEX idx_crm_tarefas_lead ON crm_tarefas(lead_id);

-- 8. TRIGGER PARA HISTÓRICO
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

-- 9. INSERIR DADOS PADRÃO
INSERT INTO crm_pipelines (nome, descricao, cor, ordem) VALUES
('Vendas', 'Funil padrão de vendas', '#10b981', 1),
('Pós-Venda', 'Acompanhamento de clientes', '#3b82f6', 2),
('Recuperação', 'Recuperação de carrinhos', '#f59e0b', 3);

-- Etapas do pipeline Vendas
DO $$
DECLARE
    v_pipeline_id UUID;
BEGIN
    SELECT id INTO v_pipeline_id FROM crm_pipelines WHERE nome = 'Vendas';
    
    INSERT INTO crm_etapas (pipeline_id, nome, descricao, cor, ordem, tipo, probabilidade, sla_horas) VALUES
    (v_pipeline_id, 'Novo Lead', 'Leads recém chegados', '#3b82f6', 1, 'manual', 10, 24),
    (v_pipeline_id, 'Qualificado', 'Lead qualificado', '#8b5cf6', 2, 'manual', 30, 48),
    (v_pipeline_id, 'Proposta Enviada', 'Aguardando resposta', '#f59e0b', 3, 'manual', 60, 72),
    (v_pipeline_id, 'Negociação', 'Em negociação', '#ec4899', 4, 'manual', 80, NULL),
    (v_pipeline_id, 'Fechamento', 'Negócio ganho', '#10b981', 5, 'finalizacao', 100, NULL),
    (v_pipeline_id, 'Perdido', 'Negócio perdido', '#64748b', 6, 'descarte', 0, NULL);
END $$;

-- Tags padrão
INSERT INTO crm_tags (nome, cor, categoria, icone) VALUES
('VIP', '#fbbf24', 'prioridade', 'crown'),
('Primeira Compra', '#10b981', 'comportamento', 'user-plus'),
('Recorrente', '#3b82f6', 'comportamento', 'repeat'),
('Indicação', '#8b5cf6', 'origem', 'users'),
('Urgente', '#ef4444', 'prioridade', 'alert-triangle'),
('Aguardando', '#f59e0b', 'status', 'clock');

-- 10. PERMISSÕES
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

-- Verificação
SELECT 'CRM criado com sucesso!' as status,
       (SELECT COUNT(*) FROM crm_pipelines) as pipelines,
       (SELECT COUNT(*) FROM crm_etapas) as etapas,
       (SELECT COUNT(*) FROM crm_tags) as tags;
