-- Função para resetar múltiplas etiquetas em massa
CREATE OR REPLACE FUNCTION resetar_etiquetas_em_massa(
    p_pedido_ids UUID[]
)
RETURNS jsonb AS $$
DECLARE
    v_removidos INTEGER := 0;
    v_pedido_id UUID;
BEGIN
    -- Loop pelos pedidos e remove etiqueta de cada um
    FOREACH v_pedido_id IN ARRAY p_pedido_ids
    LOOP
        UPDATE pedidos_consolidados_v3
        SET 
            codigo_rastreio = NULL,
            status_envio = 'Pendente',
            logistica_etiqueta_url = NULL,
            logistica_provider = NULL,
            logistica_servico = NULL,
            logistica_valor = NULL,
            tipo_envio = NULL,
            valor_frete = NULL,
            force_remover_etiqueta = TRUE,
            updated_at = NOW()
        WHERE id = v_pedido_id
          AND codigo_rastreio IS NOT NULL;
        
        IF FOUND THEN
            v_removidos := v_removidos + 1;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'removidos', v_removidos,
        'message', format('%s etiqueta(s) removida(s) com sucesso', v_removidos)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissão
GRANT EXECUTE ON FUNCTION resetar_etiquetas_em_massa(UUID[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
