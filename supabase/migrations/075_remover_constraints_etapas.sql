-- ================================================================
-- REMOVER CONSTRAINTS UNIQUE PROBLEMÁTICAS DAS ETAPAS
-- Erro 409 = violação de constraint única
-- ================================================================

-- 1. Remover constraints únicas da tabela crm_etapas
ALTER TABLE crm_etapas DROP CONSTRAINT IF EXISTS unique_etapa_ordem;
ALTER TABLE crm_etapas DROP CONSTRAINT IF EXISTS crm_etapas_pipeline_id_nome_key;

-- 2. Verificar se há constraints restantes
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'crm_etapas'::regclass 
AND contype = 'u';

-- 3. Se ainda houver constraints únicas, remova todas
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'crm_etapas'::regclass 
        AND contype = 'u'
    LOOP
        EXECUTE 'ALTER TABLE crm_etapas DROP CONSTRAINT IF EXISTS ' || r.conname;
        RAISE NOTICE 'Constraint % removida', r.conname;
    END LOOP;
END $$;

-- 4. Garantir permissões
ALTER TABLE crm_etapas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON crm_etapas;
CREATE POLICY "allow_all" ON crm_etapas FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON crm_etapas TO authenticated;
GRANT ALL ON crm_etapas TO service_role;

-- 5. Verificar estrutura atual
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'crm_etapas';
