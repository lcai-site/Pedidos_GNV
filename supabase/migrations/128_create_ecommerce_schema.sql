-- ================================================================
-- Migração: 128_create_ecommerce_schema
-- Objetivo: Criar tabelas para o módulo E-commerce
-- Permissão necessária para executar: service_role ou superuser
-- ================================================================

-- 1. Categorias
CREATE TABLE IF NOT EXISTS ecommerce_categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    slug TEXT UNIQUE NOT NULL,
    parent_id UUID REFERENCES ecommerce_categorias(id) ON DELETE SET NULL,
    posicao INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Coleções
CREATE TABLE IF NOT EXISTS ecommerce_colecoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    tipo TEXT NOT NULL CHECK (tipo IN ('manual', 'automatica')),
    imagem_url TEXT,
    publicada BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Produtos
CREATE TABLE IF NOT EXISTS ecommerce_produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    sku TEXT UNIQUE NOT NULL,
    preco NUMERIC(10, 2) NOT NULL,
    preco_comparacao NUMERIC(10, 2),
    estoque INTEGER DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('ativo', 'rascunho', 'arquivado')),
    categoria_id UUID REFERENCES ecommerce_categorias(id) ON DELETE SET NULL,
    imagem_url TEXT,
    peso_gramas NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela associativa Produtos <-> Colecoes
CREATE TABLE IF NOT EXISTS ecommerce_produto_colecao (
    produto_id UUID REFERENCES ecommerce_produtos(id) ON DELETE CASCADE,
    colecao_id UUID REFERENCES ecommerce_colecoes(id) ON DELETE CASCADE,
    PRIMARY KEY (produto_id, colecao_id)
);

-- 4. Ofertas (Descontos nativos do produto ou campanhas)
CREATE TABLE IF NOT EXISTS ecommerce_ofertas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    tipo_desconto TEXT NOT NULL CHECK (tipo_desconto IN ('percentual', 'valor_fixo', 'frete_gratis')),
    valor_desconto NUMERIC(10, 2) NOT NULL,
    data_inicio TIMESTAMP WITH TIME ZONE,
    data_fim TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL CHECK (status IN ('ativa', 'agendada', 'expirada', 'rascunho')),
    usos INTEGER DEFAULT 0,
    limite_usos INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela associativa Ofertas <-> Produtos aplicáveis
CREATE TABLE IF NOT EXISTS ecommerce_oferta_produto (
    oferta_id UUID REFERENCES ecommerce_ofertas(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES ecommerce_produtos(id) ON DELETE CASCADE,
    PRIMARY KEY (oferta_id, produto_id)
);

-- 5. Clientes
CREATE TABLE IF NOT EXISTS ecommerce_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telefone TEXT,
    total_gasto NUMERIC(10, 2) DEFAULT 0,
    ultimo_pedido_em TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Cupons
CREATE TABLE IF NOT EXISTS ecommerce_cupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('percentual', 'valor_fixo', 'frete_gratis')),
    valor NUMERIC(10, 2) NOT NULL,
    uso_atual INTEGER DEFAULT 0,
    limite_uso INTEGER,
    valor_minimo_pedido NUMERIC(10, 2),
    validade TIMESTAMP WITH TIME ZONE,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Pedidos (Transactions E-commerce)
CREATE TABLE IF NOT EXISTS ecommerce_pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero TEXT UNIQUE NOT NULL,
    cliente_id UUID REFERENCES ecommerce_clientes(id) ON DELETE SET NULL,
    valor_total NUMERIC(10, 2) NOT NULL,
    valor_desconto NUMERIC(10, 2) DEFAULT 0,
    valor_frete NUMERIC(10, 2) DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('pendente', 'confirmado', 'processando', 'enviado', 'entregue', 'cancelado', 'reembolsado')),
    metodo_pagamento TEXT,
    codigo_rastreio TEXT,
    cupom_id UUID REFERENCES ecommerce_cupons(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ecommerce_pedido_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID REFERENCES ecommerce_pedidos(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES ecommerce_produtos(id) ON DELETE RESTRICT,
    quantidade INTEGER NOT NULL,
    preco_unitario NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Carrinhos (Recuperação de Vendas)
CREATE TABLE IF NOT EXISTS ecommerce_carrinhos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_nome TEXT,
    cliente_email TEXT,
    valor_total NUMERIC(10, 2) DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('abandonado', 'recuperado', 'convertido')),
    abandonado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recuperado_em TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Configurações da Loja
CREATE TABLE IF NOT EXISTS ecommerce_configuracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_loja TEXT NOT NULL DEFAULT 'Minha Loja GNV',
    moeda TEXT DEFAULT 'BRL',
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    email_contato TEXT,
    telefone_contato TEXT,
    gateway_pagamento TEXT DEFAULT 'mercadopago',
    ambiente_pagamento TEXT DEFAULT 'sandbox',
    correios_habilitado BOOLEAN DEFAULT true,
    cep_origem TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Garante que exista apenas uma linha de configuração
CREATE UNIQUE INDEX ecommerce_configuracoes_single_row ON ecommerce_configuracoes((true));

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

ALTER TABLE ecommerce_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_colecoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_produto_colecao ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_ofertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_oferta_produto ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_carrinhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_configuracoes ENABLE ROW LEVEL SECURITY;

-- Políticas de SELECT (Todos os usuários autenticados podem ler para visualizar o dashboard)
CREATE POLICY ecommerce_categorias_select ON ecommerce_categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY ecommerce_colecoes_select ON ecommerce_colecoes FOR SELECT TO authenticated USING (true);
CREATE POLICY ecommerce_produtos_select ON ecommerce_produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY ecommerce_produto_colecao_select ON ecommerce_produto_colecao FOR SELECT TO authenticated USING (true);
CREATE POLICY ecommerce_ofertas_select ON ecommerce_ofertas FOR SELECT TO authenticated USING (true);
CREATE POLICY ecommerce_oferta_produto_select ON ecommerce_oferta_produto FOR SELECT TO authenticated USING (true);
CREATE POLICY ecommerce_clientes_select ON ecommerce_clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY ecommerce_cupons_select ON ecommerce_cupons FOR SELECT TO authenticated USING (true);
CREATE POLICY ecommerce_pedidos_select ON ecommerce_pedidos FOR SELECT TO authenticated USING (true);
CREATE POLICY ecommerce_pedido_itens_select ON ecommerce_pedido_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY ecommerce_carrinhos_select ON ecommerce_carrinhos FOR SELECT TO authenticated USING (true);
CREATE POLICY ecommerce_configuracoes_select ON ecommerce_configuracoes FOR SELECT TO authenticated USING (true);

-- Políticas de INSERT, UPDATE e DELETE (Todos autenticados podem alterar - o RBAC bloqueia a UI para não permitidos)
-- Se desejar bloquear em nivel de DB, trocar (true) por funcoes que checam permissao customizada.
CREATE POLICY ecommerce_categorias_all ON ecommerce_categorias FOR ALL TO authenticated USING (true);
CREATE POLICY ecommerce_colecoes_all ON ecommerce_colecoes FOR ALL TO authenticated USING (true);
CREATE POLICY ecommerce_produtos_all ON ecommerce_produtos FOR ALL TO authenticated USING (true);
CREATE POLICY ecommerce_produto_colecao_all ON ecommerce_produto_colecao FOR ALL TO authenticated USING (true);
CREATE POLICY ecommerce_ofertas_all ON ecommerce_ofertas FOR ALL TO authenticated USING (true);
CREATE POLICY ecommerce_oferta_produto_all ON ecommerce_oferta_produto FOR ALL TO authenticated USING (true);
CREATE POLICY ecommerce_clientes_all ON ecommerce_clientes FOR ALL TO authenticated USING (true);
CREATE POLICY ecommerce_cupons_all ON ecommerce_cupons FOR ALL TO authenticated USING (true);
CREATE POLICY ecommerce_pedidos_all ON ecommerce_pedidos FOR ALL TO authenticated USING (true);
CREATE POLICY ecommerce_pedido_itens_all ON ecommerce_pedido_itens FOR ALL TO authenticated USING (true);
CREATE POLICY ecommerce_carrinhos_all ON ecommerce_carrinhos FOR ALL TO authenticated USING (true);
CREATE POLICY ecommerce_configuracoes_all ON ecommerce_configuracoes FOR ALL TO authenticated USING (true);
