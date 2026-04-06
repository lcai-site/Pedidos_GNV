-- ================================================================
-- MIGRATION: Remove flag foi_editado ao marcar PV como realizado
-- A flag foi_editado só deve ser marcada quando houver edição real
-- de dados do cliente ou produto, não por mudança de aba
-- ================================================================

-- Atualiza a function marcar_pv_realizado para NÃO definir foi_editado
CREATE OR REPLACE FUNCTION marcar_pv_realizado(p_order_id UUID)
RETURNS jsonb AS $$
BEGIN
    UPDATE pedidos_consolidados_v3
    SET pv_realizado = TRUE,
        pv_realizado_at = NOW(),
        dia_despacho = CURRENT_DATE, -- Libera imediatamente para a aba ENVIOS
        -- foi_editado = TRUE  -- REMOVIDO: não deve marcar como editado apenas por mudança de aba
        updated_at = NOW()
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'Pedido não encontrado: ' || p_order_id
        );
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'PV marcado como realizado'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recarregar schema
NOTIFY pgrst, 'reload schema';

SELECT 'Migration: foi_editado removido da function marcar_pv_realizado!' as resultado;
