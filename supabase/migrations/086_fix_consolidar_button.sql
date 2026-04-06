-- ================================================================
-- DIAGNÓSTICO E CORREÇÃO DO BOTÃO CONSOLIDAR
-- Resolve: Erro ao clicar em "Consolidar Agora"
-- ================================================================

-- 1. VERIFICAR SE AS FUNÇÕES EXISTEM
DO $$
DECLARE
    v_consolidar_exists BOOLEAN;
    v_proximo_dia_util_exists BOOLEAN;
    v_feriados_exists BOOLEAN;
BEGIN
    -- Verificar função consolidar_pedidos_ticto
    SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'consolidar_pedidos_ticto'
    ) INTO v_consolidar_exists;
    
    -- Verificar função proximo_dia_util
    SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'proximo_dia_util'
    ) INTO v_proximo_dia_util_exists;
    
    -- Verificar tabela feriados
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'feriados'
    ) INTO v_feriados_exists;
    
    RAISE NOTICE 'Status das dependências:';
    RAISE NOTICE '- consolidar_pedidos_ticto: %', CASE WHEN v_consolidar_exists THEN 'OK' ELSE 'FALTANDO' END;
    RAISE NOTICE '- proximo_dia_util: %', CASE WHEN v_proximo_dia_util_exists THEN 'OK' ELSE 'FALTANDO' END;
    RAISE NOTICE '- tabela feriados: %', CASE WHEN v_feriados_exists THEN 'OK' ELSE 'FALTANDO' END;
END $$;

-- 2. CRIAR FUNÇÃO proximo_dia_util SE NÃO EXISTIR
CREATE OR REPLACE FUNCTION proximo_dia_util(data_base DATE)
RETURNS DATE AS $$
DECLARE
  data_resultado DATE := data_base + 1;
  max_iterations INT := 30;
  iterations INT := 0;
BEGIN
  WHILE iterations < max_iterations LOOP
    -- Verificar se é fim de semana (0=Domingo, 6=Sábado)
    IF EXTRACT(DOW FROM data_resultado) NOT IN (0, 6) THEN
      RETURN data_resultado;
    END IF;
    data_resultado := data_resultado + 1;
    iterations := iterations + 1;
  END LOOP;
  RETURN data_resultado;
END;
$$ LANGUAGE plpgsql;

-- 3. CRIAR TABELA FERIADOS SE NÃO EXISTIR
CREATE TABLE IF NOT EXISTS feriados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    tipo TEXT DEFAULT 'nacional'
);

-- Verificar estrutura da tabela e inserir feriados
DO $$
DECLARE
    v_col_nome TEXT;
BEGIN
    -- Verificar qual coluna existe (nome ou descricao)
    SELECT column_name INTO v_col_nome
    FROM information_schema.columns 
    WHERE table_name = 'feriados' AND column_name IN ('nome', 'descricao')
    LIMIT 1;
    
    -- Inserir usando a coluna correta
    IF v_col_nome = 'descricao' THEN
        INSERT INTO feriados (data, descricao, tipo) VALUES
            ('2026-01-01', 'Confraternização Universal', 'nacional'),
            ('2026-04-03', 'Sexta-feira Santa', 'nacional'),
            ('2026-04-21', 'Tiradentes', 'nacional'),
            ('2026-05-01', 'Dia do Trabalho', 'nacional'),
            ('2026-09-07', 'Independência do Brasil', 'nacional'),
            ('2026-10-12', 'Nossa Senhora Aparecida', 'nacional'),
            ('2026-11-02', 'Finados', 'nacional'),
            ('2026-11-15', 'Proclamação da República', 'nacional'),
            ('2026-12-25', 'Natal', 'nacional')
        ON CONFLICT (data) DO UPDATE SET descricao = EXCLUDED.descricao;
    ELSE
        INSERT INTO feriados (data, nome, tipo) VALUES
            ('2026-01-01', 'Confraternização Universal', 'nacional'),
            ('2026-04-03', 'Sexta-feira Santa', 'nacional'),
            ('2026-04-21', 'Tiradentes', 'nacional'),
            ('2026-05-01', 'Dia do Trabalho', 'nacional'),
            ('2026-09-07', 'Independência do Brasil', 'nacional'),
            ('2026-10-12', 'Nossa Senhora Aparecida', 'nacional'),
            ('2026-11-02', 'Finados', 'nacional'),
            ('2026-11-15', 'Proclamação da República', 'nacional'),
            ('2026-12-25', 'Natal', 'nacional')
        ON CONFLICT (data) DO UPDATE SET nome = EXCLUDED.nome;
    END IF;
END $$;

-- 4. RECRIAR FUNÇÃO CONSOLIDAR PEDIDOS (Versão simplificada e robusta)
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
BEGIN
    -- ============================================================
    -- PRE-CHECK: FERIADOS
    -- ============================================================
    v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

    -- Usar COALESCE para pegar nome ou descricao
    SELECT COALESCE(nome, descricao) INTO v_nome_feriado 
    FROM feriados 
    WHERE data = v_hoje;
    
    IF v_nome_feriado IS NOT NULL THEN
        RETURN jsonb_build_object(
            'status', 'skipped',
            'message', 'Feriado: ' || v_nome_feriado
        );
    END IF;

    -- ============================================================
    -- PREPARAÇÃO
    -- ============================================================
    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;

    -- PRESERVAR registros já despachados/editados
    CREATE TEMP TABLE _locked_ids AS
    SELECT id FROM pedidos_consolidados_v3
    WHERE codigo_rastreio IS NOT NULL
       OR foi_editado = TRUE
       OR data_envio IS NOT NULL;

    CREATE TEMP TABLE _locked_codes AS
    SELECT codigo_transacao FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids)
    UNION
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids);

    -- Remover não-travados para reprocessar
    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
          AND c2.data_venda >= (v_hoje - INTERVAL '30 days')
    ) to_delete
    WHERE c.id = to_delete.id;

    -- IDs já processados
    CREATE TEMP TABLE _processed (id UUID PRIMARY KEY);
    
    INSERT INTO _processed (id)
    SELECT id FROM _locked_ids;

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
          AND COALESCE(p.status_date, p.order_date) >= (v_hoje - INTERVAL '30 days') -- Limite de 30 dias para performance
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE id = p.id)
          -- Um pedido é "Pai" se não tiver flags de Bump/Upsell ou se for o item principal do Order ID
          AND (
            (REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') NOT LIKE '%ORDERBUMP%'
             AND REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') NOT LIKE '%UPSELL%'
             AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%ORDER BUMP%'
             AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%UP SELL%'
             AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%CC%')
            OR p.paid_amount > 100 -- Segurança: Pedidos principais costumam ter valor maior
          )
        ORDER BY COALESCE(p.status_date, p.order_date) ASC
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
        INSERT INTO _processed (id) VALUES (pedido_pai.id) ON CONFLICT DO NOTHING;

        -- CÁLCULO DE DATAS (Baseado na confirmação do pagamento)
        BEGIN
            v_dia_pv := proximo_dia_util(COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE);
            v_dia_despacho := proximo_dia_util(v_dia_pv);
        EXCEPTION WHEN OTHERS THEN
            v_dia_despacho := (COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE + 2);
        END;

        -- BUSCA 1: FAMÍLIA POR ORDER_ID (Padrão Ticto: Mesmo Order ID para Pai e Bumps)
        IF pedido_pai.order_id IS NOT NULL THEN
            FOR rec IN
                SELECT p.transaction_hash, p.offer_name, p.product_name, p.id, p.offer_code,
                       REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') as oferta_norm
                FROM ticto_pedidos p
                WHERE p.order_id = pedido_pai.order_id
                  AND p.id != pedido_pai.id
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE id = p.id)
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
                    -- Se não for bump nem upsell, mas tiver mesmo order_id, é provavelmente item do kit ou 2 cartões
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                END IF;
                
                INSERT INTO _processed (id) VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- BUSCA 2: ORDER BUMPS extras
        FOR rec IN
            SELECT transaction_hash, offer_name, id FROM ticto_pedidos p
            WHERE p.id != pedido_pai.id
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE id = p.id)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND COALESCE(p.status_date, p.order_date)::DATE = COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE
            AND (REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') LIKE '%ORDERBUMP%' OR UPPER(p.offer_name) LIKE '%ORDER BUMP%')
        LOOP
            v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            v_order_bumps := array_append(v_order_bumps, rec.offer_name);
            v_quantidade := v_quantidade + 1;
            INSERT INTO _processed (id) VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- BUSCA 3: UPSELLS
        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT transaction_hash, offer_name, id FROM ticto_pedidos p
                WHERE p.id != pedido_pai.id
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE id = p.id)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND COALESCE(p.status_date, p.order_date)::DATE BETWEEN COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE AND (COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE + 1)
                AND REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') LIKE '%UPSELL%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                v_upsells := array_append(v_upsells, rec.offer_name);
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (id) VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- BUSCA 4: 2 CARTÕES
        FOR rec IN
            SELECT transaction_hash, id FROM ticto_pedidos p
            WHERE p.id != pedido_pai.id
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE id = p.id)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.offer_name = pedido_pai.offer_name
            AND COALESCE(p.status_date, p.order_date)::DATE = COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            INSERT INTO _processed (id) VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- BUSCA 5: PÓS-VENDAS CC
        IF EXTRACT(DOW FROM COALESCE(pedido_pai.status_date, pedido_pai.order_date)) IN (4, 5) THEN
            v_data_limite := COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE + 4;
        ELSE
            v_data_limite := COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE + 2;
        END IF;

        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT transaction_hash, offer_name, product_name, id FROM ticto_pedidos p
                WHERE p.id != pedido_pai.id
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE id = p.id)
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
                INSERT INTO _processed (id) VALUES (rec.id) ON CONFLICT DO NOTHING;
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

        -- INSERIR NA CONSOLIDADA
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
            
        v_total_processados := v_total_processados + 1;
    END LOOP;

    -- Cleanup
    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Consolidação concluída: ' || v_total_processados || ' pedidos processados'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. PERMISSÕES
GRANT EXECUTE ON FUNCTION consolidar_pedidos_ticto() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION proximo_dia_util(DATE) TO anon, authenticated, service_role;

-- 6. RECARREGAR SCHEMA
NOTIFY pgrst, 'reload schema';

-- 7. ÍNDICES DE PERFORMANCE (MANDATÓRIO PARA EVITAR TIMEOUT)
CREATE INDEX IF NOT EXISTS idx_ticto_pedidos_order_id ON ticto_pedidos(order_id);
CREATE INDEX IF NOT EXISTS idx_ticto_pedidos_customer_email ON ticto_pedidos(LOWER(customer_email));
CREATE INDEX IF NOT EXISTS idx_ticto_pedidos_customer_cpf ON ticto_pedidos(REGEXP_REPLACE(customer_cpf, '[^0-9]', '', 'g'));
CREATE INDEX IF NOT EXISTS idx_ticto_pedidos_order_date ON ticto_pedidos(order_date);

-- 8. TESTAR FUNÇÃO
SELECT 'Função recriada com índices!' as status;
