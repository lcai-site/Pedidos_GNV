-- ================================================================
-- MIGRATION 121: Atualizar Sigla Produtos
-- Adicionando suporte para BelaBloom Hair, SekaShot, Mounjalis
-- e as variações de Desejo Proibido Gotas e Cápsulas.
-- ================================================================

CREATE OR REPLACE FUNCTION sigla_produto(nome TEXT)
RETURNS TEXT AS $$
DECLARE u TEXT;
BEGIN
    u := UPPER(COALESCE(nome, ''));
    
    -- Variações de Desejo Proibido
    IF (u LIKE '%DESEJO PROIBIDO%' OR u LIKE '%DESEJO%') AND u LIKE '%GOTA%' THEN RETURN 'DP GTS'; END IF;
    IF (u LIKE '%DESEJO PROIBIDO%' OR u LIKE '%DESEJO%') AND (u LIKE '%CAPS%' OR u LIKE '%CÁPS%') THEN RETURN 'DP CPS'; END IF;
    IF u LIKE '%DESEJO PROIBIDO%' OR u LIKE '%DESEJO%' THEN RETURN 'DP'; END IF;
    
    -- Novos e existentes
    IF u LIKE '%BELA LUMI%' OR u LIKE '%LUMI%' THEN RETURN 'BL'; END IF;
    IF u LIKE '%BELA FORMA%' OR u LIKE '%FORMA%' THEN RETURN 'BF'; END IF;
    IF u LIKE '%BELABLOOM%' OR u LIKE '%BLOOM%' THEN RETURN 'BH'; END IF;
    IF u LIKE '%SEKASHOT%' OR u LIKE '%SEKA%' THEN RETURN 'SS'; END IF;
    IF u LIKE '%MOUNJALIS%' THEN RETURN 'ME'; END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION sigla_produto(TEXT) TO anon, authenticated, service_role;
