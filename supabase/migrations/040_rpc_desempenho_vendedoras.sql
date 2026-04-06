-- ================================================================
-- MIGRATION 040: RPC Desempenho Vendedoras (Pós-Venda)
-- Objetivo: Agregar métricas de performance por vendedora/afiliada
-- Fonte: campo JSONB 'affiliates' da tabela ticto_pedidos
-- Execute no SQL Editor do Supabase Produção
-- ================================================================

-- ============================================================
-- FUNÇÃO 1: Desempenho por vendedora no período
-- Retorna ranking com vendas, valor, comissão, taxa de conversão
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_desempenho_vendedoras(
    p_data_inicio TIMESTAMPTZ,
    p_data_fim TIMESTAMPTZ
)
RETURNS TABLE (
    affiliate_id INTEGER,
    affiliate_name TEXT,
    affiliate_email TEXT,
    affiliate_phone TEXT,
    affiliate_pid TEXT,
    total_vendas BIGINT,
    vendas_aprovadas BIGINT,
    vendas_pendentes BIGINT,
    vendas_recusadas BIGINT,
    valor_total_aprovado NUMERIC,
    valor_total_pendente NUMERIC,
    comissao_total NUMERIC,
    ticket_medio NUMERIC,
    taxa_conversao NUMERIC,
    primeira_venda TIMESTAMPTZ,
    ultima_venda TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        (aff->>'id')::INTEGER AS affiliate_id,
        aff->>'name' AS affiliate_name,
        aff->>'email' AS affiliate_email,
        aff->>'phone' AS affiliate_phone,
        aff->>'pid' AS affiliate_pid,

        -- Contadores
        COUNT(*) AS total_vendas,
        COUNT(*) FILTER (WHERE tp.status = 'Aprovado') AS vendas_aprovadas,
        COUNT(*) FILTER (WHERE tp.status IN ('Pendente', 'Aguardando')) AS vendas_pendentes,
        COUNT(*) FILTER (WHERE tp.status IN ('Recusado', 'Expirado', 'Cancelado')) AS vendas_recusadas,

        -- Valores
        COALESCE(SUM(tp.paid_amount) FILTER (WHERE tp.status = 'Aprovado'), 0) AS valor_total_aprovado,
        COALESCE(SUM(tp.paid_amount) FILTER (WHERE tp.status = 'Pendente'), 0) AS valor_total_pendente,

        -- Comissão (campo amount vem em centavos no JSON)
        COALESCE(SUM((aff->>'amount')::NUMERIC / 100) FILTER (WHERE tp.status = 'Aprovado'), 0) AS comissao_total,

        -- Ticket médio (aprovados)
        CASE
            WHEN COUNT(*) FILTER (WHERE tp.status = 'Aprovado') > 0
            THEN ROUND(
                COALESCE(SUM(tp.paid_amount) FILTER (WHERE tp.status = 'Aprovado'), 0)
                / COUNT(*) FILTER (WHERE tp.status = 'Aprovado'),
            2)
            ELSE 0
        END AS ticket_medio,

        -- Taxa de conversão (aprovados / total * 100)
        CASE
            WHEN COUNT(*) > 0
            THEN ROUND((COUNT(*) FILTER (WHERE tp.status = 'Aprovado'))::NUMERIC / COUNT(*) * 100, 1)
            ELSE 0
        END AS taxa_conversao,

        MIN(tp.order_date) AS primeira_venda,
        MAX(tp.order_date) AS ultima_venda

    FROM ticto_pedidos tp,
         LATERAL jsonb_array_elements(tp.affiliates) AS aff
    WHERE tp.affiliates IS NOT NULL
      AND tp.affiliates != '[]'::jsonb
      AND tp.order_date >= p_data_inicio
      AND tp.order_date <= p_data_fim
    GROUP BY
        (aff->>'id')::INTEGER,
        aff->>'name',
        aff->>'email',
        aff->>'phone',
        aff->>'pid'
    ORDER BY valor_total_aprovado DESC;
$$;

-- ============================================================
-- FUNÇÃO 2: Métricas gerais do pós-venda + meta coletiva
-- Meta = 15% do faturamento aprovado do PERÍODO ANTERIOR
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_metricas_pos_venda(
    p_data_inicio TIMESTAMPTZ,
    p_data_fim TIMESTAMPTZ
)
RETURNS TABLE (
    total_vendedoras INTEGER,
    total_vendas_pv BIGINT,
    total_vendas_aprovadas BIGINT,
    faturamento_pv NUMERIC,
    faturamento_pendente_pv NUMERIC,
    comissao_total NUMERIC,
    ticket_medio_geral NUMERIC,
    taxa_conversao_geral NUMERIC,
    meta_valor NUMERIC,
    meta_atingida_pct NUMERIC,
    faturamento_periodo_anterior NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    WITH
    -- Período atual: apenas pedidos de afiliados
    periodo_atual AS (
        SELECT
            tp.paid_amount,
            tp.status,
            (aff->>'amount')::NUMERIC / 100 AS comissao_aff
        FROM ticto_pedidos tp,
             LATERAL jsonb_array_elements(tp.affiliates) AS aff
        WHERE tp.affiliates IS NOT NULL
          AND tp.affiliates != '[]'::jsonb
          AND tp.order_date >= p_data_inicio
          AND tp.order_date <= p_data_fim
    ),
    -- Período anterior (mesmo tamanho): TODOS os pedidos aprovados
    periodo_anterior AS (
        SELECT COALESCE(SUM(paid_amount), 0) AS fat_anterior
        FROM ticto_pedidos
        WHERE status = 'Aprovado'
          AND order_date >= p_data_inicio - (p_data_fim - p_data_inicio)
          AND order_date < p_data_inicio
    ),
    -- Vendedoras únicas no período
    vendedoras AS (
        SELECT COUNT(DISTINCT (aff->>'id')) AS cnt
        FROM ticto_pedidos tp,
             LATERAL jsonb_array_elements(tp.affiliates) AS aff
        WHERE tp.affiliates IS NOT NULL
          AND tp.affiliates != '[]'::jsonb
          AND tp.order_date >= p_data_inicio
          AND tp.order_date <= p_data_fim
    )
    SELECT
        v.cnt::INTEGER AS total_vendedoras,
        COUNT(*)::BIGINT AS total_vendas_pv,
        COUNT(*) FILTER (WHERE pa.status = 'Aprovado')::BIGINT AS total_vendas_aprovadas,
        COALESCE(SUM(pa.paid_amount) FILTER (WHERE pa.status = 'Aprovado'), 0) AS faturamento_pv,
        COALESCE(SUM(pa.paid_amount) FILTER (WHERE pa.status = 'Pendente'), 0) AS faturamento_pendente_pv,
        COALESCE(SUM(pa.comissao_aff) FILTER (WHERE pa.status = 'Aprovado'), 0) AS comissao_total,

        -- Ticket médio
        CASE
            WHEN COUNT(*) FILTER (WHERE pa.status = 'Aprovado') > 0
            THEN ROUND(
                COALESCE(SUM(pa.paid_amount) FILTER (WHERE pa.status = 'Aprovado'), 0)
                / COUNT(*) FILTER (WHERE pa.status = 'Aprovado'),
            2)
            ELSE 0
        END AS ticket_medio_geral,

        -- Taxa de conversão
        CASE
            WHEN COUNT(*) > 0
            THEN ROUND(COUNT(*) FILTER (WHERE pa.status = 'Aprovado')::NUMERIC / COUNT(*) * 100, 1)
            ELSE 0
        END AS taxa_conversao_geral,

        -- Meta: 15% do faturamento do período anterior
        ROUND(pant.fat_anterior * 0.15, 2) AS meta_valor,

        -- % da meta atingida
        CASE
            WHEN pant.fat_anterior > 0
            THEN ROUND(
                COALESCE(SUM(pa.paid_amount) FILTER (WHERE pa.status = 'Aprovado'), 0)
                / (pant.fat_anterior * 0.15) * 100,
            1)
            ELSE 0
        END AS meta_atingida_pct,

        pant.fat_anterior AS faturamento_periodo_anterior

    FROM periodo_atual pa
    CROSS JOIN periodo_anterior pant
    CROSS JOIN vendedoras v
    GROUP BY v.cnt, pant.fat_anterior;
$$;

-- ============================================================
-- PERMISSÕES
-- ============================================================

GRANT EXECUTE ON FUNCTION rpc_desempenho_vendedoras(TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rpc_metricas_pos_venda(TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated;

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================

NOTIFY pgrst, 'reload schema';

SELECT 'RPC rpc_desempenho_vendedoras criada com sucesso!' AS resultado
UNION ALL
SELECT 'RPC rpc_metricas_pos_venda criada com sucesso!' AS resultado;
