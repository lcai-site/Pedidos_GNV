-- ================================================================
-- REMOVER CONSTRAINTS QUE BLOQUEIAM CRIAÇÃO DE ETAPAS
-- ================================================================

-- 1. Listar todas as constraints da tabela
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'crm_etapas'::regclass;

-- 2. Remover constraints únicas (se existirem)
ALTER TABLE crm_etapas DROP CONSTRAINT IF EXISTS unique_etapa_ordem;
ALTER TABLE crm_etapas DROP CONSTRAINT IF EXISTS crm_etapas_pipeline_id_nome_key;

-- 3. Verificar se a tabela tem RLS e ajustar
ALTER TABLE crm_etapas DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_etapas ENABLE ROW LEVEL SECURITY;

-- 4. Garantir política permissiva
DROP POLICY IF EXISTS "allow_all" ON crm_etapas;
CREATE POLICY "allow_all" ON crm_etapas FOR ALL USING (true) WITH CHECK (true);

-- 5. Garantir permissões
GRANT ALL ON crm_etapas TO authenticated;
GRANT ALL ON crm_etapas TO service_role;

-- 6. Verificar etapas do pipeline Vendas
SELECT p.nome as pipeline, COUNT(e.id) as total_etapas
FROM crm_pipelines p
LEFT JOIN crm_etapas e ON e.pipeline_id = p.id AND e.ativo = true
WHERE p.nome = 'Vendas'
GROUP BY p.id, p.nome;
