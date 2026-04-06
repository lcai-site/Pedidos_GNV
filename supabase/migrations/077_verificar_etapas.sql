-- ================================================================
-- VERIFICAR E CORRIGIR ETAPAS
-- ================================================================

-- 1. Verificar se a tabela existe
SELECT 'Tabela crm_etapas existe: ' || COUNT(*)::text as status
FROM information_schema.tables 
WHERE table_name = 'crm_etapas';

-- 2. Verificar estrutura
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'crm_etapas'
ORDER BY ordinal_position;

-- 3. Verificar etapas por pipeline
SELECT 
    p.nome as pipeline,
    COUNT(e.id) as total_etapas
FROM crm_pipelines p
LEFT JOIN crm_etapas e ON e.pipeline_id = p.id AND e.ativo = true
WHERE p.ativo = true
GROUP BY p.id, p.nome;

-- 4. Listar todas as etapas ativas
SELECT 
    e.id,
    e.nome,
    e.pipeline_id,
    p.nome as pipeline_nome,
    e.ordem,
    e.ativo
FROM crm_etapas e
JOIN crm_pipelines p ON e.pipeline_id = p.id
WHERE e.ativo = true
ORDER BY p.nome, e.ordem;

-- 5. Se não houver etapas, recriar
DO $$
DECLARE
    v_pipeline_id UUID;
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM crm_etapas WHERE ativo = true;
    
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
            
            RAISE NOTICE 'Etapas padrão criadas para o pipeline Vendas';
        END IF;
    END IF;
END $$;
