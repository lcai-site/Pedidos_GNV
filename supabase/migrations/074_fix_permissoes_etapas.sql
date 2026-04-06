-- ================================================================
-- CORREÇÃO DE PERMISSÕES PARA ETAPAS
-- Execute este SQL se estiver tendo erro ao criar etapas
-- ================================================================

-- 1. Garantir que RLS está ativo mas permitindo tudo
ALTER TABLE crm_etapas ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas
DROP POLICY IF EXISTS "allow_all" ON crm_etapas;
DROP POLICY IF EXISTS "crm_etapas_all" ON crm_etapas;

-- 3. Criar política permissiva
CREATE POLICY "allow_all_etapas" ON crm_etapas FOR ALL USING (true) WITH CHECK (true);

-- 4. Garantir permissões
GRANT ALL ON crm_etapas TO authenticated;
GRANT ALL ON crm_etapas TO service_role;
GRANT ALL ON crm_etapas TO anon;

-- 5. Verificar se a sequência está correta (para UUID)
ALTER TABLE crm_etapas ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 6. Verificar constraints
ALTER TABLE crm_etapas DROP CONSTRAINT IF EXISTS unique_etapa_ordem;

-- 7. Teste de inserção (você pode remover após testar)
/*
DO $$
DECLARE
    v_pipeline_id UUID;
BEGIN
    SELECT id INTO v_pipeline_id FROM crm_pipelines WHERE nome = 'Vendas' LIMIT 1;
    
    IF v_pipeline_id IS NOT NULL THEN
        INSERT INTO crm_etapas (pipeline_id, nome, cor, ordem, probabilidade, tipo)
        VALUES (v_pipeline_id, 'Teste Inserção', '#3b82f6', 99, 50, 'manual');
        
        RAISE NOTICE 'Inserção de teste bem-sucedida!';
        
        -- Remover teste
        DELETE FROM crm_etapas WHERE nome = 'Teste Inserção';
    END IF;
END $$;
*/

-- 8. Verificar status
SELECT 
    'Tabela crm_etapas:' as info,
    COUNT(*) as total_registros,
    (SELECT COUNT(*) FROM crm_pipelines WHERE ativo = true) as pipelines_ativos
FROM crm_etapas WHERE ativo = true;
