-- ================================================================
-- ATUALIZAR MATERIALIZED VIEW pedidos_consolidados_v3
-- ================================================================

-- Para MATERIALIZED VIEW, use REFRESH:
REFRESH MATERIALIZED VIEW pedidos_consolidados_v3;

-- Verificar contagem após refresh
SELECT 
    (SELECT COUNT(*) FROM pedidos) as total_pedidos,
    (SELECT COUNT(*) FROM pedidos WHERE status IN ('Aprovado', 'Autorizado')) as pedidos_pagos,
    (SELECT COUNT(*) FROM pedidos_consolidados_v3) as consolidados_v3;
