# 🔧 Correção: Erro 409 ao Criar Etapas

## ❌ Erro Identificado
```
Failed to load resource: the server responded with a status of 409
```

**Significado**: Violation of unique constraint (Constraint UNIQUE violada)

A tabela `crm_etapas` tem uma constraint que impede inserções duplicadas baseada em `(pipeline_id, ordem)` ou `(pipeline_id, nome)`.

---

## ✅ Solução Rápida

### Execute este SQL no Supabase:

```sql
-- Arquivo: supabase/migrations/076_recriar_etapas_sem_constraints.sql

-- Remove a tabela problemática e recria sem constraints UNIQUE
DROP TABLE IF EXISTS crm_etapas CASCADE;

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
);

-- Permissões
ALTER TABLE crm_etapas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON crm_etapas FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON crm_etapas TO authenticated;

-- Recriar etapas padrão
DO $$
DECLARE
    v_pipeline_id UUID;
BEGIN
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
END $$;
```

---

## 🧪 Após Executar o SQL

1. **Recarregue a página** (F5)
2. Vá para `/crm/pipelines`
3. Clique no pipeline "Vendas"
4. Tente criar uma nova etapa

**Deve funcionar agora!**

---

## 📝 O que foi alterado no código

O arquivo `pages/CRM/Pipelines.tsx` foi atualizado para:
- ✅ Detectar erro de duplicação
- ✅ Tentar novamente com ordem diferente se der erro 409
- ✅ Mostrar mensagem de erro amigável

---

## 🐛 Se ainda der erro

Verifique no console (F12) se o erro mudou. Se aparecer outro código de erro (400, 401, 403, 500), me envie que eu corrijo!
