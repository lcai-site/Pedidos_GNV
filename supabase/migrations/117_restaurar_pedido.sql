-- ================================================================
-- MIGRATION 117: Restaurar Pedidos Excluídos
-- ================================================================

CREATE OR REPLACE FUNCTION restaurar_pedido_logistica(p_pedido_id UUID)
RETURNS JSONB AS $$
BEGIN
    UPDATE pedidos_consolidados_v3
    SET 
        status_aprovacao = 'Aprovado',
        status_envio     = 'pronto', -- Garante que volta para a aba "Prontos"
        motivo_cancelamento = NULL,
        foi_editado      = TRUE,
        updated_at       = NOW()
    WHERE id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Pedido não encontrado');
    END IF;

    RETURN jsonb_build_object('status', 'success', 'message', 'Pedido restaurado com sucesso');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION restaurar_pedido_logistica(UUID) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
SELECT 'Migration 117: Função restaurar_pedido_logistica criada!' AS resultado;
