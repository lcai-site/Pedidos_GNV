-- ================================================================
-- MIGRATION 107: FIX FOI_EDITADO — Lógica Flexível de Consolidação
-- ================================================================
-- PROBLEMA RESOLVIDO:
--   Pedidos com foi_editado=TRUE (dados do cliente editados manualmente)
--   bloqueavam a adição automática de novos filhos (Bumps, Upsells, PVs).
--
-- SOLUÇÃO:
--   Separação em dois níveis de lock:
--   - HARD LOCK: pedidos com rastreio/envio → INTOCÁVEIS
--   - SOFT LOCK: pedidos com foi_editado=TRUE → preservam dados do cliente
--                MAS continuam recebendo novos filhos no loop
--
-- REGRA DE NEGÓCIO (foi_editado):
--   - TRUE apenas quando dados do CLIENTE são alterados manualmente
--     (nome, CPF, email, telefone, endereço)
--   - Mudar descricao_pacote NÃO define foi_editado=TRUE
--
-- FONTE DA VERDADE: Este arquivo é o estado canônico da função.
--   Para qualquer modificação futura, EDITE ESTE ARQUIVO antes de criar
--   uma nova migration, para evitar perda de contexto.
-- ================================================================

-- ----------------------------------------------------------------
-- PARTE 1: atualizar_descricao_pacote — NÃO trava o pedido
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION atualizar_descricao_pacote(p_id UUID, p_descricao TEXT)
RETURNS JSONB AS $$
BEGIN
  UPDATE pedidos_consolidados_v3
  SET
    descricao_pacote = p_descricao,
    -- INTENCIONAL: foi_editado NÃO é setado aqui.
    -- Mudar o nome do pacote não deve bloquear consolidações futuras.
    updated_at = NOW()
  WHERE id = p_id;

  RETURN jsonb_build_object('status', 'success', 'message', 'Descrição atualizada');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION atualizar_descricao_pacote(UUID, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------
-- PARTE 2: consolidar_pedidos_ticto — Lógica completa com Hard/Soft Lock
-- ----------------------------------------------------------------
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
    v_descricao TEXT;
    v_hoje DATE;
    v_dia_pv DATE;
    v_dia_despacho DATE;
    v_tem_divergencia BOOLEAN;
    v_lista_divergencias JSONB;
    v_total_processados INTEGER := 0;
    v_decisao_existente TEXT;
    v_endereco_completo TEXT;
BEGIN
    v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
    IF EXISTS (SELECT 1 FROM feriados WHERE data = v_hoje) THEN
        RETURN jsonb_build_object('status', 'skipped', 'message', 'Feriado');
    END IF;

    DROP TABLE IF EXISTS _hard_locked_ids;
    DROP TABLE IF EXISTS _hard_locked_codes;
    DROP TABLE IF EXISTS _soft_locked_ids;
    DROP TABLE IF EXISTS _processed;

    -- ──────────────────────────────────────────────────────────────
    -- HARD LOCK: Pedidos já despachados ou etiquetados — INTOCÁVEIS
    -- ──────────────────────────────────────────────────────────────
    CREATE TEMP TABLE _hard_locked_ids AS
    SELECT id FROM pedidos_consolidados_v3
    WHERE codigo_rastreio IS NOT NULL OR data_envio IS NOT NULL OR status_aprovacao = 'Cancelado';

    -- IDs de ticto_pedidos que pertencem a pedidos hard locked
    CREATE TEMP TABLE _hard_locked_codes AS
    SELECT p.id
    FROM pedidos_consolidados_v3 c
    JOIN ticto_pedidos p
        ON p.transaction_hash = c.codigo_transacao
        OR p.codigo_unico = ANY(c.codigos_agrupados)
    WHERE c.id IN (SELECT id FROM _hard_locked_ids);

    -- ──────────────────────────────────────────────────────────────
    -- SOFT LOCK: Pedidos editados manualmente — preservar no banco,
    --             mas deixar reprocessar para adicionar novos filhos
    -- ──────────────────────────────────────────────────────────────
    CREATE TEMP TABLE _soft_locked_ids AS
    SELECT id FROM pedidos_consolidados_v3
    WHERE foi_editado = TRUE
      AND id NOT IN (SELECT id FROM _hard_locked_ids);

    -- Deletar apenas pedidos que NÃO têm nenhum tipo de lock
    DELETE FROM pedidos_consolidados_v3
    WHERE id NOT IN (SELECT id FROM _hard_locked_ids)
      AND id NOT IN (SELECT id FROM _soft_locked_ids);

    -- Marcar hard locked como processados (não reentrar neles)
    -- Soft locked NÃO entram em _processed → o loop pai os reprocesa
    CREATE TEMP TABLE _processed (id UUID PRIMARY KEY);
    INSERT INTO _processed (id) SELECT id FROM _hard_locked_codes;

    -- ══════════════════════════════════════════════════════════════
    -- LOOP PRINCIPAL: Iterar sobre pedidos pai da plataforma
    -- ══════════════════════════════════════════════════════════════
    FOR pedido_pai IN
        SELECT
            p.*,
            REGEXP_REPLACE(COALESCE(p.customer_cpf,''), '[^0-9]', '', 'g') as doc_limpo,
            CASE
                WHEN UPPER(p.product_name) LIKE '%DESEJO%' THEN 'DP'
                WHEN UPPER(p.product_name) LIKE '%LUMI%'   THEN 'BL'
                WHEN UPPER(p.product_name) LIKE '%FORMA%'  THEN 'BF'
                WHEN UPPER(p.product_name) LIKE '%BELABLOOM%' THEN 'BH'
                WHEN UPPER(p.product_name) LIKE '%SEKASHOT%' OR UPPER(p.product_name) LIKE '%SEKA%' THEN 'SS'
                WHEN UPPER(p.product_name) LIKE '%MOUNJALIS%' THEN 'ME'
                ELSE 'OUTRO'
            END as sigla
        FROM ticto_pedidos p
        WHERE p.status IN ('authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago')
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE id = p.id)
          AND p.offer_name !~* '(ORDEM\s*BUMP|ORDER\s*BUMP|UPSELL|CC)'
        ORDER BY COALESCE(p.status_date, p.order_date) ASC
    LOOP
        IF pedido_pai.sigla = 'OUTRO' THEN CONTINUE; END IF;

        -- ──────────────────────────────────────────────────────────────
        -- FILTRO DE CANCELADOS: Se o pedido foi cancelado manualmente 
        -- na aplicação (Logística), não deixamos a sincronização 
        -- automática trazê-lo de volta para "Envios".
        -- ──────────────────────────────────────────────────────────────
        IF EXISTS (
            SELECT 1 FROM pedidos_consolidados_v3 
            WHERE (codigo_transacao = pedido_pai.transaction_hash OR id = pedido_pai.id)
              AND status_aprovacao = 'Cancelado'
        ) THEN 
            v_total_processados := v_total_processados + 1; -- Conta como "visto" mas pula
            CONTINUE; 
        END IF;

        v_codigos_filhos      := ARRAY[]::TEXT[];
        v_order_bumps         := ARRAY[]::TEXT[];
        v_upsells             := ARRAY[]::TEXT[];
        v_pos_vendas          := ARRAY[]::TEXT[];
        v_quantidade          := COALESCE(pedido_pai.item_quantity, 1);
        v_tem_dois_cartoes    := FALSE;
        v_tem_divergencia     := FALSE;
        v_lista_divergencias  := '[]'::JSONB;

        -- ──────────────────────────────────────────────────────────
        -- LIMPEZA AGRESSIVA DO NOME DA OFERTA (Normalização)
        -- ──────────────────────────────────────────────────────────
        v_nome_oferta := TRIM(pedido_pai.offer_name);
        
        -- 1. Remover siglas e nomes de produtos redundantes do início (ex: "DP - ", "Bela Forma...")
        v_nome_oferta := REGEXP_REPLACE(v_nome_oferta, '(?i)^(DP|BF|BL|BH|SS|ME|DESEJO(?:\s*PROIBIDO)?|BELA(?:\s*FORMA|\s*LUMI|\s*BLOOM)?|SEKA(?:\s*SHOT)?|MOUNJALIS)\s*[,\-\s:]*\s*', '', 'i');
        
        -- ──────────────────────────────────────────────────────────
        -- NORMALIZAÇÃO DEFINITIVA (Extração de Quantidade e Variante)
        -- ──────────────────────────────────────────────────────────
        DECLARE
            v_raw_offer TEXT := TRIM(pedido_pai.offer_name);
            v_qtd TEXT;
            v_var TEXT := '';
        BEGIN
            IF pedido_pai.sigla = 'DP' THEN
                -- Primeiro limpar ruídos comuns da string original
                v_raw_offer := NULLIF(TRIM(pedido_pai.offer_name), '');
                
                IF v_raw_offer IS NOT NULL THEN
                    -- TRATAMENTO ESPECIAL PARA COMBO (Gotas + Cápsulas na mesma oferta)
                    IF v_raw_offer ~* 'GOTA|GTS' AND v_raw_offer ~* 'CPS|C[AÁ]PS|CAPSULA|CÁPSULA|CÁP' THEN
                        DECLARE
                            v_match_gts TEXT[] := regexp_match(v_raw_offer, '(\d+)\s*(?:GOTA|GTS|GOTAS)', 'i');
                            v_match_cps TEXT[] := regexp_match(v_raw_offer, '(\d+)\s*(?:CPS|C[AÁ]PS|CAPSULA|CÁPSULA|CÁP)', 'i');
                            v_qtd_gts TEXT;
                            v_qtd_cps TEXT;
                        BEGIN
                            IF v_match_gts IS NOT NULL THEN v_qtd_gts := v_match_gts[1]; ELSE v_qtd_gts := '1'; END IF;
                            IF v_match_cps IS NOT NULL THEN v_qtd_cps := v_match_cps[1]; ELSE v_qtd_cps := '1'; END IF;
                            
                            v_nome_oferta := v_qtd_gts || ' UN GTS + ' || v_qtd_cps || ' UN CPS';
                        END;
                    ELSE
                        -- 1. Identificar variante (GTS/CPS) em qualquer parte do texto
                        IF v_raw_offer ~* 'CPS|C[AÁ]PS|CAPSULA|CÁPSULA|CÁP' THEN 
                           v_var := 'CPS';
                        ELSIF v_raw_offer ~* 'GTS|GOTA' THEN v_var := 'GTS';
                        ELSIF pedido_pai.sigla = 'DP' THEN v_var := 'GTS'; -- Padrão DP
                        END IF;

                        -- 2. Pescar cirurgicamente apenas o número (Quantidade)
                        IF v_raw_offer ~* 'LEVE\s+(\d+)' THEN
                            v_qtd := SUBSTRING(v_raw_offer FROM '(?i)LEVE\s+(\d+)');
                        ELSE
                            v_qtd := SUBSTRING(v_raw_offer FROM '(\d+)');
                        END IF;
                        
                        -- Fallback para 1 se não achar número
                        v_qtd := COALESCE(v_qtd, '1');

                        -- 3. Reconstruir do zero: [Qtd] UN [Variante]
                        v_nome_oferta := v_qtd || ' UN';
                        IF v_var <> '' THEN
                            v_nome_oferta := v_nome_oferta || ' ' || v_var;
                        END IF;
                    END IF;
                END IF;
            END IF;
        END;

        INSERT INTO _processed (id) VALUES (pedido_pai.id) ON CONFLICT DO NOTHING;

        -- Calcular datas de PV e despacho usando status_date quando disponível
        v_dia_pv       := proximo_dia_util(COALESCE(pedido_pai.status_date, pedido_pai.order_date)::DATE);
        v_dia_despacho := proximo_dia_util(v_dia_pv);

        -- ──────────────────────────────────────────────────────────
        -- SUB-LOOP: Buscar filhos (Bumps, Upsells, CCs, 2 cartões)
        -- ──────────────────────────────────────────────────────────
        FOR rec IN
            SELECT p.*, REGEXP_REPLACE(COALESCE(p.customer_cpf,''), '[^0-9]', '', 'g') as doc_limpo
            FROM ticto_pedidos p
            WHERE (
                    -- Mesmo order_id da plataforma
                    (pedido_pai.order_id IS NOT NULL AND p.order_id = pedido_pai.order_id)
                    -- Mesmo CPF
                    OR (LENGTH(pedido_pai.doc_limpo) >= 11
                        AND REGEXP_REPLACE(COALESCE(p.customer_cpf,''), '[^0-9]', '', 'g') = pedido_pai.doc_limpo)
                    -- Mesmo email
                    OR (LOWER(COALESCE(p.customer_email,'')) = LOWER(COALESCE(pedido_pai.customer_email,'')))
                  )
              AND p.id != pedido_pai.id
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE id = p.id)
              AND p.status IN ('authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago')
        LOOP
            -- Verificar decisão manual de unificação (UNIR/SEPARAR)
            BEGIN
                SELECT acao INTO v_decisao_existente
                FROM decisoes_unificacao
                WHERE hash_filho = rec.transaction_hash AND hash_pai = pedido_pai.transaction_hash;
            EXCEPTION WHEN OTHERS THEN
                v_decisao_existente := NULL;
            END;
            IF v_decisao_existente = 'SEPARAR' THEN CONTINUE; END IF;

            -- Detectar divergência de dados (apenas para pedidos SEM match por CPF)
            IF v_decisao_existente IS NULL AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                IF LOWER(TRIM(COALESCE(rec.customer_name,'')))  != LOWER(TRIM(COALESCE(pedido_pai.customer_name,''))) OR
                   LOWER(TRIM(COALESCE(rec.customer_email,''))) != LOWER(TRIM(COALESCE(pedido_pai.customer_email,''))) THEN
                    -- Só reporta divergência se o match NÃO foi por CPF
                    IF NOT (LENGTH(pedido_pai.doc_limpo) >= 11
                            AND REGEXP_REPLACE(COALESCE(rec.customer_cpf,''), '[^0-9]', '', 'g') = pedido_pai.doc_limpo) THEN
                        v_tem_divergencia := TRUE;
                        v_lista_divergencias := v_lista_divergencias || jsonb_build_object(
                            'hash', rec.transaction_hash, 'codigo_unico', rec.codigo_unico,
                            'nome', rec.customer_name, 'email', rec.customer_email,
                            'oferta', rec.offer_name, 'produto', rec.product_name
                        );
                        CONTINUE;
                    END IF;
                END IF;
            END IF;

            -- Adicionar filho à lista
            IF rec.codigo_unico != ALL(v_codigos_filhos) THEN
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_unico);
            END IF;

            v_quantidade := v_quantidade + COALESCE(rec.item_quantity, 1);

            -- ──────────────────────────────────────────────────────────
            -- CLASSIFICAR TIPO DO FILHO (Bump, Upsell, PV)
            -- ──────────────────────────────────────────────────────────
            DECLARE
                v_item_qtd TEXT := COALESCE(rec.item_quantity, 1)::TEXT;
                v_variante_filho TEXT := '';
            BEGIN
                -- Detectar variante APENAS para Desejo Proibido
                IF (UPPER(rec.product_name) LIKE '%DESEJO%' OR UPPER(rec.offer_name) LIKE '%DESEJO%' OR pedido_pai.sigla = 'DP') THEN
                    IF rec.offer_name ~* 'GOTA|GTS' AND rec.offer_name ~* 'CPS|C[AÁ]PS|CAPSULA|CÁPSULA|CÁP' THEN
                        v_variante_filho := ' GTS + CPS';
                    ELSIF rec.offer_name ~* 'CPS|C[AÁ]PS|CAPSULA|CÁPSULA|CÁP' THEN v_variante_filho := ' CPS';
                    ELSE v_variante_filho := ' GTS'; -- Fallback padrão para DP
                    END IF;
                END IF;

                IF UPPER(rec.offer_name) ~* '(ORDEM|ORDER)\s*BUMP' THEN
                    v_order_bumps := array_append(v_order_bumps, v_item_qtd || ' OB' || v_variante_filho);
                ELSIF UPPER(rec.offer_name) ~* 'UPSELL' THEN
                    v_upsells := array_append(v_upsells, v_item_qtd || ' US' || v_variante_filho);
                ELSE
                    DECLARE v_sigla_pv TEXT := CASE
                        WHEN (UPPER(rec.product_name) LIKE '%DESEJO%' OR UPPER(rec.offer_name) LIKE '%DESEJO%') AND (UPPER(rec.product_name) LIKE '%GOTA%' OR UPPER(rec.offer_name) LIKE '%GOTA%') THEN 'DP GTS'
                        WHEN (UPPER(rec.product_name) LIKE '%DESEJO%' OR UPPER(rec.offer_name) LIKE '%DESEJO%') AND (UPPER(rec.product_name) LIKE '%CAPS%' OR UPPER(rec.offer_name) LIKE '%CAPS%' OR UPPER(rec.product_name) LIKE '%CÁPS%') THEN 'DP CPS'
                        WHEN (UPPER(rec.product_name) LIKE '%DESEJO%' OR UPPER(rec.offer_name) LIKE '%DESEJO%') THEN 'DP GTS' -- Padrão DP para PV
                        WHEN UPPER(rec.product_name) LIKE '%LUMI%'   THEN 'BL'
                        WHEN UPPER(rec.product_name) LIKE '%FORMA%'  THEN 'BF'
                        WHEN UPPER(rec.product_name) LIKE '%BELABLOOM%' THEN 'BH'
                        WHEN UPPER(rec.product_name) LIKE '%SEKASHOT%' OR UPPER(rec.offer_name) LIKE '%SEKA%' THEN 'SS'
                        WHEN UPPER(rec.product_name) LIKE '%MOUNJALIS%' THEN 'ME'
                        ELSE 'OUTRO' END;
                    BEGIN
                        v_pos_vendas := array_append(v_pos_vendas, v_item_qtd || ' PV ' || v_sigla_pv);
                    END;
                END IF;
            END;

            INSERT INTO _processed (id) VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;
        -- Fim sub-loop filhos

        -- Montar descrição final
        v_descricao := pedido_pai.sigla || ' - ' || v_nome_oferta;
        -- Limpar "+ DP" solto que possa sobrar no nome da oferta de produtos mal formatados do Ticto
        v_descricao := REGEXP_REPLACE(v_descricao, '(?i)\s*\+\s*DP$', '');

        IF array_length(v_order_bumps, 1) > 0 THEN 
            FOR rec IN SELECT unnest(v_order_bumps) as item LOOP
                v_descricao := v_descricao || ' + ' || rec.item;
            END LOOP;
        END IF;
        IF array_length(v_upsells, 1) > 0 THEN 
            FOR rec IN SELECT unnest(v_upsells) as item LOOP
                v_descricao := v_descricao || ' + ' || rec.item;
            END LOOP;
        END IF;
        FOR rec IN SELECT unnest(v_pos_vendas) as item LOOP
            v_descricao := v_descricao || ' + ' || rec.item;
        END LOOP;

        v_endereco_completo :=
            COALESCE(pedido_pai.address_street, '') || ', ' ||
            COALESCE(pedido_pai.address_number, '') ||
            CASE WHEN pedido_pai.address_complement IS NOT NULL AND pedido_pai.address_complement != ''
                 THEN ' - ' || pedido_pai.address_complement ELSE '' END ||
            ' - ' || COALESCE(pedido_pai.address_neighborhood, '') || ', ' ||
            COALESCE(pedido_pai.address_city, '') || '/' || COALESCE(pedido_pai.address_state, '') ||
            ' - CEP: ' || COALESCE(pedido_pai.address_zip_code, '');

        -- ──────────────────────────────────────────────────────────
        -- UPSERT no pedidos_consolidados_v3
        -- Regras do ON CONFLICT:
        --   • Se foi_editado=TRUE: preserva dados do CLIENTE, mas atualiza produtos/filhos
        --   • Se codigo_rastreio IS NOT NULL: nenhuma alteração (guard final)
        --   • dia_despacho: preserva se pv_realizado=TRUE (agendamento manual)
        -- ──────────────────────────────────────────────────────────
        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
            nome_cliente, email, cpf, telefone, cep, data_venda,
            descricao_pacote, codigos_agrupados, quantidade_pedidos, produto_principal,
            dia_despacho, status_envio, plataforma,
            order_bumps, upsells, pos_vendas, codigos_filhos,
            tem_divergencia, itens_divergentes,
            logradouro, numero, complemento, bairro, cidade, estado, endereco_completo
        ) VALUES (
            pedido_pai.id,
            pedido_pai.transaction_hash,
            'Aprovado',
            pedido_pai.product_name,
            v_nome_oferta,
            pedido_pai.customer_name,
            pedido_pai.customer_email,
            pedido_pai.customer_cpf,
            pedido_pai.customer_phone,
            pedido_pai.address_zip_code,
            COALESCE(pedido_pai.status_date, pedido_pai.order_date),
            v_descricao,
            ARRAY[pedido_pai.codigo_unico] || v_codigos_filhos,
            v_quantidade,
            pedido_pai.sigla,
            v_dia_despacho,
            'Pendente',
            COALESCE(pedido_pai.plataforma, 'ticto'),
            v_order_bumps,
            v_upsells,
            v_pos_vendas,
            v_codigos_filhos,
            v_tem_divergencia,
            v_lista_divergencias,
            pedido_pai.address_street,
            pedido_pai.address_number,
            pedido_pai.address_complement,
            pedido_pai.address_neighborhood,
            pedido_pai.address_city,
            pedido_pai.address_state,
            v_endereco_completo
        )
        ON CONFLICT (codigo_transacao) DO UPDATE SET
            -- Produtos/filhos: SEMPRE atualizar (mesmo em pedidos editados)
            nome_oferta        = EXCLUDED.nome_oferta,
            descricao_pacote   = EXCLUDED.descricao_pacote,
            codigos_agrupados  = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps        = EXCLUDED.order_bumps,
            upsells            = EXCLUDED.upsells,
            pos_vendas         = EXCLUDED.pos_vendas,
            codigos_filhos     = EXCLUDED.codigos_filhos,
            tem_divergencia    = EXCLUDED.tem_divergencia,
            itens_divergentes  = EXCLUDED.itens_divergentes,
            -- Dados do cliente: preservar se foi editado manualmente (foi_editado=TRUE)
            nome_cliente      = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.nome_cliente   ELSE EXCLUDED.nome_cliente   END,
            cpf               = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.cpf            ELSE EXCLUDED.cpf            END,
            email             = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.email          ELSE EXCLUDED.email          END,
            telefone          = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.telefone       ELSE EXCLUDED.telefone       END,
            cep               = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.cep            ELSE EXCLUDED.cep            END,
            logradouro        = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.logradouro     ELSE EXCLUDED.logradouro     END,
            numero            = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.numero         ELSE EXCLUDED.numero         END,
            complemento       = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.complemento   ELSE EXCLUDED.complemento   END,
            bairro            = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.bairro         ELSE EXCLUDED.bairro         END,
            cidade            = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.cidade         ELSE EXCLUDED.cidade         END,
            estado            = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.estado         ELSE EXCLUDED.estado         END,
            endereco_completo = CASE WHEN pedidos_consolidados_v3.foi_editado = TRUE THEN pedidos_consolidados_v3.endereco_completo ELSE EXCLUDED.endereco_completo END,
            -- Data de despacho: preservar se agendamento manual (pv_realizado=TRUE)
            dia_despacho      = CASE WHEN pedidos_consolidados_v3.pv_realizado = TRUE THEN pedidos_consolidados_v3.dia_despacho ELSE EXCLUDED.dia_despacho END,
            updated_at        = NOW()
        WHERE pedidos_consolidados_v3.codigo_rastreio IS NULL; -- Guard: nunca alterar pedido etiquetado

        v_total_processados := v_total_processados + 1;
    END LOOP;

    RETURN jsonb_build_object('status', 'success', 'processed', v_total_processados);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION consolidar_pedidos_ticto() TO anon, authenticated, service_role;
