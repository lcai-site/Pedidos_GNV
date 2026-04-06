-- =====================================================
-- CORREÇÃO: Permissões para Gerenciar Usuários
-- Resolve: Gestor/ADM não consegue editar/adicionar usuários
-- =====================================================

-- 1. Desabilitar RLS temporariamente para garantir acesso
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. Remover TODAS as políticas existentes de profiles
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Usuário vê próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "authenticated_users_read_profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Usuário atualiza próprio perfil" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "Atendentes veem apenas próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Apenas ADM modifica roles" ON profiles;
DROP POLICY IF EXISTS "Usuários podem ver próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Gestores e ADMs veem todos perfis" ON profiles;
DROP POLICY IF EXISTS "Apenas ADM pode criar usuários" ON profiles;
DROP POLICY IF EXISTS "Apenas ADM pode deletar usuários" ON profiles;

-- 3. Reabilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Criar política SELECT - Todos autenticados podem ver todos os perfis
CREATE POLICY "authenticated_read_all_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- 5. Criar política INSERT - Apenas ADM pode inserir
CREATE POLICY "adm_can_insert_users"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'adm');

-- 6. Criar política UPDATE - ADM pode atualizar qualquer um, usuário pode atualizar próprio
CREATE POLICY "adm_can_update_any_user"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'adm'
    OR auth.uid() = id
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'adm'
    OR auth.uid() = id
  );

-- 7. Criar política DELETE - Apenas ADM pode deletar
CREATE POLICY "adm_can_delete_users"
  ON profiles FOR DELETE
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'adm');

-- 8. Verificar políticas aplicadas
SELECT 
  policyname,
  cmd,
  permissive,
  roles::text
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- 9. Verificar seu usuário atual
SELECT 
  id,
  email,
  nome_completo,
  role,
  ativo
FROM profiles
WHERE email = 'autosporte@gmail.com';
