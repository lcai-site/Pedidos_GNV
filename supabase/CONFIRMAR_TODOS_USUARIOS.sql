-- ================================================================
-- DESATIVAR VERIFICAÇÃO DE EMAIL (VIA SQL)
-- ================================================================
-- IMPORTANTE: A verificação de email é uma configuração do Supabase
-- que fica no painel de controle, NÃO no banco de dados.
-- 
-- Este script FAZ O MESMO EFEITO: confirma todos os usuários
-- automaticamente, permitindo que façam login sem verificar email.
-- ================================================================

-- ================================================================
-- PASSO 1: Confirmar TODOS os usuários existentes
-- ================================================================
UPDATE auth.users
SET 
  email_confirmed_at = NOW()
  -- NOTA: confirmed_at é gerado automaticamente, não precisa atualizar
WHERE email_confirmed_at IS NULL;

-- ================================================================
-- PASSO 2: Verificar usuários confirmados
-- ================================================================
SELECT 
  email,
  created_at,
  email_confirmed_at,
  confirmed_at,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✅ Confirmado - Pode fazer login'
    ELSE '❌ Não confirmado - Bloqueado'
  END as status
FROM auth.users
ORDER BY created_at DESC;

-- ================================================================
-- PASSO 3: Verificar se seu usuário foi confirmado
-- ================================================================
SELECT 
  '🔍 Verificando seu usuário:' as info,
  email,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✅ CONFIRMADO! Você pode fazer login agora!'
    ELSE '❌ ERRO: Ainda não confirmado'
  END as status
FROM auth.users
WHERE email = 'lrcmcho@gmail.com';

-- ================================================================
-- BÔNUS: Criar função para auto-confirmar novos usuários
-- ================================================================
-- Esta função confirma automaticamente qualquer usuário novo que for criado

CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Confirmar automaticamente (confirmed_at é gerado automaticamente)
  NEW.email_confirmed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para auto-confirmar
DROP TRIGGER IF EXISTS auto_confirm_new_users ON auth.users;
CREATE TRIGGER auto_confirm_new_users
  BEFORE INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.auto_confirm_user();

-- ================================================================
-- ✅ PRONTO!
-- ================================================================
-- O que este script fez:
-- 
-- 1. ✅ Confirmou TODOS os usuários existentes (incluindo você!)
-- 2. ✅ Criou trigger para auto-confirmar novos usuários
-- 3. ✅ Agora você pode fazer login sem verificar email!
--
-- Teste agora:
-- 1. Volte para http://localhost:3001
-- 2. Faça login com: lrcmcho@gmail.com
-- 3. Deve funcionar! 🎉
-- ================================================================

-- ================================================================
-- VERIFICAÇÃO FINAL
-- ================================================================
SELECT 
  '📊 RESUMO FINAL:' as info,
  COUNT(*) as total_usuarios,
  COUNT(*) FILTER (WHERE email_confirmed_at IS NOT NULL) as usuarios_confirmados,
  COUNT(*) FILTER (WHERE email_confirmed_at IS NULL) as usuarios_pendentes
FROM auth.users;
