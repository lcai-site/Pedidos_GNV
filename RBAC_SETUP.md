# Fase 1: RBAC - Setup e Instalação

## 📋 Arquivos Criados

### Backend/Database
- `supabase/migrations/001_add_rbac_to_profiles.sql` - Migration para adicionar RBAC ao Supabase

### Frontend
- `lib/rbac/permissions.ts` - Sistema de permissões
- `lib/hooks/useAuth.ts` - Hook de autenticação e autorização
- `components/RBAC/CanAccess.tsx` - Componente para controle de acesso
- `components/RBAC/RoleGuard.tsx` - Guard para proteção de rotas

### Atualizados
- `App.tsx` - Integrado com novo sistema RBAC

---

## 🚀 Passos para Aplicar

### 1. Aplicar Migration no Supabase

**Opção A: Via Supabase Dashboard (Recomendado)**

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **SQL Editor**
4. Clique em **New Query**
5. Copie e cole o conteúdo de `supabase/migrations/001_add_rbac_to_profiles.sql`
6. Clique em **Run** (ou pressione `Ctrl+Enter`)
7. Verifique se não há erros

**Opção B: Via Supabase CLI**

```bash
# Se você tem Supabase CLI instalado
supabase db push
```

### 2. Verificar Migration

Execute estas queries no SQL Editor para verificar:

```sql
-- Verificar colunas adicionadas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles';

-- Verificar policies
SELECT policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'profiles';

-- Verificar se há pelo menos um usuário ADM
SELECT id, email, role 
FROM profiles 
WHERE role = 'adm';
```

### 3. Criar Primeiro Usuário ADM (Se Necessário)

Se não houver nenhum usuário ADM, execute:

```sql
-- Atualizar seu usuário para ADM
UPDATE profiles
SET role = 'adm',
    nome_completo = 'Seu Nome Aqui',
    ativo = true
WHERE email = 'seu-email@exemplo.com';
```

### 4. Testar o Sistema

1. Faça logout do sistema
2. Faça login novamente
3. Verifique se o sistema carrega corretamente
4. Abra o console do navegador (F12) e verifique se não há erros

---

## 🧪 Como Testar RBAC

### Teste 1: Hook useAuth

Adicione este código temporariamente em qualquer componente:

```typescript
import { useAuth } from './lib/hooks/useAuth';

function TestComponent() {
  const { profile, can, isManager } = useAuth();

  console.log('Profile:', profile);
  console.log('Can approve?', can('solicitacoes:approve'));
  console.log('Is Manager?', isManager());

  return <div>Check console</div>;
}
```

### Teste 2: Componente CanAccess

```typescript
import { CanAccess } from './components/RBAC/CanAccess';

function TestComponent() {
  return (
    <div>
      <CanAccess permission="solicitacoes:approve">
        <button>Aprovar Solicitação</button>
      </CanAccess>

      <CanAccess permission="solicitacoes:approve" fallback={<p>Sem permissão</p>}>
        <button>Aprovar</button>
      </CanAccess>
    </div>
  );
}
```

### Teste 3: RoleGuard

```typescript
import { RoleGuard } from './components/RBAC/RoleGuard';

function AdminPage() {
  return (
    <RoleGuard allowedRoles={['gestor', 'adm']}>
      <div>Conteúdo apenas para Gestores e ADMs</div>
    </RoleGuard>
  );
}
```

---

## 📝 Próximos Passos

Após confirmar que o RBAC está funcionando:

1. ✅ Criar usuários de teste com diferentes roles
2. ✅ Testar permissões em cada página
3. ✅ Implementar controle de acesso nas páginas existentes
4. ✅ Prosseguir para Fase 2: Sistema de Solicitações

---

## ⚠️ Troubleshooting

### Erro: "relation profiles does not exist"
- A tabela `profiles` precisa existir antes de rodar a migration
- Verifique se você já tem a tabela criada no Supabase

### Erro: "column already exists"
- Alguns campos já existem na tabela
- Isso é normal, a migration usa `ADD COLUMN IF NOT EXISTS`

### Erro: "permission denied"
- Você precisa estar logado como superuser no Supabase
- Use o SQL Editor do dashboard, não a API

### Usuário não consegue fazer login
- Verifique se o campo `ativo` está `true`
- Verifique se o usuário tem um `role` definido

---

## 🔐 Estrutura de Roles

| Role | Descrição | Permissões |
|------|-----------|------------|
| **atendente** | Atendimento ao cliente | Visualizar, criar solicitações, editar clientes/pedidos |
| **gestor** | Gestão da equipe | Tudo do atendente + aprovar solicitações, gerar etiquetas, gerenciar metas |
| **adm** | Administrador | Acesso completo, gerenciar usuários, configurações |

---

**Status:** ✅ Pronto para aplicar  
**Tempo estimado:** 10-15 minutos
