# 🧪 Setup de Ambiente de Testes (Staging)

Este guia vai te ajudar a configurar um ambiente de testes completo para o projeto Pedidos GNV.

---

## 📋 Pré-requisitos

- Conta no Supabase (gratuita)
- Node.js instalado
- Git configurado

---

## 🚀 Passo 1: Criar Projeto Supabase Staging

### 1.1 Acessar Supabase

1. Acesse [Supabase Dashboard](https://app.supabase.com)
2. Faça login com sua conta
3. Clique em **"New Project"**

### 1.2 Configurar Projeto

Preencha os campos:

- **Name:** `pedidos-gnv-staging`
- **Database Password:** Crie uma senha forte (anote em local seguro!)
- **Region:** `South America (São Paulo)` (mesma região da produção)
- **Pricing Plan:** `Free`

### 1.3 Aguardar Provisionamento

⏱️ Aguarde ~2 minutos enquanto o Supabase provisiona o banco de dados.

---

## 🔑 Passo 2: Copiar Credenciais

### 2.1 Acessar Configurações

1. No projeto staging, clique em **Settings** (ícone de engrenagem)
2. Vá em **API**

### 2.2 Copiar Credenciais

Você verá duas informações importantes:

- **Project URL** (exemplo: `https://abcdefgh.supabase.co`)
- **anon/public key** (uma string longa começando com `eyJ...`)

### 2.3 Atualizar `.env.development`

Abra o arquivo `.env.development` e preencha:

```bash
VITE_SUPABASE_URL=https://SEU-PROJETO-STAGING.supabase.co
VITE_SUPABASE_ANON_KEY=SUA-CHAVE-STAGING-AQUI
```

**Substitua** pelos valores copiados do Supabase.

---

## 🗄️ Passo 3: Aplicar Migrations

### 3.1 Via Supabase Dashboard (Recomendado)

1. No projeto staging, vá em **SQL Editor**
2. Clique em **New Query**
3. Para cada arquivo em `supabase/migrations/`, na ordem:
   - Abra o arquivo localmente
   - Copie todo o conteúdo
   - Cole no SQL Editor
   - Clique em **Run** (ou `Ctrl+Enter`)
   - Aguarde confirmação de sucesso

**Ordem das migrations:**
```
001_add_rbac_to_profiles.sql
002_fix_rls_policies.sql
003_add_rls_remaining_tables.sql
004b_create_solicitacoes_simple.sql
005_fix_profiles_rls.sql
006_ensure_profiles_rls.sql
007_create_pedidos_consolidados_view.sql
008_preparacao_consolidacao_v3.sql
009_funcao_janela_pv.sql
010_create_view_v3.sql
012_protecao_status_aprovado.sql
013_add_shipping_tracking.sql
```

### 3.2 Verificar Migrations

Execute esta query para verificar:

```sql
-- Verificar tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Verificar views
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public';
```

Você deve ver:
- Tabelas: `pedidos`, `profiles`, `solicitacoes`, etc.
- Views: `pedidos_consolidados_v3`

---

## 👥 Passo 4: Criar Usuários de Teste

### 4.1 Acessar Authentication

1. No Supabase, vá em **Authentication** → **Users**
2. Clique em **Add User** → **Create new user**

### 4.2 Criar 3 Usuários

**Usuário 1 - Admin:**
- Email: `admin@test.com`
- Password: `Admin@123` (anote!)
- Auto Confirm User: ✅ Sim

**Usuário 2 - Gestor:**
- Email: `gestor@test.com`
- Password: `Gestor@123`
- Auto Confirm User: ✅ Sim

**Usuário 3 - Atendente:**
- Email: `atendente@test.com`
- Password: `Atendente@123`
- Auto Confirm User: ✅ Sim

### 4.3 Configurar Roles via SQL

Execute no SQL Editor:

```sql
-- Atualizar roles dos usuários de teste
UPDATE profiles 
SET role = 'adm', 
    nome_completo = 'Admin Teste',
    ativo = true
WHERE email = 'admin@test.com';

UPDATE profiles 
SET role = 'gestor', 
    nome_completo = 'Gestor Teste',
    ativo = true
WHERE email = 'gestor@test.com';

UPDATE profiles 
SET role = 'atendente', 
    nome_completo = 'Atendente Teste',
    ativo = true
WHERE email = 'atendente@test.com';

-- Verificar
SELECT email, role, nome_completo, ativo 
FROM profiles;
```

---

## 🌱 Passo 5: Popular com Dados de Teste (Opcional)

### 5.1 Dados Mínimos via SQL

Execute no SQL Editor para criar alguns pedidos de teste:

```sql
-- Inserir pedidos de teste
INSERT INTO pedidos (
  codigo_transacao,
  status,
  nome_cliente,
  cpf_cliente,
  email_cliente,
  telefone_cliente,
  cep,
  rua,
  numero,
  cidade,
  estado,
  valor_total,
  data_venda,
  nome_produto,
  forma_pagamento
) VALUES
  ('TEST-001', 'Aprovado', 'João Silva', '12345678901', 'joao@test.com', '11999999999', '01310-100', 'Av Paulista', '1000', 'São Paulo', 'SP', 150.00, NOW() - INTERVAL '2 days', 'Desejo Proibido - 1 Pote', 'pix'),
  ('TEST-002', 'Aprovado', 'Maria Santos', '98765432100', 'maria@test.com', '11888888888', '01310-100', 'Av Paulista', '2000', 'São Paulo', 'SP', 300.00, NOW() - INTERVAL '1 day', 'Bela Forma - 2 Potes', 'credit_card'),
  ('TEST-003', 'Pendente', 'Pedro Costa', '11122233344', 'pedro@test.com', '11777777777', '01310-100', 'Av Paulista', '3000', 'São Paulo', 'SP', 200.00, NOW(), 'Bela Lumi - 1 Pote', 'boleto'),
  ('TEST-004', 'Aprovado', 'Ana Paula', '55566677788', 'ana@test.com', '11666666666', '04567-000', 'Rua Augusta', '500', 'São Paulo', 'SP', 450.00, NOW() - INTERVAL '3 days', 'Desejo Proibido - 3 Potes', 'pix');

-- Verificar pedidos criados
SELECT * FROM pedidos ORDER BY data_venda DESC;
```

---

## ✅ Passo 6: Testar Localmente

### 6.1 Rodar em Modo Desenvolvimento

```bash
# Parar o servidor atual (Ctrl+C)
# Rodar em modo development (usa .env.development)
npm run dev
```

### 6.2 Fazer Login

1. Abra `http://localhost:3000`
2. Faça login com:
   - **Email:** `admin@test.com`
   - **Senha:** `Admin@123`

### 6.3 Validar Funcionalidades

- [ ] Dashboard carrega métricas
- [ ] Logistics mostra pedidos de teste
- [ ] Consegue editar pedidos
- [ ] RBAC funciona (admin vê tudo)

---

## 🔄 Workflow de Desenvolvimento

Agora você tem dois ambientes:

### Desenvolvimento/Staging
```bash
npm run dev              # Roda localmente com staging
npm run build:staging    # Build para staging
```

### Produção
```bash
npm run dev:prod         # Roda localmente com produção (cuidado!)
npm run build            # Build para produção
```

---

## 🎯 Próximos Passos

Após validar que o ambiente de staging está funcionando:

1. ✅ Ambiente de testes configurado
2. ⏭️ Próximo: Modularizar a aplicação
3. ⏭️ Depois: Implementar testes automatizados

---

## ❓ Troubleshooting

### Erro: "Invalid API key"

**Solução:** Verifique se copiou a chave correta do Supabase. Deve começar com `eyJ...`

### Erro: "relation does not exist"

**Solução:** Você esqueceu de aplicar alguma migration. Revise o Passo 3.

### Não consigo fazer login

**Solução:** 
1. Verifique se o usuário foi criado em Authentication
2. Verifique se o role foi configurado na tabela `profiles`
3. Verifique se `ativo = true`

### Pedidos não aparecem

**Solução:** Execute a query do Passo 5.1 para criar pedidos de teste.

---

## 📞 Suporte

Se encontrar problemas, verifique:
1. Console do navegador (F12) para erros
2. Network tab para ver requisições falhando
3. Supabase Logs (no dashboard)

---

**Status:** ✅ Pronto para usar  
**Tempo estimado:** 30-45 minutos  
**Última atualização:** 2026-01-28
