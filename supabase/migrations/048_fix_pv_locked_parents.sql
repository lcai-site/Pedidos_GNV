-- ================================================================
-- MIGRATION 048: Fix OB + PV orphans para Parents Locked
-- Data: 2026-02-24 (v2 — colunas corretas + suporte a OB)
-- Problema 1: pedidos CC (Pós Venda) que chegam após o parent
--   ficar locked (codigo_rastreio / foi_editado) ficavam orphans.
-- Problema 2: Order Bumps do mesmo parent locked ficavam orphans.
-- Solução: PASSO 0.5-CC e PASSO 0.5-OB no consolidar_pedidos().
-- Correção: usa p.status e p.email_cliente (colunas reais do banco).
-- ================================================================

-- Funções auxiliares (idempotentes)
CREATE OR REPLACE FUNCTION calcular_janela_pv(data_pedido DATE)
RETURNS DATE AS $$
BEGIN
    IF data_pedido IS NULL THEN RETURN CURRENT_DATE; END IF;
    IF EXTRACT(DOW FROM data_pedido) IN (4, 5) THEN
        RETURN data_pedido + INTERVAL '4 days';
    END IF;
    RETURN data_pedido + INTERVAL '2 days';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION normalizar_documento(doc_raw TEXT)
RETURNS TEXT AS $$
DECLARE doc_limpo TEXT;
BEGIN
    IF doc_raw IS NULL OR doc_raw = '' THEN RETURN ''; END IF;
    doc_limpo := REGEXP_REPLACE(doc_raw, '[^0-9]', '', 'g');
    IF doc_limpo = '' THEN RETURN ''; END IF;
    RETURN LTRIM(doc_limpo, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION chave_endereco(p_cep TEXT, p_cidade TEXT, p_estado TEXT, p_rua TEXT, p_numero TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(TRIM(COALESCE(p_cep,''))) || '|' ||
           LOWER(TRIM(COALESCE(p_cidade,''))) || '|' ||
           LOWER(TRIM(COALESCE(p_estado,''))) || '|' ||
           LOWER(TRIM(COALESCE(p_rua,''))) || '|' ||
           LOWER(TRIM(COALESCE(p_numero,'')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION sigla_produto(nome TEXT)
RETURNS TEXT AS $$
DECLARE u TEXT;
BEGIN
    u := UPPER(COALESCE(nome, ''));
    IF u LIKE '%DESEJO PROIBIDO%' OR u LIKE '%DESEJO%' THEN RETURN 'DP'; END IF;
    IF u LIKE '%BELA LUMI%' OR u LIKE '%LUMI%' THEN RETURN 'BL'; END IF;
    IF u LIKE '%BELA FORMA%' OR u LIKE '%FORMA%' THEN RETURN 'BF'; END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- PROCEDIMENTO PRINCIPAL
-- ================================================================
CREATE OR REPLACE FUNCTION consolidar_pedidos()
RETURNS TABLE (
    total_principais INTEGER,
    total_order_bumps INTEGER,
    total_upsells INTEGER,
    total_pos_vendas INTEGER,
    total_dois_cartoes INTEGER,
    total_mesmo_endereco INTEGER
) AS $$
DECLARE
    v_total_principais    INTEGER := 0;
    v_total_order_bumps   INTEGER := 0;
    v_total_upsells       INTEGER := 0;
    v_total_pos_vendas    INTEGER := 0;
    v_total_dois_cartoes  INTEGER := 0;
    v_total_mesmo_endereco INTEGER := 0;

    pedido_pai     RECORD;
    locked_parent  RECORD;
    rec            RECORD;

    v_codigos_filhos TEXT[];
    v_order_bumps    TEXT[];
    v_upsells        TEXT[];
    v_pos_vendas     TEXT[];
    v_nome_oferta    TEXT;
    v_quantidade     INTEGER;
    v_doc_limpo      TEXT;
    v_email_lower    TEXT;
    v_data_limite    DATE;
    v_tem_dois_cartoes BOOLEAN;
    v_sigla          TEXT;
    v_descricao      TEXT;

    -- PASSO 0.5 vars
    v_novos_count  INTEGER;
    v_pv_append    TEXT[];
    v_ob_append    TEXT[];
    v_codes_append TEXT[];
    v_pv_dp INT; v_pv_bf INT; v_pv_bl INT;
    v_pv_item TEXT;
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

    DROP TABLE IF EXISTS _locked_codes;
    CREATE TEMP TABLE _locked_codes (code TEXT PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _locked_codes
    SELECT codigo_transacao FROM pedidos_consolidados_v3
    WHERE id IN (SELECT id FROM _locked_ids)
    ON CONFLICT DO NOTHING;

    INSERT INTO _locked_codes
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3
    WHERE id IN (SELECT id FROM _locked_ids)
    ON CONFLICT DO NOTHING;

    -- Deletar registros NÃO locked
    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
    ) to_delete
    WHERE c.id = to_delete.id;

    DROP TABLE IF EXISTS _processed;
    CREATE TEMP TABLE _processed (pedido_id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _processed
    SELECT p.id FROM pedidos p
    WHERE p.codigo_transacao IN (SELECT code FROM _locked_codes)
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- PASSO 0.5-CC: ANEXAR NOVOS PVs (CC) AOS PARENTS LOCKED
    -- ============================================================
    FOR locked_parent IN
        SELECT c.id, c.cpf, c.email, c.data_venda,
               c.codigos_filhos, c.pos_vendas, c.order_bumps,
               c.descricao_pacote, c.quantidade_pedidos
        FROM pedidos_consolidados_v3 c
        WHERE c.id IN (SELECT id FROM _locked_ids)
          AND c.cpf IS NOT NULL AND c.cpf != ''
          AND c.data_envio IS NULL
    LOOP
        v_data_limite  := calcular_janela_pv(locked_parent.data_venda::DATE);
        v_doc_limpo    := normalizar_documento(locked_parent.cpf);
        v_pv_append    := ARRAY[]::TEXT[];
        v_codes_append := ARRAY[]::TEXT[];
        v_novos_count  := 0;

        FOR rec IN
            SELECT p.id, p.codigo_transacao, p.nome_oferta, p.nome_produto,
                   sigla_produto(p.nome_produto) AS sigla_pv
            FROM pedidos p
            WHERE NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
              AND v_doc_limpo != ''
              AND p.data_venda::DATE >  locked_parent.data_venda::DATE
              AND p.data_venda::DATE <= v_data_limite
              AND UPPER(COALESCE(p.nome_oferta, '')) LIKE '%CC%'
              AND NOT (COALESCE(locked_parent.codigos_filhos, ARRAY[]::TEXT[])
                       @> ARRAY[p.codigo_transacao])
        LOOP
            v_codes_append := array_append(v_codes_append, rec.codigo_transacao);
            v_pv_append    := array_append(v_pv_append,
                COALESCE(rec.sigla_pv, '') || ':' || rec.nome_oferta);
            v_novos_count  := v_novos_count + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        IF v_novos_count > 0 THEN
            v_pv_dp := 0; v_pv_bf := 0; v_pv_bl := 0;
            FOREACH v_pv_item IN ARRAY v_pv_append LOOP
                IF    v_pv_item LIKE 'DP:%' THEN v_pv_dp := v_pv_dp + 1;
                ELSIF v_pv_item LIKE 'BF:%' THEN v_pv_bf := v_pv_bf + 1;
                ELSIF v_pv_item LIKE 'BL:%' THEN v_pv_bl := v_pv_bl + 1;
                END IF;
            END LOOP;

            v_descricao := locked_parent.descricao_pacote;
            IF v_pv_dp > 0 THEN v_descricao := v_descricao || ' + ' || v_pv_dp || ' DP'; END IF;
            IF v_pv_bf > 0 THEN v_descricao := v_descricao || ' + ' || v_pv_bf || ' BF'; END IF;
            IF v_pv_bl > 0 THEN v_descricao := v_descricao || ' + ' || v_pv_bl || ' BL'; END IF;

            UPDATE pedidos_consolidados_v3
            SET codigos_filhos     = COALESCE(codigos_filhos, '{}') || v_codes_append,
                pos_vendas         = COALESCE(pos_vendas, '{}') || v_pv_append,
                quantidade_pedidos = quantidade_pedidos + v_novos_count,
                descricao_pacote   = v_descricao,
                updated_at         = NOW()
            WHERE id = locked_parent.id;

            v_total_pos_vendas := v_total_pos_vendas + v_novos_count;
        END IF;
    END LOOP;

    -- ============================================================
    -- PASSO 0.5-OB: ANEXAR NOVOS ORDER BUMPS AOS PARENTS LOCKED
    -- OBs usam email + mesma data como chave de matching
    -- ============================================================
    FOR locked_parent IN
        SELECT c.id, c.email, c.data_venda,
               c.codigos_filhos, c.order_bumps,
               c.descricao_pacote, c.quantidade_pedidos
        FROM pedidos_consolidados_v3 c
        WHERE c.id IN (SELECT id FROM _locked_ids)
          AND c.email IS NOT NULL AND c.email != ''
          AND c.data_envio IS NULL
    LOOP
        v_email_lower  := LOWER(TRIM(locked_parent.email));
        v_ob_append    := ARRAY[]::TEXT[];
        v_codes_append := ARRAY[]::TEXT[];
        v_novos_count  := 0;

        FOR rec IN
            SELECT p.id, p.codigo_transacao, p.nome_oferta
            FROM pedidos p
            WHERE NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(TRIM(p.email_cliente)) = v_email_lower
              AND v_email_lower != ''
              AND p.data_venda::DATE = locked_parent.data_venda::DATE
              AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%ORDERBUMP%'
              AND NOT (COALESCE(locked_parent.codigos_filhos, ARRAY[]::TEXT[])
                       @> ARRAY[p.codigo_transacao])
        LOOP
            v_codes_append := array_append(v_codes_append, rec.codigo_transacao);
            v_ob_append    := array_append(v_ob_append, rec.nome_oferta);
            v_novos_count  := v_novos_count + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        IF v_novos_count > 0 THEN
            -- Reconstruir descricao: adicionar " + Order Bump" por cada novo OB
            v_descricao := locked_parent.descricao_pacote ||
                           REPEAT(' + Order Bump', v_novos_count);

            UPDATE pedidos_consolidados_v3
            SET codigos_filhos     = COALESCE(codigos_filhos, '{}') || v_codes_append,
                order_bumps        = COALESCE(order_bumps, '{}') || v_ob_append,
                quantidade_pedidos = quantidade_pedidos + v_novos_count,
                descricao_pacote   = v_descricao,
                updated_at         = NOW()
            WHERE id = locked_parent.id;

            v_total_order_bumps := v_total_order_bumps + v_novos_count;
        END IF;
    END LOOP;

    -- ============================================================
    -- PASSO 1: DETECTAR ENDEREÇOS COMPARTILHADOS (FRAUDE)
    -- ============================================================
    DROP TABLE IF EXISTS _addr_map;
    CREATE TEMP TABLE _addr_map (
        pedido_id UUID,
        chave TEXT,
        doc TEXT,
        nome TEXT
    ) ON COMMIT DROP;

    INSERT INTO _addr_map
    SELECT p.id,
           chave_endereco(p.cep, p.cidade, p.estado,
               COALESCE(p.logradouro, p.rua), p.numero),
           normalizar_documento(p.cpf_cliente),
           LOWER(TRIM(COALESCE(p.nome_cliente, '')))
    FROM pedidos p
    WHERE p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
      AND p.cep IS NOT NULL AND p.cep != '';

    DROP TABLE IF EXISTS _fraud_ids;
    CREATE TEMP TABLE _fraud_ids (pedido_id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _fraud_ids
    SELECT DISTINCT a1.pedido_id
    FROM _addr_map a1
    JOIN _addr_map a2 ON a1.chave = a2.chave AND a1.pedido_id != a2.pedido_id
    WHERE a1.doc != a2.doc OR a1.nome != a2.nome
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- PASSO 2: PROCESSAR PEDIDOS PRINCIPAIS
    -- ============================================================
    FOR pedido_pai IN
        SELECT p.*,
               normalizar_documento(p.cpf_cliente) AS doc_limpo,
               LOWER(COALESCE(p.email_cliente, '')) AS email_lower,
               UPPER(REPLACE(COALESCE(p.nome_oferta, ''), ' ', '')) AS oferta_norm,
               sigla_produto(p.nome_produto) AS sigla
        FROM pedidos p
        WHERE p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
          AND p.codigo_transacao IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
          AND sigla_produto(p.nome_produto) IS NOT NULL
          AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) NOT LIKE '%ORDERBUMP%'
          AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) NOT LIKE '%UPSELL%'
          AND UPPER(COALESCE(p.nome_oferta,'')) NOT LIKE '%CC%'
        ORDER BY p.data_venda ASC NULLS LAST
    LOOP
        IF EXISTS (SELECT 1 FROM _processed WHERE pedido_id = pedido_pai.id) THEN
            CONTINUE;
        END IF;

        v_codigos_filhos   := ARRAY[]::TEXT[];
        v_order_bumps      := ARRAY[]::TEXT[];
        v_upsells          := ARRAY[]::TEXT[];
        v_pos_vendas       := ARRAY[]::TEXT[];
        v_quantidade       := 1;
        v_doc_limpo        := pedido_pai.doc_limpo;
        v_email_lower      := pedido_pai.email_lower;
        v_tem_dois_cartoes := FALSE;
        v_sigla            := pedido_pai.sigla;

        INSERT INTO _processed VALUES (pedido_pai.id) ON CONFLICT DO NOTHING;

        -- Fraude de endereço
        IF EXISTS (SELECT 1 FROM _fraud_ids WHERE pedido_id = pedido_pai.id) THEN
            v_total_mesmo_endereco := v_total_mesmo_endereco + 1;
            INSERT INTO pedidos_consolidados_v3 (
                id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
                valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
                telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
                endereco_completo, data_venda, created_at, metadata, produto_principal,
                descricao_pacote, fraude_endereco, status_envio,
                dia_despacho, codigos_agrupados, quantidade_pedidos
            ) VALUES (
                pedido_pai.id, pedido_pai.codigo_transacao, 'Mesmo End',
                pedido_pai.nome_produto, pedido_pai.nome_oferta,
                pedido_pai.valor_total, pedido_pai.forma_pagamento, pedido_pai.parcelas,
                pedido_pai.nome_cliente, pedido_pai.email_cliente,
                pedido_pai.cpf_cliente, pedido_pai.telefone_cliente,
                pedido_pai.cep, COALESCE(pedido_pai.logradouro, pedido_pai.rua),
                pedido_pai.numero, pedido_pai.complemento, pedido_pai.bairro,
                pedido_pai.cidade, pedido_pai.estado,
                CONCAT_WS(', ', COALESCE(pedido_pai.logradouro,pedido_pai.rua),
                    pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
                pedido_pai.data_venda, pedido_pai.created_at, pedido_pai.metadata,
                v_sigla, v_sigla || ' - ' || pedido_pai.nome_oferta,
                TRUE, 'Bloqueado',
                (pedido_pai.data_venda::DATE + INTERVAL '2 days')::DATE,
                ARRAY[pedido_pai.codigo_transacao], 1
            ) ON CONFLICT (codigo_transacao) DO UPDATE SET
                status_aprovacao = 'Mesmo End', fraude_endereco = TRUE, updated_at = now();
            CONTINUE;
        END IF;

        -- Order Bumps (email + mesma data)
        FOR rec IN
            SELECT p.id, p.codigo_transacao, p.nome_oferta
            FROM pedidos p
            WHERE p.id != pedido_pai.id
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(COALESCE(p.email_cliente, '')) = v_email_lower
              AND v_email_lower != ''
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
              AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%ORDERBUMP%'
        LOOP
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            v_order_bumps    := array_append(v_order_bumps, rec.nome_oferta);
            v_quantidade     := v_quantidade + 1;
            v_total_order_bumps := v_total_order_bumps + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- Upsell (CPF + mesma data ou +1 dia)
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            FOR rec IN
                SELECT p.id, p.codigo_transacao, p.nome_oferta
                FROM pedidos p
                WHERE p.id != pedido_pai.id
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                  AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
                  AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
                  AND p.data_venda::DATE >= pedido_pai.data_venda::DATE
                  AND p.data_venda::DATE <= pedido_pai.data_venda::DATE + INTERVAL '1 day'
                  AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%UPSELL%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_upsells        := array_append(v_upsells, rec.nome_oferta);
                v_quantidade     := v_quantidade + 1;
                v_total_upsells  := v_total_upsells + 1;
                INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- Dois cartões (mesmo email + mesma oferta + mesma data)
        FOR rec IN
            SELECT p.id, p.codigo_transacao
            FROM pedidos p
            WHERE p.id != pedido_pai.id
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(COALESCE(p.email_cliente, '')) = v_email_lower
              AND v_email_lower != ''
              AND TRIM(p.nome_oferta) = TRIM(pedido_pai.nome_oferta)
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            v_total_dois_cartoes := v_total_dois_cartoes + 1;
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- Pós Vendas CC (CPF + janela PV)
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            v_data_limite := calcular_janela_pv(pedido_pai.data_venda::DATE);
            FOR rec IN
                SELECT p.id, p.codigo_transacao, p.nome_oferta, p.nome_produto,
                       sigla_produto(p.nome_produto) AS sigla_pv
                FROM pedidos p
                WHERE p.id != pedido_pai.id
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                  AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
                  AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
                  AND p.data_venda::DATE >  pedido_pai.data_venda::DATE
                  AND p.data_venda::DATE <= v_data_limite
                  AND UPPER(COALESCE(p.nome_oferta, '')) LIKE '%CC%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_pos_vendas     := array_append(v_pos_vendas,
                    COALESCE(rec.sigla_pv,'') || ':' || rec.nome_oferta);
                v_quantidade     := v_quantidade + 1;
                v_total_pos_vendas := v_total_pos_vendas + 1;
                INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- Montar nome oferta consolidado
        v_nome_oferta := pedido_pai.nome_oferta;
        v_nome_oferta := v_nome_oferta || REPEAT(' + Order Bump', COALESCE(array_length(v_order_bumps, 1), 0));
        v_nome_oferta := v_nome_oferta || REPEAT(' + UPSELL',     COALESCE(array_length(v_upsells, 1), 0));

        DECLARE
            v_pv_dp2 INT := 0; v_pv_bf2 INT := 0; v_pv_bl2 INT := 0;
            v_pv_item2 TEXT;
        BEGIN
            IF v_pos_vendas IS NOT NULL THEN
                FOREACH v_pv_item2 IN ARRAY v_pos_vendas LOOP
                    IF    v_pv_item2 LIKE 'DP:%' THEN v_pv_dp2 := v_pv_dp2 + 1;
                    ELSIF v_pv_item2 LIKE 'BF:%' THEN v_pv_bf2 := v_pv_bf2 + 1;
                    ELSIF v_pv_item2 LIKE 'BL:%' THEN v_pv_bl2 := v_pv_bl2 + 1;
                    END IF;
                END LOOP;
            END IF;
            IF v_pv_dp2 > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_dp2 || ' DP'; END IF;
            IF v_pv_bf2 > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bf2 || ' BF'; END IF;
            IF v_pv_bl2 > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bl2 || ' BL'; END IF;
        END;

        v_descricao := v_sigla || ' - ' || v_nome_oferta;

        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
            valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
            telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
            endereco_completo, data_venda, created_at, metadata,
            descricao_pacote, codigos_agrupados, quantidade_pedidos, produto_principal,
            dia_despacho, status_envio,
            order_bumps, upsells, pos_vendas, codigos_filhos,
            tem_dois_cartoes, fraude_endereco
        ) VALUES (
            pedido_pai.id, pedido_pai.codigo_transacao,
            CASE WHEN v_tem_dois_cartoes THEN '2 Cartões' ELSE 'Aprovado' END,
            pedido_pai.nome_produto, v_nome_oferta,
            pedido_pai.valor_total, pedido_pai.forma_pagamento, pedido_pai.parcelas,
            pedido_pai.nome_cliente, pedido_pai.email_cliente,
            pedido_pai.cpf_cliente, pedido_pai.telefone_cliente,
            pedido_pai.cep, COALESCE(pedido_pai.logradouro, pedido_pai.rua),
            pedido_pai.numero, pedido_pai.complemento, pedido_pai.bairro,
            pedido_pai.cidade, pedido_pai.estado,
            CONCAT_WS(', ', COALESCE(pedido_pai.logradouro,pedido_pai.rua),
                pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
            pedido_pai.data_venda, pedido_pai.created_at, pedido_pai.metadata,
            v_descricao,
            ARRAY[pedido_pai.codigo_transacao] || v_codigos_filhos,
            v_quantidade, v_sigla,
            (pedido_pai.data_venda::DATE + INTERVAL '2 days')::DATE,
            'Pendente',
            v_order_bumps, v_upsells, v_pos_vendas, v_codigos_filhos,
            v_tem_dois_cartoes, FALSE
        ) ON CONFLICT (codigo_transacao) DO UPDATE SET
            nome_oferta        = EXCLUDED.nome_oferta,
            descricao_pacote   = EXCLUDED.descricao_pacote,
            codigos_agrupados  = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps        = EXCLUDED.order_bumps,
            upsells            = EXCLUDED.upsells,
            pos_vendas         = EXCLUDED.pos_vendas,
            codigos_filhos     = EXCLUDED.codigos_filhos,
            tem_dois_cartoes   = EXCLUDED.tem_dois_cartoes,
            updated_at         = now();

        v_total_principais := v_total_principais + 1;
    END LOOP;

    -- Cleanup
    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;
    DROP TABLE IF EXISTS _addr_map;
    DROP TABLE IF EXISTS _fraud_ids;

    RETURN QUERY SELECT
        v_total_principais, v_total_order_bumps,
        v_total_upsells, v_total_pos_vendas,
        v_total_dois_cartoes, v_total_mesmo_endereco;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION consolidar_pedidos() TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON pedidos_consolidados_v3 TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
SELECT 'Migration 048 v2: consolidar_pedidos() com PASSO 0.5-CC + PASSO 0.5-OB (colunas corretas)!' AS resultado;
