-- ================================================================
-- FIX RPC PARA PRODUÇÃO (cgyxinpejaoadsqrxbhy)
-- Corrige: column "metodo_pagamento" does not exist
-- Execute no SQL Editor do projeto PRODUÇÃO
-- ================================================================

-- A tabela pedidos na produção NÃO tem metodo_pagamento, só forma_pagamento
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
BEGIN
    FOR rec IN
        SELECT 
            LOWER(TRIM(COALESCE(status, ''))) as status_norm,
            COALESCE(valor_total, 0)::NUMERIC as valor,
            LOWER(TRIM(COALESCE(forma_pagamento, ''))) as metodo
        FROM pedidos
        WHERE data_venda >= p_start_date
          AND data_venda <= p_end_date
    LOOP
        IF rec.status_norm IN ('aprovado','pago','paid','approved','completed','succeeded','authorized') THEN
            v_approved := v_approved + rec.valor;
            v_count_approved := v_count_approved + 1;
        ELSIF rec.status_norm IN ('pendente','waiting payment','aguardando','pending','waiting_payment','processing') THEN
            v_pending := v_pending + rec.valor;
            v_count_pending := v_count_pending + 1;
            IF rec.metodo LIKE '%pix%' THEN v_pending_pix := v_pending_pix + rec.valor;
            ELSE v_pending_other := v_pending_other + rec.valor; END IF;
        ELSIF rec.status_norm LIKE '%expirado%' OR rec.status_norm LIKE '%expired%' THEN
            v_expired := v_expired + rec.valor;
            v_count_expired := v_count_expired + 1;
        ELSIF rec.status_norm LIKE '%recusado%' OR rec.status_norm LIKE '%refused%' OR rec.status_norm LIKE '%denied%' OR rec.status_norm LIKE '%falha%' OR rec.status_norm LIKE '%failed%' THEN
            v_refused := v_refused + rec.valor;
            v_count_refused := v_count_refused + 1;
        ELSIF rec.status_norm LIKE '%reembolsado%' OR rec.status_norm LIKE '%refunded%' OR rec.status_norm LIKE '%estornado%' THEN
            v_refunded := v_refunded + rec.valor;
            v_count_refunded := v_count_refunded + 1;
        END IF;
    END LOOP;

    -- Aguardando envio
    BEGIN
        SELECT COUNT(*) INTO v_awaiting_shipment
        FROM pedidos_consolidados_v3
        WHERE status_envio = 'Pendente'
          AND created_at >= p_start_date AND created_at <= p_end_date;
    EXCEPTION WHEN OTHERS THEN
        v_awaiting_shipment := 0;
    END;

    -- Assinaturas atrasadas (sem filtro de data - tabela pode não ter created_at)
    BEGIN
        SELECT COUNT(*) INTO v_late_subscriptions
        FROM assinaturas
        WHERE LOWER(status) LIKE '%atrasada%' OR LOWER(status) = 'late';
    EXCEPTION WHEN OTHERS THEN
        v_late_subscriptions := 0;
    END;

    -- Carrinhos abandonados (sem filtro de data)
    BEGIN
        SELECT COUNT(*) INTO v_abandoned_carts
        FROM carrinhos_abandonados;
    EXCEPTION WHEN OTHERS THEN
        v_abandoned_carts := 0;
    END;

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

-- Também garantir permissões nas tabelas secundárias
GRANT SELECT ON public.assinaturas TO anon, authenticated;
GRANT SELECT ON public.carrinhos_abandonados TO anon, authenticated;
GRANT SELECT ON public.pedidos_consolidados_v3 TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

SELECT 'RPC dashboard_metrics atualizada com sucesso!' as resultado;
