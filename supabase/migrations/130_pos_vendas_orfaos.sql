-- =================================================================================
-- MIGRATION 130: Notification for Orphan Post-Sales (Upsells/PVs without parents)
-- =================================================================================
-- Author: Antigravity AI
-- Description:
-- Identifies post-sales/upsells that were purchased via a direct link 
-- and therefore did not get naturally attached to a parent order (via CPF/email).
-- This returns a list of orphan post-sales so the frontend can notify the user.
-- =================================================================================

CREATE OR REPLACE FUNCTION get_pos_vendas_orfaos(p_dias INTEGER DEFAULT 30)
RETURNS TABLE (
    id UUID,                  -- ticto_pedido ID
    codigo_transacao TEXT,    -- transaction_hash
    nome_cliente TEXT,
    email TEXT,
    telefone TEXT,
    cpf TEXT,
    nome_oferta TEXT,
    produto TEXT,
    data_venda TIMESTAMPTZ,
    status_consolidacao TEXT  -- 'ignorado', 'consolidado_como_pai', ou 'ok'
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id, 
        p.transaction_hash as codigo_transacao,
        p.customer_name as nome_cliente,
        p.customer_email as email,
        p.customer_phone as telefone,
        p.customer_cpf as cpf,
        p.offer_name as nome_oferta,
        p.product_name as produto,
        (COALESCE(p.status_date, p.order_date)) as data_venda,
        -- Status para ajudar na UI:
        CASE 
          WHEN EXISTS (SELECT 1 FROM pedidos_consolidados_v3 c WHERE c.codigo_transacao = p.transaction_hash OR c.id = p.id) 
          THEN 'consolidado_como_pai'
          ELSE 'ignorado'
        END as status_consolidacao
    FROM ticto_pedidos p
    WHERE p.status IN ('authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago')
      AND p.status NOT IN ('Unificado', 'Cancelado', 'Reembolsado', 'Chargeback')
      AND (COALESCE(p.status_date, p.order_date)) >= (NOW() - (p_dias || ' days')::INTERVAL)
      
      -- Produto ou Oferta indica ser um Pós-venda
      AND (p.offer_name ~* '\y(ORDEM\s*BUMP|ORDER\s*BUMP|UPSELL|CC|P[OÓ]S[- ]?VENDA)\y' 
           OR p.product_name ~* '\y(ORDEM\s*BUMP|ORDER\s*BUMP|UPSELL|CC|P[OÓ]S[- ]?VENDA)\y'
           OR p.offer_name ~* '\yPV\y' 
           OR p.product_name ~* '\yPV\y')
           
      -- NÃO deve estar consolidado como PAI
      AND NOT EXISTS (SELECT 1 FROM pedidos_consolidados_v3 c WHERE c.codigo_transacao = p.transaction_hash OR c.id = p.id)
      
      -- NÃO deve estar atrelado como FILHO ou AGRUPADO em nenhum pedido consolidado
      AND NOT EXISTS (
          SELECT 1 FROM pedidos_consolidados_v3 c
          WHERE (p.codigo_unico = ANY(c.codigos_filhos) OR p.transaction_hash = ANY(c.codigos_filhos))
             OR (p.codigo_unico = ANY(c.codigos_agrupados) OR p.transaction_hash = ANY(c.codigos_agrupados))
             OR (p.order_id IS NOT NULL AND (p.order_id = c.codigo_transacao OR p.order_id = ANY(c.codigos_agrupados)))
      )
      
      -- Garantir que não está filtrando coisas do futuro/erros
      AND p.order_date IS NOT NULL
    ORDER BY p.order_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_pos_vendas_orfaos(INTEGER) TO anon, authenticated, service_role;
