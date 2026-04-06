# 🔧 Correção de Duplicatas - Execute Agora

## ⚠️ Problemas Identificados e Soluções

### Problema 1: Pipelines Duplicados
**Causa**: SQL executado múltiplas vezes sem limpar dados anteriores

### Problema 2: Botão Deletar Não Aparece
**Causa**: Estava configurado para aparecer apenas no hover

### Problema 3: Lista Não Atualiza Após Deletar
**Causa**: Cache do React Query não sendo invalidado corretamente

---

## ✅ PASSO 1: Execute o SQL Definitivo

1. Acesse: https://app.supabase.com
2. Vá em **SQL Editor**
3. Cole TODO o conteúdo do arquivo:
   ```
   supabase/migrations/073_crm_definitivo_sem_duplicatas.sql
   ```
4. Clique **Run**

**Este SQL vai:**
- ❌ Apagar TODAS as tabelas do CRM (cuidado se tiver dados importantes!)
- ✅ Recriar com constraint UNIQUE (impede duplicatas no futuro)
- ✅ Criar 3 pipelines: Vendas, Pós-Venda, Recuperação
- ✅ Criar 6 etapas no pipeline Vendas
- ✅ Criar 6 tags padrão

---

## ✅ PASSO 2: Atualize o Código

Os arquivos já foram atualizados:
- `pages/CRM/Pipelines.tsx` - Botão deletar sempre visível + atualização automática
- `pages/CRM/Tags.tsx` - CRUD completo funcionando

---

## ✅ PASSO 3: Teste

### 3.1 Verifique se não há duplicatas:
```sql
SELECT * FROM crm_pipelines;
-- Deve retornar APENAS 3 pipelines (Vendas, Pós-Venda, Recuperação)
```

### 3.2 Teste o botão deletar:
1. Vá para `/crm/pipelines`
2. O ícone de lixeira 🗑️ deve aparecer em CADA pipeline
3. Clique no ícone → Confirme → Pipeline some IMEDIATAMENTE

### 3.3 Teste criar novo:
1. Clique no + em Pipelines
2. Crie um novo
3. Ele deve aparecer na lista imediatamente

### 3.4 Teste etapas:
1. Clique no pipeline "Vendas"
2. As 6 etapas devem aparecer à direita
3. Cada etapa tem botão de deletar 🗑️
4. Clique em "Nova Etapa" para adicionar

---

## 🎯 O Que Mudou no Código

### Botão Deletar SEMPRE Visível:
```tsx
{/* Antes: só aparecia no hover */}
<button className="opacity-0 group-hover:opacity-100 ...">

{/* Agora: sempre visível */}
<button className="opacity-70 hover:opacity-100 ...">
```

### Atualização Automática:
```tsx
// Após deletar, força atualização do cache
await queryClient.invalidateQueries({ queryKey: ['crm-pipelines'] });
await queryClient.refetchQueries({ queryKey: ['crm-pipelines'] });
```

### Constraint UNIQUE no SQL:
```sql
-- Impede criar pipelines com mesmo nome
CREATE TABLE crm_pipelines (
    nome TEXT NOT NULL UNIQUE,
    ...
);

-- Impede etapas duplicadas no mesmo pipeline
CREATE TABLE crm_etapas (
    UNIQUE(pipeline_id, nome),
    ...
);
```

---

## 🐛 Se Ainda Tiver Problemas

### Erro: "duplicate key value violates unique constraint"
**Solução**: Você está tentando criar algo com nome que já existe. Use outro nome.

### Erro: "permission denied"
**Solução**: Execute no SQL Editor:
```sql
GRANT ALL ON crm_pipelines TO authenticated;
GRANT ALL ON crm_etapas TO authenticated;
```

### Pipeline deletado ainda aparece
**Solução**: Recarregue a página (F5) ou verifique se o SQL foi executado corretamente.

---

## 📋 Checklist Final

Após executar o SQL e atualizar o código:

- [ ] Executei o SQL `073_crm_definitivo_sem_duplicatas.sql`
- [ ] Vejo apenas 3 pipelines (sem duplicatas)
- [ ] Botão de deletar (🗑️) aparece em todos os pipelines
- [ ] Ao deletar, o pipeline some imediatamente
- [ ] Consigo criar novos pipelines
- [ ] Ao clicar no pipeline, vejo as etapas
- [ ] Cada etapa tem botão de deletar
- [ ] Consigo criar novas etapas

**Status esperado**: Tudo funcionando sem duplicatas!
