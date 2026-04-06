-- ================================================================
-- PASSO 1: DROPAR TABELA EXISTENTE
-- ================================================================

DROP TABLE IF EXISTS pedidos_consolidados_v3 CASCADE;

-- Criar como TABLE normal (vazia por enquanto)
CREATE TABLE IF NOT EXISTS pedidos_consolidados_v3 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_transacao TEXT UNIQUE,
    status_aprovacao TEXT DEFAULT 'Aprovado',
    nome_produto TEXT,
    nome_oferta TEXT,  -- Vai conter "+ Order Bump + UPSELL" etc
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
    codigos_agrupados TEXT[],        -- Array de códigos agrupados
    quantidade_pedidos INTEGER DEFAULT 1,
    produto_principal TEXT,
    dia_despacho DATE,
    data_envio TIMESTAMPTZ,
    codigo_rastreio TEXT,
    status_envio TEXT,
    observacao TEXT,
    foi_editado BOOLEAN DEFAULT FALSE,
    customer JSONB,
    shipping JSONB,
    dados_entrega JSONB,
    endereco_json JSONB,
    updated_at TIMESTAMPTZ DEFAULT now(),
    -- Campos extras para rastreamento
    order_bumps TEXT[],              -- Nomes das ofertas OB
    upsells TEXT[],                  -- Nomes das ofertas US
    pos_vendas TEXT[],               -- Nomes das ofertas PV CC
    tem_dois_cartoes BOOLEAN DEFAULT FALSE,
    fraude_endereco BOOLEAN DEFAULT FALSE,
    codigos_filhos TEXT[]            -- Códigos de OB, US, PV vinculados
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_consolidados_email ON pedidos_consolidados_v3 (email);
CREATE INDEX IF NOT EXISTS idx_consolidados_cpf ON pedidos_consolidados_v3 (cpf);
CREATE INDEX IF NOT EXISTS idx_consolidados_data ON pedidos_consolidados_v3 (data_venda);
CREATE INDEX IF NOT EXISTS idx_consolidados_produto ON pedidos_consolidados_v3 (produto_principal);

-- RLS
ALTER TABLE pedidos_consolidados_v3 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura pública consolidados" ON pedidos_consolidados_v3;
CREATE POLICY "Leitura pública consolidados" ON pedidos_consolidados_v3
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Update autenticado consolidados" ON pedidos_consolidados_v3;
CREATE POLICY "Update autenticado consolidados" ON pedidos_consolidados_v3
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Confirmar
SELECT 'Tabela pedidos_consolidados_v3 criada (vazia)' as resultado;
