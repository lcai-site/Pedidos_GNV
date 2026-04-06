-- ==============================================================================
-- 118_fix_realtime_rls_mensagens.sql
-- Propósito: Corrigir a policy RLS de SELECT em crm_mensagens para que
--            o Supabase Realtime entregue eventos INSERT para usuários autenticados.
--
-- Problema anterior:
--   A policy "Ver mensagens se puder ver o atendimento" dependia de um EXISTS
--   em crm_atendimentos, mas essa tabela também tem RLS. Quando o Realtime
--   testa a policy no contexto JWT de um 'atendente', ele não consegue ver
--   tickets com status 'novo' (não atribuídos) — e a sub-query retorna vazio,
--   fazendo o evento ser DESCARTADO silenciosamente antes de chegar ao frontend.
--
-- Solução:
--   Criar função SECURITY DEFINER que lê crm_atendimentos ignorando RLS,
--   e usá-la diretamente na policy de SELECT de crm_mensagens.
--   Assim o Realtime consegue avaliar o acesso sem recursão nem descarte.
-- ==============================================================================

BEGIN;

-- ============================================================
-- HELPER FUNCTION (SECURITY DEFINER)
-- Lê crm_atendimentos ignorando RLS para verificar se o usuário
-- atual tem acesso ao ticket da mensagem.
-- Necessário porque um EXISTS normal dentro de uma policy em
-- crm_mensagens acionaria o RLS de crm_atendimentos (recursão),
-- fazendo o Realtime descartar eventos silenciosamente.
-- ============================================================
CREATE OR REPLACE FUNCTION public.usuario_pode_ver_mensagem(p_atendimento_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_responsavel UUID;
BEGIN
    v_role := get_current_user_role();

    -- ADM e Gestor veem tudo
    IF v_role IN ('adm', 'gestor') THEN
        RETURN TRUE;
    END IF;

    -- Para Atendente/Logística: verificar se o ticket está sem responsável ou é seu
    -- Esta query bypassa RLS de crm_atendimentos pois a função é SECURITY DEFINER
    SELECT responsavel_id INTO v_responsavel
    FROM public.crm_atendimentos
    WHERE id = p_atendimento_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Pode ver se o ticket não tem responsável ou se é o responsável
    RETURN (v_responsavel IS NULL OR v_responsavel = auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.usuario_pode_ver_mensagem TO authenticated;

-- ============================================================
-- 1. Remover a policy problemática (EXISTS aninhado com RLS)
-- ============================================================
DROP POLICY IF EXISTS "Ver mensagens se puder ver o atendimento" ON public.crm_mensagens;

-- ============================================================
-- 2. Nova policy usando a função SECURITY DEFINER
--    O Realtime consegue avaliar corretamente pois não há RLS
--    dentro da função
-- ============================================================
CREATE POLICY "Ver mensagens via funcao segura"
    ON public.crm_mensagens FOR SELECT
    TO authenticated
    USING (
        public.usuario_pode_ver_mensagem(crm_mensagens.atendimento_id)
    );

COMMIT;
