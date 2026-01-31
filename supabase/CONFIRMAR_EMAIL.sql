-- ================================================================
-- SCRIPT RÁPIDO: Confirmar Email e Configurar como Admin
-- ================================================================
-- Execute este script no SQL Editor do Supabase Staging
-- ================================================================

-- 1. Atualizar seu usuário para admin
UPDATE profiles 
SET role = 'adm', 
    nome_completo = 'Camila Camacho',
    ativo = true
WHERE email = 'lrcmcho@gmail.com';

-- 2. Verificar se funcionou
SELECT email, role, nome_completo, ativo 
FROM profiles
WHERE email = 'lrcmcho@gmail.com';

-- ================================================================
-- ✅ PRONTO!
-- ================================================================
-- Agora você precisa CONFIRMAR O EMAIL no Supabase:
-- 1. Authentication → Users
-- 2. Encontre lrcmcho@gmail.com
-- 3. Clique nos 3 pontinhos (...)
-- 4. Clique em "Confirm email"
-- ================================================================
