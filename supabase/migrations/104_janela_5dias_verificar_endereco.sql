-- ================================================================
-- MIGRATION 104: AJUSTE NA DETECÇÃO DE ENDEREÇO COMPARTILHADO
-- 1. Limita janela de comparação para 5 dias
-- 2. Muda nomenclatura de 'fraude' para 'verificar'
-- ================================================================

-- 1. Renomear coluna fraude_endereco para verificar_endereco
ALTER TABLE pedidos_consolidados_v3
  RENAME COLUMN IF EXISTS fraude_endereco TO verificar_endereco;

-- 2. Adicionar comentário explicativo
COMMENT ON COLUMN pedidos_consolidados_v3.verificar_endereco IS 
  'Alerta: endereço compartilhado com CPF/nome diferente (janela de 5 dias)';

-- 3. Recriar a função consolidar_pedidos com janela de 5 dias
-- Primeiro, vamos criar um wrapper que modifica apenas a parte de detecção

-- Drop nas funções existentes
DROP FUNCTION IF EXISTS consolidar_pedidos_v3();
DROP FUNCTION IF EXISTS consolidar_pedidos();

-- Recriar a função consolidar_pedidos_v3 com a modificação na detecção
CREATE OR REPLACE FUNCTION consolidar_pedidos_v3()
RETURNS TABLE (
    total_principais INTEGER,
    total_order_bumps INTEGER,
    total_upsells INTEGER,
    total_pos_vendas INTEGER,
    total_dois_cartoes INTEGER,
    total_mesmo_endereco INTEGER
) AS $$
DECLARE
    v_total_principais INTEGER := 0;
    v_total_order_bumps INTEGER := 0;
    v_total_upsells INTEGER := 0;
    v_total_pos_vendas INTEGER := 0;
    v_total_dois_cartoes INTEGER := 0;
    v_total_mesmo_endereco INTEGER := 0;

    pedido_pai RECORD;
    rec RECORD;

    v_codigos_filhos TEXT[];
    v_order_bumps TEXT[];
    v_upsells TEXT[];
    v_pos_vendas TEXT[];
    v_nome_oferta TEXT;
    v_quantidade INTEGER;
    v_doc_limpo TEXT;
    v_data_limite DATE;
    v_tem_dois_cartoes BOOLEAN;
    v_sigla TEXT;
    v_descricao TEXT;
BEGIN
    -- ============================================================
    -- PASSO 0: PRESERVAR REGISTROS COM RASTREIO/EDITADOS
    -- ============================================================
    DROP TABLE IF EXISTS _locked_ids;
    CREATE TEMP TABLE _locked_ids (id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _locked_ids
    SELECT c.id FROM pedidos_consolidados_v3 c
    WHERE c.codigo_rastreio IS NOT NULL
       OR c.foi_editado = TRUE
       OR c.data_envio IS NOT NULL;

    -- Códigos de transação que pertencem a registros locked
    DROP TABLE IF EXISTS _locked_codes;
    CREATE TEMP TABLE _locked_codes (code TEXT PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _locked_codes
    SELECT codigo_transacao FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids)
    ON CONFLICT DO NOTHING;

    INSERT INTO _locked_codes
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids)
    ON CONFLICT DO NOTHING;

    -- Deletar registros NÃO locked (serão re-processados)
    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
    ) to_delete
    WHERE c.id = to_delete.id;

    -- IDs de pedidos já consumidos
    DROP TABLE IF EXISTS _processed;
    CREATE TEMP TABLE _processed (pedido_id UUID PRIMARY KEY) ON COMMIT DROP;

    -- Marcar pedidos que pertencem a registros locked
    INSERT INTO _processed
    SELECT p.id FROM pedidos p
    WHERE p.codigo_transacao IN (SELECT code FROM _locked_codes)
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- PASSO 1: DETECTAR ENDEREÇOS COMPARTILHADOS (JANELA DE 5 DIAS)
    -- ============================================================
    DROP TABLE IF EXISTS _addr_map;
    CREATE TEMP TABLE _addr_map (
        pedido_id UUID,
        chave TEXT,
        doc TEXT,
        nome TEXT,
        data_venda TIMESTAMPTZ
    ) ON COMMIT DROP;

    INSERT INTO _addr_map
    SELECT p.id,
           chave_endereco(p.cep, p.cidade, p.estado, COALESCE(p.logradouro, p.rua), p.numero),
           normalizar_documento(COALESCE(p.cpf_cliente, p.cpf)),
           LOWER(TRIM(COALESCE(p.nome_cliente, ''))),
           p.data_venda
    FROM pedidos p
    WHERE COALESCE(p.status, p.status_aprovacao) IN ('Aprovado','Autorizado','Pago','Paid','Approved')
      AND p.cep IS NOT NULL AND p.cep != '';

    -- Tabela de pedidos com endereço compartilhado (APENAS dentro de 5 dias)
    DROP TABLE IF EXISTS _verificar_endereco_ids;
    CREATE TEMP TABLE _verificar_endereco_ids (pedido_id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _verificar_endereco_ids
    SELECT DISTINCT a1.pedido_id
    FROM _addr_map a1
    JOIN _addr_map a2 ON a1.chave = a2.chave 
                     AND a1.pedido_id != a2.pedido_id
                     -- JANELA DE 5 DIAS: diferença máxima de 5 dias entre os pedidos
                     AND ABS(EXTRACT(EPOCH FROM (a1.data_venda - a2.data_venda))) <= 432000
    WHERE a1.doc != a2.doc OR a1.nome != a2.nome
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- PASSO 2: PROCESSAR PEDIDOS PRINCIPAIS
    -- ============================================================
    FOR pedido_pai IN
        SELECT p.*,
               normalizar_documento(COALESCE(p.cpf_cliente, p.cpf)) as doc_limpo,
               LOWER(COALESCE(p.email_cliente, p.email, '')) as email_lower,
               UPPER(REPLACE(COALESCE(p.nome_oferta, ''), ' ', '')) as oferta_norm,
               sigla_produto(p.nome_produto) as sigla
        FROM pedidos p
        WHERE COALESCE(p.status, p.status_aprovacao) IN ('Aprovado','Autorizado','Pago','Paid','Approved')
          AND p.codigo_transacao IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
          AND sigla_produto(p.nome_produto) IS NOT NULL
          -- Não é Order Bump, Upsell, nem CC
          AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) NOT LIKE '%ORDERBUMP%'
          AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) NOT LIKE '%UPSELL%'
          AND UPPER(COALESCE(p.nome_oferta,'')) NOT LIKE '%CC%'
        ORDER BY p.data_venda ASC NULLS LAST
    LOOP
        IF EXISTS (SELECT 1 FROM _processed WHERE pedido_id = pedido_pai.id) THEN
            CONTINUE;
        END IF;

        -- Init
        v_codigos_filhos := ARRAY[]::TEXT[];
        v_order_bumps := ARRAY[]::TEXT[];
        v_upsells := ARRAY[]::TEXT[];
        v_pos_vendas := ARRAY[]::TEXT[];
        v_quantidade := 1;
        v_doc_limpo := pedido_pai.doc_limpo;
        v_tem_dois_cartoes := FALSE;
        v_sigla := pedido_pai.sigla;

        -- Marcar como processado
        INSERT INTO _processed VALUES (pedido_pai.id) ON CONFLICT DO NOTHING;

        -- ========================================================
        -- CHECAR ENDEREÇO COMPARTILHADO (VERIFICAR)
        -- ========================================================
        IF EXISTS (SELECT 1 FROM _verificar_endereco_ids WHERE pedido_id = pedido_pai.id) THEN
            v_total_mesmo_endereco := v_total_mesmo_endereco + 1;
            INSERT INTO pedidos_consolidados_v3 (
                id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
                valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
                telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
                endereco_completo, data_venda, created_at, metadata, produto_principal,
                descricao_pacote, verificar_endereco, status_envio,
                dia_despacho, codigos_agrupados, quantidade_pedidos
            ) VALUES (
                pedido_pai.id, pedido_pai.codigo_transacao, 'Mesmo End',
                pedido_pai.nome_produto, pedido_pai.nome_oferta,
                pedido_pai.valor_total, pedido_pai.forma_pagamento, pedido_pai.parcelas,
                pedido_pai.nome_cliente, COALESCE(pedido_pai.email_cliente,pedido_pai.email),
                COALESCE(pedido_pai.cpf_cliente,pedido_pai.cpf),
                COALESCE(pedido_pai.telefone_cliente,pedido_pai.telefone),
                pedido_pai.cep, COALESCE(pedido_pai.logradouro,pedido_pai.rua),
                pedido_pai.numero, pedido_pai.complemento, pedido_pai.bairro,
                pedido_pai.cidade, pedido_pai.estado,
                CONCAT_WS(', ', COALESCE(pedido_pai.logradouro,pedido_pai.rua), pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
                pedido_pai.data_venda, pedido_pai.created_at, pedido_pai.metadata,
                v_sigla, v_sigla || ' - ' || pedido_pai.nome_oferta,
                TRUE, 'Bloqueado',
                (pedido_pai.data_venda::DATE + INTERVAL '2 days')::DATE,
                ARRAY[pedido_pai.codigo_transacao], 1
            ) ON CONFLICT (codigo_transacao) DO UPDATE SET
                status_aprovacao = 'Mesmo End', verificar_endereco = TRUE, updated_at = now();
            CONTINUE;
        END IF;

        -- ========================================================
        -- 3. ORDER BUMPS (mesmo email + mesma data + ORDERBUMP)
        -- ========================================================
        FOR rec IN
            SELECT p.id, p.codigo_transacao, p.nome_oferta
            FROM pedidos p
            WHERE p.id != pedido_pai.id
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND COALESCE(p.status, p.status_aprovacao) IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(COALESCE(p.email_cliente, p.email, '')) = pedido_pai.email_lower
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
              AND (
                  UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%ORDERBUMP%'
              )
        LOOP
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            v_order_bumps := array_append(v_order_bumps, rec.nome_oferta);
            v_quantidade := v_quantidade + 1;
            v_total_order_bumps := v_total_order_bumps + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- ========================================================
        -- 4. UPSELL POR DOCUMENTO (mesmo CPF + D→D+1 + UPSELL)
        -- ========================================================
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            FOR rec IN
                SELECT p.id, p.codigo_transacao, p.nome_oferta
                FROM pedidos p
                WHERE p.id != pedido_pai.id
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                  AND COALESCE(p.status, p.status_aprovacao) IN ('Aprovado','Autorizado','Pago','Paid','Approved')
                  AND normalizar_documento(COALESCE(p.cpf_cliente, p.cpf)) = v_doc_limpo
                  AND p.data_venda::DATE BETWEEN pedido_pai.data_venda::DATE AND (pedido_pai.data_venda::DATE + INTERVAL '1 day')
                  AND (
                      UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%UPSELL%'
                      OR UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%UP-SELL%'
                      OR UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%UPSELL%'
                  )
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_upsells := array_append(v_upsells, rec.nome_oferta);
                v_quantidade := v_quantidade + 1;
                v_total_upsells := v_total_upsells + 1;
                INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- ========================================================
        -- 5. DOIS CARTÕES (mesmo email + mesma oferta + mesma data)
        -- ========================================================
        FOR rec IN
            SELECT p.id, p.codigo_transacao
            FROM pedidos p
            WHERE p.id != pedido_pai.id
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND COALESCE(p.status, p.status_aprovacao) IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(COALESCE(p.email_cliente, p.email, '')) = pedido_pai.email_lower
              AND UPPER(REPLACE(COALESCE(p.nome_oferta, ''), ' ', '')) = pedido_pai.oferta_norm
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
        LOOP
            IF NOT v_tem_dois_cartoes THEN
                v_tem_dois_cartoes := TRUE;
                v_total_dois_cartoes := v_total_dois_cartoes + 1;
            END IF;
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            v_quantidade := v_quantidade + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- ========================================================
        -- 6. PÓS VENDA / CROSS-SELL (mesmo CPF + D+1→janela + CC)
        -- ========================================================
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            v_data_limite := calcular_janela_pv(pedido_pai.data_venda::DATE);
            FOR rec IN
                SELECT p.id, p.codigo_transacao, p.nome_oferta
                FROM pedidos p
                WHERE p.id != pedido_pai.id
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                  AND COALESCE(p.status, p.status_aprovacao) IN ('Aprovado','Autorizado','Pago','Paid','Approved')
                  AND normalizar_documento(COALESCE(p.cpf_cliente, p.cpf)) = v_doc_limpo
                  AND p.data_venda::DATE > pedido_pai.data_venda::DATE
                  AND p.data_venda::DATE <= v_data_limite
                  AND UPPER(COALESCE(p.nome_oferta, '')) LIKE '%CC%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_pos_vendas := array_append(v_pos_vendas, rec.nome_oferta);
                v_quantidade := v_quantidade + 1;
                v_total_pos_vendas := v_total_pos_vendas + 1;
                INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- ========================================================
        -- INSERT DO PEDIDO CONSOLIDADO
        -- ========================================================
        v_descricao := v_sigla || ' - ' || pedido_pai.nome_oferta;
        IF array_length(v_order_bumps, 1) IS NOT NULL THEN
            v_descricao := v_descricao || ' + ' || array_length(v_order_bumps, 1) || ' OB';
        END IF;
        IF array_length(v_upsells, 1) IS NOT NULL THEN
            v_descricao := v_descricao || ' + ' || array_length(v_upsells, 1) || ' UP';
        END IF;
        IF array_length(v_pos_vendas, 1) IS NOT NULL THEN
            v_descricao := v_descricao || ' + ' || array_length(v_pos_vendas, 1) || ' PV';
        END IF;

        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
            valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
            telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
            endereco_completo, data_venda, created_at, metadata,
            produto_principal, descricao_pacote, codigos_agrupados,
            quantidade_pedidos, order_bumps, upsells, pos_vendas,
            tem_dois_cartoes, dia_despacho
        ) VALUES (
            pedido_pai.id, pedido_pai.codigo_transacao, 'Aprovado',
            pedido_pai.nome_produto, pedido_pai.nome_oferta,
            pedido_pai.valor_total, pedido_pai.forma_pagamento, pedido_pai.parcelas,
            pedido_pai.nome_cliente, COALESCE(pedido_pai.email_cliente,pedido_pai.email),
            COALESCE(pedido_pai.cpf_cliente,pedido_pai.cpf),
            COALESCE(pedido_pai.telefone_cliente,pedido_pai.telefone),
            pedido_pai.cep, COALESCE(pedido_pai.logradouro,pedido_pai.rua),
            pedido_pai.numero, pedido_pai.complemento, pedido_pai.bairro,
            pedido_pai.cidade, pedido_pai.estado,
            CONCAT_WS(', ', COALESCE(pedido_pai.logradouro,pedido_pai.rua), pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
            pedido_pai.data_venda, pedido_pai.created_at, pedido_pai.metadata,
            v_sigla, v_descricao,
            ARRAY[pedido_pai.codigo_transacao] || v_codigos_filhos,
            v_quantidade, v_order_bumps, v_upsells, v_pos_vendas,
            v_tem_dois_cartoes,
            (pedido_pai.data_venda::DATE + INTERVAL '2 days')::DATE
        ) ON CONFLICT (codigo_transacao) DO UPDATE SET
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            codigos_agrupados = EXCLUDED.codigos_agrupados,
            order_bumps = EXCLUDED.order_bumps,
            upsells = EXCLUDED.upsells,
            pos_vendas = EXCLUDED.pos_vendas,
            tem_dois_cartoes = EXCLUDED.tem_dois_cartoes,
            dia_despacho = EXCLUDED.dia_despacho,
            updated_at = NOW();

        v_total_principais := v_total_principais + 1;
    END LOOP;

    RETURN QUERY SELECT
        v_total_principais,
        v_total_order_bumps,
        v_total_upsells,
        v_total_pos_vendas,
        v_total_dois_cartoes,
        v_total_mesmo_endereco;
END;
$$ LANGUAGE plpgsql;

-- Recarregar schema
NOTIFY pgrst, 'reload schema';

SELECT 'Migration 104: Janela de 5 dias para verificar endereço aplicada!' as status;
