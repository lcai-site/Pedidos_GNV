-- ================================================================
-- MIGRATION 061: Corrigir Status e Mapeamento de Consolidação (FINAL - v14)
-- Data: 2026-03-13
--
-- O que essa migration resolve:
-- 1. Restaura os status de faturamento.
-- 2. PREFIXO DE SIGLA obrigatório.
-- 3. LIMPEZA GLOBAL de órfãos (Bumps soltos).
-- 4. SINCRONIZAÇÃO DE STATUS: Remove pedidos CANCELADOS/ESTORNADOS automaticamente.
-- 5. CONTAGEM BRUTA fixada (ignora 2nd card).
-- 6. PRESERVAÇÃO DE LIBERAÇÃO: Não sobrescreve dia_despacho se PV_REALIZADO.
-- ================================================================

CREATE OR REPLACE FUNCTION consolidar_pedidos_ticto()
RETURNS void AS $$
DECLARE
    pedido_pai RECORD;
    rec RECORD;
    v_codigos_filhos TEXT[];
    v_quantidade INT;
    v_order_bumps TEXT[];
    v_upsells TEXT[];
    v_pos_vendas TEXT[];
    v_tem_dois_cartoes BOOLEAN;
    v_nome_oferta TEXT;
    v_sigla_pai TEXT;
    v_valid_status TEXT[] := ARRAY['authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago', 'printing', 'printed'];
    v_data_limite_pv TIMESTAMP;
    v_dia_pv DATE;
    v_dia_despacho DATE;
BEGIN
    -- 0.1 LIMPEZA DE PEDIDOS QUE FORAM CANCELADOS OU ESTORNADOS NA TICTO
    DELETE FROM pedidos_consolidados_v3 c
    USING ticto_pedidos p
    WHERE c.codigo_transacao = p.transaction_hash
      AND p.status != ANY(v_valid_status)
      AND c.foi_editado = FALSE;

    -- 0.2 LIMPEZA GLOBAL DE ÓRFÃOS
    DELETE FROM pedidos_consolidados_v3
    WHERE (UPPER(REPLACE(descricao_pacote, ' ', '')) LIKE '%ORDERBUMP%' 
       OR UPPER(descricao_pacote) LIKE 'OB %'
       OR UPPER(descricao_pacote) LIKE '%UPSELL%')
      AND (quantidade_pedidos = 1 OR quantidade_pedidos IS NULL)
      AND foi_editado = FALSE;

    CREATE TEMP TABLE IF NOT EXISTS _processed (pedido_id TEXT PRIMARY KEY) ON COMMIT DROP;
    CREATE TEMP TABLE IF NOT EXISTS _ignorar_pai (pedido_id TEXT PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _ignorar_pai (pedido_id)
    SELECT id::TEXT FROM ticto_pedidos p
    WHERE UPPER(REPLACE(p.offer_name, ' ', '')) LIKE '%ORDERBUMP%' 
       OR UPPER(p.offer_name) LIKE '%OB %' 
       OR UPPER(p.offer_name) LIKE 'OB %'
       OR UPPER(p.offer_name) LIKE '%UPSELL%'
       OR UPPER(p.offer_name) LIKE '%CC%'
    ON CONFLICT DO NOTHING;

    FOR pedido_pai IN
        SELECT p.*, LOWER(p.customer_email) AS email_lower, REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') AS doc_limpo
        FROM ticto_pedidos p
        WHERE p.status = ANY(v_valid_status)
        AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id::TEXT)
        AND NOT EXISTS (SELECT 1 FROM _ignorar_pai WHERE pedido_id = p.id::TEXT)
        ORDER BY p.order_date ASC
    LOOP
        v_codigos_filhos := ARRAY[pedido_pai.transaction_hash];
        v_quantidade := 1;
        v_order_bumps := ARRAY[]::TEXT[];
        v_upsells := ARRAY[]::TEXT[];
        v_pos_vendas := ARRAY[]::TEXT[];
        v_tem_dois_cartoes := FALSE;
        
        v_sigla_pai := CASE 
            WHEN UPPER(pedido_pai.product_name) LIKE '%DESEJO%' THEN 'DP'
            WHEN UPPER(pedido_pai.product_name) LIKE '%LUMI%' THEN 'BL'
            WHEN UPPER(pedido_pai.product_name) LIKE '%FORMA%' THEN 'BF'
            ELSE NULL END;

        v_nome_oferta := pedido_pai.offer_name;
        IF v_sigla_pai IS NOT NULL THEN v_nome_oferta := v_sigla_pai || ' - ' || v_nome_oferta; END IF;

        INSERT INTO _processed (pedido_id) VALUES (pedido_pai.id::TEXT) ON CONFLICT DO NOTHING;

        BEGIN
            v_dia_pv := proximo_dia_util((pedido_pai.order_date AT TIME ZONE 'America/Sao_Paulo')::DATE);
            v_dia_despacho := proximo_dia_util(v_dia_pv);
        EXCEPTION WHEN OTHERS THEN v_dia_despacho := ((pedido_pai.order_date AT TIME ZONE 'America/Sao_Paulo')::DATE + 2);
        END;
        v_data_limite_pv := (pedido_pai.order_date + INTERVAL '5 days');

        FOR rec IN
            SELECT id, transaction_hash, offer_name, product_name, order_date FROM ticto_pedidos p
            WHERE p.id != pedido_pai.id AND p.status = ANY(v_valid_status) 
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id::TEXT)
            AND (LOWER(COALESCE(p.customer_email, '')) = pedido_pai.email_lower OR (LENGTH(pedido_pai.doc_limpo) >= 11 AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo))
            AND p.order_date >= pedido_pai.order_date AND p.order_date <= v_data_limite_pv
            AND (UPPER(REPLACE(p.offer_name, ' ', '')) LIKE '%ORDERBUMP%' OR UPPER(p.offer_name) LIKE '%OB %' OR UPPER(p.offer_name) LIKE '%UPSELL%' OR UPPER(p.offer_name) LIKE '%CC%' OR (p.offer_name = pedido_pai.offer_name))
        LOOP
            IF rec.offer_name = pedido_pai.offer_name THEN
                v_tem_dois_cartoes := TRUE;
            ELSE
                IF UPPER(rec.offer_name) LIKE '%CC%' THEN
                    DECLARE v_sigla_pv TEXT; v_match TEXT; v_qtde INT;
                    BEGIN
                        v_sigla_pv := CASE WHEN UPPER(rec.product_name) LIKE '%DESEJO%' THEN 'DP' WHEN UPPER(rec.product_name) LIKE '%LUMI%' THEN 'BL' WHEN UPPER(rec.product_name) LIKE '%FORMA%' THEN 'BF' ELSE 'OUTRO' END;
                        v_match := substring(UPPER(rec.offer_name) from '([0-9]+)\s*FRASCO');
                        IF v_match IS NULL THEN v_match := substring(UPPER(rec.offer_name) from '([0-9]+)\s*POTE'); END IF;
                        IF v_match IS NOT NULL THEN v_qtde := v_match::INT; ELSE v_qtde := 1; END IF;
                        v_pos_vendas := array_append(v_pos_vendas, v_sigla_pv || ':' || v_qtde::TEXT);
                    END;
                ELSIF UPPER(rec.offer_name) LIKE '%UPSELL%' THEN v_upsells := array_append(v_upsells, rec.offer_name);
                ELSE v_order_bumps := array_append(v_order_bumps, rec.offer_name);
                END IF;
                v_quantidade := v_quantidade + 1;
            END IF;
            IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) THEN v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash); END IF;
            INSERT INTO _processed (pedido_id) VALUES (rec.id::TEXT) ON CONFLICT DO NOTHING;
        END LOOP;

        DECLARE v_pv_dp INT := 0; v_pv_bf INT := 0; v_pv_bl INT := 0; v_pv_item TEXT; v_sigla_s TEXT; v_qtde_s INT;
        BEGIN
            IF v_pos_vendas IS NOT NULL THEN
                FOREACH v_pv_item IN ARRAY v_pos_vendas LOOP
                    v_sigla_s := split_part(v_pv_item, ':', 1); v_qtde_s := split_part(v_pv_item, ':', 2)::INT;
                    IF v_sigla_s = 'DP' THEN v_pv_dp := v_pv_dp + v_qtde_s; ELSIF v_sigla_s = 'BF' THEN v_pv_bf := v_pv_bf + v_qtde_s; ELSIF v_sigla_s = 'BL' THEN v_pv_bl := v_pv_bl + v_qtde_s; END IF;
                END LOOP;
            END IF;
            IF v_pv_dp > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_dp || ' DP'; END IF;
            IF v_pv_bf > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bf || ' BF'; END IF;
            IF v_pv_bl > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bl || ' BL'; END IF;
        END;
        IF array_length(v_order_bumps, 1) > 0 AND UPPER(v_nome_oferta) NOT LIKE '%ORDER BUMP%' THEN v_nome_oferta := v_nome_oferta || ' + Order Bump'; END IF;
        IF v_tem_dois_cartoes THEN v_nome_oferta := v_nome_oferta || ' (2 Cartões)'; END IF;

        DELETE FROM pedidos_consolidados_v3 WHERE codigo_transacao = ANY(v_codigos_filhos) AND codigo_transacao != pedido_pai.transaction_hash AND foi_editado = FALSE;

        INSERT INTO pedidos_consolidados_v3 (
            codigo_transacao, data_venda, nome_cliente, cpf, email, telefone, endereco_completo, logradouro, numero, complemento, bairro, cidade, estado, cep, nome_oferta, descricao_pacote, quantidade_pedidos, valor_total, status_envio, codigos_agrupados, dia_despacho, status_aprovacao, produto_principal, order_bumps, upsells, pos_vendas, tem_dois_cartoes
        ) VALUES (
            pedido_pai.transaction_hash, pedido_pai.order_date, pedido_pai.customer_name, pedido_pai.customer_cpf, pedido_pai.customer_email, pedido_pai.customer_phone, COALESCE(pedido_pai.address_street, '') || ', ' || COALESCE(pedido_pai.address_number, '') || ' - ' || COALESCE(pedido_pai.address_neighborhood, '') || ', ' || COALESCE(pedido_pai.address_city, '') || '/' || COALESCE(pedido_pai.address_state, '') || ' - CEP: ' || COALESCE(pedido_pai.address_zip_code, ''),
            pedido_pai.address_street, pedido_pai.address_number, pedido_pai.address_complement, pedido_pai.address_neighborhood, pedido_pai.address_city, pedido_pai.address_state, pedido_pai.address_zip_code, pedido_pai.offer_name, v_nome_oferta, v_quantidade, pedido_pai.paid_amount, 'Pendente', v_codigos_filhos, v_dia_despacho, CASE WHEN v_tem_dois_cartoes THEN '2 Cartões' ELSE 'Aprovado' END, COALESCE(v_sigla_pai, 'OUTRO'), v_order_bumps, v_upsells, v_pos_vendas, v_tem_dois_cartoes
        ) ON CONFLICT (codigo_transacao) DO UPDATE SET
            data_venda = EXCLUDED.data_venda, nome_cliente = EXCLUDED.nome_cliente, cpf = EXCLUDED.cpf, email = EXCLUDED.email, telefone = EXCLUDED.telefone, endereco_completo = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.endereco_completo ELSE EXCLUDED.endereco_completo END, logradouro = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.logradouro ELSE EXCLUDED.logradouro END, numero = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.numero ELSE EXCLUDED.numero END, complemento = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.complemento ELSE EXCLUDED.complemento END, bairro = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.bairro ELSE EXCLUDED.bairro END, cidade = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.cidade ELSE EXCLUDED.cidade END, estado = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.estado ELSE EXCLUDED.estado END, cep = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.cep ELSE EXCLUDED.cep END, nome_oferta = EXCLUDED.nome_oferta, descricao_pacote = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.descricao_pacote ELSE EXCLUDED.descricao_pacote END, quantidade_pedidos = EXCLUDED.quantidade_pedidos, valor_total = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.valor_total ELSE EXCLUDED.valor_total END, codigos_agrupados = EXCLUDED.codigos_agrupados, 
            dia_despacho = CASE WHEN pedidos_consolidados_v3.pv_realizado = TRUE THEN pedidos_consolidados_v3.dia_despacho ELSE EXCLUDED.dia_despacho END, 
            status_aprovacao = EXCLUDED.status_aprovacao, produto_principal = EXCLUDED.produto_principal, order_bumps = EXCLUDED.order_bumps, upsells = EXCLUDED.upsells, pos_vendas = EXCLUDED.pos_vendas, tem_dois_cartoes = EXCLUDED.tem_dois_cartoes, updated_at = NOW();
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT consolidar_pedidos_ticto();