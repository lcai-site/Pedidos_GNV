-- ================================================================
-- MIGRATION 031: Consolidação baseada na tabela 'ticto_pedidos'
-- Objetivo: Migrar lógica de 'pedidos' para 'ticto_pedidos'
-- Agendamento: pg_cron Seg-Sex às 08:30 BRT (11:30 UTC)
-- Notificações: Tabela e Trigger para pós-vendas atrasados
-- Proteção: Não roda em feriados cadastrados na tabela 'feriados'
-- Retorno: JSONB com status da execução
-- ================================================================

-- 1. Habilitar extensão pg_cron (se possível via Dashboard)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Tabela de Notificações
CREATE TABLE IF NOT EXISTS notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL, -- 'atraso_pv', 'fraude', etc.
    mensagem TEXT NOT NULL,
    lida BOOLEAN DEFAULT FALSE,
    dados JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ativar RLS para notificações
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total a autenticados" ON notificacoes;
CREATE POLICY "Acesso total a autenticados" ON notificacoes FOR ALL TO authenticated USING (true);


-- ================================================================
-- 3. PROCEDURE: CONSOLIDAR PEDIDOS (V4 - TICTO SOURCE)
-- ================================================================
CREATE OR REPLACE FUNCTION consolidar_pedidos_ticto()
RETURNS jsonb AS $$
DECLARE
    -- Variáveis de controle
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
    
    -- Variáveis de data
    v_hoje DATE;
    v_nome_feriado TEXT;
    v_dia_pv DATE;
    v_dia_despacho DATE;
BEGIN
    -- ============================================================
    -- PRE-CHECK: FERIADOS (Proteção)
    -- ============================================================
    -- Garantir data correta no fuso Brasil (UTC-3)
    v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

    -- Se hoje for feriado, abortar execução
    SELECT nome INTO v_nome_feriado FROM feriados WHERE data = v_hoje;
    
    IF v_nome_feriado IS NOT NULL THEN
        RETURN jsonb_build_object(
            'status', 'skipped',
            'message', 'Feriado: ' || v_nome_feriado,
            'details', jsonb_build_object('data', v_hoje, 'motivo', 'Tabela de Feriados')
        );
    END IF;

    -- ============================================================
    -- LÓGICA DE CONSOLIDAÇÃO (Segue fluxo normal)
    -- ============================================================

    -- Limpar tabelas temporárias antigas se existirem
    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;

    -- PASSO 0: PRESERVAR REGISTROS LOCKED (JÁ DESPACHADOS)
    CREATE TEMP TABLE _locked_ids AS
    SELECT id FROM pedidos_consolidados_v3
    WHERE codigo_rastreio IS NOT NULL
       OR foi_editado = TRUE
       OR data_envio IS NOT NULL;

    CREATE TEMP TABLE _locked_codes AS
    SELECT codigo_transacao FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids)
    UNION
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids);

    -- Remover registros consolidados que NÃO estão travados (para reprocessar)
    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
    ) to_delete
    WHERE c.id = to_delete.id;

    -- Tabela de hashes processados nesta execução
    CREATE TEMP TABLE _processed (hash TEXT PRIMARY KEY);
    
    -- Marcar hashes travados como já processados
    INSERT INTO _processed (hash)
    SELECT codigo_transacao FROM _locked_codes;

    -- PASSO 1: ITERAR SOBRE PEDIDOS "PAI" (Novos na ticto_pedidos)
    FOR pedido_pai IN
        SELECT 
            p.*,
            -- Normalizações
            REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') as doc_limpo,
            LOWER(COALESCE(p.customer_email, '')) as email_lower,
            UPPER(REPLACE(COALESCE(p.offer_name, ''), ' ', '')) as oferta_norm,
            -- Cálculo de Sigla (Regra do Produto)
            CASE 
                WHEN UPPER(p.product_name) LIKE '%DESEJO%' THEN 'DP'
                WHEN UPPER(p.product_name) LIKE '%LUMI%' THEN 'BL'
                WHEN UPPER(p.product_name) LIKE '%FORMA%' THEN 'BF'
                ELSE NULL
            END as sigla
        FROM ticto_pedidos p
        WHERE p.status IN ('authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago')
          -- Não processar se já foi (locked ou nesta execução)
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
          -- Filtrar tipos (Pai não pode ser Bump/Upsell/CC)
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%ORDERBUMP%'
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%UPSELL%'
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%CC%'
        ORDER BY p.order_date ASC
    LOOP
        -- Sigla obrigatória
        IF pedido_pai.sigla IS NULL THEN CONTINUE; END IF;

        -- Inicializar Arrays
        v_codigos_filhos := ARRAY[]::TEXT[];
        v_order_bumps := ARRAY[]::TEXT[];
        v_upsells := ARRAY[]::TEXT[];
        v_pos_vendas := ARRAY[]::TEXT[];
        v_quantidade := 1;
        v_tem_dois_cartoes := FALSE;
        v_nome_oferta := pedido_pai.offer_name;

        -- Marcar Pai como processado
        INSERT INTO _processed (hash) VALUES (pedido_pai.transaction_hash) ON CONFLICT DO NOTHING;

        -- ========================================================
        -- CÁLCULO DE DATAS (Utilizando função de dias úteis existente)
        -- ========================================================
        -- Padrão: Venda -> +1 dia útil (PV) -> +1 dia útil (Despacho) = Total ~2 dias úteis
        -- Se proximo_dia_util não existir, fallback para data simples
        BEGIN
            v_dia_pv := proximo_dia_util(pedido_pai.order_date::DATE);
            v_dia_despacho := proximo_dia_util(v_dia_pv);
        EXCEPTION WHEN OTHERS THEN
            v_dia_despacho := (pedido_pai.order_date::DATE + 2);
        END;

        -- ========================================================
        -- BUSCA: ORDER BUMPS (Mesmo Email + Mesma Data + OrderBump)
        -- ========================================================
        FOR rec IN
            SELECT transaction_hash, offer_name FROM ticto_pedidos p
            WHERE p.transaction_hash != pedido_pai.transaction_hash
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.order_date::DATE = pedido_pai.order_date::DATE
            AND UPPER(p.offer_name) LIKE '%ORDERBUMP%'
        LOOP
            v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            v_order_bumps := array_append(v_order_bumps, rec.offer_name);
            v_quantidade := v_quantidade + 1;
            INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
        END LOOP;

        -- ========================================================
        -- BUSCA: UPSELLS (Mesmo CPF + Data D ou D+1 + Upsell)
        -- ========================================================
        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT transaction_hash, offer_name FROM ticto_pedidos p
                WHERE p.transaction_hash != pedido_pai.transaction_hash
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE BETWEEN pedido_pai.order_date::DATE AND (pedido_pai.order_date::DATE + 1)
                AND UPPER(p.offer_name) LIKE '%UPSELL%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                v_upsells := array_append(v_upsells, rec.offer_name);
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- ========================================================
        -- BUSCA: 2 CARTÕES (Mesmo Email + Mesma Oferta + Mesma Data)
        -- ========================================================
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

        -- ========================================================
        -- BUSCA: PÓS-VENDAS CC (Mesmo CPF + Janela de Dias + CC)
        -- ========================================================
        -- Janela: Se Qui/Sex -> +4 dias. Senão +2 dias.
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
                -- Sigla do PV
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

        -- ========================================================
        -- INSERIR NA CONSOLIDADA
        -- ========================================================
        -- Montar nome oferta
        IF array_length(v_order_bumps, 1) > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || array_length(v_order_bumps, 1) || ' OB'; END IF;
        IF array_length(v_upsells, 1) > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || array_length(v_upsells, 1) || ' UP'; END IF;
        IF array_length(v_pos_vendas, 1) > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || array_length(v_pos_vendas, 1) || ' PV'; END IF;

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

-- Permissões
GRANT EXECUTE ON FUNCTION consolidar_pedidos_ticto() TO anon, authenticated, service_role;


-- ================================================================
-- 4. TRIGGER PARA NOTIFICAR ATRASOS
-- ================================================================
CREATE OR REPLACE FUNCTION check_late_pos_vendas()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_id UUID;
    v_parent_despacho DATE;
    v_corte TIMESTAMPTZ;
BEGIN
    -- Se for OB, Upsell ou PV (CC)
    IF UPPER(NEW.offer_name) LIKE '%UPSELL%' 
    OR UPPER(NEW.offer_name) LIKE '%ORDERBUMP%'
    OR UPPER(NEW.offer_name) LIKE '%CC%' THEN
        
        -- Achar o pai consolidado mais recente desse cliente
        SELECT id, dia_despacho INTO v_parent_id, v_parent_despacho
        FROM pedidos_consolidados_v3
        WHERE (cpf = NEW.customer_cpf OR email = NEW.customer_email)
        ORDER BY data_venda DESC LIMIT 1;

        IF v_parent_id IS NOT NULL THEN
            -- Corte é 11:30 UTC (08:30 BRT) do dia do despacho
            v_corte := v_parent_despacho + TIME '11:30:00';
            
            -- Se chegou DEPOIS do corte (NOW() é UTC no Supabase)
            IF NOW() > v_corte THEN
                 INSERT INTO notificacoes (tipo, mensagem, dados)
                 VALUES ('atraso_pv', 
                         'Item chegou após corte de envio (08:30)! ' || NEW.transaction_hash,
                         jsonb_build_object('pai_id', v_parent_id, 'item_hash', NEW.transaction_hash));
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_late_pv ON ticto_pedidos;
CREATE TRIGGER trg_check_late_pv
    AFTER INSERT ON ticto_pedidos
    FOR EACH ROW
    EXECUTE FUNCTION check_late_pos_vendas();


-- ================================================================
-- 5. AGENDAMENTO CRON (11:30 UTC = 08:30 BRT, Seg a Sex)
-- ================================================================

SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname = 'consolidacao_diaria_ticto';

SELECT cron.schedule(
    'consolidacao_diaria_ticto',
    '30 11 * * 1-5', 
    'SELECT consolidar_pedidos_ticto()'
);
