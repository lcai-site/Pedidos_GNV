-- ============================================
-- SETUP COMPLETO DO BANCO DE TESTES/STAGING
-- ============================================
-- Execute este script no BANCO DE STAGING/TESTES
-- Versão corrigida - lida com tabelas existentes
-- ============================================

-- ============================================
-- PARTE 1: LIMPAR ESTRUTURA ANTERIOR
-- ============================================
-- Para garantir que tudo seja recriado corretamente

DROP MATERIALIZED VIEW IF EXISTS pedidos_consolidados_v3 CASCADE;
DROP VIEW IF EXISTS pedidos_consolidados_v3 CASCADE;
DROP VIEW IF EXISTS pedidos_consolidados CASCADE;
DROP TABLE IF EXISTS pedidos_unificados CASCADE;
DROP TABLE IF EXISTS pedidos_agrupados CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS pedidos_unificados CASCADE;
DROP TABLE IF EXISTS pedidos_agrupados CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;

-- ============================================
-- PARTE 2: CRIAR TABELA PEDIDOS
-- ============================================

CREATE TABLE pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_transacao TEXT UNIQUE NOT NULL,
  nome_cliente TEXT,
  cpf TEXT,
  email TEXT,
  telefone TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  endereco_completo TEXT,
  descricao_pacote TEXT,
  nome_produto TEXT,
  nome_oferta TEXT,
  valor_total DECIMAL(10,2),
  forma_pagamento TEXT,
  parcelas INTEGER,
  cpf_cliente TEXT,
  telefone_cliente TEXT,
  email_cliente TEXT,
  rua TEXT,
  data_venda TIMESTAMPTZ,
  data_envio TIMESTAMPTZ,
  status TEXT DEFAULT 'Pendente',
  status_aprovacao TEXT DEFAULT 'Pendente',
  status_envio TEXT DEFAULT 'Aguardando',
  codigo_rastreio TEXT,
  observacao TEXT,
  erro_ia TEXT,
  metadata JSONB,
  customer JSONB,
  shipping JSONB,
  dados_entrega JSONB,
  endereco_json JSONB,
  foi_editado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_pedidos_cpf ON pedidos(cpf);
CREATE INDEX idx_pedidos_cpf_cliente ON pedidos(cpf_cliente);
CREATE INDEX idx_pedidos_data_venda ON pedidos(data_venda);
CREATE INDEX idx_pedidos_status ON pedidos(status_aprovacao);
CREATE INDEX idx_pedidos_codigo ON pedidos(codigo_transacao);

-- ============================================
-- PARTE 3: CRIAR TABELA PEDIDOS_AGRUPADOS
-- ============================================

CREATE TABLE pedidos_agrupados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf TEXT NOT NULL,
  codigos_agrupados TEXT[],
  quantidade_pedidos INTEGER,
  data_primeiro_pedido TIMESTAMPTZ,
  data_ultimo_pedido TIMESTAMPTZ,
  status_envio TEXT DEFAULT 'Pendente',
  codigo_rastreio TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agrupados_cpf ON pedidos_agrupados(cpf);

-- ============================================
-- PARTE 4: CRIAR TABELA PEDIDOS_UNIFICADOS
-- ============================================

CREATE TABLE pedidos_unificados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_transacao TEXT,
  cpf TEXT,
  nome_cliente TEXT,
  email TEXT,
  telefone TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  endereco_completo TEXT,
  descricao_pacote TEXT,
  data_venda TIMESTAMPTZ,
  status_aprovacao TEXT DEFAULT 'Pendente',
  status_envio TEXT DEFAULT 'Aguardando',
  codigo_rastreio TEXT,
  observacao TEXT,
  codigos_agrupados TEXT[],
  quantidade_pedidos INTEGER DEFAULT 1,
  metadata JSONB,
  customer JSONB,
  shipping JSONB,
  dados_entrega JSONB,
  endereco_json JSONB,
  foi_editado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_unificados_cpf ON pedidos_unificados(cpf);

-- ============================================
-- PARTE 5: CRIAR VIEW PEDIDOS_CONSOLIDADOS
-- ============================================

CREATE VIEW pedidos_consolidados AS
SELECT 
  p.id,
  p.codigo_transacao,
  p.nome_cliente,
  COALESCE(p.cpf, p.cpf_cliente) as cpf,
  COALESCE(p.email, p.email_cliente) as email,
  COALESCE(p.telefone, p.telefone_cliente) as telefone,
  p.cep,
  COALESCE(p.logradouro, p.rua) as logradouro,
  p.numero,
  p.complemento,
  p.bairro,
  p.cidade,
  p.estado,
  p.endereco_completo,
  p.descricao_pacote,
  p.nome_produto,
  p.nome_oferta,
  p.valor_total,
  p.forma_pagamento,
  p.parcelas,
  p.data_venda,
  p.data_envio,
  COALESCE(p.status_aprovacao, p.status) as status_aprovacao,
  p.status_envio,
  p.codigo_rastreio,
  p.observacao,
  p.metadata,
  p.customer,
  p.shipping,
  p.dados_entrega,
  p.endereco_json,
  p.foi_editado,
  COALESCE(pa.codigos_agrupados, ARRAY[p.codigo_transacao]) as codigos_agrupados,
  p.created_at,
  p.updated_at
FROM pedidos p
LEFT JOIN pedidos_agrupados pa ON COALESCE(p.cpf, p.cpf_cliente) = pa.cpf;

-- ============================================
-- PARTE 6: CRIAR VIEW V3 (COM DIA_DESPACHO)
-- ============================================

CREATE VIEW pedidos_consolidados_v3 AS
SELECT 
  pc.*,
  CASE 
    WHEN EXTRACT(DOW FROM pc.data_venda) = 4 THEN 
      (pc.data_venda + INTERVAL '4 days')::DATE
    WHEN EXTRACT(DOW FROM pc.data_venda) = 5 THEN 
      (pc.data_venda + INTERVAL '4 days')::DATE
    ELSE 
      (pc.data_venda + INTERVAL '2 days')::DATE
  END as dia_despacho
FROM pedidos_consolidados pc;

-- ============================================
-- PARTE 7: FUNÇÕES SQL
-- ============================================

CREATE OR REPLACE FUNCTION update_pedidos_consolidados(
  p_cpf_antigo TEXT,
  p_cpf_novo TEXT,
  p_nome TEXT,
  p_email TEXT,
  p_telefone TEXT,
  p_cep TEXT,
  p_logradouro TEXT,
  p_numero TEXT,
  p_complemento TEXT,
  p_bairro TEXT,
  p_cidade TEXT,
  p_estado TEXT,
  p_observacao TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_endereco_completo TEXT;
BEGIN
  v_endereco_completo := p_logradouro || ', ' || p_numero;
  IF p_complemento IS NOT NULL AND p_complemento != '' THEN
    v_endereco_completo := v_endereco_completo || ' - ' || p_complemento;
  END IF;
  v_endereco_completo := v_endereco_completo || ' - ' || p_bairro || ', ' || p_cidade || ' - ' || p_estado || ', ' || p_cep;

  UPDATE pedidos
  SET 
    cpf = p_cpf_novo,
    cpf_cliente = p_cpf_novo,
    nome_cliente = p_nome,
    email = p_email,
    email_cliente = p_email,
    telefone = p_telefone,
    telefone_cliente = p_telefone,
    cep = p_cep,
    logradouro = p_logradouro,
    rua = p_logradouro,
    numero = p_numero,
    complemento = p_complemento,
    bairro = p_bairro,
    cidade = p_cidade,
    estado = p_estado,
    endereco_completo = v_endereco_completo,
    observacao = p_observacao,
    foi_editado = true,
    updated_at = NOW()
  WHERE cpf = p_cpf_antigo OR cpf_cliente = p_cpf_antigo;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pedidos_updated_at
  BEFORE UPDATE ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_unificados_updated_at
  BEFORE UPDATE ON pedidos_unificados
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PARTE 8: RLS (ROW LEVEL SECURITY)
-- ============================================

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_agrupados ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_unificados ENABLE ROW LEVEL SECURITY;

-- Pedidos
CREATE POLICY "Permitir leitura para autenticados" ON pedidos
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir inserção para autenticados" ON pedidos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permitir atualização para autenticados" ON pedidos
  FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir exclusão para autenticados" ON pedidos
  FOR DELETE USING (auth.role() = 'authenticated');

-- Pedidos Agrupados
CREATE POLICY "Permitir leitura para autenticados" ON pedidos_agrupados
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir inserção para autenticados" ON pedidos_agrupados
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permitir atualização para autenticados" ON pedidos_agrupados
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Pedidos Unificados
CREATE POLICY "Permitir leitura para autenticados" ON pedidos_unificados
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir inserção para autenticados" ON pedidos_unificados
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permitir atualização para autenticados" ON pedidos_unificados
  FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================
-- PARTE 9: PERMISSÕES VIEWS
-- ============================================

GRANT SELECT ON pedidos_consolidados TO authenticated;
GRANT SELECT ON pedidos_consolidados TO anon;
GRANT SELECT ON pedidos_consolidados_v3 TO authenticated;
GRANT SELECT ON pedidos_consolidados_v3 TO anon;

-- ============================================
-- VERIFICAÇÃO
-- ============================================

SELECT '✅ SETUP CONCLUÍDO!' as status;
SELECT 'Tabelas criadas:' as info, COUNT(*) as total 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'pedidos%';
