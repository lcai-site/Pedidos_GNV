-- ================================================================
-- SCRIPT COMPLETO PARA SETUP DO STAGING (DO ZERO!)
-- ================================================================
-- Este script cria TODAS as tabelas necessárias do zero
-- Copie e cole no SQL Editor do Supabase Staging
-- ================================================================

-- ================================================================
-- PASSO 1: CRIAR TABELA PROFILES
-- ================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'atendente',
  nome_completo TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índice para role
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies para profiles
DROP POLICY IF EXISTS "Usuários podem ver próprio perfil" ON profiles;
CREATE POLICY "Usuários podem ver próprio perfil"
ON profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuários podem atualizar próprio perfil" ON profiles;
CREATE POLICY "Usuários podem atualizar próprio perfil"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- ================================================================
-- PASSO 2: CRIAR TABELA PEDIDOS
-- ================================================================
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_transacao TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  nome_cliente TEXT,
  cpf_cliente TEXT,
  email_cliente TEXT,
  telefone_cliente TEXT,
  cep TEXT,
  rua TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  valor_total DECIMAL(10,2),
  data_venda TIMESTAMPTZ DEFAULT NOW(),
  nome_produto TEXT,
  nome_oferta TEXT,
  forma_pagamento TEXT,
  parcelas INTEGER,
  metadata JSONB,
  codigo_rastreio TEXT,
  data_envio TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para pedidos
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_data_venda ON pedidos(data_venda DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_cpf ON pedidos(cpf_cliente);
CREATE INDEX IF NOT EXISTS idx_pedidos_codigo ON pedidos(codigo_transacao);

-- ================================================================
-- PASSO 3: CRIAR TABELA SOLICITAÇÕES
-- ================================================================
CREATE TABLE IF NOT EXISTS solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT DEFAULT 'pendente',
  solicitante_id UUID REFERENCES profiles(id),
  aprovador_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE solicitacoes ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- PASSO 4: CRIAR FUNÇÃO PARA AUTO-CRIAR PROFILE
-- ================================================================
-- Esta função cria automaticamente um profile quando um usuário é criado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, ativo)
  VALUES (
    NEW.id,
    NEW.email,
    'atendente',
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- PASSO 5: POPULAR PROFILES DOS USUÁRIOS JÁ CRIADOS
-- ================================================================
-- Inserir profiles para usuários que já existem no auth.users
INSERT INTO profiles (id, email, role, nome_completo, ativo)
SELECT 
  id,
  email,
  'atendente',
  'Usuário Teste',
  true
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- PASSO 6: CONFIGURAR ROLES DOS USUÁRIOS DE TESTE
-- ================================================================
-- Atualizar role de Admin
UPDATE profiles 
SET role = 'adm', 
    nome_completo = 'Admin Teste',
    ativo = true
WHERE email = 'admin@test.com';

-- Atualizar role de Gestor
UPDATE profiles 
SET role = 'gestor', 
    nome_completo = 'Gestor Teste',
    ativo = true
WHERE email = 'gestor@test.com';

-- Atualizar role de Atendente
UPDATE profiles 
SET role = 'atendente', 
    nome_completo = 'Atendente Teste',
    ativo = true
WHERE email = 'atendente@test.com';

-- ================================================================
-- PASSO 7: CRIAR PEDIDOS DE TESTE
-- ================================================================
INSERT INTO pedidos (
  codigo_transacao, status, nome_cliente, cpf_cliente,
  email_cliente, telefone_cliente, cep, rua, numero,
  cidade, estado, valor_total, data_venda, nome_produto,
  forma_pagamento
) VALUES
  ('TEST-001', 'Aprovado', 'João Silva', '12345678901', 
   'joao@test.com', '11999999999', '01310-100', 'Av Paulista', '1000',
   'São Paulo', 'SP', 150.00, NOW() - INTERVAL '2 days', 
   'Desejo Proibido - 1 Pote', 'pix'),
   
  ('TEST-002', 'Aprovado', 'Maria Santos', '98765432100',
   'maria@test.com', '11888888888', '01310-100', 'Av Paulista', '2000',
   'São Paulo', 'SP', 300.00, NOW() - INTERVAL '1 day',
   'Bela Forma - 2 Potes', 'credit_card'),
   
  ('TEST-003', 'Pendente', 'Pedro Costa', '11122233344',
   'pedro@test.com', '11777777777', '01310-100', 'Av Paulista', '3000',
   'São Paulo', 'SP', 200.00, NOW(),
   'Bela Lumi - 1 Pote', 'boleto'),
   
  ('TEST-004', 'Aprovado', 'Ana Paula', '55566677788',
   'ana@test.com', '11666666666', '04567-000', 'Rua Augusta', '500',
   'São Paulo', 'SP', 450.00, NOW() - INTERVAL '3 days',
   'Desejo Proibido - 3 Potes', 'pix')
ON CONFLICT (codigo_transacao) DO NOTHING;

-- ================================================================
-- VERIFICAÇÕES FINAIS
-- ================================================================
-- Verificar tabelas criadas
SELECT '✅ TABELAS CRIADAS:' as status;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Verificar usuários configurados
SELECT '✅ USUÁRIOS CONFIGURADOS:' as status;
SELECT email, role, nome_completo, ativo 
FROM profiles
ORDER BY role DESC;

-- Verificar pedidos criados
SELECT '✅ PEDIDOS DE TESTE:' as status;
SELECT codigo_transacao, status, nome_cliente, valor_total, data_venda
FROM pedidos
ORDER BY data_venda DESC;

-- Contagem final
SELECT '✅ RESUMO:' as status;
SELECT 
  (SELECT COUNT(*) FROM profiles) as total_usuarios,
  (SELECT COUNT(*) FROM pedidos) as total_pedidos,
  (SELECT COUNT(*) FROM solicitacoes) as total_solicitacoes;

-- ================================================================
-- ✅ SETUP COMPLETO!
-- ================================================================
-- Agora você pode fazer login com:
-- Email: admin@test.com
-- Senha: Admin@123
-- ================================================================

-- ================================================================
-- MIGRATION 001: RBAC
-- ================================================================
-- Adicionar colunas RBAC à tabela profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'atendente',
ADD COLUMN IF NOT EXISTS nome_completo TEXT,
ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Criar índice para role
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- RLS Policies para profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver próprio perfil" ON profiles;
CREATE POLICY "Usuários podem ver próprio perfil"
ON profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuários podem atualizar próprio perfil" ON profiles;
CREATE POLICY "Usuários podem atualizar próprio perfil"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- ================================================================
-- MIGRATION 004: SOLICITAÇÕES
-- ================================================================
CREATE TABLE IF NOT EXISTS solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT DEFAULT 'pendente',
  solicitante_id UUID REFERENCES profiles(id),
  aprovador_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE solicitacoes ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- MIGRATION 013: SHIPPING TRACKING
-- ================================================================
-- Adicionar campos de rastreio se não existirem
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='pedidos' AND column_name='codigo_rastreio') THEN
    ALTER TABLE pedidos ADD COLUMN codigo_rastreio TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='pedidos' AND column_name='data_envio') THEN
    ALTER TABLE pedidos ADD COLUMN data_envio TIMESTAMPTZ;
  END IF;
END $$;

-- ================================================================
-- CRIAR USUÁRIOS DE TESTE
-- ================================================================
-- IMPORTANTE: Você precisa criar os usuários no Authentication primeiro!
-- Depois execute este UPDATE para configurar as roles

-- Configurar role de Admin
UPDATE profiles 
SET role = 'adm', 
    nome_completo = 'Admin Teste',
    ativo = true
WHERE email = 'admin@test.com';

-- Configurar role de Gestor
UPDATE profiles 
SET role = 'gestor', 
    nome_completo = 'Gestor Teste',
    ativo = true
WHERE email = 'gestor@test.com';

-- Configurar role de Atendente
UPDATE profiles 
SET role = 'atendente', 
    nome_completo = 'Atendente Teste',
    ativo = true
WHERE email = 'atendente@test.com';

-- ================================================================
-- CRIAR PEDIDOS DE TESTE
-- ================================================================
INSERT INTO pedidos (
  codigo_transacao, status, nome_cliente, cpf_cliente,
  email_cliente, telefone_cliente, cep, rua, numero,
  cidade, estado, valor_total, data_venda, nome_produto,
  forma_pagamento
) VALUES
  ('TEST-001', 'Aprovado', 'João Silva', '12345678901', 
   'joao@test.com', '11999999999', '01310-100', 'Av Paulista', '1000',
   'São Paulo', 'SP', 150.00, NOW() - INTERVAL '2 days', 
   'Desejo Proibido - 1 Pote', 'pix'),
   
  ('TEST-002', 'Aprovado', 'Maria Santos', '98765432100',
   'maria@test.com', '11888888888', '01310-100', 'Av Paulista', '2000',
   'São Paulo', 'SP', 300.00, NOW() - INTERVAL '1 day',
   'Bela Forma - 2 Potes', 'credit_card'),
   
  ('TEST-003', 'Pendente', 'Pedro Costa', '11122233344',
   'pedro@test.com', '11777777777', '01310-100', 'Av Paulista', '3000',
   'São Paulo', 'SP', 200.00, NOW(),
   'Bela Lumi - 1 Pote', 'boleto'),
   
  ('TEST-004', 'Aprovado', 'Ana Paula', '55566677788',
   'ana@test.com', '11666666666', '04567-000', 'Rua Augusta', '500',
   'São Paulo', 'SP', 450.00, NOW() - INTERVAL '3 days',
   'Desejo Proibido - 3 Potes', 'pix')
ON CONFLICT DO NOTHING;

-- ================================================================
-- VERIFICAÇÕES
-- ================================================================
-- Verificar tabelas criadas
SELECT 'Tabelas criadas:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verificar usuários configurados
SELECT 'Usuários configurados:' as info;
SELECT email, role, nome_completo, ativo 
FROM profiles;

-- Verificar pedidos criados
SELECT 'Pedidos de teste criados:' as info;
SELECT COUNT(*) as total_pedidos FROM pedidos;

-- ================================================================
-- FIM DO SCRIPT
-- ================================================================
