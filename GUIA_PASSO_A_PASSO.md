# 🎯 Guia Passo a Passo - Setup de Staging (SIMPLIFICADO)

Vou te guiar em cada etapa com instruções bem claras!

---

## 📝 Passo 1: Criar Projeto Supabase Staging (15 min)

### 1.1 Acessar Supabase

1. Abra seu navegador
2. Acesse: **https://app.supabase.com**
3. Faça login com sua conta

### 1.2 Criar Novo Projeto

1. Você verá uma tela com seus projetos existentes
2. Clique no botão verde **"New Project"** (canto superior direito)
3. Preencha o formulário:

```
Organization: [Selecione sua organização]
Name: pedidos-gnv-staging
Database Password: [Crie uma senha FORTE e ANOTE!]
Region: South America (São Paulo)
Pricing Plan: Free
```

4. Clique em **"Create new project"**
5. ⏱️ Aguarde ~2 minutos (vai aparecer uma barra de progresso)

---

## 🔑 Passo 2: Copiar Credenciais (5 min)

### 2.1 Acessar Configurações de API

1. No projeto staging que acabou de criar, procure no menu lateral esquerdo
2. Clique em **⚙️ Settings** (ícone de engrenagem)
3. No submenu, clique em **API**

### 2.2 Copiar as Credenciais

Você verá duas informações importantes:

**Project URL:**
```
https://abcdefgh.supabase.co
```
👆 Copie este valor completo

**anon public (API Key):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
👆 Copie esta chave longa (começa com `eyJ`)

### 2.3 Preencher .env.development

1. Abra o arquivo `.env.development` no seu projeto
2. Substitua as linhas:

**ANTES:**
```bash
VITE_SUPABASE_URL=https://SEU-PROJETO-STAGING.supabase.co
VITE_SUPABASE_ANON_KEY=SUA-CHAVE-STAGING-AQUI
```

**DEPOIS:**
```bash
VITE_SUPABASE_URL=https://abcdefgh.supabase.co  # ← Cole sua URL aqui
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # ← Cole sua chave aqui
```

3. Salve o arquivo (`Ctrl+S`)

---

## 🗄️ Passo 3: Aplicar Migrations (20 min)

### 3.1 Acessar SQL Editor

1. No projeto staging, procure no menu lateral esquerdo
2. Clique em **🔧 SQL Editor**

### 3.2 Aplicar Cada Migration

Você vai copiar e colar cada arquivo SQL na ordem. Vou te dar a lista exata:

#### Migration 1: RBAC
1. No SQL Editor, clique em **"New query"**
2. Abra o arquivo: `supabase/migrations/001_add_rbac_to_profiles.sql`
3. Copie TODO o conteúdo (`Ctrl+A`, `Ctrl+C`)
4. Cole no SQL Editor
5. Clique em **"Run"** (ou `Ctrl+Enter`)
6. ✅ Aguarde mensagem de sucesso

#### Migration 2: RLS Policies
1. Clique em **"New query"** novamente
2. Abra: `supabase/migrations/002_fix_rls_policies.sql`
3. Copie todo o conteúdo
4. Cole no SQL Editor
5. Clique em **"Run"**
6. ✅ Aguarde sucesso

#### Migration 3: RLS Remaining Tables
1. Repita o processo com: `003_add_rls_remaining_tables.sql`

#### Migration 4: Solicitações
1. Repita com: `004b_create_solicitacoes_simple.sql`

#### Migrations 5-13: Continue a sequência
```
005_fix_profiles_rls.sql
006_ensure_profiles_rls.sql
007_create_pedidos_consolidados_view.sql
008_preparacao_consolidacao_v3.sql
009_funcao_janela_pv.sql
010_create_view_v3.sql
012_protecao_status_aprovado.sql
013_add_shipping_tracking.sql
```

**⚠️ IMPORTANTE:** Aplique na ordem! Cada migration depende da anterior.

### 3.3 Verificar Migrations

Após aplicar todas, execute esta query para verificar:

```sql
-- Verificar tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

Você deve ver estas tabelas:
- ✅ `pedidos`
- ✅ `profiles`
- ✅ `solicitacoes`
- ✅ `pedidos_consolidados_v3` (view)

---

## 👥 Passo 4: Criar Usuários de Teste (10 min)

### 4.1 Acessar Authentication

1. No menu lateral, clique em **🔐 Authentication**
2. Clique em **Users**

### 4.2 Criar Usuário Admin

1. Clique em **"Add user"** → **"Create new user"**
2. Preencha:
   ```
   Email: admin@test.com
   Password: Admin@123
   Auto Confirm User: ✅ Marque esta opção
   ```
3. Clique em **"Create user"**

### 4.3 Criar Usuário Gestor

Repita o processo:
```
Email: gestor@test.com
Password: Gestor@123
Auto Confirm User: ✅
```

### 4.4 Criar Usuário Atendente

Repita:
```
Email: atendente@test.com
Password: Atendente@123
Auto Confirm User: ✅
```

### 4.5 Configurar Roles via SQL

1. Volte para **SQL Editor**
2. Execute esta query:

```sql
-- Configurar roles dos usuários
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

Você deve ver os 3 usuários com roles configuradas!

### 4.6 Criar Pedidos de Teste (OPCIONAL)

Se quiser ter alguns pedidos para testar:

```sql
-- Inserir pedidos de teste
INSERT INTO pedidos (
  codigo_transacao, status, nome_cliente, cpf_cliente,
  email_cliente, telefone_cliente, cep, rua, numero,
  cidade, estado, valor_total, data_venda, nome_produto,
  forma_pagamento
) VALUES
  ('TEST-001', 'Aprovado', 'João Silva', '12345678901', 
   'joao@test.com', '11999999999', '01310-100', 'Av Paulista', '1000',
   'São Paulo', 'SP', 150.00, NOW() - INTERVAL '2 days', 
   'Desejo Proibido - 1 Pote', 'pix'),
   
  ('TEST-002', 'Aprovado', 'Maria Santos', '98765432100',
   'maria@test.com', '11888888888', '01310-100', 'Av Paulista', '2000',
   'São Paulo', 'SP', 300.00, NOW() - INTERVAL '1 day',
   'Bela Forma - 2 Potes', 'credit_card'),
   
  ('TEST-003', 'Pendente', 'Pedro Costa', '11122233344',
   'pedro@test.com', '11777777777', '01310-100', 'Av Paulista', '3000',
   'São Paulo', 'SP', 200.00, NOW(),
   'Bela Lumi - 1 Pote', 'boleto');
```

---

## ✅ Passo 5: Testar Localmente (5 min)

### 5.1 Parar o Servidor Atual

No terminal onde está rodando `npm run dev`:
1. Pressione `Ctrl+C`
2. Aguarde o servidor parar

### 5.2 Rodar em Modo Development

```bash
npm run dev
```

### 5.3 Verificar Logs

Você deve ver no console:

```
🌍 Ambiente: development
🔧 Debug: true
🧪 Mock APIs: false
🔌 Supabase URL: https://seu-projeto-staging.supabase.co
```

**Se aparecer erro:**
```
❌ Erro de configuração de ambiente:
  - VITE_SUPABASE_URL não está configurada
```

👉 Significa que você não preencheu o `.env.development` corretamente. Volte ao Passo 2.3!

### 5.4 Fazer Login

1. Abra o navegador em `http://localhost:3000`
2. Faça login com:
   ```
   Email: admin@test.com
   Senha: Admin@123
   ```

### 5.5 Validar Funcionalidades

- [ ] Dashboard carrega?
- [ ] Logistics mostra pedidos?
- [ ] Consegue navegar entre páginas?

**✅ Se tudo funcionar, PARABÉNS! Ambiente de staging configurado!**

---

## 🎉 Próximo Passo

Quando tudo estiver funcionando, me avise que vamos para:

**Fase 2: Modularização da Aplicação** 🚀

---

## 🆘 Problemas Comuns

### Erro: "Invalid API key"
**Solução:** Verifique se copiou a chave `anon public` correta do Supabase

### Erro: "relation does not exist"
**Solução:** Você pulou alguma migration. Revise o Passo 3.

### Não consigo fazer login
**Solução:** 
1. Verifique se criou o usuário em Authentication
2. Verifique se executou o UPDATE de roles (Passo 4.5)

### Dashboard vazio
**Solução:** Execute o SQL do Passo 4.6 para criar pedidos de teste

---

**Tempo total:** ~55 minutos  
**Dificuldade:** ⭐⭐⭐ (Média)
