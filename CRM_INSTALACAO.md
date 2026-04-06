# 🚀 CRM Kanban - Guia de Instalação

## ⚠️ IMPORTANTE - LEIA ANTES

Este guia vai fazer o CRM funcionar 100%. Siga cada passo com atenção.

---

## 📋 PASSO 1: Preparar o Banco de Dados

### 1.1 Acesse o Supabase SQL Editor
1. Vá para https://app.supabase.com
2. Selecione seu projeto
3. Clique em **SQL Editor** no menu lateral

### 1.2 Execute o SQL de Reset
Execute este SQL **uma única vez** (vai limpar dados antigos e criar tudo novo):

```sql
-- Arquivo: supabase/migrations/071_crm_reset_completo.sql
-- COLE O CONTEÚDO DESTE ARQUIVO E EXECUTE
```

**O que este SQL faz:**
- ✅ Apaga todas as tabelas antigas do CRM
- ✅ Recria tabelas do zero (sem duplicatas)
- ✅ Cria 3 pipelines: Vendas, Pós-Venda, Recuperação
- ✅ Cria 6 etapas no pipeline Vendas
- ✅ Cria 10 tags
- ✅ Configura permissões

---

## 📋 PASSO 2: Verificar Instalação

### 2.1 Verifique se o Supabase está configurado corretamente:

No SQL Editor, execute:
```sql
SELECT * FROM crm_pipelines;
```

Deve retornar 3 pipelines (Vendas, Pós-Venda, Recuperação).

Se retornar vazio ou erro, o SQL não foi executado corretamente.

---

## 📋 PASSO 3: Rodar a Aplicação

### 3.1 Instalar dependências (se necessário):
```bash
npm install
```

### 3.2 Iniciar o servidor:
```bash
npm run dev
```

### 3.3 Acesse no navegador:
```
http://localhost:5173/#/crm/leads
```

---

## 📋 PASSO 4: Testar Funcionalidades

### 4.1 Pipeline de Vendas deve aparecer automaticamente
- Selecione "Vendas" no dropdown superior
- As 6 colunas devem aparecer:
  - Novo Lead
  - Qualificado
  - Proposta Enviada
  - Negociação
  - Fechamento
  - Perdido

### 4.2 Criar um Lead de Teste
1. Clique no botão "Novo Lead"
2. Preencha:
   - Título: "Teste - Cliente"
   - Nome: "João Silva"
   - Telefone: "(11) 99999-9999"
   - Valor: 1000
3. Clique "Criar Lead"

O lead deve aparecer na primeira coluna (Novo Lead).

### 4.3 Mover o Lead
1. Arraste o card do lead para outra coluna
2. O lead deve mover e a contagem da coluna deve atualizar

### 4.4 Criar uma Tag
1. Vá para Configurações → Tags (ou /#/crm/tags)
2. Clique "Nova Tag"
3. Preencha nome e cor
4. Clique "Salvar"

A tag deve aparecer na lista.

---

## 📋 PASSO 5: Gerenciar Pipelines e Etapas

Acesse: `/#/crm/pipelines`

### Criar Novo Pipeline:
1. Clique no ícone + ao lado de "Pipelines"
2. Digite o nome
3. Escolha uma cor
4. Clique "Criar Pipeline"

### Adicionar Etapas:
1. Clique no pipeline criado
2. Clique "Nova Etapa"
3. Preencha nome, probabilidade, SLA
4. Clique "Adicionar Etapa"

---

## 🔧 Solução de Problemas

### Problema: "relation does not exist"
**Solução:** O SQL não foi executado. Execute o arquivo `071_crm_reset_completo.sql` no Supabase.

### Problema: Pipelines duplicados
**Solução:** Execute o SQL de reset novamente. Ele limpa tudo antes de recriar.

### Problema: Kanban não aparece
**Solução:** 
1. Verifique se selecionou um pipeline no dropdown
2. Verifique no console (F12) se há erros
3. Verifique se as etapas existem: `SELECT * FROM crm_etapas;`

### Problema: Não consigo criar tags
**Solução:** Verifique as permissões RLS. Execute:
```sql
GRANT ALL ON crm_tags TO authenticated;
```

### Problema: Drag-and-drop não funciona
**Solução:** Verifique se @hello-pangea/dnd está instalado:
```bash
npm install @hello-pangea/dnd
```

---

## 📱 Rotas Disponíveis

| Rota | Descrição |
|------|-----------|
| `/#/crm/leads` | Kanban de leads |
| `/#/crm/pipelines` | Gerenciar pipelines e etapas |
| `/#/crm/tags` | Gerenciar tags |
| `/#/crm/config` | Hub de configurações |

---

## ✅ Checklist de Funcionamento

Após seguir os passos acima, verifique:

- [ ] Pipelines aparecem sem duplicatas
- [ ] Etapas aparecem nas colunas do Kanban
- [ ] Posso criar leads
- [ ] Posso mover leads entre colunas
- [ ] Posso criar tags
- [ ] Posso excluir tags
- [ ] Posso criar pipelines
- [ ] Posso criar etapas
- [ ] Os valores totais aparecem nas colunas

---

## 📞 Suporte

Se ainda tiver problemas:
1. Verifique o console do navegador (F12) por erros
2. Verifique se o Supabase está online
3. Execute o SQL de reset novamente

**Status esperado:** CRM 100% funcional com design profissional.
