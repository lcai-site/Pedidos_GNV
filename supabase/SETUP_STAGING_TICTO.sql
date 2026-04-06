-- ================================================================
-- SETUP STAGING: Criar estrutura das novas tabelas Ticto
-- Execute este SQL no SQL Editor do Supabase STAGING
-- (vkeshyusimduiwjaijjv.supabase.co)
-- 
-- Pré-requisito: As migrações 030, 031, 032, 033 já rodaram
-- na Produção. Este script replica a ESTRUTURA no Staging.
-- Os DADOS virão via sync-to-staging.mjs
-- ================================================================

-- ============================================================
-- 1. TABELA: ticto_pedidos (Migration 030)
-- ============================================================

CREATE TABLE IF NOT EXISTS ticto_pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_hash TEXT UNIQUE NOT NULL,
    order_id INTEGER,
    order_hash TEXT,
    status TEXT NOT NULL DEFAULT 'authorized',
    status_date TIMESTAMPTZ,
    commission_type TEXT,
    payment_method TEXT,
    paid_amount NUMERIC(10,2),
    installments INTEGER DEFAULT 1,
    shipping_amount NUMERIC(10,2) DEFAULT 0,
    shipping_type TEXT,
    shipping_method TEXT,
    shipping_delivery_days INTEGER,
    marketplace_commission NUMERIC(10,2) DEFAULT 0,
    product_name TEXT,
    product_id INTEGER,
    offer_name TEXT,
    offer_id INTEGER,
    offer_code TEXT,
    offer_price NUMERIC(10,2),
    is_subscription BOOLEAN DEFAULT FALSE,
    offer_interval TEXT,
    offer_trial_days INTEGER,
    offer_first_charge_price NUMERIC(10,2),
    item_quantity INTEGER DEFAULT 1,
    item_amount NUMERIC(10,2),
    coupon_id TEXT,
    coupon_name TEXT,
    coupon_value TEXT,
    refund_deadline INTEGER,
    customer_name TEXT,
    customer_email TEXT,
    customer_cpf TEXT,
    customer_cnpj TEXT,
    customer_code TEXT,
    customer_phone TEXT,
    customer_type TEXT DEFAULT 'person',
    customer_is_foreign BOOLEAN DEFAULT FALSE,
    customer_language TEXT DEFAULT 'pt-BR',
    address_street TEXT,
    address_number TEXT,
    address_neighborhood TEXT,
    address_city TEXT,
    address_state TEXT,
    address_zip_code TEXT,
    address_country TEXT DEFAULT 'Brasil',
    producer JSONB,
    affiliates JSONB DEFAULT '[]'::jsonb,
    coproducers JSONB DEFAULT '[]'::jsonb,
    owner_commissions JSONB DEFAULT '[]'::jsonb,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    src TEXT,
    sck TEXT,
    checkout_url TEXT,
    webhook_version TEXT DEFAULT '2.0',
    token TEXT,
    query_params JSONB,
    tracking JSONB,
    transaction_pix_qr_code TEXT,
    transaction_pix_url TEXT,
    transaction_bank_slip_code TEXT,
    transaction_bank_slip_url TEXT,
    address_complement TEXT,
    order_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    payload_completo JSONB
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ticto_pedidos_status ON ticto_pedidos (status);
CREATE INDEX IF NOT EXISTS idx_ticto_pedidos_order_date ON ticto_pedidos (order_date);
CREATE INDEX IF NOT EXISTS idx_ticto_pedidos_email ON ticto_pedidos (customer_email);
CREATE INDEX IF NOT EXISTS idx_ticto_pedidos_status_date ON ticto_pedidos (status, order_date);

-- RLS
ALTER TABLE ticto_pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_all_ticto_pedidos" ON ticto_pedidos;
CREATE POLICY "select_all_ticto_pedidos" ON ticto_pedidos FOR SELECT USING (true);
DROP POLICY IF EXISTS "insert_ticto_pedidos" ON ticto_pedidos;
CREATE POLICY "insert_ticto_pedidos" ON ticto_pedidos FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "update_ticto_pedidos" ON ticto_pedidos;
CREATE POLICY "update_ticto_pedidos" ON ticto_pedidos FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_ticto_pedidos" ON ticto_pedidos;
CREATE POLICY "delete_ticto_pedidos" ON ticto_pedidos FOR DELETE USING (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE ON ticto_pedidos TO anon, authenticated;
GRANT ALL ON ticto_pedidos TO service_role;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_ticto_pedidos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticto_pedidos_updated_at ON ticto_pedidos;
CREATE TRIGGER trg_ticto_pedidos_updated_at
    BEFORE UPDATE ON ticto_pedidos
    FOR EACH ROW
    EXECUTE FUNCTION update_ticto_pedidos_updated_at();

-- ============================================================
-- 2. TABELA: ticto_logs (se não existir)
-- ============================================================

CREATE TABLE IF NOT EXISTS ticto_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento TEXT,
    tipo TEXT,
    payload JSONB,
    resposta JSONB,
    status_code INTEGER,
    sucesso BOOLEAN DEFAULT true,
    erro TEXT,
    erro_processamento TEXT,
    duracao_ms INTEGER,
    codigo_rastreio TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ticto_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_all_ticto_logs" ON ticto_logs;
CREATE POLICY "select_all_ticto_logs" ON ticto_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "insert_ticto_logs" ON ticto_logs;
CREATE POLICY "insert_ticto_logs" ON ticto_logs FOR INSERT WITH CHECK (true);

GRANT SELECT, INSERT ON ticto_logs TO anon, authenticated;
GRANT ALL ON ticto_logs TO service_role;

-- ============================================================
-- 3. TABELA: feriados (Migration 032)
-- ============================================================

CREATE TABLE IF NOT EXISTS feriados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL UNIQUE,
    descricao TEXT,
    tipo TEXT DEFAULT 'municipal',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feriados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_all_feriados" ON feriados;
CREATE POLICY "select_all_feriados" ON feriados FOR SELECT USING (true);
GRANT SELECT ON feriados TO anon, authenticated;
GRANT ALL ON feriados TO service_role;

-- ============================================================
-- 4. VIEW: view_recuperacao (Migration 033)
-- ============================================================

DROP VIEW IF EXISTS view_recuperacao;

CREATE VIEW view_recuperacao AS
SELECT 
    p.id, p.transaction_hash, p.order_date, p.status,
    p.payment_method, p.paid_amount,
    p.customer_name, p.customer_email, p.customer_phone, p.customer_cpf,
    p.product_name, p.offer_name,
    COALESCE(p.transaction_pix_url, p.transaction_bank_slip_url, p.checkout_url) as link_pagamento,
    p.transaction_pix_qr_code, p.transaction_bank_slip_code,
    p.utm_source, p.utm_campaign,
    CASE 
        WHEN p.status IN ('cart_abandoned', 'abandoned') THEN 'Carrinho Abandonado'
        WHEN p.status IN ('waiting_payment', 'pending') THEN 'Pendente'
        WHEN p.status IN ('refused', 'denied', 'failed') THEN 'Recusado'
        WHEN p.status IN ('canceled', 'cancelled') THEN 'Cancelado'
        WHEN p.status IN ('expired') THEN 'Expirado'
        WHEN p.status IN ('chargeback') THEN 'Chargeback'
        ELSE p.status
    END as status_label,
    CASE 
        WHEN p.status IN ('cart_abandoned', 'abandoned') THEN 0
        WHEN p.status IN ('waiting_payment', 'pending') THEN 1
        WHEN p.status IN ('refused', 'denied', 'failed') THEN 2
        WHEN p.status IN ('canceled', 'cancelled') THEN 3
        ELSE 4
    END as prioridade
FROM ticto_pedidos p
WHERE 
    p.status NOT IN ('authorized', 'approved', 'paid', 'completed', 'refunded', 'Pre-Order')
    AND p.order_date >= (NOW() - INTERVAL '30 days');

GRANT SELECT ON view_recuperacao TO authenticated;
GRANT SELECT ON view_recuperacao TO service_role;

-- ============================================================
-- 5. VERIFICAÇÃO
-- ============================================================

SELECT 'Setup Staging Ticto concluído!' as resultado;

SELECT 
    'ticto_pedidos' as objeto, COUNT(*) as registros FROM ticto_pedidos
UNION ALL
SELECT 'ticto_logs', COUNT(*) FROM ticto_logs
UNION ALL
SELECT 'feriados', COUNT(*) FROM feriados;
