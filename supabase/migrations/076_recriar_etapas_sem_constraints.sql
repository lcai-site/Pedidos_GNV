-- ================================================================
-- RECRIAR TABELA crm_etapas SEM CONSTRAINTS PROBLEMÁTICAS
-- ================================================================

-- 1. Fazer backup dos dados existentes (se houver)
CREATE TEMP TABLE etapas_backup AS SELECT * FROM crm_etapas;

-- 2. Dropar tabela
DROP TABLE IF EXISTS crm_etapas CASCADE;

-- 3. Recriar sem constraints UNIQUE
CREATE TABLE crm_etapas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    pipeline_id UUID NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    cor TEXT DEFAULT '#64748b',
    ordem INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    tipo TEXT DEFAULT 'manual',
    regras_entrada JSONB DEFAULT '[]',
    sla_horas INTEGER,
    alerta_sla BOOLEAN DEFAULT true,
    probabilidade DECIMAL(5,2) DEFAULT 0
    -- SEM CONSTRAINTS UNIQUE!
);

-- 4. Restaurar dados do backup (se existirem)
INSERT INTO crm_etapas (
    id, created_at, pipeline_id, nome, descricao, cor, ordem, 
    ativo, tipo, regras_entrada, sla_horas, alerta_sla, probabilidade
)
SELECT 
    id, created_at, pipeline_id, nome, descricao, cor, ordem,
    ativo, tipo, regras_entrada, sla_horas, alerta_sla, probabilidade
FROM etapas_backup
ON CONFLICT DO NOTHING;

-- 5. Dropar backup
DROP TABLE etapas_backup;

-- 6. Índices (sem unique)
CREATE INDEX idx_crm_etapas_pipeline ON crm_etapas(pipeline_id);
CREATE INDEX idx_crm_etapas_ativo ON crm_etapas(ativo);

-- 7. Permissões
ALTER TABLE crm_etapas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON crm_etapas;
CREATE POLICY "allow_all" ON crm_etapas FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON crm_etapas TO authenticated;
GRANT ALL ON crm_etapas TO service_role;

-- 8. Recriar etapas padrão se estiver vazio
DO $$
DECLARE
    v_count INTEGER;
    v_pipeline_id UUID;
BEGIN
    SELECT COUNT(*) INTO v_count FROM crm_etapas;
    
    IF v_count = 0 THEN
        SELECT id INTO v_pipeline_id FROM crm_pipelines WHERE nome = 'Vendas' LIMIT 1;
        
        IF v_pipeline_id IS NOT NULL THEN
            INSERT INTO crm_etapas (pipeline_id, nome, cor, ordem, probabilidade, tipo, sla_horas) VALUES
            (v_pipeline_id, 'Novo Lead', '#3b82f6', 1, 10, 'manual', 24),
            (v_pipeline_id, 'Qualificado', '#8b5cf6', 2, 30, 'manual', 48),
            (v_pipeline_id, 'Proposta Enviada', '#f59e0b', 3, 60, 'manual', 72),
            (v_pipeline_id, 'Negociação', '#ec4899', 4, 80, 'manual', NULL),
            (v_pipeline_id, 'Fechamento', '#10b981', 5, 100, 'finalizacao', NULL),
            (v_pipeline_id, 'Perdido', '#64748b', 6, 0, 'descarte', NULL);
        END IF;
    END IF;
END $$;

-- Verificação
SELECT 'Tabela crm_etapas recriada!' as status, COUNT(*) as total_etapas FROM crm_etapas;
