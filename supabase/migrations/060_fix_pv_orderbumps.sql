-- ================================================================
-- MIGRATION 060: Corrigir consolidação de Order Bumps no Pós-Venda
-- Data: 2026-03-12
--
-- O que essa migration resolve:
-- Quando um cliente comprava um Pós-Venda (CC) no dia seguinte à compra
-- principal (mas antes da janela de Despacho) E adicionava um Order Bump
-- ou Upsell, esses itens extras eram ignorados.
-- O motivo é que a varredura de OBs e Upsells olhava ESTRITAMENTE para
-- o MESMO DIA da compra matriz.
-- Agora, a varredura usa a `v_data_limite_pv`, ou seja, pega tudo do email/cpf
-- vinculado que aconteceu desde a compra matriz até às 08:30 do dia do despacho.
-- ================================================================

DROP FUNCTION IF EXISTS consolidar_pedidos_ticto();

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
    v_valid_status TEXT[] := ARRAY['approved', 'printing', 'printed'];
    v_data_limite_pv TIMESTAMP;
    v_dia_pv DATE;
    v_dia_despacho DATE;
    v_is_limite_fds BOOLEAN;
BEGIN
    CREATE TEMP TABLE IF NOT EXISTS _processed (pedido_id TEXT PRIMARY KEY) ON COMMIT DROP;
    CREATE TEMP TABLE IF NOT EXISTS _ignorar_pai (pedido_id TEXT PRIMARY KEY) ON COMMIT DROP;

    -- 0. PRÉ-PROCESSA FILHOS DE PÓS-VENDA (CC) PARA QUE NÃO SEJAM CONSUMIDOS COMO PAIS
    INSERT INTO _ignorar_pai (pedido_id)
    SELECT p_filho.id::TEXT
    FROM ticto_pedidos p_filho
    JOIN ticto_pedidos pv ON pv.transaction_hash = p_filho.transaction_hash
    WHERE pv.status = ANY(v_valid_status) 
      AND UPPER(pv.offer_name) LIKE '%CC%'
      AND p_filho.id != pv.id
      AND UPPER(p_filho.offer_name) NOT LIKE '%CC%'
    ON CONFLICT DO NOTHING;

    FOR pedido_pai IN
        SELECT p.*,
            LOWER(p.customer_email) AS email_lower,
            REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') AS doc_limpo
        FROM ticto_pedidos p
        WHERE p.status = ANY(v_valid_status)
        AND UPPER(p.offer_name) NOT LIKE '%ORDERBUMP%'
        AND UPPER(p.offer_name) NOT LIKE '%UPSELL%'
        AND UPPER(p.offer_name) NOT LIKE '%CC%'
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
        v_nome_oferta := pedido_pai.offer_name;

        INSERT INTO _processed (pedido_id) VALUES (pedido_pai.id::TEXT) ON CONFLICT DO NOTHING;

        -- 1. Calcula o Dia do Despacho rigorosamente
        BEGIN
            v_dia_pv := proximo_dia_util((pedido_pai.order_date AT TIME ZONE 'America/Sao_Paulo')::DATE);
            v_dia_despacho := proximo_dia_util(v_dia_pv);
        EXCEPTION WHEN OTHERS THEN
            v_dia_despacho := ((pedido_pai.order_date AT TIME ZONE 'America/Sao_Paulo')::DATE + 2);
        END;

        -- 2. Define a Data Limite (Pós-Venda, OBs de Pós Venda e Upsells de Pós-Venda) ==> 08:30:59 do dia do despacho
        v_data_limite_pv := ((v_dia_despacho::TEXT || ' 08:30:59')::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo');


        -- O BUMPS 
        -- Agora busca qualquer OB feito entre o pedido pai e a data limite de envio
        FOR rec IN
            SELECT id, transaction_hash, offer_name FROM ticto_pedidos p
            WHERE p.id != pedido_pai.id
            AND p.status = ANY(v_valid_status) 
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id::TEXT)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.order_date >= pedido_pai.order_date
            AND p.order_date <= v_data_limite_pv
            AND UPPER(REPLACE(p.offer_name, ' ', '')) LIKE '%ORDERBUMP%'
        LOOP
            IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            END IF;
            v_order_bumps := array_append(v_order_bumps, rec.offer_name);
            v_quantidade := v_quantidade + 1;
            INSERT INTO _processed (pedido_id) VALUES (rec.id::TEXT) ON CONFLICT DO NOTHING;
        END LOOP;


        -- UPSELLS
        -- Agora busca qualquer UPSELL feito entre o pedido pai e a data limite de envio
        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT id, transaction_hash, offer_name FROM ticto_pedidos p
                WHERE p.id != pedido_pai.id
                AND p.status = ANY(v_valid_status) 
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id::TEXT)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date >= pedido_pai.order_date
                AND p.order_date <= v_data_limite_pv
                AND UPPER(p.offer_name) LIKE '%UPSELL%'
            LOOP
                IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                END IF;
                v_upsells := array_append(v_upsells, rec.offer_name);
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (pedido_id) VALUES (rec.id::TEXT) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- 2 CARTÕES (Mantemos restrito ao mesmo dia pois é a de duplicidade imediata do gateway)
        FOR rec IN
            SELECT id, transaction_hash FROM ticto_pedidos p
            WHERE p.id != pedido_pai.id
            AND p.status = ANY(v_valid_status) 
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id::TEXT)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.offer_name = pedido_pai.offer_name
            AND (p.order_date AT TIME ZONE 'America/Sao_Paulo')::DATE = (pedido_pai.order_date AT TIME ZONE 'America/Sao_Paulo')::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            END IF;
            INSERT INTO _processed (pedido_id) VALUES (rec.id::TEXT) ON CONFLICT DO NOTHING;
        END LOOP;

        -- PÓS-VENDAS / CALL CENTER
        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT id, transaction_hash, offer_name, product_name FROM ticto_pedidos p
                WHERE p.id != pedido_pai.id
                AND p.status = ANY(v_valid_status) 
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id::TEXT)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date > pedido_pai.order_date
                AND p.order_date <= v_data_limite_pv
                AND UPPER(p.offer_name) LIKE '%CC%'
            LOOP
                DECLARE 
                    v_sigla_pv TEXT;
                    v_match TEXT;
                    v_qtde INT;
                    rec_filho RECORD;
                BEGIN
                    v_sigla_pv := CASE 
                        WHEN UPPER(rec.product_name) LIKE '%DESEJO%' THEN 'DP'
                        WHEN UPPER(rec.product_name) LIKE '%LUMI%' THEN 'BL'
                        WHEN UPPER(rec.product_name) LIKE '%FORMA%' THEN 'BF'
                        ELSE 'OUTRO' END;
                    
                    v_match := substring(UPPER(rec.offer_name) from '([0-9]+)\s*FRASCO');
                    IF v_match IS NULL THEN v_match := substring(UPPER(rec.offer_name) from '([0-9]+)\s*POTE'); END IF;
                    IF v_match IS NULL THEN v_match := substring(UPPER(rec.offer_name) from '([0-9]+)\s*UNIDADE'); END IF;
                    IF v_match IS NULL THEN v_match := substring(UPPER(rec.offer_name) from '([0-9]+)'); END IF;
                    
                    IF v_match IS NOT NULL THEN 
                        v_qtde := v_match::INT; 
                    ELSE 
                        v_qtde := 1; 
                    END IF;

                    v_pos_vendas := array_append(v_pos_vendas, v_sigla_pv || ':' || v_qtde::TEXT);
                    
                    -- SUB-ITENS DO PÓS VENDA FORAM MOVIDOS PARA A VARREDURA GLOBAL ABAIXO
                END;
                
                IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                END IF;
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (pedido_id) VALUES (rec.id::TEXT) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- =========================================================
        -- VARREDURA GLOBAL DE ÓRFÃOS (Order Bumps Silenciosos)
        -- =========================================================
        DECLARE 
            orfao RECORD;
            hash_code TEXT;
        BEGIN
            FOREACH hash_code IN ARRAY v_codigos_filhos LOOP
                FOR orfao IN
                    SELECT id, offer_name FROM ticto_pedidos p_orfao
                    WHERE p_orfao.transaction_hash = hash_code
                    AND p_orfao.id != pedido_pai.id
                    AND p_orfao.status = ANY(v_valid_status)
                    AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p_orfao.id::TEXT)
                LOOP
                    v_order_bumps := array_append(v_order_bumps, orfao.offer_name);
                    v_quantidade := v_quantidade + 1;
                    INSERT INTO _processed (pedido_id) VALUES (orfao.id::TEXT) ON CONFLICT DO NOTHING;
                END LOOP;
            END LOOP;
        END;

        -- =========================================================
        -- FORMATAÇÃO FINAL 
        -- =========================================================
        IF array_length(v_order_bumps, 1) > 0 THEN 
            IF UPPER(v_nome_oferta) NOT LIKE '%ORDERBUMP%' AND UPPER(v_nome_oferta) NOT LIKE '%ORDER BUMP%' THEN
                v_nome_oferta := v_nome_oferta || ' + Order Bump'; 
            END IF;
        END IF;
        
        IF array_length(v_upsells, 1) > 0 THEN 
            IF UPPER(v_nome_oferta) NOT LIKE '%UPSELL%' THEN
                v_nome_oferta := v_nome_oferta || ' + ' || array_length(v_upsells, 1) || ' UPSELL'; 
            END IF;
        END IF;
        
        DECLARE
            v_pv_dp INT := 0; v_pv_bf INT := 0; v_pv_bl INT := 0; v_pv_item TEXT;
            v_sigla_s TEXT; v_qtde_s INT;
        BEGIN
            IF v_pos_vendas IS NOT NULL THEN
                FOREACH v_pv_item IN ARRAY v_pos_vendas LOOP
                    v_sigla_s := split_part(v_pv_item, ':', 1);
                    v_qtde_s := split_part(v_pv_item, ':', 2)::INT;
                    
                    IF v_sigla_s = 'DP' THEN v_pv_dp := v_pv_dp + v_qtde_s;
                    ELSIF v_sigla_s = 'BF' THEN v_pv_bf := v_pv_bf + v_qtde_s;
                    ELSIF v_sigla_s = 'BL' THEN v_pv_bl := v_pv_bl + v_qtde_s;
                    END IF;
                END LOOP;
            END IF;

            IF v_pv_dp > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_dp || ' PV DP'; END IF;
            IF v_pv_bf > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bf || ' PV BF'; END IF;
            IF v_pv_bl > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bl || ' PV BL'; END IF;
        END;

        IF v_tem_dois_cartoes THEN 
            IF UPPER(v_nome_oferta) NOT LIKE '%2 CARTÕES%' THEN
                v_nome_oferta := v_nome_oferta || ' (2 Cartões)';
            END IF;
        END IF;

        -- =========================================================
        -- INSERÇÃO / ATUALIZAÇÃO NO CONSOLIDADO (Mantém o bugfix 058)
        -- =========================================================
        INSERT INTO pedidos_consolidados_v3 (
            codigo_transacao,
            data_venda,
            nome_cliente,
            cpf,
            email,
            telefone,
            endereco_completo,
            rua,
            numero,
            complemento,
            bairro,
            cidade,
            estado,
            cep,
            nome_oferta,
            descricao_pacote,
            quantidade,
            valor,
            status_envio,
            codigos_agrupados,
            dia_despacho
        ) VALUES (
            pedido_pai.transaction_hash,
            pedido_pai.order_date,
            pedido_pai.customer_name,
            pedido_pai.customer_cpf,
            pedido_pai.customer_email,
            pedido_pai.customer_phone,
            COALESCE(pedido_pai.customer_address, '') || ', ' || COALESCE(pedido_pai.customer_address_number, '') || ' - ' || COALESCE(pedido_pai.customer_neighborhood, '') || ', ' || COALESCE(pedido_pai.customer_city, '') || '/' || COALESCE(pedido_pai.customer_state, '') || ' - CEP: ' || COALESCE(pedido_pai.customer_zipcode, ''),
            pedido_pai.customer_address,
            pedido_pai.customer_address_number,
            pedido_pai.customer_complement,
            pedido_pai.customer_neighborhood,
            pedido_pai.customer_city,
            pedido_pai.customer_state,
            pedido_pai.customer_zipcode,
            pedido_pai.offer_name,
            v_nome_oferta,
            v_quantidade,
            pedido_pai.price,
            'Pendente',
            v_codigos_filhos,
            v_dia_despacho::TEXT
        )
        ON CONFLICT (codigo_transacao) DO UPDATE SET
            data_venda = EXCLUDED.data_venda,
            nome_cliente = EXCLUDED.nome_cliente,
            cpf = EXCLUDED.cpf,
            email = EXCLUDED.email,
            telefone = EXCLUDED.telefone,
            endereco_completo = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.endereco_completo ELSE EXCLUDED.endereco_completo END,
            rua = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.rua ELSE EXCLUDED.rua END,
            numero = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.numero ELSE EXCLUDED.numero END,
            complemento = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.complemento ELSE EXCLUDED.complemento END,
            bairro = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.bairro ELSE EXCLUDED.bairro END,
            cidade = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.cidade ELSE EXCLUDED.cidade END,
            estado = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.estado ELSE EXCLUDED.estado END,
            cep = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.cep ELSE EXCLUDED.cep END,
            nome_oferta = EXCLUDED.nome_oferta,
            descricao_pacote = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.descricao_pacote ELSE EXCLUDED.descricao_pacote END,
            quantidade = EXCLUDED.quantidade,
            valor = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.valor ELSE EXCLUDED.valor END,
            codigos_agrupados = EXCLUDED.codigos_agrupados,
            dia_despacho = EXCLUDED.dia_despacho,
            updated_at = NOW();

    END LOOP;
END;
$$ LANGUAGE plpgsql;
