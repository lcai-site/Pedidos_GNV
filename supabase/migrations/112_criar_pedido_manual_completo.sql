-- ==============================================================================
-- 112_criar_pedido_manual_completo.sql
-- Propósito: Criar pedido manual em ticto_pedidos E pedidos_consolidados_v3
-- Mudanças em relação à 111:
--   1. Cria registro em ticto_pedidos com plataforma='Manual'
--   2. status_envio = 'pronto' (vai direto para aba ENVIOS)
--   3. data_venda = now() (data de criação)
-- ==============================================================================

-- Primeiro, remover a função anterior se existir
DROP FUNCTION IF EXISTS criar_pedido_manual(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);

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
    v_pedido_ticto_id UUID;
    v_codigo_transacao TEXT;
    v_user_email TEXT;
    v_endereco_completo TEXT;
    v_sigla TEXT := 'DP'; -- Padrão, será extraído da descrição
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

    -- Extrair sigla do produto (DP, BF, BL)
    IF UPPER(p_produto_principal) LIKE '%LUMI%' THEN
        v_sigla := 'BL';
    ELSIF UPPER(p_produto_principal) LIKE '%FORMA%' THEN
        v_sigla := 'BF';
    ELSIF UPPER(p_produto_principal) LIKE '%DESEJO%' THEN
        v_sigla := 'DP';
    END IF;

    -- ================================================================
    -- PASSO 1: Criar registro em ticto_pedidos (fonte primária)
    -- ================================================================
    INSERT INTO ticto_pedidos (
        transaction_hash,
        order_id,
        order_hash,
        status,
        status_date,
        payment_method,
        paid_amount,
        shipping_amount,
        product_name,
        product_id,
        offer_name,
        offer_code,
        item_quantity,
        item_amount,
        customer_name,
        customer_email,
        customer_cpf,
        customer_phone,
        customer_type,
        address_street,
        address_number,
        address_complement,
        address_neighborhood,
        address_city,
        address_state,
        address_zip_code,
        address_country,
        order_date,
        created_at,
        plataforma,
        payload_completo
    ) VALUES (
        v_codigo_transacao,
        NULL,  -- order_id (não tem, é manual)
        NULL,  -- order_hash (não tem, é manual)
        'paid',  -- status (já pago/confirmado)
        now(),   -- status_date
        'manual', -- payment_method (identifica como manual)
        0,       -- paid_amount (será atualizado se necessário)
        0,       -- shipping_amount
        p_produto_principal,  -- product_name
        NULL,    -- product_id
        p_descricao_pacote,   -- offer_name
        'MANUAL', -- offer_code
        1,       -- item_quantity
        0,       -- item_amount
        p_nome_cliente,
        COALESCE(p_email, 'manual@pedidosgnv.com.br'),
        p_cpf,
        p_telefone,
        'person',
        p_logradouro,
        p_numero,
        p_complemento,
        p_bairro,
        p_cidade,
        p_estado,
        p_cep,
        'Brasil',
        now(),   -- order_date
        now(),   -- created_at
        'Manual', -- plataforma ← IDENTIFICAÇÃO
        jsonb_build_object(
            'tipo', 'manual',
            'criado_por', v_user_email,
            'criado_em', now(),
            'descricao_pacote', p_descricao_pacote
        )
    )
    RETURNING id INTO v_pedido_ticto_id;

    -- ================================================================
    -- PASSO 2: Criar em pedidos_consolidados_v3 (view de logística)
    -- ================================================================
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
        foi_editado,
        metadata,
        plataforma
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
        'Aprovado',    -- Já aprovado
        'pronto',      -- ← VAI DIRETO PARA ABA ENVIOS (pronto para gerar etiqueta)
        now(),         -- Data de criação (AGORA)
        TRUE,          -- Bloqueia sobrescrita pela consolidação automática
        jsonb_build_object(
            'tipo', 'manual',
            'criado_por', v_user_email,
            'criado_em', now(),
            'ticto_pedido_id', v_pedido_ticto_id
        ),
        'Manual'       -- ← IDENTIFICAÇÃO NA CONSOLIDADA TAMBÉM
    )
    RETURNING id INTO v_pedido_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Pedido manual criado com sucesso em ticto_pedidos e pedidos_consolidados_v3!',
        'pedido_id', v_pedido_id,
        'ticto_pedido_id', v_pedido_ticto_id,
        'codigo_transacao', v_codigo_transacao,
        'plataforma', 'Manual'
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

-- Comentário explicativo
COMMENT ON FUNCTION criar_pedido_manual IS 
'Cria pedido manual em ticto_pedidos e pedidos_consolidados_v3 com plataforma=Manual. 
O pedido já nasce com status_envio=pronto para geração imediata de etiqueta.';
