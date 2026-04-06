# 📋 SQLs do CRM Kanban - Ordem de Execução

## 🎯 Sobre este documento

Este guia lista TODOS os SQLs necessários para o funcionamento completo do CRM Kanban, na ordem correta de execução.

---

## 📁 Local dos arquivos

Todos os arquivos estão em: `supabase/migrations/`

---

## 🚀 ORDEM DE EXECUÇÃO

### **ETAPA 1: CRM Básico (Recuperação)**

Execute estes 3 SQLs primeiro:

#### 1. `046_add_crm_contact_tracking.sql`
```sql
-- Adiciona controle de contato na tabela ticto_pedidos
ALTER TABLE ticto_pedidos ADD COLUMN IF NOT EXISTS contatado_recuperacao BOOLEAN DEFAULT false;
ALTER TABLE ticto_pedidos ADD COLUMN IF NOT EXISTS data_contato_recuperacao TIMESTAMPTZ;

-- Recria view_recuperacao
DROP VIEW IF EXISTS view_recuperacao;
CREATE VIEW view_recuperacao AS
SELECT 
    p.id,
    p.transaction_hash,
    p.order_date,
    p.status,
    p.payment_method,
    p.paid_amount,
    COALESCE(p.contatado_recuperacao, false) as contatado,
    p.customer_name,
    p.customer_email,
    p.customer_phone,
    p.product_name,
    p.offer_name,
    COALESCE(p.transaction_pix_url, p.transaction_bank_slip_url, p.checkout_url) as link_pagamento,
    p.utm_source,
    p.utm_campaign,
    CASE 
        WHEN p.status IN ('cart_abandoned', 'abandoned') THEN 'Carrinho Abandonado'
        WHEN p.status IN ('waiting_payment', 'pending') THEN 'Pendente'
        WHEN p.status IN ('refused', 'denied', 'failed') THEN 'Recusado'
        ELSE p.status
    END as status_label,
    CASE 
        WHEN p.status IN ('cart_abandoned', 'abandoned') THEN 0
        WHEN p.status IN ('waiting_payment', 'pending') THEN 1
        ELSE 2
    END as prioridade
FROM ticto_pedidos p
WHERE p.status NOT IN ('authorized', 'approved', 'paid', 'completed')
    AND p.order_date >= (NOW() - INTERVAL '30 days');
```

#### 2. `047_add_contact_date_tracking.sql`
```sql
-- Adiciona data de contato
ALTER TABLE ticto_pedidos ADD COLUMN IF NOT EXISTS data_contato_recuperacao TIMESTAMPTZ;

-- Recria view_recuperacao com nova coluna
DROP VIEW IF EXISTS view_recuperacao;
CREATE VIEW view_recuperacao AS
SELECT 
    p.id,
    p.transaction_hash,
    p.order_date,
    p.status,
    p.payment_method,
    p.paid_amount,
    COALESCE(p.contatado_recuperacao, false) as contatado,
    p.data_contato_recuperacao,
    p.customer_name,
    p.customer_email,
    p.customer_phone,
    p.product_name,
    p.offer_name,
    COALESCE(p.transaction_pix_url, p.transaction_bank_slip_url, p.checkout_url) as link_pagamento,
    p.utm_source,
    p.utm_campaign,
    CASE 
        WHEN p.status IN ('cart_abandoned', 'abandoned') THEN 'Carrinho Abandonado'
        WHEN p.status IN ('waiting_payment', 'pending') THEN 'Pendente'
        WHEN p.status IN ('refused', 'denied', 'failed') THEN 'Recusado'
        ELSE p.status
    END as status_label,
    CASE 
        WHEN p.status IN ('cart_abandoned', 'abandoned') THEN 0
        WHEN p.status IN ('waiting_payment', 'pending') THEN 1
        ELSE 2
    END as prioridade
FROM ticto_pedidos p
WHERE p.status NOT IN ('authorized', 'approved', 'paid', 'completed')
    AND p.order_date >= (NOW() - INTERVAL '30 days');
```

#### 3. `048_add_observacao_recuperacao.sql`
```sql
-- Adiciona observação na recuperação
ALTER TABLE ticto_pedidos ADD COLUMN IF NOT EXISTS observacao_recuperacao TEXT;
COMMENT ON COLUMN ticto_pedidos.observacao_recuperacao IS 'Observações sobre a tentativa de recuperação';
```

---

### **ETAPA 2: Schema CRM Kanban (O MAIS IMPORTANTE)**

#### 4. `049_create_crm_schema.sql`
**Arquivo completo em:** `supabase/migrations/049_create_crm_schema.sql`

Este arquivo cria:
- `crm_leads` - Tabela de leads
- `crm_templates` - Templates de mensagens
- `crm_campanhas` - Campanhas de envio
- `crm_mensagens` - Histórico de mensagens
- `crm_automacoes` - Automações
- `crm_config_zapi` - Configuração Z-API

#### 5. `050_create_crm_kanban_complete.sql`
**Arquivo completo em:** `supabase/migrations/050_create_crm_kanban_complete.sql`

Este é o SQL MAIS IMPORTANTE! Ele cria:

**Tabelas principais:**
- `crm_pipelines` - Funis/Kanbans personalizáveis
- `crm_etapas` - Colunas do Kanban
- `crm_tags` - Sistema de tags avançado
- `crm_leads` - Base de leads completa
- `crm_lead_tags` - Relacionamento N:N
- `crm_historico` - Timeline de ações
- `crm_tarefas` - Follow-ups e lembretes
- `crm_automacoes` - Fluxos automáticos
- `crm_produtos` - Catálogo de produtos
- `crm_lead_produtos` - Interesses dos leads

**Dados iniciais (SEED):**
- 3 Pipelines: Vendas, Pós-Venda, Recuperação
- 6 Etapas no pipeline Vendas (Novo Lead → Perdido)
- 11 Tags pré-cadastradas (VIP, Primeira Compra, etc.)
- 4 Produtos pré-cadastrados

**Functions e Triggers:**
- `crm_on_etapa_change()` - Registra mudanças de etapa automaticamente
- `crm_check_sla()` - Verifica leads com SLA estourado
- `crm_update_historico_compras()` - Atualiza histórico do cliente

---

## ✅ Como executar

### Passo 1: Acesse o Supabase
1. Vá para: https://app.supabase.com
2. Selecione seu projeto
3. Clique em **SQL Editor** no menu lateral

### Passo 2: Execute na ordem
Cole e execute UM POR VEZ:

1. `046_add_crm_contact_tracking.sql`
2. `047_add_contact_date_tracking.sql`
3. `048_add_observacao_recuperacao.sql`
4. `049_create_crm_schema.sql`
5. `050_create_crm_kanban_complete.sql`

### Passo 3: Verifique se funcionou
Execute esta query:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'crm_%'
ORDER BY table_name;
```

**Resultado esperado (13 tabelas):**
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
```

---

## 🎯 Funcionalidades habilitadas

Após executar todos os SQLs, você terá:

### 📊 Pipelines (Funis)
- Criar múltiplos funis de vendas
- Configurar etapas personalizadas
- Definir SLA por etapa
- Probabilidade de fechamento

### 🏷️ Tags
- Tags coloridas
- Categorias (prioridade, comportamento, origem, produto)
- Ícones personalizados
- Múltiplas tags por lead

### 👥 Leads
- Histórico de compras automático
- Endereço completo
- Campos customizados
- Controle de duplicidade (telefone/email)

### 📈 Kanban
- Drag-and-drop entre etapas
- Alertas de SLA
- Visualização por pipeline
- Cards com informações completas

### ⚡ Automações
- Gatilhos por movimentação
- Ações automáticas
- Regras condicionais

---

## 🐛 Erros comuns

### "relation already exists"
→ SQL já foi executado. Pule para o próximo.

### "column already exists"
→ Coluna já existe. Pode ignorar.

### "permission denied"
→ Verifique se está logado como admin.

---

## 📞 Suporte

Se encontrar erros:
1. Anote o número do SQL (ex: 050)
2. Copie a mensagem de erro completa
3. Verifique se executou na ordem correta

---

**Criado em:** Março 2026  
**Versão:** 1.0 - CRM Kanban Completo
