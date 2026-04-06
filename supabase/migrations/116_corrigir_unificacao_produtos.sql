-- ================================================================
-- MIGRATION 116: Corrigir Unificação (Merge) de Produtos
-- Garante que ao unificar pedidos (manualmente ou por endereço), 
-- a descrição dos produtos (descricao_pacote) seja concatenada adequadamente.
-- ================================================================

-- 1. Atualizar unificar_pedidos (Unificação Manual via Bulk Action)
CREATE OR REPLACE FUNCTION unificar_pedidos(
    p_manter_id      UUID,
    p_absorver_id    UUID,
    p_nova_descricao TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_absorver RECORD;
    v_manter RECORD;
BEGIN
    SELECT * INTO v_manter FROM pedidos_consolidados_v3 WHERE id = p_manter_id;
    SELECT * INTO v_absorver FROM pedidos_consolidados_v3 WHERE id = p_absorver_id;

    IF v_manter IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Pedido principal não encontrado');
    END IF;

    IF v_absorver IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Pedido a absorver não encontrado');
    END IF;

    -- Atualizar o pedido principal: mesclar filhos, códigos e garantir descrição completa
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

-- 2. Atualizar unificar_pedidos_mesmo_endereco (Unificação via botão "Verificar")
CREATE OR REPLACE FUNCTION unificar_pedidos_mesmo_endereco(
    p_pedido_principal UUID,
    p_pedido_secundario UUID
)
RETURNS jsonb AS $$
DECLARE
    v_pedido_principal RECORD;
    v_pedido_secundario RECORD;
    v_codigos_agrupados TEXT[];
    v_obs TEXT;
    v_sigla_secundaria TEXT;
    v_desc_original_principal TEXT;
    v_desc_original_secundaria TEXT;
    v_nova_desc TEXT;
BEGIN
    SELECT * INTO v_pedido_principal FROM pedidos_consolidados_v3 WHERE id = p_pedido_principal;
    SELECT * INTO v_pedido_secundario FROM pedidos_consolidados_v3 WHERE id = p_pedido_secundario;
    
    IF v_pedido_principal IS NULL THEN RETURN jsonb_build_object('status', 'error', 'message', 'Pedido principal não encontrado'); END IF;
    IF v_pedido_secundario IS NULL THEN RETURN jsonb_build_object('status', 'error', 'message', 'Pedido secundário não encontrado'); END IF;
    
    IF v_pedido_principal.status_aprovacao IN ('Unificado', 'Cancelado', 'Fraud') THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Pedido principal não está válido para unificação');
    END IF;
    IF v_pedido_secundario.status_aprovacao IN ('Unificado', 'Cancelado', 'Fraud') THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Pedido secundário não está válido para unificação');
    END IF;
    
    v_codigos_agrupados := ARRAY_CAT(COALESCE(v_pedido_principal.codigos_agrupados, ARRAY[v_pedido_principal.codigo_transacao]), COALESCE(v_pedido_secundario.codigos_agrupados, ARRAY[v_pedido_secundario.codigo_transacao]));
    
    v_obs := format(
        '🔄 Pedido Unificado em %s | Unificado com %s (CPF: %s) | Pedido original: %s',
        TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI'),
        v_pedido_secundario.nome_cliente,
        COALESCE(v_pedido_secundario.cpf, 'N/A'),
        v_pedido_secundario.codigo_transacao
    );

    v_sigla_secundaria := COALESCE(v_pedido_secundario.produto_principal, '');
    IF v_sigla_secundaria = '' THEN
        v_sigla_secundaria := sigla_produto(v_pedido_secundario.nome_produto);
    END IF;

    -- Lógica de concatenação de descrição mais robusta
    v_desc_original_principal := COALESCE(v_pedido_principal.descricao_pacote, v_pedido_principal.nome_oferta, '');
    v_desc_original_secundaria := COALESCE(v_pedido_secundario.descricao_pacote, v_pedido_secundario.nome_oferta, '');
    
    -- Se a sigla secundária for relevante e não estiver na descrição principal, anexa
    IF v_sigla_secundaria != '' AND v_sigla_secundaria != 'OUTRO' AND v_desc_original_principal NOT LIKE '%' || v_sigla_secundaria || '%' THEN
        v_nova_desc := v_desc_original_principal || ' + 1 ' || v_sigla_secundaria;
    ELSIF v_desc_original_principal NOT LIKE '%' || v_desc_original_secundaria || '%' THEN
        v_nova_desc := v_desc_original_principal || ' + ' || v_desc_original_secundaria;
    ELSE
        v_nova_desc := v_desc_original_principal;
    END IF;
    
    -- 1. Marcar pedido secundário como Unificado
    UPDATE pedidos_consolidados_v3
    SET 
        status_aprovacao = 'Unificado',
        metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{unificado}', 'true'::jsonb) || jsonb_build_object(
            'unificado_em', p_pedido_principal,
            'data_unificacao', NOW(),
            'pedido_principal', v_pedido_principal.codigo_transacao
        ),
        observacao = COALESCE(observacao || E'\n', '') || format('🔄 Unificado com %s em %s', v_pedido_principal.nome_cliente, TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI')),
        updated_at = NOW()
    WHERE id = p_pedido_secundario;

    -- 2. Esconder a transação original na tabela raw
    UPDATE ticto_pedidos SET status = 'Unificado' WHERE transaction_hash = v_pedido_secundario.codigo_transacao;
    
    -- 3. Atualizar pedido principal
    UPDATE pedidos_consolidados_v3
    SET 
        valor_total = COALESCE(v_pedido_principal.valor_total, 0) + COALESCE(v_pedido_secundario.valor_total, 0),
        quantidade_pedidos = COALESCE(v_pedido_principal.quantidade_pedidos, 1) + COALESCE(v_pedido_secundario.quantidade_pedidos, 1),
        codigos_agrupados = v_codigos_agrupados,
        descricao_pacote = v_nova_desc,
        nome_oferta = v_nova_desc,
        metadata = jsonb_set(COALESCE(v_pedido_principal.metadata, '{}'::jsonb), '{unificado}', 'true'::jsonb) || jsonb_build_object(
            'pedido_unificado_com', v_pedido_secundario.codigo_transacao,
            'data_unificacao', NOW(),
            'nome_cliente_original', v_pedido_secundario.nome_cliente,
            'cpf_cliente_original', v_pedido_secundario.cpf
        ),
        observacao = COALESCE(v_pedido_principal.observacao || E'\n', '') || v_obs,
        foi_editado = TRUE,
        updated_at = NOW()
    WHERE id = p_pedido_principal;
    
    RETURN jsonb_build_object('status', 'success', 'message', 'Pedidos unificados com sucesso');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-garantir permissões
GRANT EXECUTE ON FUNCTION unificar_pedidos(UUID, UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION unificar_pedidos_mesmo_endereco(UUID, UUID) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
SELECT 'Migration 116: Unificação de produtos corrigida com sucesso!' as status;
