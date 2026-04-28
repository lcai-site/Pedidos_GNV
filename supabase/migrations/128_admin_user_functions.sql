-- Migration para gerenciar exclusão de usuários do auth.users

CREATE OR REPLACE FUNCTION excluir_usuario(p_user_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o usuário logado é ADM
  IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'adm' THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir usuários.';
  END IF;

  -- Impede o usuário de se excluir
  IF auth.uid() = p_user_id THEN
    RAISE EXCEPTION 'Não é possível excluir o próprio usuário.';
  END IF;

  -- Deleta o usuário da tabela auth.users
  -- (O Supabase geralmente faz cascade para a tabela profiles, mas excluímos explicitamente se não houver)
  DELETE FROM auth.users WHERE id = p_user_id;
  
  RETURN true;
END;
$$;

-- Garantir permissões de execução
GRANT EXECUTE ON FUNCTION excluir_usuario(UUID) TO authenticated;
