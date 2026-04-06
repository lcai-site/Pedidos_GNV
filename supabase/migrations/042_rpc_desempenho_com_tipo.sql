-- ================================================================
-- MIGRATION 042: RPC atualizada com filtro por tipo de afiliado
-- Substitui as RPCs da migration 040
-- Execute no SQL Editor do Supabase Produção (APÓS a 041)
-- ================================================================

-- ============================================================
-- FUNÇÃO 1: Desempenho por vendedora no período (com filtro tipo)
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_desempenho_vendedoras(
    p_data_inicio TIMESTAMPTZ,
    p_data_fim TIMESTAMPTZ,
    p_tipo TEXT DEFAULT NULL
)
RETURNS TABLE (
    affiliate_id INTEGER,
    affiliate_name TEXT,
    affiliate_email TEXT,
    affiliate_phone TEXT,
    affiliate_pid TEXT,
    affiliate_tipo TEXT,
    is_coprodutor BOOLEAN,
    is_afiliado BOOLEAN,
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
        COALESCE(af.nome, aff->>'name') AS affiliate_name,
        COALESCE(af.email, aff->>'email') AS affiliate_email,
        aff->>'phone' AS affiliate_phone,
        aff->>'pid' AS affiliate_pid,
        COALESCE(af.tipo, 'nao_classificado') AS affiliate_tipo,
        COALESCE(af.is_coprodutor, FALSE) AS is_coprodutor,
        COALESCE(af.is_afiliado, TRUE) AS is_afiliado,

        COUNT(*) AS total_vendas,
        COUNT(*) FILTER (WHERE tp.status = 'Aprovado') AS vendas_aprovadas,
        COUNT(*) FILTER (WHERE tp.status IN ('Pendente', 'Aguardando')) AS vendas_pendentes,
        COUNT(*) FILTER (WHERE tp.status IN ('Recusado', 'Expirado', 'Cancelado')) AS vendas_recusadas,

        COALESCE(SUM(tp.paid_amount) FILTER (WHERE tp.status = 'Aprovado'), 0) AS valor_total_aprovado,
        COALESCE(SUM(tp.paid_amount) FILTER (WHERE tp.status = 'Pendente'), 0) AS valor_total_pendente,
        COALESCE(SUM((aff->>'amount')::NUMERIC / 100) FILTER (WHERE tp.status = 'Aprovado'), 0) AS comissao_total,

        CASE
            WHEN COUNT(*) FILTER (WHERE tp.status = 'Aprovado') > 0
            THEN ROUND(
                COALESCE(SUM(tp.paid_amount) FILTER (WHERE tp.status = 'Aprovado'), 0)
                / COUNT(*) FILTER (WHERE tp.status = 'Aprovado'),
            2)
            ELSE 0
        END AS ticket_medio,

        CASE
            WHEN COUNT(*) > 0
            THEN ROUND((COUNT(*) FILTER (WHERE tp.status = 'Aprovado'))::NUMERIC / COUNT(*) * 100, 1)
            ELSE 0
        END AS taxa_conversao,

        MIN(tp.order_date) AS primeira_venda,
        MAX(tp.order_date) AS ultima_venda

    FROM ticto_pedidos tp,
         LATERAL jsonb_array_elements(tp.affiliates) AS aff
         LEFT JOIN afiliados af ON af.affiliate_id = (aff->>'id')::INTEGER
    WHERE tp.affiliates IS NOT NULL
      AND tp.affiliates != '[]'::jsonb
      AND tp.order_date >= p_data_inicio
      AND tp.order_date <= p_data_fim
      AND (p_tipo IS NULL OR COALESCE(af.tipo, 'nao_classificado') = p_tipo)
    GROUP BY
        (aff->>'id')::INTEGER,
        af.nome, aff->>'name',
        af.email, aff->>'email',
        aff->>'phone',
        aff->>'pid',
        af.tipo,
        af.is_coprodutor,
        af.is_afiliado
    ORDER BY valor_total_aprovado DESC;
$$;

-- ============================================================
-- FUNÇÃO 2: Métricas gerais PV + meta (com filtro tipo)
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_metricas_pos_venda(
    p_data_inicio TIMESTAMPTZ,
    p_data_fim TIMESTAMPTZ,
    p_tipo TEXT DEFAULT NULL
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
    periodo_atual AS (
        SELECT
            tp.paid_amount,
            tp.status,
            (aff->>'amount')::NUMERIC / 100 AS comissao_aff
        FROM ticto_pedidos tp,
             LATERAL jsonb_array_elements(tp.affiliates) AS aff
             LEFT JOIN afiliados af ON af.affiliate_id = (aff->>'id')::INTEGER
        WHERE tp.affiliates IS NOT NULL
          AND tp.affiliates != '[]'::jsonb
          AND tp.order_date >= p_data_inicio
          AND tp.order_date <= p_data_fim
          AND (p_tipo IS NULL OR COALESCE(af.tipo, 'nao_classificado') = p_tipo)
    ),
    periodo_anterior AS (
        SELECT COALESCE(SUM(paid_amount), 0) AS fat_anterior
        FROM ticto_pedidos
        WHERE status = 'Aprovado'
          AND order_date >= p_data_inicio - (p_data_fim - p_data_inicio)
          AND order_date < p_data_inicio
    ),
    vendedoras AS (
        SELECT COUNT(DISTINCT (aff->>'id')) AS cnt
        FROM ticto_pedidos tp,
             LATERAL jsonb_array_elements(tp.affiliates) AS aff
             LEFT JOIN afiliados af ON af.affiliate_id = (aff->>'id')::INTEGER
        WHERE tp.affiliates IS NOT NULL
          AND tp.affiliates != '[]'::jsonb
          AND tp.order_date >= p_data_inicio
          AND tp.order_date <= p_data_fim
          AND (p_tipo IS NULL OR COALESCE(af.tipo, 'nao_classificado') = p_tipo)
    )
    SELECT
        v.cnt::INTEGER AS total_vendedoras,
        COUNT(*)::BIGINT AS total_vendas_pv,
        COUNT(*) FILTER (WHERE pa.status = 'Aprovado')::BIGINT AS total_vendas_aprovadas,
        COALESCE(SUM(pa.paid_amount) FILTER (WHERE pa.status = 'Aprovado'), 0) AS faturamento_pv,
        COALESCE(SUM(pa.paid_amount) FILTER (WHERE pa.status = 'Pendente'), 0) AS faturamento_pendente_pv,
        COALESCE(SUM(pa.comissao_aff) FILTER (WHERE pa.status = 'Aprovado'), 0) AS comissao_total,
        CASE
            WHEN COUNT(*) FILTER (WHERE pa.status = 'Aprovado') > 0
            THEN ROUND(
                COALESCE(SUM(pa.paid_amount) FILTER (WHERE pa.status = 'Aprovado'), 0)
                / COUNT(*) FILTER (WHERE pa.status = 'Aprovado'),
            2)
            ELSE 0
        END AS ticket_medio_geral,
        CASE
            WHEN COUNT(*) > 0
            THEN ROUND(COUNT(*) FILTER (WHERE pa.status = 'Aprovado')::NUMERIC / COUNT(*) * 100, 1)
            ELSE 0
        END AS taxa_conversao_geral,
        ROUND(pant.fat_anterior * 0.15, 2) AS meta_valor,
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

GRANT EXECUTE ON FUNCTION rpc_desempenho_vendedoras(TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rpc_metricas_pos_venda(TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

SELECT 'RPCs atualizadas com filtro por tipo!' AS resultado;
