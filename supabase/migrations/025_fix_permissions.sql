-- ================================================================
-- FIX COMPLETO PARA BANCO DE DESENVOLVIMENTO
-- Cria tabelas que faltam + Permissões + RPC
-- Execute no SQL Editor do projeto vkeshyusimduiwjaijjv
-- ================================================================

-- ============================================================
-- ETAPA 1: CRIAR TABELAS QUE NÃO EXISTEM
-- ============================================================

-- pedidos_consolidados_v3
CREATE TABLE IF NOT EXISTS pedidos_consolidados_v3 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_transacao TEXT UNIQUE,
    status_aprovacao TEXT DEFAULT 'Aprovado',
    nome_produto TEXT,
    nome_oferta TEXT,
    valor_total NUMERIC(10,2),
    forma_pagamento TEXT,
    parcelas INTEGER,
    nome_cliente TEXT,
    email TEXT,
    cpf TEXT,
    telefone TEXT,
    cep TEXT,
    logradouro TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    endereco_completo TEXT,
    data_venda TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB,
    descricao_pacote TEXT,
    codigos_agrupados TEXT[],
    quantidade_pedidos INTEGER DEFAULT 1,
    produto_principal TEXT,
    dia_despacho DATE,
    data_envio TIMESTAMPTZ,
    codigo_rastreio TEXT,
    status_envio TEXT DEFAULT 'Pendente',
    observacao TEXT,
    foi_editado BOOLEAN DEFAULT FALSE,
    campos_alterados TEXT[],
    customer JSONB,
    shipping JSONB,
    dados_entrega JSONB,
    endereco_json JSONB,
    updated_at TIMESTAMPTZ DEFAULT now(),
    order_bumps TEXT[],
    upsells TEXT[],
    pos_vendas TEXT[],
    tem_dois_cartoes BOOLEAN DEFAULT FALSE,
    fraude_endereco BOOLEAN DEFAULT FALSE,
    codigos_filhos TEXT[],
    metodo_pagamento TEXT,
    tentativas_geracao INTEGER DEFAULT 0,
    erro_ia TEXT
);

CREATE INDEX IF NOT EXISTS idx_consolidados_email ON pedidos_consolidados_v3 (email);
CREATE INDEX IF NOT EXISTS idx_consolidados_cpf ON pedidos_consolidados_v3 (cpf);
CREATE INDEX IF NOT EXISTS idx_consolidados_data ON pedidos_consolidados_v3 (data_venda);
CREATE INDEX IF NOT EXISTS idx_consolidados_produto ON pedidos_consolidados_v3 (produto_principal);
CREATE INDEX IF NOT EXISTS idx_consolidados_status_envio ON pedidos_consolidados_v3 (status_envio);

-- estoque
CREATE TABLE IF NOT EXISTS estoque (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_produto TEXT NOT NULL,
    quantidade_atual INTEGER DEFAULT 0,
    limite_alerta INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- estoque_movimentacoes
CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID REFERENCES estoque(id),
    tipo TEXT NOT NULL,
    quantidade INTEGER NOT NULL,
    motivo TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- assinaturas
CREATE TABLE IF NOT EXISTS assinaturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'Ativa',
    plano TEXT,
    proxima_cobranca TIMESTAMPTZ
);

-- carrinhos_abandonados
CREATE TABLE IF NOT EXISTS carrinhos_abandonados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    nome_produto TEXT,
    telefone_cliente TEXT,
    link_checkout TEXT
);

-- pedidos_status_log
CREATE TABLE IF NOT EXISTS pedidos_status_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID,
    status_anterior TEXT,
    status_novo TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ETAPA 2: HABILITAR RLS + CRIAR POLÍTICAS
-- ============================================================

-- pedidos_consolidados_v3
ALTER TABLE pedidos_consolidados_v3 ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "allow_select_all" ON public.pedidos_consolidados_v3;
    DROP POLICY IF EXISTS "allow_insert_auth" ON public.pedidos_consolidados_v3;
    DROP POLICY IF EXISTS "allow_update_auth" ON public.pedidos_consolidados_v3;
    DROP POLICY IF EXISTS "allow_delete_auth" ON public.pedidos_consolidados_v3;
    DROP POLICY IF EXISTS "allow_insert_anon" ON public.pedidos_consolidados_v3;
    DROP POLICY IF EXISTS "allow_update_anon" ON public.pedidos_consolidados_v3;
    DROP POLICY IF EXISTS "Leitura pública consolidados" ON public.pedidos_consolidados_v3;
    DROP POLICY IF EXISTS "Update autenticado consolidados" ON public.pedidos_consolidados_v3;
END $$;

CREATE POLICY "allow_select_all" ON public.pedidos_consolidados_v3 FOR SELECT USING (true);
CREATE POLICY "allow_insert_auth" ON public.pedidos_consolidados_v3 FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_update_auth" ON public.pedidos_consolidados_v3 FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_delete_auth" ON public.pedidos_consolidados_v3 FOR DELETE TO authenticated USING (true);
CREATE POLICY "allow_insert_anon" ON public.pedidos_consolidados_v3 FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "allow_update_anon" ON public.pedidos_consolidados_v3 FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- estoque
ALTER TABLE estoque ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "allow_select_all" ON public.estoque;
    DROP POLICY IF EXISTS "allow_all_auth" ON public.estoque;
    DROP POLICY IF EXISTS "allow_all_anon" ON public.estoque;
END $$;
CREATE POLICY "allow_select_all" ON public.estoque FOR SELECT USING (true);
CREATE POLICY "allow_all_auth" ON public.estoque FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON public.estoque FOR ALL TO anon USING (true) WITH CHECK (true);

-- assinaturas
ALTER TABLE assinaturas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "allow_select_all" ON public.assinaturas;
END $$;
CREATE POLICY "allow_select_all" ON public.assinaturas FOR SELECT USING (true);

-- carrinhos_abandonados
ALTER TABLE carrinhos_abandonados ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "allow_select_all" ON public.carrinhos_abandonados;
END $$;
CREATE POLICY "allow_select_all" ON public.carrinhos_abandonados FOR SELECT USING (true);

-- ============================================================
-- ETAPA 3: GRANT PERMISSÕES
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_consolidados_v3 TO anon, authenticated;
GRANT ALL ON public.pedidos_consolidados_v3 TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO anon, authenticated;
GRANT ALL ON public.pedidos TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_unificados TO anon, authenticated;
GRANT ALL ON public.pedidos_unificados TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_agrupados TO anon, authenticated;
GRANT ALL ON public.pedidos_agrupados TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque TO anon, authenticated;
GRANT ALL ON public.estoque TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_movimentacoes TO anon, authenticated;
GRANT ALL ON public.estoque_movimentacoes TO service_role;

GRANT SELECT ON public.assinaturas TO anon, authenticated;
GRANT ALL ON public.assinaturas TO service_role;

GRANT SELECT ON public.carrinhos_abandonados TO anon, authenticated;
GRANT ALL ON public.carrinhos_abandonados TO service_role;

GRANT SELECT, INSERT ON public.pedidos_status_log TO anon, authenticated;
GRANT ALL ON public.pedidos_status_log TO service_role;

-- ============================================================
-- ETAPA 4: CRIAR FUNÇÃO RPC dashboard_metrics
-- ============================================================
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
    v_has_data_venda BOOLEAN := FALSE;
BEGIN
    -- Detectar se a coluna data_venda existe na tabela pedidos
    SELECT EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'pedidos' 
          AND column_name = 'data_venda'
    ) INTO v_has_data_venda;

    -- Query principal
    IF v_has_data_venda THEN
        FOR rec IN
            SELECT 
                LOWER(TRIM(COALESCE(status, ''))) as status_norm,
                COALESCE(valor_total, 0)::NUMERIC as valor,
                LOWER(TRIM(COALESCE(forma_pagamento, metodo_pagamento, ''))) as metodo
            FROM pedidos
            WHERE data_venda >= p_start_date AND data_venda <= p_end_date
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
    ELSE
        FOR rec IN
            SELECT 
                LOWER(TRIM(COALESCE(status, ''))) as status_norm,
                COALESCE(valor_total, 0)::NUMERIC as valor,
                LOWER(TRIM(COALESCE(forma_pagamento, metodo_pagamento, ''))) as metodo
            FROM pedidos
            WHERE created_at >= p_start_date AND created_at <= p_end_date
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
    END IF;

    -- Aguardando envio
    BEGIN
        SELECT COUNT(*) INTO v_awaiting_shipment
        FROM pedidos_consolidados_v3
        WHERE status_envio = 'Pendente'
          AND created_at >= p_start_date AND created_at <= p_end_date;
    EXCEPTION WHEN OTHERS THEN
        v_awaiting_shipment := 0;
    END;

    -- Assinaturas atrasadas
    BEGIN
        SELECT COUNT(*) INTO v_late_subscriptions
        FROM assinaturas
        WHERE LOWER(status) LIKE '%atrasada%' OR LOWER(status) = 'late';
    EXCEPTION WHEN OTHERS THEN
        v_late_subscriptions := 0;
    END;

    -- Carrinhos abandonados
    BEGIN
        SELECT COUNT(*) INTO v_abandoned_carts
        FROM carrinhos_abandonados
        WHERE created_at >= p_start_date AND created_at <= p_end_date;
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

-- ============================================================
-- ETAPA 5: RELOAD SCHEMA CACHE
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- ETAPA 6: VERIFICAÇÃO
-- ============================================================
SELECT 'SUCESSO - Tudo criado e configurado!' as resultado;

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('pedidos', 'pedidos_consolidados_v3', 'estoque', 'pedidos_unificados', 'assinaturas', 'carrinhos_abandonados')
ORDER BY table_name;

SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'dashboard_metrics';
