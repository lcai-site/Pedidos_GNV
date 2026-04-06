-- ================================================================
-- ESPELHAR SCHEMA DA PRODUÇÃO NO BANCO DE DESENVOLVIMENTO
-- Execute no SQL Editor do projeto vkeshyusimduiwjaijjv (DEV)
-- ================================================================

-- ============================================================
-- 1. DROPAR E RECRIAR TABELAS COM SCHEMA IDÊNTICO AO DA PRODUÇÃO
-- ============================================================

-- pedidos (tabela principal - schema real da produção)
-- Primeiro, verificar se já existe e adicionar colunas que faltam
DO $$
BEGIN
    -- Adicionar colunas que podem estar faltando na tabela pedidos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'data_venda') THEN
        ALTER TABLE pedidos ADD COLUMN data_venda TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'metodo_pagamento') THEN
        ALTER TABLE pedidos ADD COLUMN metodo_pagamento TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'forma_pagamento') THEN
        ALTER TABLE pedidos ADD COLUMN forma_pagamento TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'nome_produto') THEN
        ALTER TABLE pedidos ADD COLUMN nome_produto TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'nome_oferta') THEN
        ALTER TABLE pedidos ADD COLUMN nome_oferta TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'codigo_transacao') THEN
        ALTER TABLE pedidos ADD COLUMN codigo_transacao TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'cliente') THEN
        ALTER TABLE pedidos ADD COLUMN cliente TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'nome_cliente') THEN
        ALTER TABLE pedidos ADD COLUMN nome_cliente TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'email_cliente') THEN
        ALTER TABLE pedidos ADD COLUMN email_cliente TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'cpf') THEN
        ALTER TABLE pedidos ADD COLUMN cpf TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'telefone') THEN
        ALTER TABLE pedidos ADD COLUMN telefone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'endereco') THEN
        ALTER TABLE pedidos ADD COLUMN endereco TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'cidade') THEN
        ALTER TABLE pedidos ADD COLUMN cidade TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'estado') THEN
        ALTER TABLE pedidos ADD COLUMN estado TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'cep') THEN
        ALTER TABLE pedidos ADD COLUMN cep TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'valor_total') THEN
        ALTER TABLE pedidos ADD COLUMN valor_total NUMERIC;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'status') THEN
        ALTER TABLE pedidos ADD COLUMN status TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'parcelas') THEN
        ALTER TABLE pedidos ADD COLUMN parcelas INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'tipo_venda') THEN
        ALTER TABLE pedidos ADD COLUMN tipo_venda TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'plataforma') THEN
        ALTER TABLE pedidos ADD COLUMN plataforma TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'email') THEN
        ALTER TABLE pedidos ADD COLUMN email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'numero') THEN
        ALTER TABLE pedidos ADD COLUMN numero TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'complemento') THEN
        ALTER TABLE pedidos ADD COLUMN complemento TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'bairro') THEN
        ALTER TABLE pedidos ADD COLUMN bairro TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'endereco_completo') THEN
        ALTER TABLE pedidos ADD COLUMN endereco_completo TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos' AND column_name = 'corte_pv') THEN
        ALTER TABLE pedidos ADD COLUMN corte_pv TEXT;
    END IF;
END $$;

-- pedidos_consolidados_v3 (já deveria existir via 025)
-- Adicionar colunas extras que podem faltar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_consolidados_v3' AND column_name = 'metodo_pagamento') THEN
        ALTER TABLE pedidos_consolidados_v3 ADD COLUMN metodo_pagamento TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_consolidados_v3' AND column_name = 'campos_alterados') THEN
        ALTER TABLE pedidos_consolidados_v3 ADD COLUMN campos_alterados TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_consolidados_v3' AND column_name = 'tentativas_geracao') THEN
        ALTER TABLE pedidos_consolidados_v3 ADD COLUMN tentativas_geracao INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_consolidados_v3' AND column_name = 'erro_ia') THEN
        ALTER TABLE pedidos_consolidados_v3 ADD COLUMN erro_ia TEXT;
    END IF;
END $$;

-- pedidos_unificados (adicionar colunas que podem faltar)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_unificados' AND column_name = 'metodo_pagamento') THEN
        ALTER TABLE pedidos_unificados ADD COLUMN metodo_pagamento TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedidos_unificados' AND column_name = 'campos_alterados') THEN
        ALTER TABLE pedidos_unificados ADD COLUMN campos_alterados TEXT[];
    END IF;
END $$;

-- pedidos_status_log (recriar com schema correto)
DROP TABLE IF EXISTS pedidos_status_log CASCADE;
CREATE TABLE pedidos_status_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID,
    codigo_transacao TEXT,
    status_anterior TEXT,
    status_novo TEXT,
    motivo TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE pedidos_status_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_select_all" ON pedidos_status_log FOR SELECT USING (true);
CREATE POLICY "allow_insert_all" ON pedidos_status_log FOR INSERT WITH CHECK (true);
GRANT SELECT, INSERT ON pedidos_status_log TO anon, authenticated;
GRANT ALL ON pedidos_status_log TO service_role;

-- estoque (recriar com schema correto da produção)
DROP TABLE IF EXISTS estoque_movimentacoes CASCADE;
DROP TABLE IF EXISTS estoque CASCADE;
CREATE TABLE estoque (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto TEXT NOT NULL,
    nome_produto TEXT,
    quantidade INTEGER DEFAULT 0,
    quantidade_atual INTEGER DEFAULT 0,
    limite_alerta INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_select_all" ON estoque FOR SELECT USING (true);
CREATE POLICY "allow_all_auth" ON estoque FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON estoque FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON estoque TO anon, authenticated;
GRANT ALL ON estoque TO service_role;

CREATE TABLE estoque_movimentacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID REFERENCES estoque(id),
    tipo TEXT NOT NULL,
    quantidade INTEGER NOT NULL,
    motivo TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_select_all" ON estoque_movimentacoes FOR SELECT USING (true);
CREATE POLICY "allow_insert_all" ON estoque_movimentacoes FOR INSERT WITH CHECK (true);
GRANT SELECT, INSERT ON estoque_movimentacoes TO anon, authenticated;
GRANT ALL ON estoque_movimentacoes TO service_role;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pedidos_data_venda ON pedidos (data_venda);
CREATE INDEX IF NOT EXISTS idx_pedidos_created_at ON pedidos (created_at);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos (status);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Schema do DEV atualizado com sucesso!' as resultado;
