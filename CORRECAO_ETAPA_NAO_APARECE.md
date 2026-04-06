# 🔧 Correção: Etapa Criada mas Não Aparece

## ❌ Problema
A mensagem de sucesso aparece, mas a etapa não aparece na lista.

## 🛠️ Correções Aplicadas

### 1. Hook useEtapas atualizado
- Adicionado `staleTime: 0` para sempre buscar dados frescos
- Adicionado `refetchOnWindowFocus: true`
- Adicionado log no console

### 2. Página Pipelines.tsx atualizada
- Botão de atualizar manual adicionado (🔄)
- Forçar re-renderização após criar
- Logs de debug no console

---

## 🧪 Como Testar

### Passo 1: Abra o Console (F12)

### Passo 2: Selecione o Pipeline "Vendas"
Verifique no console:
```
Pipeline selecionado: [UUID do pipeline]
Etapas carregadas: 0 []
```

### Passo 3: Crie uma Etapa
Preencha e clique em "Adicionar Etapa"

### Passo 4: Verifique os Logs
Deve aparecer:
```
Inserindo etapa: {pipeline_id: "...", nome: "Teste", ...}
Etapa criada com sucesso!
```

Depois de 100ms:
```
Etapas retornadas do Supabase: 1 [...]
Pipeline selecionado: [UUID]
Etapas carregadas: 1 [...]
```

---

## 🔍 Se Ainda Não Aparecer

### Opção 1: Clique no botão Atualizar (🔄)
No canto superior direito, ao lado de "Nova Etapa"

### Opção 2: Verifique no SQL Editor
Execute no Supabase:
```sql
SELECT * FROM crm_etapas WHERE pipeline_id = '[UUID_DO_PIPELINE]';
```

Substitua `[UUID_DO_PIPELINE]` pelo ID do pipeline Vendas (veja no console).

Se retornar vazio → A etapa não foi criada
Se retornar dados → O problema é no frontend

### Opção 3: Recarregue a Página (F5)

---

## 🐛 Se a Etapa não foi Criada no Banco

Execute este SQL para verificar:

```sql
-- Ver todas as etapas
SELECT e.id, e.nome, e.pipeline_id, p.nome as pipeline_nome, e.ativo
FROM crm_etapas e
LEFT JOIN crm_pipelines p ON e.pipeline_id = p.id
WHERE e.ativo = true;
```

Se não aparecer nenhuma etapa, execute:

```sql
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

## ✅ Checklist

- [ ] Abri o console (F12)
- [ ] Selecionei o pipeline "Vendas"
- [ ] Criei uma etapa
- [ ] Vi a mensagem "Etapa criada com sucesso!"
- [ ] Cliquei no botão 🔄 (atualizar)
- [ ] A etapa apareceu na lista

Se ainda não funcionar, me envie o que aparece no console!
