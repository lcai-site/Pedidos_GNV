-- ================================================================
-- IMPLEMENTAÇÃO COMPLETA: FRETE, COTAÇÃO E ABA ENVIADOS
-- Execute este arquivo SQL completo no Supabase
-- ================================================================

-- 1. ADICIONAR COLUNAS PARA CONTROLE DE FRETE
ALTER TABLE pedidos_consolidados_v3 
ADD COLUMN IF NOT EXISTS tipo_envio TEXT, -- 'Mini Envios', 'PAC', 'SEDEX'
ADD COLUMN IF NOT EXISTS valor_frete DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS data_postagem TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cotacao_frete JSONB, -- Armazena as 3 opções
ADD COLUMN IF NOT EXISTS force_remover_etiqueta BOOLEAN DEFAULT FALSE;

-- 2. CRIAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_pedidos_consolidados_v3_tipo_envio 
ON pedidos_consolidados_v3(tipo_envio) WHERE tipo_envio IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_consolidados_v3_data_postagem 
ON pedidos_consolidados_v3(data_postagem) WHERE data_postagem IS NOT NULL;

-- 3. FUNÇÃO: SALVAR COTAÇÃO DE FRETE
CREATE OR REPLACE FUNCTION salvar_cotacao_frete(
    p_pedido_id UUID,
    p_cotacao JSONB,
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

-- 4. FUNÇÃO: ATUALIZAR VALOR DO FRETE
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

-- 5. FUNÇÃO: MARCAR PEDIDO COMO POSTADO
CREATE OR REPLACE FUNCTION marcar_pedido_postado(
    p_pedido_id UUID,
    p_codigo_rastreio TEXT DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_pedido RECORD;
    v_codigo TEXT;
BEGIN
    SELECT * INTO v_pedido FROM pedidos_consolidados_v3 WHERE id = p_pedido_id;
    
    IF v_pedido IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
    END IF;
    
    v_codigo := COALESCE(p_codigo_rastreio, v_pedido.codigo_rastreio);
    
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
        'data_postagem', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. FUNÇÃO: RESETAR ETIQUETA
CREATE OR REPLACE FUNCTION resetar_etiqueta_pedido(
    p_pedido_id UUID,
    p_confirmacao BOOLEAN DEFAULT FALSE
)
RETURNS jsonb AS $$
DECLARE
    v_pedido RECORD;
BEGIN
    SELECT * INTO v_pedido FROM pedidos_consolidados_v3 WHERE id = p_pedido_id;
    
    IF v_pedido IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
    END IF;
    
    IF v_pedido.codigo_rastreio IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido não possui código de rastreio');
    END IF;
    
    IF NOT p_confirmacao THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Confirmação necessária',
            'message', 'Essa ação cancelará a etiqueta atual e invalidará o código de rastreio: ' || v_pedido.codigo_rastreio
        );
    END IF;
    
    UPDATE pedidos_consolidados_v3
    SET 
        codigo_rastreio = NULL,
        status_envio = 'Pendente',
        logistica_etiqueta_url = NULL,
        logistica_provider = NULL,
        logistica_servico = NULL,
        logistica_valor = NULL,
        force_remover_etiqueta = TRUE,
        updated_at = NOW()
    WHERE id = p_pedido_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Etiqueta removida com sucesso',
        'codigo_rastreio_removido', v_pedido.codigo_rastreio
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. TRIGGER DE PROTEÇÃO DE ETIQUETADOS
CREATE OR REPLACE FUNCTION protect_etiquetados_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.codigo_rastreio IS NOT NULL AND NEW.codigo_rastreio IS NULL THEN
        IF NOT COALESCE(NEW.force_remover_etiqueta, FALSE) THEN
            RAISE EXCEPTION 'Não é permitido remover código de rastreio sem confirmação.';
        END IF;
    END IF;
    
    NEW.force_remover_etiqueta := FALSE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_etiquetados ON pedidos_consolidados_v3;

CREATE TRIGGER trg_protect_etiquetados
    BEFORE UPDATE ON pedidos_consolidados_v3
    FOR EACH ROW
    EXECUTE FUNCTION protect_etiquetados_update();

-- 8. PERMISSÕES
GRANT EXECUTE ON FUNCTION salvar_cotacao_frete(UUID, JSONB, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION atualizar_valor_frete(UUID, DECIMAL, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION marcar_pedido_postado(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resetar_etiqueta_pedido(UUID, BOOLEAN) TO authenticated, service_role;

-- 9. RECARREGAR SCHEMA
NOTIFY pgrst, 'reload schema';

SELECT 'Sistema de frete e envios configurado com sucesso!' as status;
