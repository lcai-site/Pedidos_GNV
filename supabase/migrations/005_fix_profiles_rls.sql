-- Limpar políticas duplicadas e criar uma simples que funciona

-- Remover todas as políticas SELECT existentes
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Usuário vê próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;

-- Criar UMA política SELECT simples
CREATE POLICY "authenticated_users_read_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Verificar
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles';
