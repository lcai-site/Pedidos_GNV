-- ================================================================
-- MIGRATION 099: FIX NOMENCLATURA (REDUNDÂNCIA DE SIGLAS)
-- ================================================================

CREATE OR REPLACE FUNCTION consolidar_pedidos_ticto()
RETURNS jsonb AS $$
DECLARE
    pedido_pai RECORD;
    rec RECORD;
    v_codigos_filhos TEXT[];
    v_order_bumps TEXT[];
    v_upsells TEXT[];
    v_pos_vendas TEXT[];
    v_nome_oferta TEXT;
    v_quantidade INTEGER;
    v_tem_dois_cartoes BOOLEAN;
    v_sigla TEXT;
    v_descricao TEXT;
    v_hoje DATE;
    v_dia_pv DATE;
    v_dia_despacho DATE;
    v_tem_divergencia BOOLEAN;
    v_lista_divergencias JSONB;
    v_total_processados INTEGER := 0;
    v_decisao_existente TEXT;
BEGIN
    v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
    IF EXISTS (SELECT 1 FROM feriados WHERE data = v_hoje) THEN
        RETURN jsonb_build_object('status', 'skipped', 'message', 'Feriado');
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
    USING (SELECT c2.id FROM pedidos_consolidados_v3 c2 LEFT JOIN _locked_ids l ON c2.id = l.id WHERE l.id IS NULL) to_delete
    WHERE c.id = to_delete.id;

    CREATE TEMP TABLE _processed (hash TEXT PRIMARY KEY);
    INSERT INTO _processed (hash) SELECT codigo_transacao FROM _locked_codes;

    FOR pedido_pai IN
        SELECT p.*, REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') as doc_limpo,
               CASE WHEN UPPER(p.product_name) LIKE '%DESEJO%' THEN 'DP'
                    WHEN UPPER(p.product_name) LIKE '%LUMI%' THEN 'BL'
                    WHEN UPPER(p.product_name) LIKE '%FORMA%' THEN 'BF'
                    ELSE 'OUTRA' END as sigla
        FROM ticto_pedidos p
        WHERE p.status IN ('authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago')
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
          AND p.offer_name !~* '(ORDER\s*BUMP|UPSELL|CC)'
        ORDER BY COALESCE(p.status_date, p.order_date) ASC
    LOOP
        v_codigos_filhos := ARRAY[]::TEXT[];
        v_order_bumps := ARRAY[]::TEXT[];
        v_upsells := ARRAY[]::TEXT[];
        v_pos_vendas := ARRAY[]::TEXT[];
        v_quantidade := COALESCE(pedido_pai.item_quantity, 1);
        v_tem_dois_cartoes := FALSE;
        v_tem_divergencia := FALSE;
        v_lista_divergencias := '[]'::JSONB;

        -- NOVO: Limpeza agressiva do nome da oferta para evitar DP - DP
        v_nome_oferta := pedido_pai.offer_name;
        v_nome_oferta := REGEXP_REPLACE(v_nome_oferta, '^(DP|BF|BL)\s*-\s*', '', 'i'); -- Remove prefixo
        v_nome_oferta := REGEXP_REPLACE(v_nome_oferta, '\s*-\s+\w+\s*$', '', 'i'); -- Remove sufixo se existir
        v_nome_oferta := TRIM(v_nome_oferta);

        INSERT INTO _processed (hash) VALUES (pedido_pai.transaction_hash) ON CONFLICT DO NOTHING;
        v_dia_pv := proximo_dia_util(COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE);
        v_dia_despacho := proximo_dia_util(v_dia_pv);

        FOR rec IN
            SELECT p.*, REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') as doc_limpo
            FROM ticto_pedidos p
            WHERE ((pedido_pai.order_id IS NOT NULL AND p.order_id = pedido_pai.order_id) OR (REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo))
              AND p.transaction_hash != pedido_pai.transaction_hash
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
              AND p.status IN ('authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago')
        LOOP
            SELECT acao INTO v_decisao_existente FROM decisoes_unificacao WHERE hash_filho = rec.transaction_hash AND hash_pai = pedido_pai.transaction_hash;
            IF v_decisao_existente = 'SEPARAR' THEN CONTINUE; END IF;

            IF v_decisao_existente IS NULL AND 
               (LOWER(TRIM(rec.customer_name)) != LOWER(TRIM(pedido_pai.customer_name)) OR
                LOWER(TRIM(rec.customer_email)) != LOWER(TRIM(pedido_pai.customer_email)) OR
                REGEXP_REPLACE(rec.customer_phone, '[^0-9]', '', 'g') != REGEXP_REPLACE(pedido_pai.customer_phone, '[^0-9]', '', 'g')) THEN
                v_tem_divergencia := TRUE;
                v_lista_divergencias := v_lista_divergencias || jsonb_build_object('hash', rec.transaction_hash, 'nome', rec.customer_name, 'email', rec.customer_email, 'fone', rec.customer_phone, 'oferta', rec.offer_name, 'produto', rec.product_name, 'quantidade', rec.item_quantity);
                CONTINUE;
            END IF;

            v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            v_quantidade := v_quantidade + COALESCE(rec.item_quantity, 1);
            IF UPPER(rec.offer_name) ~* 'ORDER\s*BUMP' THEN v_order_bumps := array_append(v_order_bumps, rec.offer_name);
            ELSIF UPPER(rec.offer_name) ~ 'UPSELL' THEN v_upsells := array_append(v_upsells, rec.offer_name);
            ELSIF UPPER(rec.offer_name) ~ 'CC' THEN
                DECLARE v_sigla_pv TEXT := CASE WHEN UPPER(rec.product_name) LIKE '%DESEJO%' THEN 'DP' WHEN UPPER(rec.product_name) LIKE '%LUMI%' THEN 'BL' WHEN UPPER(rec.product_name) LIKE '%FORMA%' THEN 'BF' ELSE 'OUTRO' END;
                BEGIN v_pos_vendas := array_append(v_pos_vendas, v_sigla_pv || ':' || COALESCE(rec.item_quantity, 1) || ':' || rec.offer_name); END;
            END IF;
            INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
        END LOOP;

        v_descricao := pedido_pai.sigla || ' - ' || v_nome_oferta;
        IF array_length(v_order_bumps, 1) > 0 THEN v_descricao := v_descricao || ' + Order Bump'; END IF;
        IF array_length(v_upsells, 1) > 0 THEN v_descricao := v_descricao || ' + UPSELL'; END IF;
        FOR rec IN SELECT unnest(v_pos_vendas) as item LOOP
            v_descricao := v_descricao || ' + ' || SPLIT_PART(rec.item, ':', 2) || ' ' || SPLIT_PART(rec.item, ':', 1);
        END LOOP;

        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta, nome_cliente, email, cpf, telefone, cep, data_venda, 
            descricao_pacote, codigos_agrupados, quantidade_pedidos, produto_principal, dia_despacho, status_envio, plataforma,
            order_bumps, upsells, pos_vendas, codigos_filhos, tem_divergencia, itens_divergentes
        ) VALUES (
            pedido_pai.id, pedido_pai.transaction_hash, 'Aprovado', pedido_pai.product_name, v_nome_oferta,
            pedido_pai.customer_name, pedido_pai.customer_email, pedido_pai.customer_cpf, pedido_pai.customer_phone,
            pedido_pai.address_zip_code, COALESCE(pedido_pai.status_date, pedido_pai.order_date),
            v_descricao, ARRAY[pedido_pai.transaction_hash] || v_codigos_filhos, v_quantidade, pedido_pai.sigla,
            v_dia_despacho, 'Pendente', COALESCE(pedido_pai.plataforma, 'ticto'),
            v_order_bumps, v_upsells, v_pos_vendas, v_codigos_filhos, v_tem_divergencia, v_lista_divergencias
        ) ON CONFLICT (codigo_transacao) DO UPDATE SET
            nome_oferta = EXCLUDED.nome_oferta, descricao_pacote = EXCLUDED.descricao_pacote, codigos_agrupados = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos, order_bumps = EXCLUDED.order_bumps, upsells = EXCLUDED.upsells, pos_vendas = EXCLUDED.pos_vendas,
            codigos_filhos = EXCLUDED.codigos_filhos, tem_divergencia = EXCLUDED.tem_divergencia, itens_divergentes = EXCLUDED.itens_divergentes,
            dia_despacho = CASE WHEN pedidos_consolidados_v3.pv_realizado = TRUE THEN pedidos_consolidados_v3.dia_despacho ELSE EXCLUDED.dia_despacho END,
            updated_at = NOW()
        WHERE pedidos_consolidados_v3.codigo_rastreio IS NULL AND pedidos_consolidados_v3.foi_editado IS NOT TRUE;
        v_total_processados := v_total_processados + 1;
    END LOOP;
    RETURN jsonb_build_object('status', 'success', 'processed', v_total_processados);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
