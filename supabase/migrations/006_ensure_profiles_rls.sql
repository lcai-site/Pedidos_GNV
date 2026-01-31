-- Verificar e garantir que as políticas RLS da tabela profiles estão corretas
-- Esta migração garante que usuários autenticados possam ler perfis

-- 1. Remover políticas SELECT duplicadas ou conflitantes
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Usuário vê próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "authenticated_users_read_profiles" ON profiles;

-- 2. Criar política SELECT simples e funcional
CREATE POLICY "authenticated_users_read_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- 3. Garantir que usuários possam atualizar seu próprio perfil
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Usuário atualiza próprio perfil" ON profiles;

CREATE POLICY "users_update_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Verificar políticas aplicadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;
