# ✅ Script Corrigido - Pronto para Usar!

## 🎯 O que mudou?

O script anterior tentava modificar a tabela `profiles` antes de criá-la. Agora o novo script:

1. ✅ **Cria** a tabela `profiles` do zero
2. ✅ **Cria** a tabela `pedidos` do zero
3. ✅ **Cria** a tabela `solicitacoes` do zero
4. ✅ **Cria** função automática para novos usuários
5. ✅ **Popula** profiles dos usuários já criados
6. ✅ **Configura** roles (admin, gestor, atendente)
7. ✅ **Insere** pedidos de teste

---

## � Como Usar (2 minutos)

### Passo 1: Criar Usuários no Supabase

**IMPORTANTE:** Faça isso ANTES de executar o script!

1. Acesse: https://supabase.com/dashboard/project/vkeshyusimduiwjaijjv
2. **Authentication** → **Users** → **Add user**

Criar 3 usuários:

```
Email: admin@test.com
Password: Admin@123
Auto Confirm User: ✅ MARQUE
```

```
Email: gestor@test.com
Password: Gestor@123
Auto Confirm User: ✅ MARQUE
```

```
Email: atendente@test.com
Password: Atendente@123
Auto Confirm User: ✅ MARQUE
```

### Passo 2: Executar o Script

1. **SQL Editor** → **New query**
2. Abra: `supabase/SETUP_STAGING_RAPIDO.sql`
3. Copie **TODO** o conteúdo
4. Cole no SQL Editor
5. **Run** (ou `Ctrl+Enter`)

### Passo 3: Verificar Resultado

Você deve ver no final:

```
✅ TABELAS CRIADAS:
- pedidos
- profiles
- solicitacoes

✅ USUÁRIOS CONFIGURADOS:
- admin@test.com (adm)
- gestor@test.com (gestor)
- atendente@test.com (atendente)

✅ PEDIDOS DE TESTE:
- 4 pedidos criados

✅ RESUMO:
- 3 usuários
- 4 pedidos
```

### Passo 4: Fazer Login

1. Volte para http://localhost:3001
2. Login:
   ```
   Email: admin@test.com
   Senha: Admin@123
   ```

**✅ Deve funcionar agora!**

---

## 🆘 Se der erro

### "relation auth.users does not exist"
**Solução:** Você está no projeto errado. Certifique-se de estar no projeto STAGING (vkeshyusimduiwjaijjv)

### "duplicate key value violates unique constraint"
**Solução:** Normal! Significa que já existe. Pode ignorar.

### Ainda não consigo fazer login
**Solução:** 
1. Verifique se criou os 3 usuários em Authentication
2. Execute o script novamente
3. Limpe o cache do navegador (Ctrl+Shift+Delete)

---

**Tempo:** ~2 minutos  
**Dificuldade:** ⭐ (Muito Fácil)
