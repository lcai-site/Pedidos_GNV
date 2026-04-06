-- ================================================================
-- ATUALIZAR VIEW PARA ACEITAR MÚLTIPLOS STATUS
-- Problema: VIEW filtra apenas 'Aprovado', mas CSV tem 'Autorizado'
-- Solução: Alterar VIEW para aceitar ambos
-- ================================================================

-- Verificar status atuais
SELECT status, COUNT(*) as quantidade
FROM pedidos
GROUP BY status
ORDER BY quantidade DESC;

-- Atualizar a condição WHERE na VIEW (em todos os lugares que filtra por status)
-- Trocar: WHERE p.status = 'Aprovado'
-- Por:    WHERE p.status IN ('Aprovado', 'Autorizado')

-- ================================================================
-- INSTRUÇÕES MANUAIS:
-- 1. Abra a VIEW pedidos_consolidados_v3 no Supabase (Database > Views)
-- 2. Edite e substitua TODAS as ocorrências de:
--    status = 'Aprovado' 
-- Por:
--    status IN ('Aprovado', 'Autorizado')
--
-- OU execute o SQL abaixo que recria a VIEW com a correção
-- ================================================================

-- ALTERNATIVA: Padronizar os status (mais limpo a longo prazo)
-- Descomente se preferir:

/*
UPDATE pedidos
SET status = 'Aprovado', updated_at = now()
WHERE status = 'Autorizado';
*/

-- Verificar contagem final
SELECT 
    (SELECT COUNT(*) FROM pedidos) as total_pedidos,
    (SELECT COUNT(*) FROM pedidos WHERE status IN ('Aprovado', 'Autorizado')) as pedidos_pagos,
    (SELECT COUNT(*) FROM pedidos_consolidados_v3) as consolidados_v3;
