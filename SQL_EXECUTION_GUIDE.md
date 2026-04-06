# 📋 Guia de Execução SQLs - Supabase

## 📁 Local dos Arquivos

Todos os arquivos SQL estão em: `supabase/migrations/`

---

## 🎯 SQLs para Executar (Ordem Importante)

### **1. CRM Básico (Se ainda não executou)**

```sql
-- Arquivo: 046_add_crm_contact_tracking.sql
-- Data: 08/03/2026
-- Descrição: Adiciona controle de contato na recuperação
-- Conteúdo: Coluna contatado_recuperacao na tabela ticto_pedidos
```

```sql
-- Arquivo: 047_add_contact_date_tracking.sql
-- Data: 14/03/2026
-- Descrição: Adiciona data de contato na recuperação
-- Conteúdo: Coluna data_contato_recuperacao e recria view_recuperacao
```

```sql
-- Arquivo: 048_add_observacao_recuperacao.sql
-- Data: 14/03/2026
-- Descrição: Adiciona observação na recuperação
-- Conteúdo: Coluna observacao_recuperacao
```

### **2. CRM Kanban Completo (NOVO - Executar por último)**

```sql
-- Arquivo: 049_create_crm_schema.sql
-- Data: 14/03/2026
-- Descrição: Schema básico do CRM (LEADS, TEMPLATES, CAMPANHAS)
-- Conteúdo: 
--   - Tabela crm_leads
--   - Tabela crm_templates
--   - Tabela crm_campanhas
--   - Tabela crm_mensagens
--   - Tabela crm_automacoes
--   - Tabela crm_config_zapi
--   - Templates padrão
--   - RLS Policies
```

```sql
-- Arquivo: 050_create_crm_kanban_complete.sql
-- Data: 14/03/2026
-- Descrição: Schema COMPLETO do Kanban
-- Conteúdo:
--   - Tabela crm_pipelines (funis)
--   - Tabela crm_etapas (colunas do kanban)
--   - Tabela crm_tags avançada
--   - Tabela crm_leads (completa com histórico)
--   - Tabela crm_lead_tags (relacionamento N:N)
--   - Tabela crm_historico (timeline)
--   - Tabela crm_tarefas (follow-ups)
--   - Tabela crm_automacoes
--   - Tabela crm_produtos
--   - Índices para performance
--   - Triggers automáticos
--   - Funções auxiliares
--   - Dados iniciais (pipelines, etapas, tags, produtos)
--   - Automações de exemplo
```

---

## 🚀 Como Executar

### Passo 1: Acesse o Supabase
1. Vá para: https://app.supabase.com
2. Selecione seu projeto
3. Clique em **"SQL Editor"** no menu lateral

### Passo 2: Execute na Ordem

Cole e execute UM POR VEZ:

1. `046_add_crm_contact_tracking.sql`
2. `047_add_contact_date_tracking.sql`
3. `048_add_observacao_recuperacao.sql`
4. `049_create_crm_schema.sql`
5. `050_create_crm_kanban_complete.sql`

### Passo 3: Verificar se Funcionou

Execute esta query no SQL Editor:

```sql
-- Verificar tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'crm_%'
ORDER BY table_name;
```

**Resultado esperado:**
```
crm_automacoes
crm_campanhas
crm_config_zapi
crm_etapas
crm_historico
crm_lead_produtos
crm_lead_tags
crm_leads
crm_mensagens
crm_pipelines
crm_produtos
crm_tags
crm_tarefas
crm_templates
```

---

## 📊 Estrutura Criada

### Pipelines Padrão
- **Vendas** - Funil principal de vendas
- **Pós-Venda** - Acompanhamento de clientes
- **Recuperação** - Recuperação de carrinhos

### Etapas do Pipeline "Vendas"
| Etapa | Probabilidade | SLA |
|-------|--------------|-----|
| Novo Lead | 10% | 24h |
| Qualificado | 30% | 48h |
| Proposta Enviada | 60% | 72h |
| Negociação | 80% | - |
| Fechamento | 100% | - |
| Perdido | 0% | - |

### Tags Padrão
- Cliente VIP
- Primeira Compra
- Cliente Recorrente
- Indicação
- Urgente
- Aguardando Pagamento
- Não Atende
- Desejo Proibido
- Bela Forma
- Bela Lumi

---

## ⚠️ SQLs Antigos (Já Executados)

Os arquivos numerados de 001 a 065 (exceto os 5 acima) provavelmente já foram executados no seu banco. Não execute novamente para evitar erros.

### Se tiver dúvida, verifique se já existe:

```sql
-- Verificar se view_recuperacao existe
SELECT * FROM pg_views WHERE viewname = 'view_recuperacao';

-- Verificar se tabela crm_leads existe
SELECT * FROM information_schema.tables WHERE table_name = 'crm_leads';
```

---

## 🐛 Erros Comuns

### "relation already exists"
→ O SQL já foi executado antes. Pule para o próximo.

### "column already exists"
→ A coluna já existe. Pode ignorar.

### "permission denied"
→ Verifique se está logado com usuário admin do Supabase.

### "syntax error"
→ Copie o SQL completo sem cortar nada.

---

## ✅ Checklist Pós-Execução

Após executar todos os SQLs, confirme:

- [ ] Tabelas `crm_*` aparecem na lista
- [ ] Pipelines padrão foram criados
- [ ] Etapas do funil de Vendas existem
- [ ] Tags padrão foram criadas
- [ ] Aplicação carrega sem erros
- [ ] Página CRM abre normalmente

---

## 📞 Precisa de Ajuda?

Se encontrar erros:
1. Anote o nome do arquivo SQL
2. Copie a mensagem de erro completa
3. Verifique se executou na ordem correta
