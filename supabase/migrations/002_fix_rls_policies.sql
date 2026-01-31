-- =====================================================
-- DIAGNÓSTICO E CORREÇÃO: Erro 500 na tabela profiles
-- =====================================================

-- PASSO 1: Verificar estrutura atual da tabela
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- PASSO 2: Verificar políticas RLS existentes
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'profiles';

-- PASSO 3: Desabilitar RLS temporariamente para diagnóstico
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- PASSO 4: Tentar fazer login novamente
-- (Volte para o app e tente fazer login)
-- Se funcionar, o problema são as políticas RLS

-- PASSO 5: Recriar políticas RLS corretamente
-- Primeiro, remover todas as políticas existentes
DROP POLICY IF EXISTS "Usuários podem ver próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Gestores e ADMs veem todos perfis" ON profiles;
DROP POLICY IF EXISTS "Apenas ADM modifica roles" ON profiles;
DROP POLICY IF EXISTS "Apenas ADM pode criar usuários" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- PASSO 6: Criar políticas RLS simplificadas
-- Permitir que usuários autenticados vejam e criem seus próprios perfis
CREATE POLICY "Enable read access for authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on id"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- PASSO 7: Reabilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- PASSO 8: Verificar se as políticas foram criadas
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles';

-- =====================================================
-- TESTE: Execute esta query para verificar se consegue ler
-- =====================================================
SELECT * FROM profiles LIMIT 5;
