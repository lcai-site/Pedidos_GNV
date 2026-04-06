-- ================================================================
-- MIGRATION 049: Editar Descrição + Unificar Pedidos
-- Data: 2026-02-24
-- ================================================================

-- ----------------------------------------------------------------
-- RPC 1: Atualizar apenas o descricao_pacote (edição inline)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION atualizar_descricao_pacote(p_id UUID, p_descricao TEXT)
RETURNS JSONB AS $$
BEGIN
    UPDATE pedidos_consolidados_v3
    SET descricao_pacote = p_descricao,
        foi_editado      = TRUE,
        updated_at       = NOW()
    WHERE id = p_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Pedido não encontrado');
    END IF;

    RETURN jsonb_build_object('status', 'success');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------
-- RPC 2: Unificar dois pedidos em um só
-- p_manter_id  → pedido que sobrevive (o "principal")
-- p_absorver_id → pedido que será absorvido e removido
-- p_nova_descricao → nova descrição consolidada (ex: "BF - ... + 2 DP")
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION unificar_pedidos(
    p_manter_id      UUID,
    p_absorver_id    UUID,
    p_nova_descricao TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_absorver RECORD;
BEGIN
    SELECT * INTO v_absorver FROM pedidos_consolidados_v3 WHERE id = p_absorver_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Pedido a absorver não encontrado');
    END IF;

    -- Atualizar o pedido principal: mesclar filhos, códigos e nova descrição
    UPDATE pedidos_consolidados_v3
    SET
        descricao_pacote   = p_nova_descricao,
        -- Incorporar todos os códigos do pedido absorvido
        codigos_filhos     = array(
                                SELECT DISTINCT unnest(
                                    COALESCE(codigos_filhos, '{}') ||
                                    COALESCE(v_absorver.codigos_filhos, '{}') ||
                                    ARRAY[v_absorver.codigo_transacao]::TEXT[]
                                )
                             ),
        codigos_agrupados  = array(
                                SELECT DISTINCT unnest(
                                    COALESCE(codigos_agrupados, '{}') ||
                                    COALESCE(v_absorver.codigos_agrupados, '{}')
                                )
                             ),
        quantidade_pedidos = quantidade_pedidos + v_absorver.quantidade_pedidos,
        -- foi_editado=TRUE protege da re-consolidação automática futura
        foi_editado        = TRUE,
        updated_at         = NOW()
    WHERE id = p_manter_id;

    -- Remover o pedido absorvido
    DELETE FROM pedidos_consolidados_v3 WHERE id = p_absorver_id;

    RETURN jsonb_build_object(
        'status',  'success',
        'message', 'Pedidos unificados com sucesso'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissões
GRANT EXECUTE ON FUNCTION atualizar_descricao_pacote(UUID, TEXT)           TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION unificar_pedidos(UUID, UUID, TEXT)               TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
SELECT 'Migration 049: atualizar_descricao_pacote e unificar_pedidos criadas!' AS resultado;
