-- ================================================================
-- MIGRATION 041: Tabela afiliados + seed automático
-- Objetivo: Cadastro centralizado de afiliados/coprodutores
-- com classificação manual (vendedora/influencer/coprodutor)
-- Execute no SQL Editor do Supabase Produção
-- ================================================================

-- ============================================================
-- ETAPA 1: CRIAR TABELA
-- ============================================================

CREATE TABLE IF NOT EXISTS afiliados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id INTEGER UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    pid TEXT,
    documento TEXT,

    -- Classificação manual pelo gestor
    tipo TEXT NOT NULL DEFAULT 'nao_classificado'
        CHECK (tipo IN ('vendedora', 'influencer', 'coprodutor', 'nao_classificado')),

    -- Status do vínculo na Ticto
    status_afiliacao TEXT NOT NULL DEFAULT 'ativo'
        CHECK (status_afiliacao IN ('solicitado', 'criado', 'aprovado', 'ativo', 'removido')),

    -- Flags úteis
    is_coprodutor BOOLEAN DEFAULT FALSE,
    is_afiliado BOOLEAN DEFAULT FALSE,
    ativo BOOLEAN DEFAULT TRUE,

    -- Meta
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ETAPA 2: ÍNDICES
-- ============================================================

CREATE INDEX idx_afiliados_tipo ON afiliados (tipo);
CREATE INDEX idx_afiliados_ativo ON afiliados (ativo);
CREATE INDEX idx_afiliados_email ON afiliados (email);

-- ============================================================
-- ETAPA 3: TRIGGER updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_afiliados_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_afiliados_updated_at
    BEFORE UPDATE ON afiliados
    FOR EACH ROW
    EXECUTE FUNCTION update_afiliados_updated_at();

-- ============================================================
-- ETAPA 4: RLS + POLICIES
-- ============================================================

ALTER TABLE afiliados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_afiliados" ON afiliados
    FOR SELECT USING (true);

CREATE POLICY "insert_afiliados" ON afiliados
    FOR INSERT WITH CHECK (true);

CREATE POLICY "update_afiliados" ON afiliados
    FOR UPDATE USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON afiliados TO anon, authenticated;
GRANT ALL ON afiliados TO service_role;

-- ============================================================
-- ETAPA 5: SEED - Popular com afiliados existentes
-- Extrai dos campos JSONB de ticto_pedidos
-- ============================================================

-- Inserir afiliados (do campo affiliates)
INSERT INTO afiliados (affiliate_id, nome, email, telefone, pid, documento, is_afiliado, tipo)
SELECT DISTINCT ON ((aff->>'id')::INTEGER)
    (aff->>'id')::INTEGER,
    aff->>'name',
    aff->>'email',
    aff->>'phone',
    aff->>'pid',
    aff->>'document',
    TRUE,
    'nao_classificado'
FROM ticto_pedidos tp,
     LATERAL jsonb_array_elements(tp.affiliates) AS aff
WHERE tp.affiliates IS NOT NULL
  AND tp.affiliates != '[]'::jsonb
  AND aff->>'id' IS NOT NULL
ON CONFLICT (affiliate_id) DO NOTHING;

-- Atualizar/inserir coprodutores (do campo coproducers)
INSERT INTO afiliados (affiliate_id, nome, email, telefone, documento, is_coprodutor, tipo)
SELECT DISTINCT ON ((cop->>'id')::INTEGER)
    (cop->>'id')::INTEGER,
    cop->>'name',
    cop->>'email',
    cop->>'phone',
    cop->>'document',
    TRUE,
    'coprodutor'
FROM ticto_pedidos tp,
     LATERAL jsonb_array_elements(tp.coproducers) AS cop
WHERE tp.coproducers IS NOT NULL
  AND tp.coproducers != '[]'::jsonb
  AND cop->>'id' IS NOT NULL
ON CONFLICT (affiliate_id) DO UPDATE SET
    is_coprodutor = TRUE,
    tipo = CASE
        WHEN afiliados.tipo = 'nao_classificado' THEN 'coprodutor'
        ELSE afiliados.tipo
    END;

-- Marcar sobreposição: quem é afiliado E coprodutor
UPDATE afiliados SET is_afiliado = TRUE
WHERE affiliate_id IN (
    SELECT DISTINCT (aff->>'id')::INTEGER
    FROM ticto_pedidos tp,
         LATERAL jsonb_array_elements(tp.affiliates) AS aff
    WHERE tp.affiliates IS NOT NULL AND tp.affiliates != '[]'::jsonb
) AND is_coprodutor = TRUE;

-- ============================================================
-- ETAPA 6: COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE afiliados IS 'Cadastro de afiliados e coprodutores da Ticto com classificação manual (vendedora/influencer/coprodutor).';
COMMENT ON COLUMN afiliados.tipo IS 'Classificação: vendedora (PV ativo), influencer (tráfego), coprodutor, nao_classificado';
COMMENT ON COLUMN afiliados.is_coprodutor IS 'TRUE se a pessoa aparece como coprodutor em algum pedido';
COMMENT ON COLUMN afiliados.is_afiliado IS 'TRUE se a pessoa aparece como afiliado em algum pedido';

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================

NOTIFY pgrst, 'reload schema';

SELECT tipo, is_coprodutor, is_afiliado, COUNT(*) as total
FROM afiliados
GROUP BY tipo, is_coprodutor, is_afiliado
ORDER BY total DESC;
