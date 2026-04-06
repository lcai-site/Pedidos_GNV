-- ================================================================
-- Migração: 129_ecommerce_afiliados
-- Objetivo: Sistema Avançado de Afiliados e Gerentes E-commerce
-- Permissão necessária para executar: service_role ou superuser
-- ================================================================

CREATE TABLE IF NOT EXISTS ecommerce_afiliados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT UNIQUE,
    telefone TEXT,
    tipo TEXT NOT NULL CHECK (tipo IN ('gerente', 'afiliado')),
    gerente_id UUID REFERENCES ecommerce_afiliados(id) ON DELETE SET NULL,
    codigo_rastreio TEXT UNIQUE NOT NULL,
    taxa_comissao NUMERIC(5, 2) DEFAULT 0 CHECK (taxa_comissao >= 0 AND taxa_comissao <= 100),
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'pendente')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index para o código de rastreio para buscas rápidas (via links UTM)
CREATE INDEX IF NOT EXISTS idx_ecommerce_afiliados_codigo ON ecommerce_afiliados(codigo_rastreio);
-- Index de hierarquia
CREATE INDEX IF NOT EXISTS idx_ecommerce_afiliados_gerente ON ecommerce_afiliados(gerente_id);

-- Alterando tabela de pedidos nativa (já criada no schema ecommerce)
ALTER TABLE ecommerce_pedidos
ADD COLUMN IF NOT EXISTS afiliado_id UUID REFERENCES ecommerce_afiliados(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS gerente_id UUID REFERENCES ecommerce_afiliados(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS comissao_afiliado NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS comissao_gerente NUMERIC(10, 2) DEFAULT 0;

-- ================================================================
-- View Materializada Virtual para Performance
-- Calcula KPIs (Vendas Totais, Quantidade e Comissões) por afiliado
-- ================================================================
CREATE OR REPLACE VIEW vw_ecommerce_afiliados_metricas AS
SELECT 
    ea.id as afiliado_id,
    COUNT(ep.id) as total_vendas,
    COALESCE(SUM(ep.valor_total), 0) as receita_gerada,
    COALESCE(SUM(ep.comissao_afiliado), 0) as comissoes_ganhas
FROM ecommerce_afiliados ea
LEFT JOIN ecommerce_pedidos ep ON ep.afiliado_id = ea.id AND ep.status IN ('pago', 'enviado', 'entregue', 'processando', 'confirmado')
WHERE ea.tipo = 'afiliado'
GROUP BY ea.id;

CREATE OR REPLACE VIEW vw_ecommerce_gerentes_metricas AS
SELECT 
    eg.id as gerente_id,
    COUNT(ep.id) as total_vendas_equipe,
    COALESCE(SUM(ep.valor_total), 0) as receita_gerada_equipe,
    COALESCE(SUM(ep.comissao_gerente), 0) as comissoes_ganhas
FROM ecommerce_afiliados eg
LEFT JOIN ecommerce_pedidos ep ON ep.gerente_id = eg.id AND ep.status IN ('pago', 'enviado', 'entregue', 'processando', 'confirmado')
WHERE eg.tipo = 'gerente'
GROUP BY eg.id;

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

ALTER TABLE ecommerce_afiliados ENABLE ROW LEVEL SECURITY;

-- O time administrativo pode ver e gerenciar a base de dados
CREATE POLICY ecommerce_afiliados_select ON ecommerce_afiliados FOR SELECT TO authenticated USING (true);
CREATE POLICY ecommerce_afiliados_all ON ecommerce_afiliados FOR ALL TO authenticated USING (true);
