-- ================================================================
-- MIGRATION 095: Suporte Multi-Plataforma (Ticto + ViralMart)
-- Adiciona coluna 'plataforma' em ticto_pedidos e pedidos_consolidados_v3
-- Data: 2026-03-17
-- ================================================================

-- ============================================================
-- 1. ADICIONAR COLUNA plataforma em ticto_pedidos
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ticto_pedidos' AND column_name = 'plataforma'
    ) THEN
        ALTER TABLE ticto_pedidos ADD COLUMN plataforma TEXT NOT NULL DEFAULT 'ticto';
    END IF;
END $$;

-- Setar todos os registros existentes como 'ticto'
UPDATE ticto_pedidos SET plataforma = 'ticto' WHERE plataforma IS NULL;

-- Índice para filtrar por plataforma
CREATE INDEX IF NOT EXISTS idx_ticto_pedidos_plataforma ON ticto_pedidos(plataforma);

-- ============================================================
-- 2. ADICIONAR COLUNA plataforma em pedidos_consolidados_v3
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pedidos_consolidados_v3' AND column_name = 'plataforma'
    ) THEN
        ALTER TABLE pedidos_consolidados_v3 ADD COLUMN plataforma TEXT NOT NULL DEFAULT 'ticto';
    END IF;
END $$;

UPDATE pedidos_consolidados_v3 SET plataforma = 'ticto' WHERE plataforma IS NULL;

CREATE INDEX IF NOT EXISTS idx_consolidados_plataforma ON pedidos_consolidados_v3(plataforma);

-- ============================================================
-- 3. ATUALIZAR consolidar_pedidos_ticto() COM SUPORTE MULTI-PLATAFORMA
--    + FIX: Protege pedidos com foi_editado = TRUE (da 094)
-- ============================================================
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
    v_data_limite DATE;
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
    -- PREPARAÇÃO - PROTEÇÃO FORTE DE ETIQUETADOS E EDITADOS
    -- ============================================================
    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;

    CREATE TEMP TABLE _locked_ids AS
    SELECT id FROM pedidos_consolidados_v3
    WHERE codigo_rastreio IS NOT NULL
       OR foi_editado = TRUE
       OR data_envio IS NOT NULL;

    SELECT COUNT(*) INTO v_etiquetados_protegidos
    FROM pedidos_consolidados_v3 WHERE codigo_rastreio IS NOT NULL;

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

    CREATE TEMP TABLE _processed (hash TEXT PRIMARY KEY);
    
    INSERT INTO _processed (hash)
    SELECT codigo_transacao FROM _locked_codes;

    -- ============================================================
    -- ITERAÇÃO: PEDIDOS "PAI" (TICTO + VIRALMART)
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
          -- Filtro de pais: exclui Order Bumps, Upsells e CC
          AND REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') NOT LIKE '%ORDERBUMP%'
          AND REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') NOT LIKE '%UPSELL%'
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%ORDER BUMP%'
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%CC%'
        ORDER BY COALESCE(p.status_date, p.order_date) ASC
    LOOP
        IF pedido_pai.sigla IS NULL THEN CONTINUE; END IF;

        v_codigos_filhos := ARRAY[]::TEXT[];
        v_order_bumps := ARRAY[]::TEXT[];
        v_upsells := ARRAY[]::TEXT[];
        v_pos_vendas := ARRAY[]::TEXT[];
        v_quantidade := 1;
        v_tem_dois_cartoes := FALSE;
        v_nome_oferta := pedido_pai.offer_name;
        v_nome_oferta := REGEXP_REPLACE(v_nome_oferta, '\s*-\s+\w+\s*$', '', 'i');
        v_nome_oferta := TRIM(v_nome_oferta);

        INSERT INTO _processed (hash) VALUES (pedido_pai.transaction_hash) ON CONFLICT DO NOTHING;

        -- CÁLCULO DE DATAS
        BEGIN
            v_dia_pv := proximo_dia_util(COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE);
            v_dia_despacho := proximo_dia_util(v_dia_pv);
        EXCEPTION WHEN OTHERS THEN
            v_dia_despacho := (COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE + 2);
        END;

        -- ==========================================================
        -- BUSCA 1: FAMÍLIA POR ORDER_ID (Ticto) ou ORDER_HASH (ViralMart)
        -- ==========================================================
        IF pedido_pai.order_id IS NOT NULL OR pedido_pai.order_hash IS NOT NULL THEN
            FOR rec IN
                SELECT p.transaction_hash, p.offer_name, p.product_name,
                       REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') as oferta_norm
                FROM ticto_pedidos p
                WHERE (
                    (pedido_pai.order_id IS NOT NULL AND p.order_id = pedido_pai.order_id)
                    OR
                    (pedido_pai.order_hash IS NOT NULL AND p.order_hash = pedido_pai.order_hash AND p.plataforma = pedido_pai.plataforma)
                )
                  AND p.transaction_hash != pedido_pai.transaction_hash
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
            LOOP
                v_oferta_norm := rec.oferta_norm;
                
                IF v_oferta_norm LIKE '%ORDERBUMP%' OR UPPER(rec.offer_name) LIKE '%ORDER BUMP%' THEN
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

        -- BUSCA 2: ORDER BUMPS extras (por email + mesma data)
        FOR rec IN
            SELECT transaction_hash, offer_name FROM ticto_pedidos p
            WHERE p.transaction_hash != pedido_pai.transaction_hash
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND COALESCE(p.status_date, p.order_date)::DATE = COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE
            AND (
                REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') LIKE '%ORDERBUMP%'
                OR UPPER(COALESCE(p.offer_name,'')) LIKE '%ORDER BUMP%'
            )
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
                AND COALESCE(p.status_date, p.order_date)::DATE BETWEEN COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE AND (COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE + 1)
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
            AND COALESCE(p.status_date, p.order_date)::DATE = COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
        END LOOP;

        -- BUSCA 5: PÓS-VENDAS CC
        IF EXTRACT(DOW FROM COALESCE(pedido_pai.status_date, pedido_pai.order_date)) IN (4, 5) THEN
            v_data_limite := COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE + 4;
        ELSE
            v_data_limite := COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE + 2;
        END IF;

        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT transaction_hash, offer_name, product_name FROM ticto_pedidos p
                WHERE p.transaction_hash != pedido_pai.transaction_hash
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND COALESCE(p.status_date, p.order_date) >= COALESCE(pedido_pai.status_date, pedido_pai.order_date)
                AND COALESCE(p.status_date, p.order_date)::DATE <= v_data_limite
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
        -- INSERIR NA CONSOLIDADA (COM PROTEÇÃO + PLATAFORMA)
        -- ============================================================
        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
            valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
            telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
            endereco_completo, data_venda, created_at, 
            descricao_pacote, codigos_agrupados, quantidade_pedidos, produto_principal,
            dia_despacho, status_envio,
            order_bumps, upsells, pos_vendas, codigos_filhos, tem_dois_cartoes, fraude_endereco,
            plataforma
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
            COALESCE(pedido_pai.status_date, pedido_pai.order_date),
            pedido_pai.created_at,
            v_descricao,
            ARRAY[pedido_pai.transaction_hash] || v_codigos_filhos,
            v_quantidade,
            pedido_pai.sigla,
            v_dia_despacho, 
            'Pendente',
            v_order_bumps, v_upsells, v_pos_vendas, v_codigos_filhos,
            v_tem_dois_cartoes, FALSE,
            COALESCE(pedido_pai.plataforma, 'ticto')
        )
        -- ✅ Protege etiquetados E editados
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
            plataforma = EXCLUDED.plataforma,
            updated_at = NOW()
        WHERE pedidos_consolidados_v3.codigo_rastreio IS NULL
          AND pedidos_consolidados_v3.foi_editado IS NOT TRUE;
            
        v_total_processados := v_total_processados + 1;
    END LOOP;

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

-- ============================================================
-- 4. PERMISSÕES
-- ============================================================
GRANT EXECUTE ON FUNCTION consolidar_pedidos_ticto() TO anon, authenticated, service_role;

-- ============================================================
-- 5. RECARREGAR SCHEMA
-- ============================================================
NOTIFY pgrst, 'reload schema';

SELECT 'Migration 095: Suporte multi-plataforma (Ticto + ViralMart) configurado!' as status;
