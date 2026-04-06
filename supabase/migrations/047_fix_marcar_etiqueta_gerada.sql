-- ================================================================
-- MIGRATION 047: FIX Marcar Etiqueta Gerada em Produção
-- Data: 2026-02-24
-- Problema: atualização direta via cliente falha silenciosamente em
--           produção por possível problema de permissão/RLS.
-- Solução: RPC com SECURITY DEFINER para bypass seguro do RLS.
-- ================================================================

-- 1. RPC: marcar pedido(s) como Etiqueta Gerada (manual)
CREATE OR REPLACE FUNCTION marcar_etiqueta_gerada(p_ids UUID[])
RETURNS JSONB AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE pedidos_consolidados_v3
    SET
        codigo_rastreio = 'MANUAL',
        status_envio    = 'Etiqueta Manual',
        updated_at      = NOW()
    WHERE id = ANY(p_ids);

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'status',     'success',
        'atualizados', v_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'error',
        'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC: desfazer etiqueta (reverter para Pendente)
CREATE OR REPLACE FUNCTION desfazer_etiqueta_gerada(p_ids UUID[])
RETURNS JSONB AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE pedidos_consolidados_v3
    SET
        codigo_rastreio = NULL,
        status_envio    = 'Pendente',
        updated_at      = NOW()
    WHERE id = ANY(p_ids);

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'status',     'success',
        'atualizados', v_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'error',
        'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Garantir permissões de UPDATE na tabela (caso a policy UPDATE falte em produção)
DO $$
BEGIN
    -- Garantir policy UPDATE para authenticated
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'pedidos_consolidados_v3'
          AND policyname = 'allow_update_auth'
    ) THEN
        CREATE POLICY allow_update_auth
            ON public.pedidos_consolidados_v3
            FOR UPDATE TO authenticated
            USING (true) WITH CHECK (true);
        RAISE NOTICE 'Policy allow_update_auth criada';
    ELSE
        RAISE NOTICE 'Policy allow_update_auth já existe — OK';
    END IF;

    -- Garantir policy UPDATE para anon (webhook / service)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'pedidos_consolidados_v3'
          AND policyname = 'allow_update_anon'
    ) THEN
        CREATE POLICY allow_update_anon
            ON public.pedidos_consolidados_v3
            FOR UPDATE TO anon
            USING (true) WITH CHECK (true);
        RAISE NOTICE 'Policy allow_update_anon criada';
    ELSE
        RAISE NOTICE 'Policy allow_update_anon já existe — OK';
    END IF;
END $$;

-- 4. GRANT nas funções
GRANT EXECUTE ON FUNCTION marcar_etiqueta_gerada(UUID[])   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION desfazer_etiqueta_gerada(UUID[]) TO anon, authenticated, service_role;

-- 5. GRANT DML na tabela (idempotente)
GRANT SELECT, INSERT, UPDATE, DELETE ON pedidos_consolidados_v3 TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
SELECT 'Migration 047: marcar_etiqueta_gerada e desfazer_etiqueta_gerada criadas com sucesso!' AS resultado;
