-- ================================================================
-- DIAGNOSTICAR E CORRIGIR PIPELINE VENDAS
-- ================================================================

-- 1. Verificar se o pipeline Vendas existe
SELECT id, nome, ativo, created_at 
FROM crm_pipelines 
WHERE nome = 'Vendas';

-- 2. Verificar etapas do pipeline Vendas
SELECT e.*, p.nome as pipeline_nome
FROM crm_etapas e
JOIN crm_pipelines p ON e.pipeline_id = p.id
WHERE p.nome = 'Vendas' AND e.ativo = true;

-- 3. Verificar máximo ordem no pipeline Vendas
SELECT MAX(ordem) as max_ordem, COUNT(*) as total
FROM crm_etapas e
JOIN crm_pipelines p ON e.pipeline_id = p.id
WHERE p.nome = 'Vendas' AND e.ativo = true;

-- 4. Se houver problema de ordem duplicada, resetar ordens
DO $$
DECLARE
    v_pipeline_id UUID;
    rec RECORD;
    v_ordem INTEGER := 1;
BEGIN
    SELECT id INTO v_pipeline_id FROM crm_pipelines WHERE nome = 'Vendas' LIMIT 1;
    
    IF v_pipeline_id IS NOT NULL THEN
        -- Reordenar etapas do Vendas sequencialmente
        FOR rec IN 
            SELECT id FROM crm_etapas 
            WHERE pipeline_id = v_pipeline_id AND ativo = true
            ORDER BY created_at
        LOOP
            UPDATE crm_etapas SET ordem = v_ordem WHERE id = rec.id;
            v_ordem := v_ordem + 1;
        END LOOP;
        
        RAISE NOTICE 'Etapas do pipeline Vendas reordenadas';
    END IF;
END $$;

-- 5. Remover constraint de ordem única se existir
ALTER TABLE crm_etapas DROP CONSTRAINT IF EXISTS unique_etapa_ordem;

-- 6. Verificar resultado final
SELECT 
    p.nome as pipeline,
    e.nome as etapa,
    e.ordem,
    e.ativo
FROM crm_etapas e
JOIN crm_pipelines p ON e.pipeline_id = p.id
WHERE p.nome = 'Vendas'
ORDER BY e.ordem;
