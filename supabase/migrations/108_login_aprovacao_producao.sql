-- ================================================================
-- MIGRATION 108: Login & Aprovação de Usuários para Produção
-- ================================================================
-- PROBLEMA RESOLVIDO:
--   1. RLS recursiva na tabela profiles causava erro 500
--   2. Qualquer pessoa podia criar conta e entrar no sistema
--   3. Não havia trigger para criar perfil automaticamente ao sign-up
--
-- SOLUÇÃO:
--   1. Função helper get_current_user_role() SECURITY DEFINER
--      → evita recursão nas políticas RLS
--   2. Trigger on_auth_user_created → cria perfil com ativo=FALSE
--   3. Função aprovar_usuario() para ADM ativar contas
--   4. Políticas RLS reescritas sem recursão
-- ================================================================

-- ----------------------------------------------------------------
-- PARTE 1: Função helper para verificar role sem recursão RLS
-- Usa SECURITY DEFINER para acessar profiles ignorando RLS
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_current_user_role() TO authenticated;

-- ----------------------------------------------------------------
-- PARTE 2: Políticas RLS na tabela profiles (sem recursão)
-- ----------------------------------------------------------------
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Remover políticas antigas que causavam recursão
DROP POLICY IF EXISTS "authenticated_read_all_profiles"   ON profiles;
DROP POLICY IF EXISTS "adm_can_insert_users"              ON profiles;
DROP POLICY IF EXISTS "adm_can_update_any_user"           ON profiles;
DROP POLICY IF EXISTS "adm_can_delete_users"              ON profiles;
DROP POLICY IF EXISTS "authenticated_read_all"            ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Usuário vê próprio perfil"         ON profiles;
DROP POLICY IF EXISTS "Users can read all profiles"       ON profiles;
DROP POLICY IF EXISTS "authenticated_users_read_profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"      ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile"          ON profiles;
DROP POLICY IF EXISTS "Apenas ADM modifica roles"         ON profiles;
DROP POLICY IF EXISTS "Gestores e ADMs veem todos perfis" ON profiles;
DROP POLICY IF EXISTS "Apenas ADM pode criar usuários"    ON profiles;
DROP POLICY IF EXISTS "Apenas ADM pode deletar usuários"  ON profiles;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: todos os usuários autenticados podem ver todos os perfis
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: qualquer um pode inserir seu próprio perfil (necessário para sign-up)
-- O campo ativo=FALSE é setado pelo trigger ou pelo código de sign-up
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- UPDATE: usuário atualiza o próprio, ADM atualiza qualquer um
-- Usa get_current_user_role() para evitar recursão
CREATE POLICY "profiles_update"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR get_current_user_role() = 'adm')
  WITH CHECK (auth.uid() = id OR get_current_user_role() = 'adm');

-- DELETE: apenas ADM
CREATE POLICY "profiles_delete"
  ON profiles FOR DELETE
  TO authenticated
  USING (get_current_user_role() = 'adm');

-- ----------------------------------------------------------------
-- PARTE 3: Trigger — criar perfil automaticamente ao sign-up
-- O perfil é criado com ativo=FALSE: ADM precisa aprovar
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, role, ativo, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    'atendente',   -- role padrão mais restritiva
    FALSE,         -- bloqueado até aprovação do ADM
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- se já existir (upsert do frontend), não sobrescrever
  RETURN NEW;
END;
$$;

-- Remover trigger anterior se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar trigger no evento de novo usuário no Auth
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ----------------------------------------------------------------
-- PARTE 4: Função para ADM aprovar usuário (ativar conta)
-- Chamada via supabase.rpc('aprovar_usuario', { p_user_id: '...' })
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION aprovar_usuario(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Apenas ADM pode aprovar
  IF get_current_user_role() != 'adm' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Sem permissão.');
  END IF;

  UPDATE profiles
  SET ativo = TRUE, updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Usuário não encontrado.');
  END IF;

  RETURN jsonb_build_object('status', 'success', 'message', 'Usuário aprovado.');
END;
$$;

GRANT EXECUTE ON FUNCTION aprovar_usuario(UUID) TO authenticated;

-- ----------------------------------------------------------------
-- PARTE 5: Garantir que todos os usuários ADM existentes
-- continuem com ativo=TRUE (proteção contra lock-out acidental)
-- ----------------------------------------------------------------
UPDATE profiles SET ativo = TRUE WHERE role = 'adm' AND ativo IS DISTINCT FROM TRUE;

-- Verificação final
SELECT
  COUNT(*) FILTER (WHERE ativo = TRUE)  AS ativos,
  COUNT(*) FILTER (WHERE ativo = FALSE) AS pendentes,
  COUNT(*) FILTER (WHERE role = 'adm')  AS admins
FROM profiles;
