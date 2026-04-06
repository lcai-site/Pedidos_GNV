-- Função para marcar múltiplos pedidos como postados em uma única operação
CREATE OR REPLACE FUNCTION marcar_pedidos_postados_em_massa(
    p_pedido_ids UUID[]
)
RETURNS jsonb AS $$
DECLARE
    v_atualizados INTEGER := 0;
    v_nao_encontrados INTEGER := 0;
BEGIN
    -- Atualizar todos os pedidos de uma vez
    WITH updated AS (
        UPDATE pedidos_consolidados_v3
        SET 
            data_postagem = NOW(),
            status_envio = 'Postado',
            updated_at = NOW()
        WHERE id = ANY(p_pedido_ids)
          AND (data_postagem IS NULL OR status_envio != 'Postado')
        RETURNING id
    )
    SELECT COUNT(*) INTO v_atualizados FROM updated;
    
    -- Contar quantos não foram encontrados/atualizados
    v_nao_encontrados := array_length(p_pedido_ids, 1) - v_atualizados;
    
    RETURN jsonb_build_object(
        'success', true,
        'atualizados', v_atualizados,
        'nao_encontrados', v_nao_encontrados,
        'total_recebidos', array_length(p_pedido_ids, 1),
        'message', format('%s pedido(s) marcado(s) como postado', v_atualizados)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissões
GRANT EXECUTE ON FUNCTION marcar_pedidos_postados_em_massa(UUID[]) TO authenticated, service_role;

-- Recarregar schema
NOTIFY pgrst, 'reload schema';
