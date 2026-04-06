# 🧪 Teste do CRM - Passos

## ✅ Status Atual

- [x] Schema do banco criado no Supabase
- [x] Dependência @hello-pangea/dnd instalada
- [x] Rota /crm/leads adicionada ao App.tsx
- [x] Menu CRM adicionado ao Layout
- [x] Erros de compilação corrigidos

## 🚀 Como Testar

### 1. Iniciar o servidor
```bash
npm run dev
```

### 2. Acessar a aplicação
- Abra: http://localhost:3000
- Faça login

### 3. Navegar até o CRM
- Clique no menu lateral: **CRM**
- Ou acesse direto: http://localhost:3000/#/crm/leads

### 4. Verificar se carregou
Você deve ver:
- Título: "CRM - Gestão de Leads"
- Cards de estatísticas (Total em Aberto, Valor Pipeline, etc.)
- Seletor de Pipeline
- Botão "Importar" e "Novo Lead"
- Área do Kanban (mesmo que vazia)

### 5. Testar funcionalidades

#### Importar da Recuperação
1. Clique em **"Importar da Recuperação"**
2. Verifique se aparece toast de sucesso
3. Verifique se leads aparecem no Kanban

#### Criar Lead Manual (se o modal estiver pronto)
1. Clique em **"Novo Lead"**
2. Preencha os dados
3. Salve

#### Navegar entre Pipelines
1. Use o seletor de Pipeline no topo
2. Deve mostrar: Vendas, Pós-Venda, Recuperação

## ❗ Se der erro

### Erro: "Cannot find module"
Verifique se todos os arquivos estão no lugar:
- `pages/CRM/Leads.tsx` deve existir
- `components/Layout.tsx` deve ter o menu CRM

### Erro: "Table crm_leads does not exist"
O SQL do CRM não foi executado no Supabase. Execute:
```sql
-- No SQL Editor do Supabase
-- Arquivo: 050_create_crm_kanban_complete.sql
```

### Erro: "Failed to fetch"
Verifique a conexão com o Supabase no arquivo `.env`

## 📸 Screenshot Esperado

```
┌─────────────────────────────────────────────────────────────┐
│ [CRM - Gestão de Leads]                              [Novo] │
├─────────────────────────────────────────────────────────────┤
│ [Total: 0] [Valor: R$ 0] [Ticket: R$ 0] [Fechado: R$ 0]     │
├─────────────────────────────────────────────────────────────┤
│ [Importar da Recuperação]    [Pipeline: Vendas ▼]  [🔍]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │ NOVO LEAD     │  │ QUALIFICADO   │  │ PROPOSTA      │   │
│  │ 0 leads       │  │ 0 leads       │  │ 0 leads       │   │
│  │ Total: R$ 0   │  │ Total: R$ 0   │  │ Total: R$ 0   │   │
│  │               │  │               │  │               │   │
│  │               │  │               │  │               │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🎉 Sucesso!

Se você vir a tela do Kanban, o CRM está funcionando! 🚀
