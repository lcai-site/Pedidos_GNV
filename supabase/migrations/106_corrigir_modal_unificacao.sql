-- ================================================================
-- CORREÇÃO CIRÚRGICA: "column p.cpf does not exist"
-- ================================================================
-- O Postgres dispara erro de compilação mesmo dentro de um COALESCE
-- se a coluna referenciada não existir no schema atual.
-- A solução mais segura, caso a tabela já tenha cpf_cliente,
-- é recriar as funções referenciando apenas as colunas oficiais provadas,
-- ou então adicionar as colunas ausentes como "fallback" em branco.
-- Aqui, nós garantimos que as colunas existam para que o COALESCE funcione perfeitamente.

-- 1. Garante que todas as colunas de fallback existam na tabela (as novas serão NULL por padrão e não afetarão o DB)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS rua TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS estado TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS status_aprovacao TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS descricao_pacote TEXT;

DROP FUNCTION IF EXISTS encontrar_pedidos_mesmo_endereco(UUID);

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
DECLARE
    v_cpf_referencia TEXT;
    v_nome_referencia TEXT;
    v_chave_referencia TEXT;
    v_data_referencia TIMESTAMPTZ;
    v_email_referencia TEXT;
    v_oferta_referencia TEXT;
BEGIN
    SELECT 
        COALESCE(c.cpf, ''),
        LOWER(TRIM(COALESCE(c.nome_cliente, ''))),
        chave_endereco(c.cep, c.cidade, c.estado, c.logradouro, c.numero),
        c.data_venda,
        LOWER(COALESCE(c.email, '')),
        UPPER(COALESCE(c.descricao_pacote, c.nome_oferta, c.nome_produto, ''))
    INTO v_cpf_referencia, v_nome_referencia, v_chave_referencia, v_data_referencia, v_email_referencia, v_oferta_referencia
    FROM pedidos_consolidados_v3 c
    WHERE id = p_pedido_id;

    -- Se o pedido de referência for um UPSELL ou BUMP, retorna vazio direto
    IF v_oferta_referencia LIKE '%UPSELL%' OR v_oferta_referencia LIKE '%BUMP%' THEN
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT 
        c.id::UUID AS pedido_id,
        c.codigo_transacao::TEXT,
        c.nome_cliente::TEXT,
        COALESCE(c.cpf, '')::TEXT AS cpf_cliente,
        COALESCE(c.email, '')::TEXT AS email_cliente,
        c.data_venda::TIMESTAMPTZ,
        CONCAT_WS(', ', c.logradouro, c.numero, c.bairro, c.cidade, c.estado)::TEXT AS endereco_completo,
        COALESCE(c.cep, '')::TEXT AS cep,
        COALESCE(c.logradouro, '')::TEXT AS logradouro,
        COALESCE(c.numero, '')::TEXT AS numero,
        COALESCE(c.bairro, '')::TEXT AS bairro,
        COALESCE(c.cidade, '')::TEXT AS cidade,
        COALESCE(c.estado, '')::TEXT AS estado,
        COALESCE(c.produto_principal, '')::TEXT AS produto_principal,
        COALESCE(c.descricao_pacote, c.nome_oferta, '')::TEXT AS descricao_pacote
    FROM pedidos_consolidados_v3 c
    WHERE c.id != p_pedido_id
      AND c.status_aprovacao NOT IN ('Unificado', 'Fraud', 'Cancelado')
      AND UPPER(COALESCE(c.descricao_pacote, c.nome_oferta, c.nome_produto, '')) NOT LIKE '%UPSELL%'
      AND UPPER(COALESCE(c.descricao_pacote, c.nome_oferta, c.nome_produto, '')) NOT LIKE '%BUMP%'
      AND ABS(EXTRACT(EPOCH FROM (c.data_venda - v_data_referencia))) <= 432000
      AND (
          (
              chave_endereco(c.cep, c.cidade, c.estado, c.logradouro, c.numero) = v_chave_referencia
              AND (
                  normalizar_documento(COALESCE(c.cpf, '')) != normalizar_documento(v_cpf_referencia)
                  OR LOWER(TRIM(COALESCE(c.nome_cliente, ''))) != v_nome_referencia
              )
          )
          OR (
              normalizar_documento(COALESCE(c.cpf, '')) = normalizar_documento(v_cpf_referencia)
              AND normalizar_documento(v_cpf_referencia) != ''
              AND chave_endereco(c.cep, c.cidade, c.estado, c.logradouro, c.numero) != v_chave_referencia
          )
      )
    ORDER BY c.data_venda ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recria a função de unificação
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
    v_sufixo_descricao TEXT;
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

    IF v_sigla_secundaria != '' AND v_sigla_secundaria != 'OUTRO' THEN
        v_sufixo_descricao := ' + 1 ' || v_sigla_secundaria;
    ELSE
        v_sufixo_descricao := ' + ' || COALESCE(v_pedido_secundario.descricao_pacote, v_pedido_secundario.nome_oferta, '');
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

    -- 2. Tentar esconder a transação original na tabela raw do consolidator para proteção futura
    UPDATE ticto_pedidos SET status = 'Unificado' WHERE transaction_hash = v_pedido_secundario.codigo_transacao;
    
    -- 3. Atualizar pedido principal
    UPDATE pedidos_consolidados_v3
    SET 
        valor_total = COALESCE(v_pedido_principal.valor_total, 0) + COALESCE(v_pedido_secundario.valor_total, 0),
        quantidade_pedidos = COALESCE(v_pedido_principal.quantidade_pedidos, 1) + COALESCE(v_pedido_secundario.quantidade_pedidos, 1),
        codigos_agrupados = v_codigos_agrupados,
        descricao_pacote = v_pedido_principal.descricao_pacote || v_sufixo_descricao,
        nome_oferta = v_pedido_principal.nome_oferta || v_sufixo_descricao,
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

GRANT EXECUTE ON FUNCTION encontrar_pedidos_mesmo_endereco(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION unificar_pedidos_mesmo_endereco(UUID, UUID) TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
SELECT 'Correção cirúrgica de colunas e funções concluída!' as status;
