-- ================================================================
-- CORREÇÃO FINAL: CONSOLIDAÇÃO COM ADOÇÃO DE ÓRFÃOS (V4)
-- ================================================================

CREATE OR REPLACE FUNCTION consolidar_pedidos_ticto()
RETURNS jsonb AS $$
DECLARE
    v_total_novos INTEGER := 0;
    v_total_adotados INTEGER := 0;

    pedido_pai RECORD;
    rec RECORD;
    v_target_id UUID;

    v_codigos_filhos TEXT[];
    v_order_bumps TEXT[];
    v_upsells TEXT[];
    v_pos_vendas TEXT[];
    v_nome_oferta TEXT;
    v_quantidade INTEGER;
    v_valor_total NUMERIC;
    
    v_data_limite_pv TIMESTAMP;
    v_doc_pai_limpo TEXT;
BEGIN
    v_data_limite_pv := (CURRENT_DATE + TIME '07:00:00');

    -- Tabela temporária para rastrear hashes processados
    CREATE TEMP TABLE IF NOT EXISTS _hashes_execucao (hash TEXT PRIMARY KEY) ON COMMIT DROP;
    
    -- 1. Carregar TUDO que já está na v3 (agrupados ou pais)
    INSERT INTO _hashes_execucao (hash)
    SELECT codigo_transacao FROM pedidos_consolidados_v3
    ON CONFLICT DO NOTHING;

    INSERT INTO _hashes_execucao (hash)
    SELECT UNNEST(codigos_agrupados) FROM pedidos_consolidados_v3
    ON CONFLICT DO NOTHING;

    -- PASSO 1: CRIAR NOVOS PAIS (Mesma lógica de antes)
    FOR pedido_pai IN
        SELECT p.*
        FROM ticto_pedidos p
        WHERE p.status IN ('authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago')
          AND UPPER(COALESCE(p.offer_name, '')) NOT LIKE '%ORDERBUMP%'
          AND UPPER(COALESCE(p.offer_name, '')) NOT LIKE '%UPSELL%'
          AND UPPER(COALESCE(p.offer_name, '')) NOT LIKE '%CC%'
          AND NOT EXISTS (SELECT 1 FROM _hashes_execucao h WHERE h.hash = p.transaction_hash)
        ORDER BY p.order_date ASC
    LOOP
        IF EXISTS (SELECT 1 FROM _hashes_execucao WHERE hash = pedido_pai.transaction_hash) THEN CONTINUE; END IF;

        v_codigos_filhos := '{}';
        v_order_bumps := '{}';
        v_upsells := '{}';
        v_pos_vendas := '{}';
        v_nome_oferta := COALESCE(pedido_pai.offer_name, pedido_pai.product_name);
        v_quantidade := COALESCE(pedido_pai.item_quantity, 1);
        v_valor_total := COALESCE(pedido_pai.paid_amount, 0);
        v_doc_pai_limpo := REGEXP_REPLACE(pedido_pai.customer_cpf, '[^0-9]', '', 'g');

        INSERT INTO _hashes_execucao (hash) VALUES (pedido_pai.transaction_hash) ON CONFLICT DO NOTHING;

        -- Busca filhos no mesmo run
        FOR rec IN
            SELECT * FROM ticto_pedidos
            WHERE id <> pedido_pai.id
              AND status IN ('authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago')
              AND NOT EXISTS (SELECT 1 FROM _hashes_execucao h WHERE h.hash = transaction_hash)
              AND (
                  (LOWER(customer_email) = LOWER(pedido_pai.customer_email)) OR 
                  (customer_cpf IS NOT NULL AND pedido_pai.customer_cpf IS NOT NULL AND REGEXP_REPLACE(customer_cpf, '[^0-9]', '', 'g') = v_doc_pai_limpo)
              )
              AND order_date >= pedido_pai.order_date
        LOOP
            IF UPPER(rec.offer_name) LIKE '%ORDERBUMP%' THEN v_order_bumps := array_append(v_order_bumps, rec.offer_name);
            ELSIF UPPER(rec.offer_name) LIKE '%UPSELL%' THEN v_upsells := array_append(v_upsells, rec.offer_name);
            ELSIF UPPER(rec.offer_name) LIKE '%CC%' THEN v_pos_vendas := array_append(v_pos_vendas, rec.offer_name);
            ELSE v_pos_vendas := array_append(v_pos_vendas, 'DUPLICATA:' || COALESCE(rec.offer_name, rec.product_name));
            END IF;

            v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            v_quantidade := v_quantidade + COALESCE(rec.item_quantity, 1);
            v_valor_total := v_valor_total + COALESCE(rec.paid_amount, 0);
            INSERT INTO _hashes_execucao (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
        END LOOP;

        DECLARE
            v_dia_despacho DATE;
            v_has_pv BOOLEAN := (array_length(v_pos_vendas, 1) > 0);
        BEGIN
            IF v_has_pv THEN
                IF pedido_pai.order_date <= v_data_limite_pv THEN v_dia_despacho := CURRENT_DATE;
                ELSE v_dia_despacho := CURRENT_DATE + INTERVAL '1 day';
                END IF;
            ELSE v_dia_despacho := CURRENT_DATE;
            END IF;

            INSERT INTO pedidos_consolidados_v3 (
                id, codigo_transacao, status_aprovacao, 
                nome_cliente, email, telefone, cpf,
                logradouro, numero, complemento, bairro, cidade, estado, cep,
                nome_oferta, descricao_pacote, quantidade_pedidos, valor_total,
                order_bumps, upsells, pos_vendas,
                codigos_agrupados, codigos_filhos,
                status_envio, dia_despacho, plataforma,
                created_at, data_venda
            ) VALUES (
                pedido_pai.id, pedido_pai.transaction_hash, pedido_pai.status,
                pedido_pai.customer_name, pedido_pai.customer_email, pedido_pai.customer_phone, pedido_pai.customer_cpf,
                pedido_pai.address_street, pedido_pai.address_number, pedido_pai.address_complement, pedido_pai.address_neighborhood, pedido_pai.address_city, pedido_pai.address_state, pedido_pai.address_zip_code,
                pedido_pai.offer_name, 
                COALESCE(pedido_pai.product_name, '') || ' - ' || COALESCE(pedido_pai.offer_name, ''), 
                v_quantidade, v_valor_total,
                v_order_bumps, v_upsells, v_pos_vendas,
                array_prepend(pedido_pai.transaction_hash, v_codigos_filhos),
                v_codigos_filhos,
                'Pendente', v_dia_despacho, pedido_pai.plataforma,
                pedido_pai.created_at, pedido_pai.order_date
            ) ON CONFLICT (codigo_transacao) DO UPDATE SET
                codigos_agrupados = EXCLUDED.codigos_agrupados,
                codigos_filhos = EXCLUDED.codigos_filhos,
                order_bumps = EXCLUDED.order_bumps,
                upsells = EXCLUDED.upsells,
                pos_vendas = EXCLUDED.pos_vendas,
                quantidade_pedidos = EXCLUDED.quantidade_pedidos,
                valor_total = EXCLUDED.valor_total,
                dia_despacho = EXCLUDED.dia_despacho;

            v_total_novos := v_total_novos + 1;
        END;
    END LOOP;

    -- PASSO 2: ADOÇÃO DE ÓRFÃOS (Pedidos que sobraram e têm pais já na v3)
    FOR rec IN
        SELECT p.*, REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') as doc_limpo
        FROM ticto_pedidos p
        WHERE p.status IN ('authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago')
          AND NOT EXISTS (SELECT 1 FROM _hashes_execucao h WHERE h.hash = p.transaction_hash)
    LOOP
        -- Tenta achar um pai na v3
        SELECT id INTO v_target_id
        FROM pedidos_consolidados_v3 v
        WHERE (LOWER(v.email) = LOWER(rec.customer_email))
           OR (v.cpf IS NOT NULL AND rec.customer_cpf IS NOT NULL AND REGEXP_REPLACE(v.cpf, '[^0-9]', '', 'g') = rec.doc_limpo)
        ORDER BY v.data_venda DESC LIMIT 1;

        IF v_target_id IS NOT NULL THEN
            -- Adota o órfão
            UPDATE pedidos_consolidados_v3
            SET codigos_agrupados = array_append(codigos_agrupados, rec.transaction_hash),
                codigos_filhos = array_append(codigos_filhos, rec.transaction_hash),
                pos_vendas = CASE 
                    WHEN UPPER(rec.offer_name) LIKE '%CC%' THEN array_append(pos_vendas, rec.offer_name)
                    ELSE pos_vendas -- Se não for CC, pode ser duplicata, mas mantemos no agrupamento
                END,
                quantidade_pedidos = quantidade_pedidos + COALESCE(rec.item_quantity, 1),
                valor_total = valor_total + COALESCE(rec.paid_amount, 0),
                updated_at = now()
            WHERE id = v_target_id;

            INSERT INTO _hashes_execucao (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
            v_total_adotados := v_total_adotados + 1;
        ELSE
            -- Se mesmo assim for órfão e não tiver pai, cria como Novo (Fallback para não sumir)
            INSERT INTO pedidos_consolidados_v3 (
                id, codigo_transacao, status_aprovacao, nome_cliente, email, cpf,
                status_envio, dia_despacho, plataforma, created_at, data_venda,
                nome_oferta, descricao_pacote, quantidade_pedidos, valor_total
            ) VALUES (
                rec.id, rec.transaction_hash, rec.status, rec.customer_name, rec.customer_email, rec.customer_cpf,
                'Pendente', CURRENT_DATE, rec.plataforma, rec.created_at, rec.order_date,
                rec.offer_name, COALESCE(rec.product_name, '') || ' - ' || COALESCE(rec.offer_name, ''),
                COALESCE(rec.item_quantity, 1), COALESCE(rec.paid_amount, 0)
            ) ON CONFLICT (codigo_transacao) DO NOTHING;
            
            INSERT INTO _hashes_execucao (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'success',
        'novos', v_total_novos,
        'adotados', v_total_adotados,
        'mensagem', 'Consolidação concluída com adoção de órfãos (V4).'
    );
END;
$$ LANGUAGE plpgsql;
