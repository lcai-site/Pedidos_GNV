-- Função para voltar pedidos de ENVIADOS para ENVIOS (remover data_postagem)
CREATE OR REPLACE FUNCTION voltar_pedidos_para_envios(
    p_pedido_ids UUID[]
)
RETURNS jsonb AS $$
DECLARE
    v_atualizados INTEGER := 0;
BEGIN
    WITH updated AS (
        UPDATE pedidos_consolidados_v3
        SET 
            data_postagem = NULL,
            status_envio = 'Etiquetado',  -- Volta para etiquetado (não enviado ainda)
            updated_at = NOW()
        WHERE id = ANY(p_pedido_ids)
          AND data_postagem IS NOT NULL  -- Só atualiza se tiver data_postagem
        RETURNING id
    )
    SELECT COUNT(*) INTO v_atualizados FROM updated;
    
    RETURN jsonb_build_object(
        'success', true,
        'atualizados', v_atualizados,
        'message', format('%s pedido(s) voltaram para ENVIOS', v_atualizados)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissão
GRANT EXECUTE ON FUNCTION voltar_pedidos_para_envios(UUID[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
