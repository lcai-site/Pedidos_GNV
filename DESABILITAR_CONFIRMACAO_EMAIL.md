# 🔓 Desabilitar Confirmação de Email no Supabase

## 🎯 Objetivo

Permitir que usuários façam login sem precisar confirmar o email primeiro (apenas para ambiente de staging/testes).

---

## ✅ Passo a Passo (2 minutos)

### 1. Acessar Configurações de Autenticação

1. Acesse seu projeto staging: https://supabase.com/dashboard/project/vkeshyusimduiwjaijjv
2. No menu lateral, clique em **Authentication**
3. Clique em **Providers** (ou **Settings**)

### 2. Desabilitar Confirmação de Email

1. Procure a seção **"Email"** ou **"Auth Providers"**
2. Clique em **Email** para expandir
3. Encontre a opção:
   - **"Confirm email"** ou
   - **"Enable email confirmations"** ou
   - **"Require email verification"**
4. **DESMARQUE** esta opção (desabilite)
5. Clique em **Save** ou **Update**

### 3. Configuração Adicional (Opcional)

Se houver outras opções relacionadas:

- **"Enable email confirmations"** → Desmarcar
- **"Confirm email on sign up"** → Desmarcar
- **"Double confirm email changes"** → Desmarcar

---

## 🎉 Pronto!

Agora você pode:

1. Criar usuários sem precisar confirmar email
2. Fazer login imediatamente após criar o usuário
3. Testar sem interrupções

---

## 🧪 Testar

1. Volte para http://localhost:3001
2. Tente fazer login com `lrcmcho@gmail.com`
3. **Deve funcionar agora!** ✅

---

## ⚠️ IMPORTANTE

**Esta configuração é APENAS para staging!**

- ✅ **Staging:** Pode desabilitar (facilita testes)
- ❌ **Produção:** NUNCA desabilite (segurança!)

No ambiente de produção, sempre mantenha a confirmação de email habilitada para segurança.

---

## 🔄 Alternativa: Confirmar Usuários Existentes via SQL

Se preferir manter a confirmação habilitada mas confirmar usuários específicos:

```sql
-- Confirmar usuário específico
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'lrcmcho@gmail.com';
```

---

**Tempo:** ~2 minutos  
**Dificuldade:** ⭐ (Muito Fácil)
