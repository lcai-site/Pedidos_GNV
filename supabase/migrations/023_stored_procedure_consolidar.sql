-- ================================================================
-- STORED PROCEDURE: CONSOLIDAR PEDIDOS (V2)
-- Regras exatas baseadas na documentação do usuário
-- ================================================================

-- ================================================================
-- FUNÇÃO AUXILIAR: Calcular Janela de PV
-- Quinta-feira (4) ou Sexta-feira (5): +4 dias
-- Outros dias: +2 dias
-- ================================================================
CREATE OR REPLACE FUNCTION calcular_janela_pv(data_pedido DATE)
RETURNS DATE AS $$
DECLARE
    dia_semana INTEGER;
BEGIN
    IF data_pedido IS NULL THEN
        RETURN CURRENT_DATE;
    END IF;
    
    -- PostgreSQL: 0=domingo, 1=segunda, ..., 4=quinta, 5=sexta, 6=sábado
    dia_semana := EXTRACT(DOW FROM data_pedido);
    
    IF dia_semana IN (4, 5) THEN  -- Quinta ou Sexta
        RETURN data_pedido + INTERVAL '4 days';
    ELSE
        RETURN data_pedido + INTERVAL '2 days';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- FUNÇÃO AUXILIAR: Normalizar Documento (CPF/CNPJ)
-- Remove caracteres não numéricos e zeros à esquerda
-- ================================================================
CREATE OR REPLACE FUNCTION normalizar_documento(doc_raw TEXT)
RETURNS TEXT AS $$
DECLARE
    doc_limpo TEXT;
BEGIN
    IF doc_raw IS NULL OR doc_raw = '' THEN
        RETURN '';
    END IF;
    -- Remove tudo que não é número
    doc_limpo := REGEXP_REPLACE(doc_raw, '[^0-9]', '', 'g');
    -- Remove zeros à esquerda (converte para integer e volta para text)
    IF doc_limpo = '' THEN
        RETURN '';
    END IF;
    RETURN LTRIM(doc_limpo, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- FUNÇÃO AUXILIAR: Chave de Endereço (para detecção de fraude)
-- ================================================================
CREATE OR REPLACE FUNCTION chave_endereco(cep TEXT, cidade TEXT, estado TEXT, rua TEXT, numero TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(TRIM(COALESCE(cep, ''))) || '|' ||
           LOWER(TRIM(COALESCE(cidade, ''))) || '|' ||
           LOWER(TRIM(COALESCE(estado, ''))) || '|' ||
           LOWER(TRIM(COALESCE(rua, ''))) || '|' ||
           LOWER(TRIM(COALESCE(numero, '')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- FUNÇÃO AUXILIAR: Identificar Sigla do Produto
-- ================================================================
CREATE OR REPLACE FUNCTION sigla_produto(nome_produto TEXT)
RETURNS TEXT AS $$
DECLARE
    produto_upper TEXT;
BEGIN
    produto_upper := UPPER(COALESCE(nome_produto, ''));
    
    IF produto_upper LIKE '%DESEJO PROIBIDO%' OR produto_upper LIKE '%DESEJO%' THEN
        RETURN 'DP';
    ELSIF produto_upper LIKE '%BELA LUMI%' OR produto_upper LIKE '%LUMI%' THEN
        RETURN 'BL';
    ELSIF produto_upper LIKE '%BELA FORMA%' OR produto_upper LIKE '%FORMA%' THEN
        RETURN 'BF';
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- STORED PROCEDURE PRINCIPAL: CONSOLIDAR_PEDIDOS_V2
-- ================================================================
CREATE OR REPLACE FUNCTION consolidar_pedidos()
RETURNS TABLE (
    total_principais INTEGER,
    total_order_bumps INTEGER,
    total_upsells INTEGER,
    total_pos_vendas INTEGER,
    total_dois_cartoes INTEGER,
    total_mesmo_endereco INTEGER
) AS $$
DECLARE
    v_total_principais INTEGER := 0;
    v_total_order_bumps INTEGER := 0;
    v_total_upsells INTEGER := 0;
    v_total_pos_vendas INTEGER := 0;
    v_total_dois_cartoes INTEGER := 0;
    v_total_mesmo_endereco INTEGER := 0;
    
    rec RECORD;
    pedido_pai RECORD;
    
    v_codigos_filhos TEXT[];
    v_order_bumps TEXT[];
    v_upsells TEXT[];
    v_pos_vendas_dp TEXT[];
    v_pos_vendas_bf TEXT[];
    v_pos_vendas_bl TEXT[];
    v_nome_oferta_consolidado TEXT;
    v_quantidade_pedidos INTEGER;
    v_doc_limpo TEXT;
    v_data_limite DATE;
    v_tem_dois_cartoes BOOLEAN;
    v_eh_mesmo_endereco BOOLEAN;
    v_sigla_produto TEXT;
BEGIN
    -- ================================================================
    -- PREPARAÇÃO: Limpar tabela e criar tabela temporária de processados
    -- ================================================================
    DELETE FROM pedidos_consolidados_v3;
    
    CREATE TEMP TABLE IF NOT EXISTS temp_processados (
        codigo_transacao TEXT PRIMARY KEY
    ) ON COMMIT DROP;
    
    DELETE FROM temp_processados;
    
    -- ================================================================
    -- PASSO 1: Identificar Endereços Compartilhados (Fraude)
    -- Mesmo CEP + Cidade + Estado + Rua + Número
    -- MAS com Documento OU Nome diferentes
    -- ================================================================
    CREATE TEMP TABLE IF NOT EXISTS temp_enderecos AS
    SELECT 
        chave_endereco(cep, cidade, estado, rua, numero) as chave_end,
        normalizar_documento(cpf_cliente) as doc_normalizado,
        LOWER(TRIM(COALESCE(nome_cliente, ''))) as nome_lower,
        codigo_transacao
    FROM pedidos
    WHERE status IN ('Aprovado', 'Autorizado')
      AND cep IS NOT NULL AND cep != ''
      AND cidade IS NOT NULL AND cidade != '';
    
    CREATE TEMP TABLE IF NOT EXISTS temp_fraudes AS
    SELECT DISTINCT e1.codigo_transacao
    FROM temp_enderecos e1
    JOIN temp_enderecos e2 ON e1.chave_end = e2.chave_end
    WHERE e1.codigo_transacao != e2.codigo_transacao
      AND (e1.doc_normalizado != e2.doc_normalizado 
           OR e1.nome_lower != e2.nome_lower);
    
    -- ================================================================
    -- PASSO 2: Processar Pedidos Principais
    -- O PAI é o pedido que NÃO tem "ORDERBUMP" ou "UPSELL" na oferta
    -- ================================================================
    FOR pedido_pai IN
        SELECT p.*,
               normalizar_documento(p.cpf_cliente) as doc_limpo,
               UPPER(COALESCE(p.nome_oferta, '')) as oferta_upper,
               sigla_produto(p.nome_produto) as sigla
        FROM pedidos p
        WHERE p.status IN ('Aprovado', 'Autorizado')
          AND p.codigo_transacao IS NOT NULL
          -- Não é Order Bump
          AND UPPER(COALESCE(p.nome_oferta, '')) NOT LIKE '%ORDERBUMP%'
          -- Não é Upsell  
          AND UPPER(COALESCE(p.nome_oferta, '')) NOT LIKE '%UPSELL%'
          AND UPPER(COALESCE(p.nome_oferta, '')) NOT LIKE '%UP SELL%'
          -- É um produto conhecido (DP, BF ou BL)
          AND sigla_produto(p.nome_produto) IS NOT NULL
        ORDER BY p.data_venda ASC
    LOOP
        -- Pular se já foi processado como filho de outro pedido
        IF EXISTS (SELECT 1 FROM temp_processados WHERE codigo_transacao = pedido_pai.codigo_transacao) THEN
            CONTINUE;
        END IF;
        
        -- Inicializar variáveis
        v_codigos_filhos := ARRAY[]::TEXT[];
        v_order_bumps := ARRAY[]::TEXT[];
        v_upsells := ARRAY[]::TEXT[];
        v_pos_vendas_dp := ARRAY[]::TEXT[];
        v_pos_vendas_bf := ARRAY[]::TEXT[];
        v_pos_vendas_bl := ARRAY[]::TEXT[];
        v_quantidade_pedidos := 1;
        v_doc_limpo := pedido_pai.doc_limpo;
        v_tem_dois_cartoes := FALSE;
        
        -- ============================================================
        -- Verificar Endereço Compartilhado (Fraude)
        -- ============================================================
        v_eh_mesmo_endereco := EXISTS (
            SELECT 1 FROM temp_fraudes 
            WHERE codigo_transacao = pedido_pai.codigo_transacao
        );
        
        IF v_eh_mesmo_endereco THEN
            v_total_mesmo_endereco := v_total_mesmo_endereco + 1;
            -- Inserir com status "Mesmo End" (não pula, apenas marca)
            INSERT INTO pedidos_consolidados_v3 (
                id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
                valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
                telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
                endereco_completo, data_venda, created_at, metadata, produto_principal,
                fraude_endereco
            ) VALUES (
                pedido_pai.id, pedido_pai.codigo_transacao, 'Mesmo End', 
                pedido_pai.nome_produto, pedido_pai.nome_oferta,
                pedido_pai.valor_total, pedido_pai.forma_pagamento, pedido_pai.parcelas,
                pedido_pai.nome_cliente, pedido_pai.email_cliente, pedido_pai.cpf_cliente,
                pedido_pai.telefone_cliente, pedido_pai.cep, pedido_pai.rua, pedido_pai.numero,
                pedido_pai.complemento, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado,
                CONCAT_WS(', ', pedido_pai.rua, pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
                pedido_pai.data_venda, pedido_pai.created_at, pedido_pai.metadata,
                pedido_pai.sigla, TRUE
            ) ON CONFLICT (codigo_transacao) DO UPDATE SET 
                status_aprovacao = 'Mesmo End', 
                fraude_endereco = TRUE,
                updated_at = now();
            INSERT INTO temp_processados VALUES (pedido_pai.codigo_transacao) ON CONFLICT DO NOTHING;
            CONTINUE;  -- Não processa OB/US/PV para pedidos "Mesmo End"
        END IF;
        
        -- ============================================================
        -- 3. Buscar ORDER BUMPS (mesmo código + "ORDERBUMP" na oferta)
        -- ============================================================
        FOR rec IN
            SELECT p.codigo_transacao, p.nome_oferta
            FROM pedidos p
            WHERE p.status IN ('Aprovado', 'Autorizado')
              AND p.codigo_transacao != pedido_pai.codigo_transacao
              AND NOT EXISTS (SELECT 1 FROM temp_processados WHERE codigo_transacao = p.codigo_transacao)
              -- Mesmo código base ou metadata codigo_pedido igual
              AND (
                  -- Código começa igual (ex: TOP123 e TOP123-OB)
                  LEFT(p.codigo_transacao, 10) = LEFT(pedido_pai.codigo_transacao, 10)
                  -- Ou mesmo email + mesma data + código parecido
                  OR (p.email_cliente = pedido_pai.email_cliente 
                      AND p.data_venda::DATE = pedido_pai.data_venda::DATE)
              )
              AND UPPER(COALESCE(p.nome_oferta, '')) LIKE '%ORDERBUMP%'
        LOOP
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            v_order_bumps := array_append(v_order_bumps, rec.nome_oferta);
            v_quantidade_pedidos := v_quantidade_pedidos + 1;
            v_total_order_bumps := v_total_order_bumps + 1;
            INSERT INTO temp_processados VALUES (rec.codigo_transacao) ON CONFLICT DO NOTHING;
        END LOOP;
        
        -- ============================================================
        -- 4. Buscar UPSELL por Documento
        -- Mesmo documento + data entre D e D+1 + "UPSELL" ou "UP SELL"
        -- ============================================================
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            FOR rec IN
                SELECT p.codigo_transacao, p.nome_oferta
                FROM pedidos p
                WHERE p.status IN ('Aprovado', 'Autorizado')
                  AND p.codigo_transacao != pedido_pai.codigo_transacao
                  AND NOT EXISTS (SELECT 1 FROM temp_processados WHERE codigo_transacao = p.codigo_transacao)
                  AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
                  -- Data entre D e D+1
                  AND p.data_venda::DATE >= pedido_pai.data_venda::DATE
                  AND p.data_venda::DATE <= pedido_pai.data_venda::DATE + INTERVAL '1 day'
                  -- Oferta contém UPSELL
                  AND (
                      UPPER(COALESCE(p.nome_oferta, '')) LIKE '%UPSELL%'
                      OR UPPER(COALESCE(p.nome_oferta, '')) LIKE '%UP SELL%'
                  )
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_upsells := array_append(v_upsells, rec.nome_oferta);
                v_quantidade_pedidos := v_quantidade_pedidos + 1;
                v_total_upsells := v_total_upsells + 1;
                INSERT INTO temp_processados VALUES (rec.codigo_transacao) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;
        
        -- ============================================================
        -- 5. Detecção de 2 Cartões
        -- Mesmo email + mesma oferta exata
        -- (Coluna Pagamento2Cartoes não existe na tabela, então verificamos duplicatas)
        -- ============================================================
        FOR rec IN
            SELECT p.codigo_transacao
            FROM pedidos p
            WHERE p.status IN ('Aprovado', 'Autorizado')
              AND p.codigo_transacao != pedido_pai.codigo_transacao
              AND NOT EXISTS (SELECT 1 FROM temp_processados WHERE codigo_transacao = p.codigo_transacao)
              AND LOWER(p.email_cliente) = LOWER(pedido_pai.email_cliente)
              AND p.nome_oferta = pedido_pai.nome_oferta
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            v_total_dois_cartoes := v_total_dois_cartoes + 1;
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            INSERT INTO temp_processados VALUES (rec.codigo_transacao) ON CONFLICT DO NOTHING;
        END LOOP;
        
        -- ============================================================
        -- 6. Buscar PÓS VENDAS CC
        -- Mesmo documento + data > D + dentro da janela + "CC" na oferta
        -- ============================================================
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            v_data_limite := calcular_janela_pv(pedido_pai.data_venda::DATE);
            
            FOR rec IN
                SELECT p.codigo_transacao, p.nome_oferta, p.nome_produto,
                       sigla_produto(p.nome_produto) as sigla_pv
                FROM pedidos p
                WHERE p.status IN ('Aprovado', 'Autorizado')
                  AND p.codigo_transacao != pedido_pai.codigo_transacao
                  AND NOT EXISTS (SELECT 1 FROM temp_processados WHERE codigo_transacao = p.codigo_transacao)
                  AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
                  -- Data estritamente posterior
                  AND p.data_venda::DATE > pedido_pai.data_venda::DATE
                  -- Dentro da janela de PV
                  AND p.data_venda::DATE <= v_data_limite
                  -- Oferta contém CC
                  AND UPPER(COALESCE(p.nome_oferta, '')) LIKE '%CC%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_quantidade_pedidos := v_quantidade_pedidos + 1;
                v_total_pos_vendas := v_total_pos_vendas + 1;
                
                -- Agrupar por sigla do produto PV
                IF rec.sigla_pv = 'DP' THEN
                    v_pos_vendas_dp := array_append(v_pos_vendas_dp, rec.nome_oferta);
                ELSIF rec.sigla_pv = 'BF' THEN
                    v_pos_vendas_bf := array_append(v_pos_vendas_bf, rec.nome_oferta);
                ELSIF rec.sigla_pv = 'BL' THEN
                    v_pos_vendas_bl := array_append(v_pos_vendas_bl, rec.nome_oferta);
                END IF;
                
                INSERT INTO temp_processados VALUES (rec.codigo_transacao) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;
        
        -- ============================================================
        -- 7. Montar Nome da Oferta Consolidado
        -- Formato: [Oferta Principal] + Order Bump + UPSELL + [Qtd] [Sigla PV]
        -- ============================================================
        v_nome_oferta_consolidado := pedido_pai.nome_oferta;
        
        IF array_length(v_order_bumps, 1) > 0 THEN
            v_nome_oferta_consolidado := v_nome_oferta_consolidado || ' + Order Bump';
        END IF;
        
        IF array_length(v_upsells, 1) > 0 THEN
            v_nome_oferta_consolidado := v_nome_oferta_consolidado || ' + UPSELL';
        END IF;
        
        IF array_length(v_pos_vendas_dp, 1) > 0 THEN
            v_nome_oferta_consolidado := v_nome_oferta_consolidado || ' + ' || 
                array_length(v_pos_vendas_dp, 1)::TEXT || ' DP';
        END IF;
        
        IF array_length(v_pos_vendas_bf, 1) > 0 THEN
            v_nome_oferta_consolidado := v_nome_oferta_consolidado || ' + ' || 
                array_length(v_pos_vendas_bf, 1)::TEXT || ' BF';
        END IF;
        
        IF array_length(v_pos_vendas_bl, 1) > 0 THEN
            v_nome_oferta_consolidado := v_nome_oferta_consolidado || ' + ' || 
                array_length(v_pos_vendas_bl, 1)::TEXT || ' BL';
        END IF;
        
        -- ============================================================
        -- INSERIR PEDIDO CONSOLIDADO
        -- ============================================================
        INSERT INTO pedidos_consolidados_v3 (
            id,
            codigo_transacao,
            status_aprovacao,
            nome_produto,
            nome_oferta,
            valor_total,
            forma_pagamento,
            parcelas,
            nome_cliente,
            email,
            cpf,
            telefone,
            cep,
            logradouro,
            numero,
            complemento,
            bairro,
            cidade,
            estado,
            endereco_completo,
            data_venda,
            created_at,
            metadata,
            descricao_pacote,
            codigos_agrupados,
            quantidade_pedidos,
            produto_principal,
            dia_despacho,
            data_envio,
            codigo_rastreio,
            order_bumps,
            upsells,
            pos_vendas,
            codigos_filhos,
            tem_dois_cartoes,
            fraude_endereco
        ) VALUES (
            pedido_pai.id,
            pedido_pai.codigo_transacao,
            'Aprovado',
            pedido_pai.nome_produto,
            v_nome_oferta_consolidado,
            pedido_pai.valor_total,
            pedido_pai.forma_pagamento,
            pedido_pai.parcelas,
            pedido_pai.nome_cliente,
            pedido_pai.email_cliente,
            pedido_pai.cpf_cliente,
            pedido_pai.telefone_cliente,
            pedido_pai.cep,
            pedido_pai.rua,
            pedido_pai.numero,
            pedido_pai.complemento,
            pedido_pai.bairro,
            pedido_pai.cidade,
            pedido_pai.estado,
            CONCAT_WS(', ', pedido_pai.rua, pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
            pedido_pai.data_venda,
            pedido_pai.created_at,
            pedido_pai.metadata,
            pedido_pai.nome_produto,
            ARRAY[pedido_pai.codigo_transacao] || v_codigos_filhos,
            v_quantidade_pedidos,
            pedido_pai.sigla,
            (pedido_pai.data_venda::DATE + INTERVAL '2 days')::DATE,
            pedido_pai.data_envio,
            pedido_pai.codigo_rastreio,
            v_order_bumps,
            v_upsells,
            v_pos_vendas_dp || v_pos_vendas_bf || v_pos_vendas_bl,
            v_codigos_filhos,
            v_tem_dois_cartoes,
            FALSE
        )
        ON CONFLICT (codigo_transacao) DO UPDATE SET
            nome_oferta = EXCLUDED.nome_oferta,
            codigos_agrupados = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps = EXCLUDED.order_bumps,
            upsells = EXCLUDED.upsells,
            pos_vendas = EXCLUDED.pos_vendas,
            codigos_filhos = EXCLUDED.codigos_filhos,
            tem_dois_cartoes = EXCLUDED.tem_dois_cartoes,
            updated_at = now();
        
        INSERT INTO temp_processados VALUES (pedido_pai.codigo_transacao) ON CONFLICT DO NOTHING;
        v_total_principais := v_total_principais + 1;
    END LOOP;
    
    -- Limpar tabelas temporárias
    DROP TABLE IF EXISTS temp_enderecos;
    DROP TABLE IF EXISTS temp_fraudes;
    
    -- Retornar estatísticas
    RETURN QUERY SELECT 
        v_total_principais,
        v_total_order_bumps,
        v_total_upsells,
        v_total_pos_vendas,
        v_total_dois_cartoes,
        v_total_mesmo_endereco;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- COMENTÁRIO
-- ================================================================
COMMENT ON FUNCTION consolidar_pedidos() IS 
'Consolida pedidos aplicando todas as regras do Apps Script V27:
- Agrupa Order Bumps (mesmo código + ORDERBUMP)
- Agrupa Upsells (mesmo CPF + D→D+1 + UPSELL)  
- Agrupa PVs CC (mesmo CPF + D+1→janela + CC) com siglas DP/BF/BL
- Detecta 2 Cartões (mesmo email + mesma oferta)
- Exclui endereços compartilhados (fraude)

Executar: SELECT * FROM consolidar_pedidos();';

SELECT 'Stored Procedure consolidar_pedidos() V2 criada!' as resultado;
