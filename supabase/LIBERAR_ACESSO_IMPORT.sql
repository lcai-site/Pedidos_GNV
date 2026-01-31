-- ============================================
-- VERIFICAR E CRIAR TABELAS FALTANTES
-- ============================================
-- Execute este script primeiro para ver o que existe

-- 1. Ver tabelas existentes
SELECT 'Tabelas existentes:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Criar pedidos_agrupados se não existir
CREATE TABLE IF NOT EXISTS pedidos_agrupados (
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

-- 3. Criar pedidos_unificados se não existir
CREATE TABLE IF NOT EXISTS pedidos_unificados (
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

-- 4. Desabilitar RLS para importação
ALTER TABLE pedidos DISABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_agrupados DISABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_unificados DISABLE ROW LEVEL SECURITY;

-- 5. Verificação final
SELECT '✅ Tabelas prontas para importação:' as status;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'pedidos%'
ORDER BY table_name;
