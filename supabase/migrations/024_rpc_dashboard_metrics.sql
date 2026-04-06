-- ================================================================
-- RPC: DASHBOARD METRICS
-- Calcula todas as métricas do dashboard no servidor
-- Evita puxar 20.000+ registros para o frontend
-- ================================================================

CREATE OR REPLACE FUNCTION dashboard_metrics(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS JSON 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
    v_approved NUMERIC := 0;
    v_count_approved INTEGER := 0;
    v_pending NUMERIC := 0;
    v_count_pending INTEGER := 0;
    v_expired NUMERIC := 0;
    v_count_expired INTEGER := 0;
    v_refused NUMERIC := 0;
    v_count_refused INTEGER := 0;
    v_refunded NUMERIC := 0;
    v_count_refunded INTEGER := 0;
    v_pending_pix NUMERIC := 0;
    v_pending_other NUMERIC := 0;
    v_awaiting_shipment INTEGER := 0;
    v_late_subscriptions INTEGER := 0;
    v_abandoned_carts INTEGER := 0;
    rec RECORD;
    v_status TEXT;
    v_val NUMERIC;
    v_method TEXT;
BEGIN
    -- Processar vendas por status
    FOR rec IN
        SELECT 
            LOWER(TRIM(COALESCE(status, ''))) as status_norm,
            COALESCE(valor_total, 0)::NUMERIC as valor,
            LOWER(TRIM(COALESCE(
                forma_pagamento, 
                metodo_pagamento, 
                ''
            ))) as metodo
        FROM pedidos
        WHERE created_at >= p_start_date
          AND created_at <= p_end_date
    LOOP
        v_status := rec.status_norm;
        v_val := rec.valor;
        v_method := rec.metodo;

        IF v_status IN ('aprovado', 'pago', 'paid', 'approved', 'completed', 'succeeded', 'authorized') THEN
            v_approved := v_approved + v_val;
            v_count_approved := v_count_approved + 1;
        ELSIF v_status IN ('pendente', 'waiting payment', 'aguardando', 'pending', 'waiting_payment', 'processing') THEN
            v_pending := v_pending + v_val;
            v_count_pending := v_count_pending + 1;
            IF v_method LIKE '%pix%' THEN
                v_pending_pix := v_pending_pix + v_val;
            ELSE
                v_pending_other := v_pending_other + v_val;
            END IF;
        ELSIF v_status LIKE '%expirado%' OR v_status LIKE '%expired%' THEN
            v_expired := v_expired + v_val;
            v_count_expired := v_count_expired + 1;
        ELSIF v_status LIKE '%recusado%' OR v_status LIKE '%refused%' OR v_status LIKE '%denied%' OR v_status LIKE '%falha%' OR v_status LIKE '%failed%' THEN
            v_refused := v_refused + v_val;
            v_count_refused := v_count_refused + 1;
        ELSIF v_status LIKE '%reembolsado%' OR v_status LIKE '%refunded%' OR v_status LIKE '%estornado%' THEN
            v_refunded := v_refunded + v_val;
            v_count_refunded := v_count_refunded + 1;
        END IF;
    END LOOP;

    -- Aguardando envio
    SELECT COUNT(*) INTO v_awaiting_shipment
    FROM pedidos_consolidados_v3
    WHERE status_envio = 'Pendente'
      AND created_at >= p_start_date
      AND created_at <= p_end_date;

    -- Assinaturas atrasadas
    SELECT COUNT(*) INTO v_late_subscriptions
    FROM assinaturas
    WHERE (LOWER(status) LIKE '%atrasada%' OR LOWER(status) IN ('late'))
      AND created_at >= p_start_date
      AND created_at <= p_end_date;

    -- Carrinhos abandonados
    SELECT COUNT(*) INTO v_abandoned_carts
    FROM carrinhos_abandonados
    WHERE created_at >= p_start_date
      AND created_at <= p_end_date;

    -- Montar resultado JSON
    result := json_build_object(
        'faturamentoAprovado', ROUND(v_approved, 2),
        'countAprovado', v_count_approved,
        'faturamentoPendente', ROUND(v_pending, 2),
        'countPendente', v_count_pending,
        'faturamentoExpirado', ROUND(v_expired, 2),
        'countExpirado', v_count_expired,
        'faturamentoRecusado', ROUND(v_refused, 2),
        'countRecusado', v_count_refused,
        'faturamentoReembolsado', ROUND(v_refunded, 2),
        'countReembolsado', v_count_refunded,
        'detalhePendente', json_build_object(
            'pix', ROUND(v_pending_pix, 2),
            'boleto', ROUND(v_pending_other, 2)
        ),
        'aguardandoEnvio', v_awaiting_shipment,
        'assinaturasAtrasadas', v_late_subscriptions,
        'carrinhosHoje', v_abandoned_carts
    );

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION dashboard_metrics(TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated, service_role;

COMMENT ON FUNCTION dashboard_metrics(TIMESTAMPTZ, TIMESTAMPTZ) IS 
'Calcula todas as métricas do dashboard no lado do servidor.
Elimina a necessidade de puxar milhares de registros para o frontend.
Uso: SELECT dashboard_metrics(''2026-01-01''::timestamptz, ''2026-01-31''::timestamptz);';
