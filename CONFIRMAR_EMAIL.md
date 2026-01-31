# 🚀 Solução Rápida - Email Not Confirmed

## 🎯 Problema

Você criou o usuário `lrcmcho@gmail.com` mas o Supabase está bloqueando porque o email não foi confirmado.

---

## ✅ Solução (2 passos - 1 minuto!)

### Passo 1: Confirmar Email no Supabase

1. No Supabase, vá em **Authentication** → **Users**
2. Encontre o usuário **lrcmcho@gmail.com**
3. Clique nos **3 pontinhos (...)** ao lado do usuário
4. Clique em **"Confirm email"** ou **"Confirm user"**

![Confirmar Email](https://i.imgur.com/example.png)

### Passo 2: Configurar como Admin (OPCIONAL)

Se quiser ser admin em vez de atendente:

1. **SQL Editor** → **New query**
2. Copie e cole:

```sql
UPDATE profiles 
SET role = 'adm', 
    nome_completo = 'Camila Camacho',
    ativo = true
WHERE email = 'lrcmcho@gmail.com';
```

3. Execute (Run)

---

## 🎉 Testar Login

1. Volte para http://localhost:3001
2. Login:
   ```
   Email: lrcmcho@gmail.com
   Senha: (sua senha)
   ```

**✅ Deve funcionar agora!**

---

## 📝 Alternativa: Criar Novo Usuário com Auto-Confirm

Se preferir criar um usuário novo já confirmado:

1. **Authentication** → **Users** → **Add user**
2. Preencher:
   ```
   Email: admin@gnv.com
   Password: Admin@123
   Auto Confirm User: ✅ MARQUE ESTA OPÇÃO
   ```
3. Executar SQL:
   ```sql
   UPDATE profiles 
   SET role = 'adm', 
       nome_completo = 'Admin GNV',
       ativo = true
   WHERE email = 'admin@gnv.com';
   ```

---

**Tempo:** ~1 minuto  
**Dificuldade:** ⭐ (Muito Fácil)
