-- ================================================================
-- MIGRATION 056: Filtros de Status nos subloops e Contagem Real de Frascos (PV)
-- Data: 2026-03-03
--
-- O que essa migration resolve:
-- 1. Faltava a validação de status de pagamento dentro dos subloops.
--    Isso fazia com que Upsells "Recusados" ou "Pix Gerados" de PV
--    fossem indevidamente anexados ao pedido pai pago.
-- 2. A consolidação dos produtos de Pós-Venda (CC) adicionava +1
--    para cada transação aprovada. Porém, o correto é ler a "quantidade
--    de frascos" da oferta (ex: "2 Frascos - CC" = + 2 BF, não 1).
--    Aplicamos extração via Regex no PostgreSQL para somar frascos reais.
-- ================================================================

CREATE OR REPLACE FUNCTION consolidar_pedidos_ticto()
RETURNS jsonb AS $$
DECLARE
    v_total_principais INTEGER := 0;
    
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
    
    v_hoje DATE;
    v_nome_feriado TEXT;
    v_dia_pv DATE;
    v_dia_despacho DATE;
    
    -- Status esperados para pedidos serem considerados "faturados"
    -- Usado tanto na head quanto nos subloops
    v_valid_status TEXT[] := ARRAY['authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago'];
BEGIN
    v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

    SELECT nome INTO v_nome_feriado FROM feriados WHERE data = v_hoje;
    IF v_nome_feriado IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'skipped');
    END IF;

    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;

    CREATE TEMP TABLE _locked_ids AS
    SELECT id FROM pedidos_consolidados_v3
    WHERE codigo_rastreio IS NOT NULL OR foi_editado = TRUE OR data_envio IS NOT NULL;

    CREATE TEMP TABLE _locked_codes AS
    SELECT codigo_transacao FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids)
    UNION
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids);

    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
    ) to_delete
    WHERE c.id = to_delete.id;

    CREATE TEMP TABLE _processed (pedido_id UUID PRIMARY KEY);
    
    INSERT INTO _processed (pedido_id)
    SELECT id FROM ticto_pedidos WHERE transaction_hash IN (SELECT codigo_transacao FROM _locked_codes);

    -- =========================================================
    -- LOOP PRINCIPAL DE PAIS 
    -- =========================================================
    FOR pedido_pai IN
        SELECT 
            p.*,
            REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') as doc_limpo,
            LOWER(COALESCE(p.customer_email, '')) as email_lower,
            UPPER(REPLACE(COALESCE(p.offer_name, ''), ' ', '')) as oferta_norm,
            CASE 
                WHEN UPPER(p.product_name) LIKE '%DESEJO%' THEN 'DP'
                WHEN UPPER(p.product_name) LIKE '%LUMI%' THEN 'BL'
                WHEN UPPER(p.product_name) LIKE '%FORMA%' THEN 'BF'
                ELSE NULL
            END as sigla
        FROM ticto_pedidos p
        WHERE p.status = ANY(v_valid_status)
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%CC%'
        ORDER BY 
          p.order_date ASC,
          CASE 
               WHEN UPPER(COALESCE(p.offer_name,'')) LIKE '%ORDERBUMP%' THEN 1 
               WHEN UPPER(COALESCE(p.offer_name,'')) LIKE '%UPSELL%' THEN 1
               ELSE 0 
          END ASC,
          p.created_at ASC
    LOOP
        IF pedido_pai.sigla IS NULL THEN CONTINUE; END IF;

        IF EXISTS (SELECT 1 FROM _processed WHERE pedido_id = pedido_pai.id) THEN
            CONTINUE;
        END IF;

        v_codigos_filhos := ARRAY[]::TEXT[];
        v_order_bumps := ARRAY[]::TEXT[];
        v_upsells := ARRAY[]::TEXT[];
        v_pos_vendas := ARRAY[]::TEXT[];
        v_quantidade := 1;
        v_tem_dois_cartoes := FALSE;
        
        v_nome_oferta := pedido_pai.offer_name;

        INSERT INTO _processed (pedido_id) VALUES (pedido_pai.id) ON CONFLICT DO NOTHING;

        BEGIN
            v_dia_pv := proximo_dia_util(pedido_pai.order_date::DATE);
            v_dia_despacho := proximo_dia_util(v_dia_pv);
        EXCEPTION WHEN OTHERS THEN
            v_dia_despacho := (pedido_pai.order_date::DATE + 2);
        END;

        -- O BUMPS (Mesmo dia, Mesmo e-mail)
        FOR rec IN
            SELECT id, transaction_hash, offer_name FROM ticto_pedidos p
            WHERE p.id != pedido_pai.id
            AND p.status = ANY(v_valid_status) 
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.order_date::DATE = pedido_pai.order_date::DATE
            AND UPPER(REPLACE(p.offer_name, ' ', '')) LIKE '%ORDERBUMP%'
        LOOP
            IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            END IF;
            v_order_bumps := array_append(v_order_bumps, rec.offer_name);
            v_quantidade := v_quantidade + 1;
            INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- UPSELLS (Doc Limpo, até +1 dia)
        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT id, transaction_hash, offer_name FROM ticto_pedidos p
                WHERE p.id != pedido_pai.id
                AND p.status = ANY(v_valid_status) 
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE BETWEEN pedido_pai.order_date::DATE AND (pedido_pai.order_date::DATE + 1)
                AND UPPER(p.offer_name) LIKE '%UPSELL%'
            LOOP
                IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                END IF;
                v_upsells := array_append(v_upsells, rec.offer_name);
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- 2 CARTÕES (Mesmo nome, E-mail, data e oferta principal idêntica)
        FOR rec IN
            SELECT id, transaction_hash FROM ticto_pedidos p
            WHERE p.id != pedido_pai.id
            AND p.status = ANY(v_valid_status) 
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.offer_name = pedido_pai.offer_name
            AND p.order_date::DATE = pedido_pai.order_date::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            END IF;
            INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- PÓS-VENDAS / CALL CENTER
        IF EXTRACT(DOW FROM pedido_pai.order_date) IN (4, 5) THEN
            v_data_limite := pedido_pai.order_date::DATE + 4;
        ELSE
            v_data_limite := pedido_pai.order_date::DATE + 2;
        END IF;

        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT id, transaction_hash, offer_name, product_name FROM ticto_pedidos p
                WHERE p.id != pedido_pai.id
                AND p.status = ANY(v_valid_status) 
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE > pedido_pai.order_date::DATE
                AND p.order_date::DATE <= v_data_limite
                AND UPPER(p.offer_name) LIKE '%CC%'
            LOOP
                DECLARE 
                    v_sigla_pv TEXT;
                    v_match TEXT;
                    v_qtde INT;
                BEGIN
                    v_sigla_pv := CASE 
                        WHEN UPPER(rec.product_name) LIKE '%DESEJO%' THEN 'DP'
                        WHEN UPPER(rec.product_name) LIKE '%LUMI%' THEN 'BL'
                        WHEN UPPER(rec.product_name) LIKE '%FORMA%' THEN 'BF'
                        ELSE 'OUTRO' END;
                    
                    -- Regex segura para extrair o numerico antes de Frasco, Pote ou Unidade.
                    -- Usa grupos de captura e case-insensitivity default via UPPER.
                    v_match := substring(UPPER(rec.offer_name) from '([0-9]+)\s*FRASCO');
                    IF v_match IS NULL THEN v_match := substring(UPPER(rec.offer_name) from '([0-9]+)\s*POTE'); END IF;
                    IF v_match IS NULL THEN v_match := substring(UPPER(rec.offer_name) from '([0-9]+)\s*UNIDADE'); END IF;
                    IF v_match IS NULL THEN v_match := substring(UPPER(rec.offer_name) from '([0-9]+)'); END IF;
                    
                    IF v_match IS NOT NULL THEN 
                        v_qtde := v_match::INT; 
                    ELSE 
                        v_qtde := 1; 
                    END IF;

                    -- Guarda 'BL:2' para somar dps
                    v_pos_vendas := array_append(v_pos_vendas, v_sigla_pv || ':' || v_qtde::TEXT);
                END;
                
                IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                END IF;
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- =========================================================
        -- FORMATAÇÃO FINAL 
        -- =========================================================
        IF array_length(v_order_bumps, 1) > 0 THEN 
            IF UPPER(REPLACE(v_nome_oferta, ' ', '')) NOT LIKE '%ORDERBUMP%' THEN
                v_nome_oferta := v_nome_oferta || ' + Order Bump'; 
            END IF;
        END IF;
        
        IF array_length(v_upsells, 1) > 0 THEN 
            IF UPPER(REPLACE(v_nome_oferta, ' ', '')) NOT LIKE '%UPSELL%' THEN
                v_nome_oferta := v_nome_oferta || ' + ' || array_length(v_upsells, 1) || ' UPSELL'; 
            END IF;
        END IF;
        
        -- Conta e formata os PVs somando EXTRAÍDOS POR Regex
        DECLARE
            v_pv_dp INT := 0; v_pv_bf INT := 0; v_pv_bl INT := 0; v_pv_item TEXT;
            v_sigla_s TEXT; v_qtde_s INT;
        BEGIN
            IF v_pos_vendas IS NOT NULL THEN
                FOREACH v_pv_item IN ARRAY v_pos_vendas LOOP
                    v_sigla_s := split_part(v_pv_item, ':', 1);
                    BEGIN
                        v_qtde_s := split_part(v_pv_item, ':', 2)::INT;
                    EXCEPTION WHEN OTHERS THEN 
                        v_qtde_s := 1;
                    END;

                    IF    v_sigla_s = 'DP' THEN v_pv_dp := v_pv_dp + v_qtde_s;
                    ELSIF v_sigla_s = 'BF' THEN v_pv_bf := v_pv_bf + v_qtde_s;
                    ELSIF v_sigla_s = 'BL' THEN v_pv_bl := v_pv_bl + v_qtde_s;
                    END IF;
                END LOOP;
            END IF;
            IF v_pv_dp > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_dp || ' DP'; END IF;
            IF v_pv_bf > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bf || ' BF'; END IF;
            IF v_pv_bl > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bl || ' BL'; END IF;
        END;

        v_descricao := pedido_pai.sigla || ' - ' || v_nome_oferta;

        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
            valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
            telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
            endereco_completo, data_venda, created_at, 
            descricao_pacote, codigos_agrupados, quantidade_pedidos, produto_principal,
            dia_despacho, status_envio,
            order_bumps, upsells, pos_vendas, codigos_filhos, tem_dois_cartoes, fraude_endereco
        ) VALUES (
            pedido_pai.id,
            pedido_pai.transaction_hash,
            CASE WHEN v_tem_dois_cartoes THEN '2 Cartões' ELSE 'Aprovado' END,
            pedido_pai.product_name,
            v_nome_oferta,
            pedido_pai.paid_amount,
            pedido_pai.payment_method,
            pedido_pai.installments,
            pedido_pai.customer_name,
            pedido_pai.customer_email,
            pedido_pai.customer_cpf,
            pedido_pai.customer_phone,
            pedido_pai.address_zip_code,
            pedido_pai.address_street,
            pedido_pai.address_number,
            pedido_pai.address_complement,
            pedido_pai.address_neighborhood,
            pedido_pai.address_city,
            pedido_pai.address_state,
            CONCAT_WS(', ', pedido_pai.address_street, pedido_pai.address_number, pedido_pai.address_neighborhood, pedido_pai.address_city, pedido_pai.address_state),
            pedido_pai.order_date,
            pedido_pai.created_at,
            v_descricao,
            ARRAY[pedido_pai.transaction_hash] || v_codigos_filhos,
            v_quantidade,
            pedido_pai.sigla,
            v_dia_despacho, 
            'Pendente',
            v_order_bumps, v_upsells, v_pos_vendas, v_codigos_filhos,
            v_tem_dois_cartoes, FALSE
        )
        ON CONFLICT (codigo_transacao) DO UPDATE SET
            nome_oferta = EXCLUDED.nome_oferta,
            descricao_pacote = EXCLUDED.descricao_pacote,
            codigos_agrupados = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps = EXCLUDED.order_bumps,
            upsells = EXCLUDED.upsells,
            pos_vendas = EXCLUDED.pos_vendas,
            codigos_filhos = EXCLUDED.codigos_filhos,
            updated_at = now();
            
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Consolidação concluída com sucesso'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION consolidar_pedidos_ticto() TO anon, authenticated, service_role;
