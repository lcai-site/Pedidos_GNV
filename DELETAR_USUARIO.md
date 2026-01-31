# Como Deletar Usuário Completamente do Supabase

## 🔴 Problema

Quando você deleta um usuário apenas da tabela `profiles`, o registro de autenticação ainda existe na tabela `auth.users` do Supabase. Por isso você recebe o erro "E-mail já cadastrado".

---

## ✅ Solução

### Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **Authentication** (menu lateral)
4. Clique em **Users**
5. Encontre o usuário com email `lrcmcho@gmail.com`
6. Clique nos **3 pontinhos** (⋮) ao lado do usuário
7. Clique em **Delete user**
8. Confirme a exclusão

![Localização do menu Authentication](https://supabase.com/docs/img/auth-users.png)

---

### Opção 2: Via SQL Editor

Se preferir usar SQL, execute este comando no **SQL Editor** do Supabase:

```sql
-- 1. Deletar da tabela auth.users (sistema de autenticação)
DELETE FROM auth.users 
WHERE email = 'lrcmcho@gmail.com';

-- 2. Verificar se foi deletado
SELECT email, created_at 
FROM auth.users 
WHERE email = 'lrcmcho@gmail.com';
-- Deve retornar 0 resultados
```

> [!WARNING]
> **Atenção:** Este comando deleta permanentemente o usuário. Não há como desfazer.

---

### Opção 3: Deletar Todos os Usuários de Teste

Se você quer limpar todos os usuários e começar do zero:

```sql
-- Deletar TODOS os usuários (cuidado!)
DELETE FROM auth.users;

-- Deletar TODOS os perfis
DELETE FROM profiles;
```

> [!CAUTION]
> **CUIDADO:** Isso deleta TODOS os usuários do sistema. Use apenas em desenvolvimento.

---

## 🔄 Após Deletar

1. Volte para a página de registro
2. Tente criar a conta novamente com `lrcmcho@gmail.com`
3. Agora deve funcionar ✅

---

## 🛡️ Prevenção Futura

Para evitar esse problema, sempre delete usuários pelo **Dashboard do Supabase** na seção **Authentication > Users**, pois isso deleta automaticamente de ambas as tabelas.

---

## 📝 Estrutura de Dados

O Supabase mantém usuários em duas tabelas:

| Tabela | Função | Quando Deletar |
|--------|--------|----------------|
| `auth.users` | Sistema de autenticação (email, senha) | Via Dashboard ou SQL |
| `public.profiles` | Dados do perfil (nome, role, etc.) | Deletado automaticamente via CASCADE |

---

## ❓ Troubleshooting

### Erro: "permission denied for table auth.users"

Se você receber esse erro ao tentar deletar via SQL, use o Dashboard (Opção 1).

### Ainda aparece "E-mail já cadastrado"

1. Limpe o cache do navegador (Ctrl+Shift+Delete)
2. Tente em uma aba anônima
3. Verifique se realmente deletou do `auth.users`

---

**Status:** Aguardando você deletar o usuário via Dashboard  
**Próximo Passo:** Criar conta novamente após deletar
