-- =====================================================
-- Migration: Add RBAC fields to profiles table
-- Description: Update profiles table with role-based access control fields
-- =====================================================

-- 1. Add new columns to profiles table
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS nome_completo TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'atendente' 
    CHECK (role IN ('atendente', 'gestor', 'adm')),
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS meta_mensal INTEGER,
  ADD COLUMN IF NOT EXISTS vendedora_nome TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if they exist
DROP POLICY IF EXISTS "Atendentes veem apenas próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Apenas ADM modifica roles" ON profiles;
DROP POLICY IF EXISTS "Usuários podem ver próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Gestores e ADMs veem todos perfis" ON profiles;
DROP POLICY IF EXISTS "Apenas ADM pode criar usuários" ON profiles;

-- 6. Create RLS policies

-- Policy: Atendentes só veem a si mesmos, Gestores/ADMs veem todos
CREATE POLICY "Usuários podem ver próprio perfil"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Gestores e ADMs veem todos perfis"
  ON profiles FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('gestor', 'adm'));

-- Policy: Apenas ADM pode modificar roles
CREATE POLICY "Apenas ADM modifica roles"
  ON profiles FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'adm');

-- Policy: Apenas ADM pode criar novos usuários
CREATE POLICY "Apenas ADM pode criar usuários"
  ON profiles FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'adm');

-- 7. Create index for role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_ativo ON profiles(ativo) WHERE ativo = true;

-- 8. Update existing users (if any) to have default role
UPDATE profiles
SET role = 'adm'
WHERE id = (
  SELECT id FROM profiles 
  WHERE role IS NULL 
  ORDER BY created_at 
  LIMIT 1
); -- Set first user as admin

UPDATE profiles
SET role = 'atendente'
WHERE role IS NULL;

-- =====================================================
-- Verification queries (run these to check)
-- =====================================================

-- Check if columns were added
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles';

-- Check policies
-- SELECT policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename = 'profiles';

-- Check triggers
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers 
-- WHERE event_object_table = 'profiles';
