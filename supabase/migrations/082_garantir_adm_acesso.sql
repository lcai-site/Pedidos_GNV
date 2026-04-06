-- ================================================================
-- MIGRATION: Garantir acesso ADM ao usuário principal
-- ================================================================

-- Atualizar o primeiro usuário (ou usuário específico) para ADM
-- Substitua 'seu-email@exemplo.com' pelo email do usuário que deve ser ADM

DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Tentar encontrar usuário pelo email (atualize o email abaixo)
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'seu-email@exemplo.com';
    
    -- Se não encontrou por email, pega o primeiro usuário criado
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id 
        FROM auth.users 
        ORDER BY created_at 
        LIMIT 1;
    END IF;
    
    -- Atualizar para ADM
    IF v_user_id IS NOT NULL THEN
        UPDATE profiles 
        SET role = 'adm',
            ativo = true,
            nome_completo = COALESCE(nome_completo, 'Administrador')
        WHERE id = v_user_id;
        
        RAISE NOTICE 'Usuário % atualizado para ADM', v_user_id;
    ELSE
        RAISE NOTICE 'Nenhum usuário encontrado';
    END IF;
END $$;

-- Comando manual (execute no SQL Editor do Supabase):
-- UPDATE profiles SET role = 'adm', ativo = true WHERE email = 'SEU_EMAIL_AQUI';

-- Verificar usuários ADM existentes
SELECT id, email, nome_completo, role, ativo 
FROM profiles 
WHERE role = 'adm';
