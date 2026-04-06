-- ================================================================
-- RESET LIMPO - Remove tudo e recria do zero
-- ================================================================

-- 1. Desativar TODAS as etapas existentes
UPDATE crm_etapas SET ativo = false;

-- 2. Pegar o ID do pipeline Vendas (ou criar se não existir)
DO $$
DECLARE
    v_pipeline_id UUID;
BEGIN
    -- Buscar pipeline Vendas
    SELECT id INTO v_pipeline_id 
    FROM crm_pipelines 
    WHERE nome = 'Vendas' AND ativo = true 
    LIMIT 1;
    
    -- Se não existe, criar
    IF v_pipeline_id IS NULL THEN
        INSERT INTO crm_pipelines (nome, descricao, cor, ordem) 
        VALUES ('Vendas', 'Funil principal', '#10b981', 1)
        RETURNING id INTO v_pipeline_id;
    END IF;
    
    -- Inserir etapas (agora que não há conflito de ordem)
    INSERT INTO crm_etapas (pipeline_id, nome, cor, ordem, probabilidade, tipo, ativo) VALUES
    (v_pipeline_id, 'Novo Lead', '#3b82f6', 1, 10, 'manual', true),
    (v_pipeline_id, 'Qualificado', '#8b5cf6', 2, 30, 'manual', true),
    (v_pipeline_id, 'Fechamento', '#10b981', 3, 100, 'finalizacao', true);
    
    RAISE NOTICE 'Pipeline Vendas (%) criado com 3 etapas', v_pipeline_id;
END $$;

-- 3. Verificar resultado
SELECT 
    p.nome as pipeline,
    e.nome as etapa,
    e.ordem,
    e.ativo
FROM crm_pipelines p
LEFT JOIN crm_etapas e ON e.pipeline_id = p.id
WHERE p.nome = 'Vendas'
ORDER BY e.ordem;
