# 🔧 Como garantir seu acesso como ADM

## Problema
Seu usuário pode não estar com o role correto (`adm`), impedindo o acesso à página de Usuários.

## Solução Rápida

### Passo 1: Execute no Supabase SQL Editor

Acesse o [Supabase Dashboard](https://app.supabase.com) → SQL Editor → New Query

Copie e cole:

```sql
-- Atualizar SEU usuário para ADM
UPDATE profiles 
SET role = 'adm', 
    ativo = true,
    nome_completo = COALESCE(nome_completo, 'Administrador')
WHERE email = 'SEU_EMAIL_AQUI';  -- <-- SUBSTITUA pelo seu email

-- Verificar se funcionou
SELECT id, email, nome_completo, role, ativo 
FROM profiles 
WHERE email = 'SEU_EMAIL_AQUI';  -- <-- SUBSTITUA pelo seu email
```

### Passo 2: Verifique o resultado

A query deve retornar algo como:
```
role: "adm"
ativo: true
```

### Passo 3: Faça logout e login novamente

1. Clique em LOGOUT no menu
2. Faça login novamente
3. Acesse a página USUÁRIOS

---

## 🎉 Nova funcionalidade: Convite por Email

Agora quando você criar um novo usuário:

1. **Não precisa mais definir senha!**
2. O sistema gera uma senha temporária automática
3. Envia um email de "redefinição de senha" para o usuário
4. O usuário clica no link e cria sua própria senha
5. Pronto! O usuário pode fazer login

### Fluxo do convite:
```
Admin cria usuário → Email enviado → Usuário define senha → Login
```

### Botão "Reenviar Convite"

Se o usuário não receber o email ou perder o link, você pode reenviar:
1. Vá na lista de usuários
2. Clique no ícone de envelope 📧 ao lado do usuário
3. O email será reenviado

---

## ⚠️ Configuração de Email no Supabase

Para que os emails sejam enviados corretamente, verifique no Supabase:

1. **Authentication** → **Email Templates**
2. O template "Reset Password" deve estar configurado
3. Opcional: Configurar SMTP próprio em **Authentication** → **SMTP Settings**

### Templates recomendados:

**Reset Password (em português):**
```html
<h2>Redefinir sua senha</h2>
<p>Olá!</p>
<p>Você foi convidado para acessar o sistema Gestão Pedidos GNV.</p>
<p>Clique no botão abaixo para criar sua senha:</p>
<a href="{{ .ConfirmationURL }}" style="padding: 10px 20px; background: #10b981; color: white; text-decoration: none; border-radius: 5px;">Criar minha senha</a>
<p>Ou copie este link: {{ .ConfirmationURL }}</p>
<p>Se você não solicitou este acesso, ignore este email.</p>
```
