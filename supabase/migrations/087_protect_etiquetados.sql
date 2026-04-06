-- ================================================================
-- PROTEÇÃO DE PEDIDOS ETIQUETADOS
-- Impede que pedidos com código de rastreio sejam sobrescritos
-- ================================================================

-- 1. TRIGGER: Impede UPDATE que remove código de rastreio sem autorização
CREATE OR REPLACE FUNCTION protect_etiquetados_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Se está tentando remover código_rastreio ou mudar status_envio de etiquetado
    IF OLD.codigo_rastreio IS NOT NULL AND NEW.codigo_rastreio IS NULL THEN
        -- Permitir apenas se a flag force_remover_etiqueta estiver setada
        IF NOT COALESCE(NEW.force_remover_etiqueta, FALSE) THEN
            RAISE EXCEPTION 'Não é permitido remover código de rastreio sem confirmação explícita. Use force_remover_etiqueta = TRUE';
        END IF;
    END IF;
    
    -- Limpar a flag após uso
    NEW.force_remover_etiqueta := FALSE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS trg_protect_etiquetados ON pedidos_consolidados_v3;

-- Criar trigger
CREATE TRIGGER trg_protect_etiquetados
    BEFORE UPDATE ON pedidos_consolidados_v3
    FOR EACH ROW
    EXECUTE FUNCTION protect_etiquetados_update();

-- 2. FUNÇÃO: Resetar etiqueta manualmente (com confirmação)
CREATE OR REPLACE FUNCTION resetar_etiqueta_pedido(
    p_pedido_id UUID,
    p_confirmacao BOOLEAN DEFAULT FALSE
)
RETURNS jsonb AS $$
DECLARE
    v_pedido RECORD;
BEGIN
    -- Buscar pedido
    SELECT * INTO v_pedido FROM pedidos_consolidados_v3 WHERE id = p_pedido_id;
    
    IF v_pedido IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
    END IF;
    
    IF v_pedido.codigo_rastreio IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido não possui código de rastreio');
    END IF;
    
    IF NOT p_confirmacao THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Confirmação necessária',
            'message', 'Essa ação cancelará a etiqueta atual e invalidará o código de rastreio: ' || v_pedido.codigo_rastreio
        );
    END IF;
    
    -- Realizar o reset com a flag especial
    UPDATE pedidos_consolidados_v3
    SET 
        codigo_rastreio = NULL,
        status_envio = 'Pendente',
        logistica_etiqueta_url = NULL,
        logistica_provider = NULL,
        logistica_servico = NULL,
        logistica_valor = NULL,
        force_remover_etiqueta = TRUE,
        updated_at = NOW()
    WHERE id = p_pedido_id;
    
    -- Log da ação
    INSERT INTO solicitacoes_historico (solicitacao_id, acao, usuario_id, detalhes)
    VALUES (
        p_pedido_id,
        'ETIQUETA_RESETADA',
        auth.uid(),
        jsonb_build_object(
            'codigo_rastreio_anterior', v_pedido.codigo_rastreio,
            'data_reset', NOW()
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Etiqueta removida com sucesso',
        'codigo_rastreio_removido', v_pedido.codigo_rastreio
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RECRIAR FUNÇÃO CONSOLIDAR COM PROTEÇÃO MAIS FORTE
DROP FUNCTION IF EXISTS consolidar_pedidos_ticto();

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
    v_oferta_norm TEXT;
    
    v_hoje DATE;
    v_nome_feriado TEXT;
    v_dia_pv DATE;
    v_dia_despacho DATE;
    
    v_total_processados INTEGER := 0;
    v_etiquetados_protegidos INTEGER := 0;
BEGIN
    -- ============================================================
    -- PRE-CHECK: FERIADOS
    -- ============================================================
    v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

    SELECT COALESCE(nome, descricao) INTO v_nome_feriado FROM feriados WHERE data = v_hoje;
    
    IF v_nome_feriado IS NOT NULL THEN
        RETURN jsonb_build_object(
            'status', 'skipped',
            'message', 'Feriado: ' || v_nome_feriado
        );
    END IF;

    -- ============================================================
    -- PREPARAÇÃO - PROTEÇÃO FORTE DE ETIQUETADOS
    -- ============================================================
    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;

    -- PRESERVAR registros já despachados/editados/ETIQUETADOS
    CREATE TEMP TABLE _locked_ids AS
    SELECT id FROM pedidos_consolidados_v3
    WHERE codigo_rastreio IS NOT NULL
       OR foi_editado = TRUE
       OR data_envio IS NOT NULL;

    -- Contar quantos etiquetados estão sendo protegidos
    SELECT COUNT(*) INTO v_etiquetados_protegidos
    FROM pedidos_consolidados_v3 WHERE codigo_rastreio IS NOT NULL;

    CREATE TEMP TABLE _locked_codes AS
    SELECT codigo_transacao FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids)
    UNION
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids);

    -- Remover NÃO-TRAVADOS (exceto etiquetados)
    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
    ) to_delete
    WHERE c.id = to_delete.id;

    -- Hashes já processados
    CREATE TEMP TABLE _processed (hash TEXT PRIMARY KEY);
    
    INSERT INTO _processed (hash)
    SELECT codigo_transacao FROM _locked_codes;

    -- ============================================================
    -- ITERAÇÃO: PEDIDOS "PAI"
    -- ============================================================
    FOR pedido_pai IN
        SELECT 
            p.*,
            REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') as doc_limpo,
            LOWER(COALESCE(p.customer_email, '')) as email_lower,
            CASE 
                WHEN UPPER(p.product_name) LIKE '%DESEJO%' THEN 'DP'
                WHEN UPPER(p.product_name) LIKE '%LUMI%' THEN 'BL'
                WHEN UPPER(p.product_name) LIKE '%FORMA%' THEN 'BF'
                ELSE NULL
            END as sigla
        FROM ticto_pedidos p
        WHERE p.status IN ('authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago')
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
          AND REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') NOT LIKE '%ORDERBUMP%'
          AND REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') NOT LIKE '%UPSELL%'
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%CC%'
        ORDER BY p.order_date ASC
    LOOP
        -- Sigla obrigatória
        IF pedido_pai.sigla IS NULL THEN CONTINUE; END IF;

        -- Inicializar
        v_codigos_filhos := ARRAY[]::TEXT[];
        v_order_bumps := ARRAY[]::TEXT[];
        v_upsells := ARRAY[]::TEXT[];
        v_pos_vendas := ARRAY[]::TEXT[];
        v_quantidade := 1;
        v_tem_dois_cartoes := FALSE;
        v_nome_oferta := pedido_pai.offer_name;
        v_nome_oferta := REGEXP_REPLACE(v_nome_oferta, '\s*-\s+\w+\s*$', '', 'i');
        v_nome_oferta := TRIM(v_nome_oferta);

        -- Marcar como processado
        INSERT INTO _processed (hash) VALUES (pedido_pai.transaction_hash) ON CONFLICT DO NOTHING;

        -- CÁLCULO DE DATAS
        BEGIN
            v_dia_pv := proximo_dia_util(pedido_pai.order_date::DATE);
            v_dia_despacho := proximo_dia_util(v_dia_pv);
        EXCEPTION WHEN OTHERS THEN
            v_dia_despacho := (pedido_pai.order_date::DATE + 2);
        END;

        -- BUSCA 1: FAMÍLIA POR ORDER_ID
        IF pedido_pai.order_id IS NOT NULL THEN
            FOR rec IN
                SELECT p.transaction_hash, p.offer_name, p.product_name,
                       REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') as oferta_norm
                FROM ticto_pedidos p
                WHERE p.order_id = pedido_pai.order_id
                  AND p.transaction_hash != pedido_pai.transaction_hash
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
            LOOP
                v_oferta_norm := rec.oferta_norm;
                
                IF v_oferta_norm LIKE '%ORDERBUMP%' THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                    v_order_bumps := array_append(v_order_bumps, rec.offer_name);
                    v_quantidade := v_quantidade + 1;
                ELSIF v_oferta_norm LIKE '%UPSELL%' THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                    v_upsells := array_append(v_upsells, rec.offer_name);
                    v_quantidade := v_quantidade + 1;
                ELSE
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                END IF;
                
                INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- BUSCA 2: ORDER BUMPS extras
        FOR rec IN
            SELECT transaction_hash, offer_name FROM ticto_pedidos p
            WHERE p.transaction_hash != pedido_pai.transaction_hash
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.order_date::DATE = pedido_pai.order_date::DATE
            AND REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') LIKE '%ORDERBUMP%'
        LOOP
            v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            v_order_bumps := array_append(v_order_bumps, rec.offer_name);
            v_quantidade := v_quantidade + 1;
            INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
        END LOOP;

        -- BUSCA 3: UPSELLS
        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT transaction_hash, offer_name FROM ticto_pedidos p
                WHERE p.transaction_hash != pedido_pai.transaction_hash
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE BETWEEN pedido_pai.order_date::DATE AND (pedido_pai.order_date::DATE + 1)
                AND REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') LIKE '%UPSELL%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                v_upsells := array_append(v_upsells, rec.offer_name);
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- BUSCA 4: 2 CARTÕES
        FOR rec IN
            SELECT transaction_hash FROM ticto_pedidos p
            WHERE p.transaction_hash != pedido_pai.transaction_hash
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.offer_name = pedido_pai.offer_name
            AND p.order_date::DATE = pedido_pai.order_date::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
        END LOOP;

        -- BUSCA 5: PÓS-VENDAS CC
        IF EXTRACT(DOW FROM pedido_pai.order_date) IN (4, 5) THEN
            v_data_limite := pedido_pai.order_date::DATE + 4;
        ELSE
            v_data_limite := pedido_pai.order_date::DATE + 2;
        END IF;

        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT transaction_hash, offer_name, product_name FROM ticto_pedidos p
                WHERE p.transaction_hash != pedido_pai.transaction_hash
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE > pedido_pai.order_date::DATE
                AND p.order_date::DATE <= v_data_limite
                AND UPPER(p.offer_name) LIKE '%CC%'
            LOOP
                DECLARE v_sigla_pv TEXT;
                BEGIN
                    v_sigla_pv := CASE 
                        WHEN UPPER(rec.product_name) LIKE '%DESEJO%' THEN 'DP'
                        WHEN UPPER(rec.product_name) LIKE '%LUMI%' THEN 'BL'
                        WHEN UPPER(rec.product_name) LIKE '%FORMA%' THEN 'BF'
                        ELSE 'OUTRO' END;
                    v_pos_vendas := array_append(v_pos_vendas, v_sigla_pv || ':' || rec.offer_name);
                END;
                
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- MONTAR NOME DA OFERTA
        FOR rec IN SELECT unnest(v_order_bumps) as nome LOOP
            v_nome_oferta := v_nome_oferta || ' + Order Bump';
        END LOOP;
        
        FOR rec IN SELECT unnest(v_upsells) as nome LOOP
            v_nome_oferta := v_nome_oferta || ' + UPSELL';
        END LOOP;

        FOR rec IN SELECT unnest(v_pos_vendas) as nome LOOP
            DECLARE 
                v_pv_sigla TEXT;
                v_pv_oferta TEXT;
            BEGIN
                v_pv_sigla := SPLIT_PART(rec.nome, ':', 1);
                v_pv_oferta := SPLIT_PART(rec.nome, ':', 2);
                IF v_pv_sigla != '' AND v_pv_sigla != 'OUTRO' THEN
                    v_nome_oferta := v_nome_oferta || ' + 1 ' || v_pv_sigla;
                ELSE
                    v_nome_oferta := v_nome_oferta || ' + ' || v_pv_oferta;
                END IF;
            END;
        END LOOP;

        v_descricao := pedido_pai.sigla || ' - ' || v_nome_oferta;

        -- ============================================================
        -- INSERIR NA CONSOLIDADA (COM PROTEÇÃO)
        -- Nunca atualiza se já existe com código de rastreio
        -- ============================================================
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
        -- CONDIÇÃO: Só atualiza se NÃO tem código de rastreio
        ON CONFLICT (codigo_transacao) 
        DO UPDATE SET
            nome_oferta = EXCLUDED.nome_oferta,
            descricao_pacote = EXCLUDED.descricao_pacote,
            codigos_agrupados = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps = EXCLUDED.order_bumps,
            upsells = EXCLUDED.upsells,
            pos_vendas = EXCLUDED.pos_vendas,
            codigos_filhos = EXCLUDED.codigos_filhos,
            updated_at = NOW()
        WHERE pedidos_consolidados_v3.codigo_rastreio IS NULL;
            
        v_total_processados := v_total_processados + 1;
    END LOOP;

    -- Cleanup
    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Consolidação concluída: ' || v_total_processados || ' pedidos processados',
        'etiquetados_protegidos', v_etiquetados_protegidos
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ADICIONAR COLUNA force_remover_etiqueta (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pedidos_consolidados_v3' AND column_name = 'force_remover_etiqueta'
    ) THEN
        ALTER TABLE pedidos_consolidados_v3 ADD COLUMN force_remover_etiqueta BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 5. PERMISSÕES
GRANT EXECUTE ON FUNCTION consolidar_pedidos_ticto() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION resetar_etiqueta_pedido(UUID, BOOLEAN) TO authenticated, service_role;

-- 6. RECARREGAR SCHEMA
NOTIFY pgrst, 'reload schema';

SELECT 'Proteção de etiquetados configurada com sucesso!' as status;
