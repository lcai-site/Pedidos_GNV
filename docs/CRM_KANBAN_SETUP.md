# 🤝 CRM Kanban - Guia de Instalação

Este documento explica como configurar o CRM Kanban completo no seu projeto.

---

## 📋 Pré-requisitos

**⚠️ IMPORTANTE:** Eu (Kimi) não tenho acesso ao seu Supabase. Você precisará executar as migrations manualmente.

Você precisa de:
1. Acesso ao painel do Supabase (https://app.supabase.com)
2. URL do seu projeto
3. Service Role Key (para algumas operações)

---

## 🚀 Passo a Passo de Instalação

### 1. Instalar Dependências

Execute no terminal do seu projeto:

```bash
npm install @hello-pangea/dnd
```

Esta biblioteca é necessária para o drag-and-drop do Kanban.

---

### 2. Executar Migrations no Supabase

Acesse o **SQL Editor** do seu projeto Supabase e execute os arquivos na ordem:

#### Migration 049 - Schema Completo do CRM
Arquivo: `supabase/migrations/050_create_crm_kanban_complete.sql`

Este arquivo cria:
- ✅ Pipelines (funis personalizáveis)
- ✅ Etapas (colunas do Kanban)
- ✅ Tags avançadas
- ✅ Leads com histórico de compras
- ✅ Histórico de movimentações
- ✅ Tarefas/Follow-ups
- ✅ Automações
- ✅ Produtos/Serviços

#### Migration 048 - Observação na Recuperação (se ainda não executou)
Arquivo: `supabase/migrations/048_add_observacao_recuperacao.sql`

---

### 3. Verificar se as Tabelas foram Criadas

Execute esta query no SQL Editor para confirmar:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'crm_%';
```

Você deve ver:
- `crm_pipelines`
- `crm_etapas`
- `crm_tags`
- `crm_leads`
- `crm_lead_tags`
- `crm_historico`
- `crm_tarefas`
- `crm_automacoes`
- `crm_produtos`
- `crm_lead_produtos`

---

### 4. Configurar Dados Iniciais

As migrations já criam dados iniciais:

**Pipelines padrão:**
- Vendas
- Pós-Venda  
- Recuperação

**Etapas do funil de Vendas:**
1. Novo Lead (SLA: 24h)
2. Qualificado (SLA: 48h)
3. Proposta Enviada (SLA: 72h)
4. Negociação
5. Fechamento
6. Perdido

**Tags pré-cadastradas:**
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

### 5. Acessar o CRM

Após executar as migrations:

1. Reinicie o servidor: `npm run dev`
2. Acesse: Menu lateral → **CRM**

---

## 🎯 Funcionalidades do CRM Kanban

### 📊 Pipeline Visual
- Drag-and-drop entre etapas
- Colunas coloridas
- Soma de valores por etapa
- Contador de leads
- Alertas de SLA (cards ficam vermelhos quando estouram o prazo)

### 👥 Gestão de Leads
- **Dados completos:** Nome, telefone, email, endereço
- **Histórico de compras:** Verifica automaticamente se já é cliente
- **Temperatura:** Fria / Morna / Quente
- **Prioridade:** Baixa / Normal / Alta / Urgente
- **Valor estimado:** Previsão de receita

### 🏷️ Sistema de Tags
- Tags coloridas
- Categorização (origem, produto, prioridade)
- Múltiplas tags por lead

### 📝 Histórico Completo
- Timeline de todas as ações
- Movimentações entre etapas
- Ligações, WhatsApp, emails
- Anotações internas

### ⏰ Tarefas e Follow-ups
- Lembretes por lead
- Prioridades
- Vencimentos
- Recorrência

### 🤖 Automações (em desenvolvimento)
- Mover leads automaticamente
- Enviar mensagens em horários específicos
- Criar tarefas automaticamente

---

## 🔌 Integração com Dados Existentes

### Importar da Recuperação
O CRM pode importar leads automaticamente da seção "Recuperação":

```typescript
// Botão "Importar" na página do CRM
// Busca pedidos não convertidos e cria leads
```

### Verificação de Clientes Existentes
Antes de importar, o sistema verifica:
- Telefone já existe no CRM?
- Cliente já comprou antes?
- Produto já foi adquirido?

---

## 📱 Integração Z-API (WhatsApp)

Para ativar o envio de mensagens automáticas:

### 1. Configurar Credenciais

Insira na tabela `crm_config_zapi`:

```sql
INSERT INTO crm_config_zapi (
  instance_id,
  instance_token,
  api_token,
  conectado
) VALUES (
  'seu-instance-id',
  'seu-instance-token',
  'sua-api-token',
  false
);
```

### 2. Conectar WhatsApp

Use a página de configuração do CRM (em desenvolvimento) ou faça via API da Z-API.

---

## 🔧 Customização

### Criar Novo Pipeline

```sql
INSERT INTO crm_pipelines (nome, descricao, cor) 
VALUES ('Onboarding', 'Acompanhamento de novos clientes', '#3b82f6');
```

### Adicionar Etapas

```sql
INSERT INTO crm_etapas (pipeline_id, nome, cor, ordem, probabilidade) 
VALUES (
  'id-do-pipeline',
  'Primeiro Contato',
  '#10b981',
  1,
  10
);
```

### Criar Tags

```sql
INSERT INTO crm_tags (nome, cor, categoria, icone) 
VALUES ('VIP Ouro', '#fbbf24', 'prioridade', 'crown');
```

---

## 🐛 Troubleshooting

### Erro: "View não encontrada"
Execute as migrations na ordem correta (049 antes de usar o CRM).

### Erro: "Permission denied"
Verifique se as RLS policies foram criadas corretamente.

### Kanban não arrasta
Verifique se instalou a dependência:
```bash
npm install @hello-pangea/dnd
```

---

## 📝 Próximos Passos Sugeridos

1. **Configurar Z-API** - Conectar instância WhatsApp
2. **Criar Templates** - Mensagens pré-definidas
3. **Campanhas** - Envio em massa
4. **Relatórios** - Dashboard de conversão
5. **Automações** - Fluxos automáticos

---

## ❓ Suporte

Se encontrar problemas:
1. Verifique o console do navegador (F12)
2. Verifique logs do Supabase (Logs > Postgres)
3. Confirme se todas as migrations foram executadas

---

**Criado em:** Março 2026  
**Versão:** 1.0.0
