-- ================================================================
-- MIGRATION 036: PÓS-VENDA REALIZADO
-- Adiciona colunas para marcar pedidos como PV realizado
-- e function RPC para a vendedora usar
-- ================================================================

-- 1. Adicionar colunas
ALTER TABLE pedidos_consolidados_v3
  ADD COLUMN IF NOT EXISTS pv_realizado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pv_realizado_at TIMESTAMPTZ;

-- 2. Índice para consultas rápidas por PV
CREATE INDEX IF NOT EXISTS idx_consolidados_pv_realizado
  ON pedidos_consolidados_v3 (pv_realizado) WHERE pv_realizado = TRUE;

-- 3. Function RPC: marcar PV como realizado
CREATE OR REPLACE FUNCTION marcar_pv_realizado(p_order_id UUID)
RETURNS jsonb AS $$
BEGIN
    UPDATE pedidos_consolidados_v3
    SET pv_realizado = TRUE,
        pv_realizado_at = NOW(),
        dia_despacho = CURRENT_DATE, -- Libera imediatamente para a aba ENVIOS
        foi_editado = TRUE,          -- BLOQUEIA re-consolidar (preserva dia_despacho manual)
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

-- 4. Function RPC: desmarcar PV (reverter)
CREATE OR REPLACE FUNCTION desmarcar_pv_realizado(p_order_id UUID)
RETURNS jsonb AS $$
BEGIN
    UPDATE pedidos_consolidados_v3
    SET pv_realizado = FALSE,
        pv_realizado_at = NULL,
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
        'message', 'PV desmarcado'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Permissões
GRANT EXECUTE ON FUNCTION marcar_pv_realizado(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION desmarcar_pv_realizado(UUID) TO anon, authenticated, service_role;

-- 6. Recarregar schema
NOTIFY pgrst, 'reload schema';

SELECT 'Migration 036: PV Realizado - colunas e functions criadas com sucesso!' as resultado;
