-- ================================================================
-- LIMPAR DUPLICATAS DO CRM
-- Execute este SQL para remover pipelines e dados duplicados
-- ================================================================

-- Desativar RLS temporariamente para limpeza
ALTER TABLE crm_pipelines DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_etapas DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 1. REMOVER PIPELINES DUPLICADOS (MANTER O MAIS ANTIGO DE CADA NOME)
-- ============================================

-- Criar tabela temporária com os IDs a manter (o mais antigo de cada nome)
CREATE TEMP TABLE pipelines_a_manter AS
SELECT DISTINCT ON (nome) id
FROM crm_pipelines
WHERE ativo = true
ORDER BY nome, created_at ASC;

-- Desativar pipelines duplicados (manter apenas os da lista)
UPDATE crm_pipelines
SET ativo = false
WHERE id NOT IN (SELECT id FROM pipelines_a_manter);

-- ============================================
-- 2. REMOVER ETAPAS DUPLICADAS (MANTER O MAIS ANTIGO DE CADA NOME POR PIPELINE)
-- ============================================

CREATE TEMP TABLE etapas_a_manter AS
SELECT DISTINCT ON (pipeline_id, nome) id
FROM crm_etapas
WHERE ativo = true
ORDER BY pipeline_id, nome, created_at ASC;

UPDATE crm_etapas
SET ativo = false
WHERE id NOT IN (SELECT id FROM etapas_a_manter);

-- ============================================
-- 3. REMOVER TAGS DUPLICADAS
-- ============================================

CREATE TEMP TABLE tags_a_manter AS
SELECT DISTINCT ON (nome) id
FROM crm_tags
WHERE ativo = true
ORDER BY nome, created_at ASC;

UPDATE crm_tags
SET ativo = false
WHERE id NOT IN (SELECT id FROM tags_a_manter);

-- ============================================
-- 4. SE NÃO HOUVER NENHUM PIPELINE ATIVO, CRIAR OS PADRÕES
-- ============================================

DO $$
DECLARE
    v_count INTEGER;
    v_vendas_id UUID;
    v_pos_id UUID;
    v_rec_id UUID;
BEGIN
    SELECT COUNT(*) INTO v_count FROM crm_pipelines WHERE ativo = true;
    
    IF v_count = 0 THEN
        -- Criar pipelines padrão
        INSERT INTO crm_pipelines (nome, descricao, cor, ordem) VALUES
        ('Vendas', 'Funil padrão de vendas', '#10b981', 1)
        RETURNING id INTO v_vendas_id;
        
        INSERT INTO crm_pipelines (nome, descricao, cor, ordem) VALUES
        ('Pós-Venda', 'Acompanhamento de clientes', '#3b82f6', 2)
        RETURNING id INTO v_pos_id;
        
        INSERT INTO crm_pipelines (nome, descricao, cor, ordem) VALUES
        ('Recuperação', 'Recuperação de carrinhos', '#f59e0b', 3)
        RETURNING id INTO v_rec_id;
        
        -- Criar etapas para Vendas
        INSERT INTO crm_etapas (pipeline_id, nome, descricao, cor, ordem, tipo, probabilidade, sla_horas) VALUES
        (v_vendas_id, 'Novo Lead', 'Leads recém chegados', '#3b82f6', 1, 'manual', 10, 24),
        (v_vendas_id, 'Qualificado', 'Lead qualificado e com interesse', '#8b5cf6', 2, 'manual', 30, 48),
        (v_vendas_id, 'Proposta Enviada', 'Aguardando resposta do cliente', '#f59e0b', 3, 'manual', 60, 72),
        (v_vendas_id, 'Negociação', 'Em negociação de valores/condições', '#ec4899', 4, 'manual', 80, NULL),
        (v_vendas_id, 'Fechamento', 'Negócio fechado com sucesso', '#10b981', 5, 'finalizacao', 100, NULL),
        (v_vendas_id, 'Perdido', 'Negócio não concretizado', '#64748b', 6, 'descarte', 0, NULL);
        
        -- Criar tags padrão
        INSERT INTO crm_tags (nome, cor, categoria, icone) VALUES
        ('VIP', '#fbbf24', 'prioridade', 'crown'),
        ('Primeira Compra', '#10b981', 'comportamento', 'user-plus'),
        ('Recorrente', '#3b82f6', 'comportamento', 'repeat'),
        ('Indicação', '#8b5cf6', 'origem', 'users'),
        ('Urgente', '#ef4444', 'prioridade', 'alert-triangle'),
        ('Aguardando', '#f59e0b', 'status', 'clock')
        ON CONFLICT (nome) DO NOTHING;
    END IF;
END $$;

-- ============================================
-- 5. LIMPAR TABELAS TEMPORÁRIAS
-- ============================================
DROP TABLE IF EXISTS pipelines_a_manter;
DROP TABLE IF EXISTS etapas_a_manter;
DROP TABLE IF EXISTS tags_a_manter;

-- ============================================
-- 6. REATIVAR RLS
-- ============================================
ALTER TABLE crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. RECRIAR POLÍTICAS
-- ============================================
DROP POLICY IF EXISTS "allow_all" ON crm_pipelines;
DROP POLICY IF EXISTS "allow_all" ON crm_etapas;
DROP POLICY IF EXISTS "allow_all" ON crm_tags;
DROP POLICY IF EXISTS "allow_all" ON crm_leads;

CREATE POLICY "allow_all" ON crm_pipelines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON crm_etapas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON crm_tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON crm_leads FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================
SELECT 'Pipelines ativos:' as info, COUNT(*) as total FROM crm_pipelines WHERE ativo = true
UNION ALL
SELECT 'Etapas ativas:', COUNT(*) FROM crm_etapas WHERE ativo = true
UNION ALL
SELECT 'Tags ativas:', COUNT(*) FROM crm_tags WHERE ativo = true;
