-- ================================================================
-- MIGRATION 105: UNIFICAÇÃO DE PEDIDOS COM MESMO ENDEREÇO
-- Cria função RPC para encontrar pedidos com mesmo endereço
-- e função para unificar pedidos
-- ================================================================

-- 1. Função para encontrar pedidos com mesmo endereço (dentro de 5 dias)
CREATE OR REPLACE FUNCTION encontrar_pedidos_mesmo_endereco(p_pedido_id UUID)
RETURNS TABLE (
    pedido_id UUID,
    codigo_transacao TEXT,
    nome_cliente TEXT,
    cpf_cliente TEXT,
    email_cliente TEXT,
    data_venda TIMESTAMPTZ,
    endereco_completo TEXT,
    cep TEXT,
    logradouro TEXT,
    numero TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    produto_principal TEXT,
    descricao_pacote TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS pedido_id,
        p.codigo_transacao,
        p.nome_cliente,
        COALESCE(p.cpf_cliente, p.cpf) AS cpf_cliente,
        COALESCE(p.email_cliente, p.email) AS email_cliente,
        p.data_venda,
        CONCAT_WS(', ', COALESCE(p.logradouro, p.rua), p.numero, p.bairro, p.cidade, p.estado) AS endereco_completo,
        p.cep,
        COALESCE(p.logradouro, p.rua) AS logradouro,
        p.numero,
        p.bairro,
        p.cidade,
        p.estado,
        sigla_produto(p.nome_produto) AS produto_principal,
        p.nome_oferta AS descricao_pacote
    FROM pedidos p
    WHERE p.id != p_pedido_id
      AND COALESCE(p.status, p.status_aprovacao) IN ('Aprovado','Autorizado','Pago','Paid','Approved')
      AND p.cep IS NOT NULL AND p.cep != ''
      -- Mesmo endereço (usa a função chave_endereco)
      AND chave_endereco(p.cep, p.cidade, p.estado, COALESCE(p.logradouro, p.rua), p.numero) = (
          SELECT chave_endereco(p2.cep, p2.cidade, p2.estado, COALESCE(p2.logradouro, p2.rua), p2.numero)
          FROM pedidos p2 WHERE p2.id = p_pedido_id
      )
      -- Janela de 5 dias
      AND ABS(EXTRACT(EPOCH FROM (p.data_venda - (SELECT data_venda FROM pedidos WHERE id = p_pedido_id)))) <= 432000
      -- CPF ou nome diferente
      AND (
          normalizar_documento(COALESCE(p.cpf_cliente, p.cpf)) != normalizar_documento((
              SELECT COALESCE(p2.cpf_cliente, p2.cpf) FROM pedidos p2 WHERE p2.id = p_pedido_id
          ))
          OR LOWER(TRIM(COALESCE(p.nome_cliente, ''))) != LOWER(TRIM((
              SELECT COALESCE(p2.nome_cliente, '') FROM pedidos p2 WHERE p2.id = p_pedido_id
          )))
      )
    ORDER BY p.data_venda ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Função para unificar pedidos com mesmo endereço
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
BEGIN
    -- Buscar dados dos pedidos
    SELECT * INTO v_pedido_principal FROM pedidos WHERE id = p_pedido_principal;
    SELECT * INTO v_pedido_secundario FROM pedidos WHERE id = p_pedido_secundario;
    
    IF v_pedido_principal IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Pedido principal não encontrado');
    END IF;
    
    IF v_pedido_secundario IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Pedido secundário não encontrado');
    END IF;
    
    -- Verificar se ambos estão aprovados
    IF COALESCE(v_pedido_principal.status, v_pedido_principal.status_aprovacao) NOT IN ('Aprovado','Autorizado','Pago','Paid','Approved') THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Pedido principal não está aprovado');
    END IF;
    
    IF COALESCE(v_pedido_secundario.status, v_pedido_secundario.status_aprovacao) NOT IN ('Aprovado','Autorizado','Pago','Paid','Approved') THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Pedido secundário não está aprovado');
    END IF;
    
    -- Agrupar códigos de transação
    v_codigos_agrupados := ARRAY[v_pedido_principal.codigo_transacao, v_pedido_secundario.codigo_transacao];
    
    -- Criar observação de unificação
    v_obs := format(
        '🔄 Pedido Unificado em %s | Unificado com %s (CPF: %s) | Pedido original: %s',
        TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI'),
        v_pedido_secundario.nome_cliente,
        COALESCE(v_pedido_secundario.cpf_cliente, v_pedido_secundario.cpf, 'N/A'),
        v_pedido_secundario.codigo_transacao
    );
    
    -- Atualizar pedido principal com dados unificados
    UPDATE pedidos
    SET 
        nome_cliente = v_pedido_principal.nome_cliente,
        cpf_cliente = COALESCE(v_pedido_principal.cpf_cliente, v_pedido_principal.cpf),
        email_cliente = COALESCE(v_pedido_principal.email_cliente, v_pedido_principal.email),
        telefone_cliente = COALESCE(v_pedido_principal.telefone_cliente, v_pedido_principal.telefone),
        logradouro = v_pedido_principal.logradouro,
        rua = v_pedido_principal.rua,
        numero = v_pedido_principal.numero,
        complemento = v_pedido_principal.complemento,
        bairro = v_pedido_principal.bairro,
        cidade = v_pedido_principal.cidade,
        estado = v_pedido_principal.estado,
        cep = v_pedido_principal.cep,
        endereco_completo = CONCAT_WS(', ', COALESCE(v_pedido_principal.logradouro, v_pedido_principal.rua), v_pedido_principal.numero, v_pedido_principal.bairro, v_pedido_principal.cidade, v_pedido_principal.estado),
        metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{unificado}',
            'true'::jsonb
        ) || jsonb_build_object(
            'pedido_unificado_com', v_pedido_secundario.codigo_transacao,
            'data_unificacao', NOW(),
            'nome_cliente_original', v_pedido_secundario.nome_cliente,
            'cpf_cliente_original', COALESCE(v_pedido_secundario.cpf_cliente, v_pedido_secundario.cpf)
        ),
        observacao = COALESCE(observacao || E'\n', '') || v_obs,
        updated_at = NOW()
    WHERE id = p_pedido_principal;
    
    -- Marcar pedido secundário como unificado (não deletar, só marcar)
    UPDATE pedidos
    SET 
        status = 'Unificado',
        status_aprovacao = 'Unificado',
        metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{unificado}',
            'true'::jsonb
        ) || jsonb_build_object(
            'unificado_em', p_pedido_principal,
            'data_unificacao', NOW(),
            'pedido_principal', v_pedido_principal.codigo_transacao
        ),
        observacao = COALESCE(observacao || E'\n', '') || format(
            '🔄 Unificado com %s em %s',
            v_pedido_principal.nome_cliente,
            TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI')
        ),
        updated_at = NOW()
    WHERE id = p_pedido_secundario;
    
    -- Atualizar pedidos_consolidados_v3 se existir
    INSERT INTO pedidos_consolidados_v3 (
        id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
        valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
        telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
        endereco_completo, data_venda, created_at, metadata, produto_principal,
        descricao_pacote, codigos_agrupados, quantidade_pedidos, observacao
    ) VALUES (
        v_pedido_principal.id,
        v_pedido_principal.codigo_transacao,
        'Unificado',
        v_pedido_principal.nome_produto,
        v_pedido_principal.nome_oferta || ' + Pedido Unificado',
        v_pedido_principal.valor_total + COALESCE(v_pedido_secundario.valor_total, 0),
        v_pedido_principal.forma_pagamento,
        v_pedido_principal.parcelas,
        v_pedido_principal.nome_cliente,
        COALESCE(v_pedido_principal.email_cliente, v_pedido_principal.email),
        COALESCE(v_pedido_principal.cpf_cliente, v_pedido_principal.cpf),
        COALESCE(v_pedido_principal.telefone_cliente, v_pedido_principal.telefone),
        v_pedido_principal.cep,
        COALESCE(v_pedido_principal.logradouro, v_pedido_principal.rua),
        v_pedido_principal.numero,
        v_pedido_principal.complemento,
        v_pedido_principal.bairro,
        v_pedido_principal.cidade,
        v_pedido_principal.estado,
        CONCAT_WS(', ', COALESCE(v_pedido_principal.logradouro, v_pedido_principal.rua), v_pedido_principal.numero, v_pedido_principal.bairro, v_pedido_principal.cidade, v_pedido_principal.estado),
        v_pedido_principal.data_venda,
        v_pedido_principal.created_at,
        jsonb_build_object(
            'unificado', true,
            'pedido_unificado_com', v_pedido_secundario.codigo_transacao,
            'data_unificacao', NOW()
        ),
        sigla_produto(v_pedido_principal.nome_produto),
        v_pedido_principal.nome_oferta || ' + Pedido Unificado',
        v_codigos_agrupados,
        2,
        v_obs
    ) ON CONFLICT (codigo_transacao) DO UPDATE SET
        status_aprovacao = 'Unificado',
        nome_oferta = EXCLUDED.nome_oferta,
        valor_total = EXCLUDED.valor_total,
        codigos_agrupados = EXCLUDED.codigos_agrupados,
        quantidade_pedidos = EXCLUDED.quantidade_pedidos,
        observacao = EXCLUDED.observacao,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
    
    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Pedidos unificados com sucesso',
        'pedido_principal', v_pedido_principal.codigo_transacao,
        'pedido_secundario', v_pedido_secundario.codigo_transacao
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Permissões
GRANT EXECUTE ON FUNCTION encontrar_pedidos_mesmo_endereco(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION unificar_pedidos_mesmo_endereco(UUID, UUID) TO anon, authenticated, service_role;

-- Recarregar schema
NOTIFY pgrst, 'reload schema';

SELECT 'Migration 105: Funções de unificação de pedidos criadas com sucesso!' as status;
