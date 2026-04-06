-- ================================================================
-- MIGRATION 047: Adicionar data de contato na Recuperação
-- Objetivo: Registrar quando o cliente recebeu mensagem de recuperação
-- ================================================================

-- 1. Adicionar coluna de data de contato (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticto_pedidos' AND column_name='data_contato_recuperacao') THEN
        ALTER TABLE ticto_pedidos ADD COLUMN data_contato_recuperacao TIMESTAMPTZ;
    END IF;
END $$;

-- 2. Recriar a View para incluir a nova coluna
DROP VIEW IF EXISTS view_recuperacao;

CREATE VIEW view_recuperacao AS
SELECT 
    p.id,
    p.transaction_hash,
    p.order_date,
    p.status,
    p.payment_method,
    p.paid_amount,
    
    -- Controle de CRM
    COALESCE(p.contatado_recuperacao, false) as contatado,
    p.data_contato_recuperacao,
    
    -- Dados do Cliente
    p.customer_name,
    p.customer_email,
    p.customer_phone,
    p.customer_cpf,
    
    -- Dados do Produto
    p.product_name,
    p.offer_name,
    
    -- Links de Pagamento (Recuperação)
    COALESCE(p.transaction_pix_url, p.transaction_bank_slip_url, p.checkout_url) as link_pagamento,
    p.transaction_pix_qr_code,
    p.transaction_bank_slip_code,
    
    -- Metadata
    p.utm_source,
    p.utm_campaign,
    
    -- Status visual (Normalizado)
    CASE 
        WHEN p.status IN ('cart_abandoned', 'abandoned') THEN 'Carrinho Abandonado'
        WHEN p.status IN ('waiting_payment', 'pending') THEN 'Pendente'
        WHEN p.status IN ('refused', 'denied', 'failed') THEN 'Recusado'
        WHEN p.status IN ('canceled', 'cancelled') THEN 'Cancelado'
        WHEN p.status IN ('expired') THEN 'Expirado'
        WHEN p.status IN ('chargeback') THEN 'Chargeback'
        ELSE p.status
    END as status_label,
    
    -- Prioridade (Para ordenação de oportunidades)
    CASE 
        WHEN p.status IN ('cart_abandoned', 'abandoned') THEN 0    -- Crítico (Abandono Real)
        WHEN p.status IN ('waiting_payment', 'pending') THEN 1     -- Alta (Boleto/Pix gerado)
        WHEN p.status IN ('refused', 'denied', 'failed') THEN 2    -- Média (Cartão negado)
        WHEN p.status IN ('canceled', 'cancelled') THEN 3          -- Baixa
        ELSE 4
    END as prioridade

FROM ticto_pedidos p
WHERE 
    p.status NOT IN ('authorized', 'approved', 'paid', 'completed', 'refunded', 'Pre-Order')
    -- Filtrar apenas pedidos recentes (últimos 30 dias) para manter a lista acionável
    AND p.order_date >= (NOW() - INTERVAL '30 days');

-- Comentários
COMMENT ON VIEW view_recuperacao IS 'Lista consolidada de oportunidades de recuperação com tracking de contato e data';
COMMENT ON COLUMN ticto_pedidos.data_contato_recuperacao IS 'Data/hora em que o cliente foi contato via CRM/WhatsApp na tela de Recuperação';

-- Permissões
GRANT SELECT ON view_recuperacao TO authenticated;
GRANT SELECT ON view_recuperacao TO service_role;
