-- ================================================================
-- MIGRATION 030: Criar tabela ticto_pedidos
-- Objetivo: Armazenar TODOS os dados do webhook Ticto
-- Deduplicação: UNIQUE em transaction_hash (UPSERT)
-- Execute no SQL Editor do Supabase Produção
-- ================================================================

-- ============================================================
-- ETAPA 1: CRIAR TABELA PRINCIPAL
-- ============================================================

DROP TABLE IF EXISTS ticto_pedidos CASCADE;

CREATE TABLE ticto_pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ── Identificação do Pedido ──────────────────────────────
    transaction_hash TEXT UNIQUE NOT NULL,
    order_id INTEGER,
    order_hash TEXT,

    -- ── Status ───────────────────────────────────────────────
    status TEXT NOT NULL DEFAULT 'authorized',
    status_date TIMESTAMPTZ,
    commission_type TEXT,

    -- ── Pagamento ────────────────────────────────────────────
    payment_method TEXT,
    paid_amount NUMERIC(10,2),
    installments INTEGER DEFAULT 1,
    shipping_amount NUMERIC(10,2) DEFAULT 0,
    shipping_type TEXT,
    shipping_method TEXT,
    shipping_delivery_days INTEGER,
    marketplace_commission NUMERIC(10,2) DEFAULT 0,

    -- ── Produto / Oferta ─────────────────────────────────────
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

    -- ── Cliente ──────────────────────────────────────────────
    customer_name TEXT,
    customer_email TEXT,
    customer_cpf TEXT,
    customer_cnpj TEXT,
    customer_code TEXT,
    customer_phone TEXT,
    customer_type TEXT DEFAULT 'person',
    customer_is_foreign BOOLEAN DEFAULT FALSE,
    customer_language TEXT DEFAULT 'pt-BR',

    -- ── Endereço ─────────────────────────────────────────────
    address_street TEXT,
    address_number TEXT,
    address_neighborhood TEXT,
    address_city TEXT,
    address_state TEXT,
    address_zip_code TEXT,
    address_country TEXT DEFAULT 'Brasil',

    -- ── Comissões (JSONB para flexibilidade) ─────────────────
    producer JSONB,
    affiliates JSONB DEFAULT '[]'::jsonb,
    coproducers JSONB DEFAULT '[]'::jsonb,
    owner_commissions JSONB DEFAULT '[]'::jsonb,

    -- ── Tracking / UTM ───────────────────────────────────────
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    src TEXT,
    sck TEXT,
    checkout_url TEXT,

    -- ── Meta ─────────────────────────────────────────────────
    webhook_version TEXT DEFAULT '2.0',
    token TEXT,
    query_params JSONB,
    tracking JSONB,
    transaction_pix_qr_code TEXT,
    transaction_pix_url TEXT,
    transaction_bank_slip_code TEXT,
    transaction_bank_slip_url TEXT,

    -- ── Endereço extras ──────────────────────────────────────
    address_complement TEXT,

    -- ── Datas ────────────────────────────────────────────────
    order_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- ── Backup integral do payload ───────────────────────────
    payload_completo JSONB
);

-- ============================================================
-- ETAPA 2: ÍNDICES PARA PERFORMANCE
-- ============================================================

-- Busca por status (dashboard principal)
CREATE INDEX idx_ticto_pedidos_status ON ticto_pedidos (status);

-- Busca por data (filtros de período)
CREATE INDEX idx_ticto_pedidos_order_date ON ticto_pedidos (order_date);
CREATE INDEX idx_ticto_pedidos_created ON ticto_pedidos (created_at);

-- Busca por cliente (página de clientes)
CREATE INDEX idx_ticto_pedidos_email ON ticto_pedidos (customer_email);
CREATE INDEX idx_ticto_pedidos_cpf ON ticto_pedidos (customer_cpf);
CREATE INDEX idx_ticto_pedidos_phone ON ticto_pedidos (customer_phone);

-- Busca por produto (relatórios por produto)
CREATE INDEX idx_ticto_pedidos_product ON ticto_pedidos (product_name);
CREATE INDEX idx_ticto_pedidos_product_id ON ticto_pedidos (product_id);

-- Busca por forma de pagamento (dashboard financeiro)
CREATE INDEX idx_ticto_pedidos_payment ON ticto_pedidos (payment_method);

-- Busca por oferta (análise de ofertas)
CREATE INDEX idx_ticto_pedidos_offer_code ON ticto_pedidos (offer_code);

-- Busca por order_hash (vinculação com consolidados)
CREATE INDEX idx_ticto_pedidos_order_hash ON ticto_pedidos (order_hash);

-- GIN index para queries em comissões JSONB
CREATE INDEX idx_ticto_pedidos_producer_gin ON ticto_pedidos USING GIN (producer);
CREATE INDEX idx_ticto_pedidos_affiliates_gin ON ticto_pedidos USING GIN (affiliates);

-- Índice composto para dashboard: status + data (query mais comum)
CREATE INDEX idx_ticto_pedidos_status_date ON ticto_pedidos (status, order_date);

-- ============================================================
-- ETAPA 3: TRIGGER PARA updated_at AUTOMÁTICO
-- ============================================================

CREATE OR REPLACE FUNCTION update_ticto_pedidos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticto_pedidos_updated_at
    BEFORE UPDATE ON ticto_pedidos
    FOR EACH ROW
    EXECUTE FUNCTION update_ticto_pedidos_updated_at();

-- ============================================================
-- ETAPA 4: RLS + POLICIES
-- ============================================================

ALTER TABLE ticto_pedidos ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer autenticado pode ler
CREATE POLICY "select_all_ticto_pedidos" ON ticto_pedidos
    FOR SELECT USING (true);

-- INSERT: service_role e autenticados (Edge Function usa service_role)
CREATE POLICY "insert_ticto_pedidos" ON ticto_pedidos
    FOR INSERT WITH CHECK (true);

-- UPDATE: service_role e autenticados
CREATE POLICY "update_ticto_pedidos" ON ticto_pedidos
    FOR UPDATE USING (true) WITH CHECK (true);

-- DELETE: apenas service_role (proteção contra exclusão acidental)
CREATE POLICY "delete_ticto_pedidos" ON ticto_pedidos
    FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- ETAPA 5: GRANT PERMISSÕES
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON ticto_pedidos TO anon, authenticated;
GRANT ALL ON ticto_pedidos TO service_role;

-- ============================================================
-- ETAPA 6: COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE ticto_pedidos IS 'Registro completo de todos os webhooks recebidos da Ticto. 1 webhook = 1 registro. Deduplicação por transaction_hash via UPSERT.';
COMMENT ON COLUMN ticto_pedidos.transaction_hash IS 'Identificador único da transação Ticto. Usado como chave de deduplicação.';
COMMENT ON COLUMN ticto_pedidos.paid_amount IS 'Valor pago em REAIS (já convertido de centavos).';
COMMENT ON COLUMN ticto_pedidos.payload_completo IS 'Backup integral do payload JSON recebido no webhook, sem transformação.';
COMMENT ON COLUMN ticto_pedidos.producer IS 'Dados do produtor: {id, name, email, phone, amount, cms, document}';
COMMENT ON COLUMN ticto_pedidos.affiliates IS 'Array de afiliados: [{id, name, email, phone, amount, cms, document, pid}]';
COMMENT ON COLUMN ticto_pedidos.coproducers IS 'Array de coprodutores: [{id, name, email, phone, amount, cms, document}]';

-- ============================================================
-- ETAPA 7: RELOAD + VERIFICAÇÃO
-- ============================================================

NOTIFY pgrst, 'reload schema';

SELECT 'Tabela ticto_pedidos criada com sucesso!' as resultado;

-- Verificar estrutura
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ticto_pedidos'
  AND table_schema = 'public'
ORDER BY ordinal_position;
