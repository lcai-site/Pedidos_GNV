-- ==============================================================================
-- 111_criar_pedido_manual.sql
-- Propósito: Criar um pedido manual (para reenvio ou influenciador) direto na
-- tabela pedidos_consolidados_v3, evitando o fluxo de webhook e evitando
-- sobrescrita acidental em futuras consolidações.
-- ==============================================================================

CREATE OR REPLACE FUNCTION criar_pedido_manual(
    p_nome_cliente TEXT,
    p_cpf TEXT,
    p_telefone TEXT,
    p_email TEXT,
    p_cep TEXT,
    p_logradouro TEXT,
    p_numero TEXT,
    p_complemento TEXT,
    p_bairro TEXT,
    p_cidade TEXT,
    p_estado TEXT,
    p_produto_principal TEXT,
    p_descricao_pacote TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pedido_id UUID;
    v_codigo_transacao TEXT;
    v_user_email TEXT;
    v_endereco_completo TEXT;
BEGIN
    -- Pegar o email do usuário logado para log/metadata
    v_user_email := auth.jwt() ->> 'email';

    -- Gerar um código de transação exclusivo para pedidos manuais
    -- Ex: MANUAL-1678886400000
    v_codigo_transacao := 'MANUAL-' || (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT::TEXT;

    -- Montar o endereço completo para ficar no padrão
    v_endereco_completo := CONCAT_WS(', ', 
        p_logradouro, 
        p_numero, 
        NULLIF(p_complemento, ''),
        p_bairro,
        p_cidade,
        p_estado,
        p_cep
    );

    INSERT INTO pedidos_consolidados_v3 (
        codigo_transacao,
        nome_cliente,
        cpf,
        telefone,
        email,
        cep,
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        endereco_completo,
        produto_principal,
        descricao_pacote,
        status_aprovacao,
        status_envio,
        data_venda,
        -- Marcar como editado para o script de consolidação ignorar sobrescrita
        foi_editado,   
        metadata
    ) VALUES (
        v_codigo_transacao,
        p_nome_cliente,
        p_cpf,
        p_telefone,
        COALESCE(p_email, 'manual@pedidosgnv.com.br'),
        p_cep,
        p_logradouro,
        p_numero,
        p_complemento,
        p_bairro,
        p_cidade,
        p_estado,
        v_endereco_completo,
        p_produto_principal,
        p_descricao_pacote,
        'Aprovado', -- Vai direto para as abas de logística
        'Pendente', -- Vai aparecer na aba PRONTOS/ENVIOS conforme o dia
        now(),      -- Data de venda é AGORA
        TRUE,       -- Bloqueia sobrescrita pela consolidação automática
        jsonb_build_object(
            'tipo', 'manual',
            'criado_por', v_user_email,
            'criado_em', now()
        )
    )
    RETURNING id INTO v_pedido_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Pedido manual criado com sucesso!',
        'pedido_id', v_pedido_id,
        'codigo_transacao', v_codigo_transacao
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'error',
        'message', SQLERRM
    );
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION criar_pedido_manual TO authenticated;
