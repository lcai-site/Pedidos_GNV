-- ================================================================
-- MIGRAÇÃO: Adicionar campos para controle de frete e envio
-- ================================================================

-- 1. Adicionar novas colunas na tabela pedidos_consolidados_v3
ALTER TABLE pedidos_consolidados_v3 
ADD COLUMN IF NOT EXISTS tipo_envio TEXT, -- 'Mini Envios', 'PAC', 'SEDEX'
ADD COLUMN IF NOT EXISTS valor_frete DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS data_postagem TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cotacao_frete JSONB; -- Armazena as 3 opções de cotação

-- 2. Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_pedidos_consolidados_v3_tipo_envio 
ON pedidos_consolidados_v3(tipo_envio) 
WHERE tipo_envio IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_consolidados_v3_data_postagem 
ON pedidos_consolidados_v3(data_postagem) 
WHERE data_postagem IS NOT NULL;

-- 3. Atualizar a função de consolidação para incluir os novos campos
-- (A função já preserva dados existentes, então só precisamos garantir que novos campos não sejam sobrescritos)

-- 4. Função para marcar pedido como postado (move de ETIQUETADOS → ENVIADOS)
CREATE OR REPLACE FUNCTION marcar_pedido_postado(
    p_pedido_id UUID,
    p_codigo_rastreio TEXT DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_pedido RECORD;
    v_codigo TEXT;
BEGIN
    -- Buscar pedido
    SELECT * INTO v_pedido 
    FROM pedidos_consolidados_v3 
    WHERE id = p_pedido_id;
    
    IF v_pedido IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
    END IF;
    
    -- Usar código fornecido ou o existente
    v_codigo := COALESCE(p_codigo_rastreio, v_pedido.codigo_rastreio);
    
    IF v_codigo IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido não possui código de rastreio');
    END IF;
    
    -- Atualizar para postado
    UPDATE pedidos_consolidados_v3
    SET 
        data_postagem = NOW(),
        status_envio = 'Postado',
        codigo_rastreio = v_codigo,
        updated_at = NOW()
    WHERE id = p_pedido_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Pedido marcado como postado',
        'data_postagem', NOW(),
        'codigo_rastreio', v_codigo
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Função para salvar cotação de frete
CREATE OR REPLACE FUNCTION salvar_cotacao_frete(
    p_pedido_id UUID,
    p_cotacao JSONB, -- { mini_envios: 15.50, pac: 23.90, sedex: 45.00 }
    p_tipo_escolhido TEXT DEFAULT NULL
)
RETURNS jsonb AS $$
BEGIN
    UPDATE pedidos_consolidados_v3
    SET 
        cotacao_frete = p_cotacao,
        tipo_envio = COALESCE(p_tipo_escolhido, tipo_envio),
        updated_at = NOW()
    WHERE id = p_pedido_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Cotação salva com sucesso'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função para atualizar valor do frete após geração da etiqueta
CREATE OR REPLACE FUNCTION atualizar_valor_frete(
    p_pedido_id UUID,
    p_valor_frete DECIMAL,
    p_tipo_envio TEXT
)
RETURNS jsonb AS $$
BEGIN
    UPDATE pedidos_consolidados_v3
    SET 
        valor_frete = p_valor_frete,
        tipo_envio = p_tipo_envio,
        updated_at = NOW()
    WHERE id = p_pedido_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Valor do frete atualizado'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Permissões
GRANT EXECUTE ON FUNCTION marcar_pedido_postado(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION salvar_cotacao_frete(UUID, JSONB, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION atualizar_valor_frete(UUID, DECIMAL, TEXT) TO authenticated, service_role;

-- 8. Recarregar schema
NOTIFY pgrst, 'reload schema';

SELECT 'Campos de frete adicionados com sucesso!' as status;
