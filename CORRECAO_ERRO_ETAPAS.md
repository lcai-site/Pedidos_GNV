# 🔧 Correção: Erro ao Adicionar Etapas

## ❌ Erro Identificado
Pelo print, o usuário está tentando criar uma etapa mas está recebendo um erro (toast vermelho no topo).

## ✅ Solução Aplicada

### 1. Código Atualizado
O arquivo `pages/CRM/Pipelines.tsx` foi reescrito para:
- ✅ Usar inserção direta via supabase (sem hooks)
- ✅ Mostrar mensagem de erro específica
- ✅ Adicionar logs no console para debug
- ✅ Corrigir atualização automática da lista

### 2. SQL de Permissões
Execute este SQL no Supabase:

```sql
-- Arquivo: supabase/migrations/074_fix_permissoes_etapas.sql

-- Garantir permissões
ALTER TABLE crm_etapas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON crm_etapas;
CREATE POLICY "allow_all" ON crm_etapas FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON crm_etapas TO authenticated;
GRANT ALL ON crm_etapas TO service_role;
```

## 🧪 Como Testar

### Passo 1: Abra o Console
Pressione `F12` no navegador para abrir o console de desenvolvimento.

### Passo 2: Tente Criar uma Etapa
1. Vá para `/crm/pipelines`
2. Clique no pipeline "Vendas"
3. Clique em "Nova Etapa"
4. Preencha:
   - Nome: "Teste"
   - Probabilidade: 10%
   - SLA: 24
5. Clique em "Adicionar Etapa"

### Passo 3: Verifique o Console
Deve aparecer no console:
```
Inserindo etapa: {pipeline_id: "...", nome: "Teste", ...}
Etapa criada: [{...}]
```

Ou se der erro:
```
Erro ao inserir: {message: "..."}
```

## 🐛 Erros Comuns

### Erro: "duplicate key value violates unique constraint"
**Significado**: Já existe uma etapa com este nome neste pipeline.
**Solução**: Use um nome diferente.

### Erro: "permission denied for table crm_etapas"
**Significado**: RLS está bloqueando a inserção.
**Solução**: Execute o SQL acima ☝️

### Erro: "null value in column 'pipeline_id' violates not-null constraint"
**Significado**: Nenhum pipeline selecionado.
**Solução**: Clique no pipeline primeiro.

### Erro: "column 'descricao' does not exist"
**Significado**: A tabela foi criada sem a coluna descrição.
**Solução**: Execute o SQL definitivo novamente.

## 🚨 Se Nada Funcionar

Execute este SQL de emergência para recriar a tabela:

```sql
-- APAGA E RECRIA A TABELA DE ETAPAS
DROP TABLE IF EXISTS crm_etapas CASCADE;

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
    probabilidade DECIMAL(5,2) DEFAULT 0
);

-- Permissões
ALTER TABLE crm_etapas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON crm_etapas FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON crm_etapas TO authenticated;
GRANT ALL ON crm_etapas TO service_role;

-- Recriar etapas padrão
INSERT INTO crm_etapas (pipeline_id, nome, cor, ordem, probabilidade, tipo, sla_horas)
SELECT 
    p.id,
    e.nome,
    e.cor,
    e.ordem,
    e.probabilidade,
    e.tipo,
    e.sla_horas
FROM crm_pipelines p
CROSS JOIN (VALUES
    ('Novo Lead', '#3b82f6', 1, 10, 'manual', 24),
    ('Qualificado', '#8b5cf6', 2, 30, 'manual', 48),
    ('Proposta Enviada', '#f59e0b', 3, 60, 'manual', 72),
    ('Negociação', '#ec4899', 4, 80, 'manual', NULL),
    ('Fechamento', '#10b981', 5, 100, 'finalizacao', NULL),
    ('Perdido', '#64748b', 6, 0, 'descarte', NULL)
) AS e(nome, cor, ordem, probabilidade, tipo, sla_horas)
WHERE p.nome = 'Vendas';
```

## ✅ Checklist de Funcionamento

Após aplicar as correções:

- [ ] Consigo ver o botão "Nova Etapa"
- [ ] O formulário abre ao clicar
- [ ] Consigo preencher nome, probabilidade, SLA e cor
- [ ] Ao clicar "Adicionar Etapa", aparece mensagem de sucesso
- [ ] A etapa aparece na lista imediatamente
- [ ] Consigo excluir a etapa

Se algum item não funcionar, verifique o console (F12) e me envie o erro!
