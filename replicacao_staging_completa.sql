-- ==========================================
-- SETUP DO AMBIENTE DE TESTES (STAGING)
-- Gerado automaticamente com todas as migrations
-- Data: 2026-03-04T00:29:08.474Z
-- ==========================================

-- ==========================================
-- MIGRATION: 001_add_rbac_to_profiles.sql
-- ==========================================

-- =====================================================
-- Migration: Add RBAC fields to profiles table
-- Description: Update profiles table with role-based access control fields
-- =====================================================

-- 1. Add new columns to profiles table
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS nome_completo TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'atendente' 
    CHECK (role IN ('atendente', 'gestor', 'adm')),
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS meta_mensal INTEGER,
  ADD COLUMN IF NOT EXISTS vendedora_nome TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if they exist
DROP POLICY IF EXISTS "Atendentes veem apenas próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Apenas ADM modifica roles" ON profiles;
DROP POLICY IF EXISTS "Usuários podem ver próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Gestores e ADMs veem todos perfis" ON profiles;
DROP POLICY IF EXISTS "Apenas ADM pode criar usuários" ON profiles;

-- 6. Create RLS policies

-- Policy: Atendentes só veem a si mesmos, Gestores/ADMs veem todos
CREATE POLICY "Usuários podem ver próprio perfil"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Gestores e ADMs veem todos perfis"
  ON profiles FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('gestor', 'adm'));

-- Policy: Apenas ADM pode modificar roles
CREATE POLICY "Apenas ADM modifica roles"
  ON profiles FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'adm');

-- Policy: Apenas ADM pode criar novos usuários
CREATE POLICY "Apenas ADM pode criar usuários"
  ON profiles FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'adm');

-- 7. Create index for role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_ativo ON profiles(ativo) WHERE ativo = true;

-- 8. Update existing users (if any) to have default role
UPDATE profiles
SET role = 'adm'
WHERE id = (
  SELECT id FROM profiles 
  WHERE role IS NULL 
  ORDER BY created_at 
  LIMIT 1
); -- Set first user as admin

UPDATE profiles
SET role = 'atendente'
WHERE role IS NULL;

-- =====================================================
-- Verification queries (run these to check)
-- =====================================================

-- Check if columns were added
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles';

-- Check policies
-- SELECT policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename = 'profiles';

-- Check triggers
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers 
-- WHERE event_object_table = 'profiles';


-- ==========================================
-- MIGRATION: 002_fix_rls_policies.sql
-- ==========================================

-- =====================================================
-- DIAGNÓSTICO E CORREÇÃO: Erro 500 na tabela profiles
-- =====================================================

-- PASSO 1: Verificar estrutura atual da tabela
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- PASSO 2: Verificar políticas RLS existentes
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'profiles';

-- PASSO 3: Desabilitar RLS temporariamente para diagnóstico
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- PASSO 4: Tentar fazer login novamente
-- (Volte para o app e tente fazer login)
-- Se funcionar, o problema são as políticas RLS

-- PASSO 5: Recriar políticas RLS corretamente
-- Primeiro, remover todas as políticas existentes
DROP POLICY IF EXISTS "Usuários podem ver próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Gestores e ADMs veem todos perfis" ON profiles;
DROP POLICY IF EXISTS "Apenas ADM modifica roles" ON profiles;
DROP POLICY IF EXISTS "Apenas ADM pode criar usuários" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- PASSO 6: Criar políticas RLS simplificadas
-- Permitir que usuários autenticados vejam e criem seus próprios perfis
CREATE POLICY "Enable read access for authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on id"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- PASSO 7: Reabilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- PASSO 8: Verificar se as políticas foram criadas
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles';

-- =====================================================
-- TESTE: Execute esta query para verificar se consegue ler
-- =====================================================
SELECT * FROM profiles LIMIT 5;


-- ==========================================
-- MIGRATION: 003_add_rls_remaining_tables.sql
-- ==========================================

-- =====================================================
-- Adicionar RLS Policies para Tabelas UNRESTRICTED
-- =====================================================

-- ========================================
-- 1. TABELA: feriados
-- ========================================

-- Habilitar RLS
ALTER TABLE feriados ENABLE ROW LEVEL SECURITY;

-- Política: Todos podem ver feriados
CREATE POLICY "Todos podem visualizar feriados"
  ON feriados FOR SELECT
  TO authenticated
  USING (true);

-- Política: Apenas ADM pode inserir feriados
CREATE POLICY "Apenas ADM pode adicionar feriados"
  ON feriados FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'adm'
  );

-- Política: Apenas ADM pode atualizar feriados
CREATE POLICY "Apenas ADM pode atualizar feriados"
  ON feriados FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'adm'
  );

-- Política: Apenas ADM pode deletar feriados
CREATE POLICY "Apenas ADM pode deletar feriados"
  ON feriados FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'adm'
  );

-- ========================================
-- 2. TABELA: solicitacoes_historico
-- ========================================

-- Habilitar RLS
ALTER TABLE solicitacoes_historico ENABLE ROW LEVEL SECURITY;

-- Política: Todos usuários autenticados podem ver histórico
-- (Quando a tabela solicitacoes for criada, essa política será atualizada)
CREATE POLICY "Usuários autenticados veem histórico"
  ON solicitacoes_historico FOR SELECT
  TO authenticated
  USING (true);

-- Política: Sistema pode inserir no histórico (trigger automático)
CREATE POLICY "Sistema pode inserir histórico"
  ON solicitacoes_historico FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Não permitir UPDATE ou DELETE no histórico (auditoria)
-- Histórico é append-only (somente inserção)

-- ========================================
-- VERIFICAÇÃO
-- ========================================

-- Ver políticas criadas para feriados
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'feriados';

-- Ver políticas criadas para solicitacoes_historico
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'solicitacoes_historico';

-- =====================================================
-- SUCESSO! Agora todas as tabelas têm RLS habilitado
-- =====================================================


-- ==========================================
-- MIGRATION: 004a_cleanup_solicitacoes.sql
-- ==========================================

-- =====================================================
-- LIMPEZA: Remover tabela solicitacoes e recomeçar
-- =====================================================

-- Remover políticas RLS
DROP POLICY IF EXISTS "Atendentes veem próprias solicitações" ON solicitacoes;
DROP POLICY IF EXISTS "Atendentes podem criar solicitações" ON solicitacoes;
DROP POLICY IF EXISTS "Atendentes atualizam próprias pendentes" ON solicitacoes;
DROP POLICY IF EXISTS "Apenas gestores deletam solicitações" ON solicitacoes;

-- Remover triggers
DROP TRIGGER IF EXISTS update_solicitacoes_updated_at ON solicitacoes;
DROP TRIGGER IF EXISTS trigger_log_solicitacao_status ON solicitacoes;
DROP TRIGGER IF EXISTS solicitacoes_audit ON solicitacoes;

-- Remover função (CASCADE remove triggers dependentes)
DROP FUNCTION IF EXISTS log_solicitacao_change() CASCADE;

-- Remover tabela (CASCADE remove índices automaticamente)
DROP TABLE IF EXISTS solicitacoes CASCADE;

-- Verificar se foi removida
SELECT tablename FROM pg_tables WHERE tablename = 'solicitacoes';
-- Deve retornar 0 resultados

-- =====================================================
-- Agora execute o script 004_create_solicitacoes_table.sql
-- =====================================================


-- ==========================================
-- MIGRATION: 004b_create_solicitacoes_simple.sql
-- ==========================================

-- Criar tabela solicitacoes
CREATE TABLE solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id TEXT NOT NULL,
  cliente_nome TEXT NOT NULL,
  cliente_email TEXT,
  cliente_telefone TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('reembolso', 'mudanca_endereco', 'mudanca_produto', 'cancelamento')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'aprovada', 'recusada', 'concluida', 'cancelada')),
  prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  dados_solicitacao JSONB NOT NULL,
  comprovantes TEXT[],
  observacoes TEXT,
  observacoes_internas TEXT,
  criado_por UUID REFERENCES profiles(id),
  aprovado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  aprovado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ
);

-- Criar índices
CREATE INDEX idx_solicitacoes_pedido ON solicitacoes(pedido_id);
CREATE INDEX idx_solicitacoes_tipo ON solicitacoes(tipo);
CREATE INDEX idx_solicitacoes_status ON solicitacoes(status);
CREATE INDEX idx_solicitacoes_criado_por ON solicitacoes(criado_por);

-- Trigger para updated_at
CREATE TRIGGER update_solicitacoes_updated_at
  BEFORE UPDATE ON solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE solicitacoes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários veem próprias solicitações"
  ON solicitacoes FOR SELECT
  TO authenticated
  USING (
    criado_por = auth.uid()
    OR
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('gestor', 'adm')
  );

CREATE POLICY "Usuários podem criar solicitações"
  ON solicitacoes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários atualizam próprias solicitações"
  ON solicitacoes FOR UPDATE
  TO authenticated
  USING (
    criado_por = auth.uid() AND status = 'pendente'
    OR
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('gestor', 'adm')
  );

CREATE POLICY "Apenas gestores deletam"
  ON solicitacoes FOR DELETE
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('gestor', 'adm'));


-- ==========================================
-- MIGRATION: 004_create_solicitacoes_table.sql
-- ==========================================

-- =====================================================
-- Migration: Sistema de Solicitações de Pós-Vendas
-- Fase 2: Criar tabelas e estrutura completa
-- =====================================================

-- ========================================
-- 1. TABELA: solicitacoes
-- ========================================

CREATE TABLE IF NOT EXISTS solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Informações do Pedido
  pedido_id TEXT NOT NULL,
  cliente_nome TEXT NOT NULL,
  cliente_email TEXT,
  cliente_telefone TEXT,
  
  -- Tipo de Solicitação
  tipo TEXT NOT NULL CHECK (tipo IN ('reembolso', 'mudanca_endereco', 'mudanca_produto', 'cancelamento')),
  
  -- Status da Solicitação
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN (
    'pendente',           -- Aguardando análise
    'em_analise',         -- Sendo analisada
    'aprovada',           -- Aprovada
    'recusada',           -- Recusada
    'concluida',          -- Concluída
    'cancelada'           -- Cancelada
  )),
  
  -- Prioridade
  prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  
  -- Dados Específicos por Tipo
  dados_solicitacao JSONB NOT NULL, -- Dados específicos de cada tipo
  
  -- Comprovantes e Anexos
  comprovantes TEXT[], -- URLs dos comprovantes
  
  -- Observações
  observacoes TEXT,
  observacoes_internas TEXT, -- Visível apenas para gestores/ADM
  
  -- Responsável
  criado_por UUID REFERENCES profiles(id),
  aprovado_por UUID REFERENCES profiles(id),
  
  -- Datas
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  aprovado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_solicitacoes_pedido ON solicitacoes(pedido_id);
CREATE INDEX idx_solicitacoes_tipo ON solicitacoes(tipo);
CREATE INDEX idx_solicitacoes_status ON solicitacoes(status);
CREATE INDEX idx_solicitacoes_criado_por ON solicitacoes(criado_por);
CREATE INDEX idx_solicitacoes_created_at ON solicitacoes(created_at DESC);

-- ========================================
-- 2. TRIGGER: Atualizar updated_at
-- ========================================

CREATE TRIGGER update_solicitacoes_updated_at
  BEFORE UPDATE ON solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 3. TRIGGER: Auditoria (solicitacoes_historico)
-- ========================================

CREATE OR REPLACE FUNCTION log_solicitacao_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO solicitacoes_historico (
    solicitacao_id,
    campo_alterado,
    valor_anterior,
    valor_novo,
    alterado_por,
    alterado_em
  ) VALUES (
    NEW.id,
    'status',
    OLD.status,
    NEW.status,
    auth.uid(),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_solicitacao_status
  AFTER UPDATE OF status ON solicitacoes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_solicitacao_change();

-- ========================================
-- 4. RLS POLICIES
-- ========================================

ALTER TABLE solicitacoes ENABLE ROW LEVEL SECURITY;

-- Política: Atendentes veem apenas próprias solicitações
CREATE POLICY "Atendentes veem próprias solicitações"
  ON solicitacoes FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'atendente' 
    AND criado_por = auth.uid()
    OR
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('gestor', 'adm')
  );

-- Política: Atendentes podem criar solicitações
CREATE POLICY "Atendentes podem criar solicitações"
  ON solicitacoes FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('atendente', 'gestor', 'adm')
  );

-- Política: Atendentes podem atualizar próprias solicitações pendentes
CREATE POLICY "Atendentes atualizam próprias pendentes"
  ON solicitacoes FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'atendente'
    AND criado_por = auth.uid()
    AND status = 'pendente'
    OR
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('gestor', 'adm')
  );

-- Política: Apenas Gestores/ADM podem deletar
CREATE POLICY "Apenas gestores deletam solicitações"
  ON solicitacoes FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('gestor', 'adm')
  );

-- ========================================
-- 5. ATUALIZAR POLÍTICA DO HISTÓRICO
-- ========================================

-- Remover política antiga
DROP POLICY IF EXISTS "Usuários autenticados veem histórico" ON solicitacoes_historico;

-- Criar política atualizada
CREATE POLICY "Usuários veem histórico próprio"
  ON solicitacoes_historico FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'atendente' AND
    EXISTS (
      SELECT 1 FROM solicitacoes 
      WHERE solicitacoes.id = solicitacoes_historico.solicitacao_id 
      AND solicitacoes.criado_por = auth.uid()
    )
    OR
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('gestor', 'adm')
  );

-- ========================================
-- VERIFICAÇÃO
-- ========================================

-- Ver estrutura da tabela
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'solicitacoes'
ORDER BY ordinal_position;

-- Ver políticas
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'solicitacoes';

-- =====================================================
-- SUCESSO! Tabela de solicitações criada
-- =====================================================


-- ==========================================
-- MIGRATION: 005_fix_profiles_rls.sql
-- ==========================================

-- Limpar políticas duplicadas e criar uma simples que funciona

-- Remover todas as políticas SELECT existentes
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Usuário vê próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;

-- Criar UMA política SELECT simples
CREATE POLICY "authenticated_users_read_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Verificar
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles';


-- ==========================================
-- MIGRATION: 006_ensure_profiles_rls.sql
-- ==========================================

-- Verificar e garantir que as políticas RLS da tabela profiles estão corretas
-- Esta migração garante que usuários autenticados possam ler perfis

-- 1. Remover políticas SELECT duplicadas ou conflitantes
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Usuário vê próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "authenticated_users_read_profiles" ON profiles;

-- 2. Criar política SELECT simples e funcional
CREATE POLICY "authenticated_users_read_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- 3. Garantir que usuários possam atualizar seu próprio perfil
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Usuário atualiza próprio perfil" ON profiles;

CREATE POLICY "users_update_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Verificar políticas aplicadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;


-- ==========================================
-- MIGRATION: 007_create_pedidos_consolidados_view.sql
-- ==========================================

-- ============================================================================
-- MIGRATION: Business Day Calculation with Holidays
-- Descrição: Implementa cálculo de dias úteis considerando feriados
-- Localização: Indaiatuba/SP
-- ============================================================================

-- ============================================================================
-- TABELA: feriados
-- Armazena feriados nacionais, estaduais (SP) e municipais (Indaiatuba)
-- ============================================================================

CREATE TABLE IF NOT EXISTS feriados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('nacional', 'estadual', 'municipal')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar coluna 'nome' se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feriados' AND column_name = 'nome'
  ) THEN
    ALTER TABLE feriados ADD COLUMN nome TEXT;
  END IF;
END $$;

-- Adicionar coluna 'descricao' se não existir (para compatibilidade)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feriados' AND column_name = 'descricao'
  ) THEN
    ALTER TABLE feriados ADD COLUMN descricao TEXT;
  END IF;
END $$;

-- Preencher valores NULL nas colunas nome e descricao
DO $$
BEGIN
  -- Preencher nome com descricao se nome estiver NULL
  UPDATE feriados SET nome = COALESCE(descricao, 'Feriado') WHERE nome IS NULL;
  
  -- Preencher descricao com nome se descricao estiver NULL
  UPDATE feriados SET descricao = COALESCE(nome, 'Feriado') WHERE descricao IS NULL;
END $$;

-- Índice para busca rápida por data
CREATE INDEX IF NOT EXISTS idx_feriados_data ON feriados(data);

-- Comentário da tabela
COMMENT ON TABLE feriados IS 'Feriados nacionais, estaduais (SP) e municipais (Indaiatuba)';

-- ============================================================================
-- INSERIR FERIADOS DE 2026
-- ============================================================================

INSERT INTO feriados (data, nome, descricao, tipo) VALUES
  -- Nacionais
  ('2026-01-01', 'Ano Novo', 'Confraternização Universal', 'nacional'),
  ('2026-02-16', 'Carnaval', 'Segunda-feira de Carnaval', 'nacional'),
  ('2026-02-17', 'Carnaval', 'Terça-feira de Carnaval', 'nacional'),
  ('2026-04-03', 'Sexta-feira Santa', 'Paixão de Cristo', 'nacional'),
  ('2026-04-21', 'Tiradentes', 'Dia de Tiradentes', 'nacional'),
  ('2026-05-01', 'Dia do Trabalho', 'Dia Mundial do Trabalho', 'nacional'),
  ('2026-06-04', 'Corpus Christi', 'Corpus Christi', 'nacional'),
  ('2026-09-07', 'Independência do Brasil', 'Independência do Brasil', 'nacional'),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'Padroeira do Brasil', 'nacional'),
  ('2026-11-02', 'Finados', 'Dia de Finados', 'nacional'),
  ('2026-11-15', 'Proclamação da República', 'Proclamação da República', 'nacional'),
  ('2026-12-25', 'Natal', 'Natal', 'nacional'),
  
  -- Estaduais (SP)
  ('2026-07-09', 'Revolução Constitucionalista', 'Revolução Constitucionalista de 1932', 'estadual'),
  
  -- Municipais (Indaiatuba)
  ('2026-05-11', 'Aniversário de Indaiatuba', 'Aniversário da cidade de Indaiatuba', 'municipal')
ON CONFLICT (data) DO UPDATE SET 
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  tipo = EXCLUDED.tipo;

-- ============================================================================
-- FUNÇÃO: proximo_dia_util
-- Calcula o próximo dia útil após uma data, pulando fins de semana e feriados
-- ============================================================================

CREATE OR REPLACE FUNCTION proximo_dia_util(data_base DATE)
RETURNS DATE AS $$
DECLARE
  data_resultado DATE := data_base + 1;
  max_iterations INT := 30; -- Proteção contra loop infinito
  iterations INT := 0;
BEGIN
  -- Loop até encontrar um dia útil
  WHILE iterations < max_iterations LOOP
    -- Verificar se é fim de semana (0=Domingo, 6=Sábado)
    IF EXTRACT(DOW FROM data_resultado) NOT IN (0, 6) THEN
      -- Verificar se não é feriado
      IF NOT EXISTS (SELECT 1 FROM feriados WHERE data = data_resultado) THEN
        RETURN data_resultado;
      END IF;
    END IF;
    
    data_resultado := data_resultado + 1;
    iterations := iterations + 1;
  END LOOP;
  
  -- Se chegou aqui, algo deu errado (30 dias sem dia útil?)
  RAISE EXCEPTION 'Não foi possível encontrar próximo dia útil após %', data_base;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comentário da função
COMMENT ON FUNCTION proximo_dia_util(DATE) IS 'Retorna o próximo dia útil após a data fornecida, pulando fins de semana e feriados';

-- ============================================================================
-- VIEW: pedidos_consolidados_v2
-- Consolida pedidos aprovados com cálculo automático de janela de PV
-- Agrupa pedidos por CPF + Data para consolidar Oferta Principal + Bumps + Upsells
-- ============================================================================

-- Dropar VIEW existente para permitir mudanças de schema
DROP VIEW IF EXISTS pedidos_consolidados_v2;

CREATE VIEW pedidos_consolidados_v2 AS
WITH vendas_base AS (
  -- Identifica vendas base (não PV) e calcula sua janela de PV
  SELECT 
    p.*,
    proximo_dia_util(p.data_venda::DATE) as dia_pv,
    proximo_dia_util(proximo_dia_util(p.data_venda::DATE)) as dia_despacho,
    (proximo_dia_util(proximo_dia_util(p.data_venda::DATE))::TIMESTAMP + INTERVAL '8 hours 30 minutes') as corte_pv
  FROM pedidos p
  WHERE p.status = 'Aprovado'
    AND p.nome_produto NOT LIKE '%[Assinatura]%'
    AND p.nome_produto NOT LIKE '%[Afiliação]%'
),
pedidos_com_grupo AS (
  -- Para cada pedido, encontra a venda base à qual ele pertence
  SELECT 
    v1.*,
    -- Procura a PRIMEIRA venda base (mais antiga) do mesmo CPF que tem janela válida
    COALESCE(
      (
        SELECT v2.id
        FROM vendas_base v2
        WHERE v2.cpf_cliente = v1.cpf_cliente
          AND v2.data_venda < v1.data_venda  -- Venda base deve ser ANTERIOR (não mesmo dia)
          AND v1.data_venda <= v2.corte_pv
        ORDER BY v2.data_venda ASC  -- Primeira venda (mais antiga)
        LIMIT 1
      ),
      v1.id  -- Se não encontrar, usa o próprio ID (é uma venda base)
    ) as venda_base_id
  FROM vendas_base v1
),
pedidos_agrupados AS (
  -- Agrupa pedidos pela venda base
  SELECT 
    venda_base_id as id,
    (ARRAY_AGG(cpf_cliente ORDER BY data_venda))[1] as cpf_cliente,
    (ARRAY_AGG(dia_despacho ORDER BY data_venda))[1] as dia_despacho,
    
    -- Dados do pedido principal (primeiro pedido do grupo)
    (ARRAY_AGG(codigo_transacao ORDER BY data_venda))[1] as codigo_transacao,
    (ARRAY_AGG(status ORDER BY data_venda))[1] as status,
    (ARRAY_AGG(nome_produto ORDER BY data_venda))[1] as nome_produto,
    (ARRAY_AGG(nome_oferta ORDER BY data_venda))[1] as nome_oferta,
    SUM(valor_total) as valor_total,
    (ARRAY_AGG(forma_pagamento ORDER BY data_venda))[1] as forma_pagamento,
    (ARRAY_AGG(parcelas ORDER BY data_venda))[1] as parcelas,
    (ARRAY_AGG(nome_cliente ORDER BY data_venda))[1] as nome_cliente,
    (ARRAY_AGG(email_cliente ORDER BY data_venda))[1] as email_cliente,
    (ARRAY_AGG(telefone_cliente ORDER BY data_venda))[1] as telefone_cliente,
    (ARRAY_AGG(cep ORDER BY data_venda))[1] as cep,
    (ARRAY_AGG(rua ORDER BY data_venda))[1] as rua,
    (ARRAY_AGG(numero ORDER BY data_venda))[1] as numero,
    (ARRAY_AGG(complemento ORDER BY data_venda))[1] as complemento,
    (ARRAY_AGG(bairro ORDER BY data_venda))[1] as bairro,
    (ARRAY_AGG(cidade ORDER BY data_venda))[1] as cidade,
    (ARRAY_AGG(estado ORDER BY data_venda))[1] as estado,
    (ARRAY_AGG(data_venda ORDER BY data_venda))[1] as data_venda,
    MIN(created_at) as created_at,
    (ARRAY_AGG(metadata ORDER BY data_venda))[1] as metadata,
    
    -- Consolidação de produtos (Oferta + Bumps + Upsells + PV)
    STRING_AGG(
      DISTINCT COALESCE(
        metadata->'offer'->>'name',
        nome_oferta,
        'Produto'
      ),
      ' + '
      ORDER BY COALESCE(
        metadata->'offer'->>'name',
        nome_oferta,
        'Produto'
      )
    ) as descricao_pacote,
    
    -- Códigos agrupados
    ARRAY_AGG(codigo_transacao ORDER BY data_venda) as codigos_agrupados,
    COUNT(*) as quantidade_pedidos
    
  FROM pedidos_com_grupo
  GROUP BY venda_base_id
)
SELECT 
  pg.id,
  pg.codigo_transacao,
  pg.status,
  pg.nome_produto,
  pg.nome_oferta,
  pg.valor_total,
  pg.forma_pagamento,
  pg.parcelas,
  pg.nome_cliente,
  pg.email_cliente,
  pg.cpf_cliente,
  pg.telefone_cliente,
  pg.cep,
  pg.rua,
  pg.numero,
  pg.complemento,
  pg.bairro,
  pg.cidade,
  pg.estado,
  pg.data_venda,
  pg.created_at,
  pg.metadata,
  pg.descricao_pacote,
  pg.codigos_agrupados,
  pg.quantidade_pedidos,
  
  -- Campos calculados (usando dia_despacho já calculado no CTE)
  proximo_dia_util(pg.data_venda::DATE) as dia_pos_vendas,
  pg.dia_despacho,
  (pg.dia_despacho::TIMESTAMP + INTERVAL '8 hours 30 minutes') as corte_pv,
  
  -- Flag de mesmo endereço (detecção de fraude)
  EXISTS (
    SELECT 1 FROM pedidos p2
    WHERE p2.cep = pg.cep
      AND p2.rua = pg.rua
      AND p2.numero = pg.numero
      AND p2.cpf_cliente != pg.cpf_cliente
      AND p2.status = 'Aprovado'
  ) as mesmo_endereco

FROM pedidos_agrupados pg;

-- Comentário da VIEW
COMMENT ON VIEW pedidos_consolidados_v2 IS 'Consolida automaticamente pedidos aprovados agrupando por CPF e data, com cálculo de janela de pós-vendas considerando dias úteis e feriados';

-- ============================================================================
-- TESTES
-- ============================================================================

-- Teste 1: Próximo dia útil (Segunda → Terça)
-- SELECT proximo_dia_util('2026-01-20'::DATE); -- Deve retornar 2026-01-21

-- Teste 2: Próximo dia útil (Sexta → Segunda)
-- SELECT proximo_dia_util('2026-01-24'::DATE); -- Deve retornar 2026-01-27

-- Teste 3: Próximo dia útil (Quinta → Sexta)
-- SELECT proximo_dia_util('2026-01-22'::DATE); -- Deve retornar 2026-01-23

-- Teste 4: VIEW completa
-- SELECT 
--   codigo_transacao,
--   data_venda::DATE,
--   EXTRACT(DOW FROM data_venda) as dow_venda,
--   dia_pos_vendas,
--   dia_despacho,
--   corte_pv
-- FROM pedidos_consolidados_v2
-- WHERE data_venda BETWEEN '2026-01-20' AND '2026-01-27'
-- ORDER BY data_venda
-- LIMIT 10;


-- ==========================================
-- MIGRATION: 008_preparacao_consolidacao_v3.sql
-- ==========================================

-- ================================================================
-- MIGRATION 008: Preparação para Consolidação V3
-- Descrição: Adiciona colunas e índices necessários para a nova lógica de consolidação
-- Data: 2026-01-27
-- ================================================================

-- ================================================================
-- PARTE 1: ADICIONAR NOVAS COLUNAS
-- ================================================================

-- Coluna para flag de pagamento com 2 cartões
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS pagamento_2_cartoes BOOLEAN DEFAULT FALSE;

-- Coluna para flag de fraude (mesmo endereço, CPFs diferentes)
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS fraude_mesmo_endereco BOOLEAN DEFAULT FALSE;

-- Coluna para status de consolidação (opcional, para rastreamento)
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS status_consolidacao TEXT;

-- ================================================================
-- PARTE 2: CRIAR ÍNDICES PARA PERFORMANCE
-- ================================================================

-- Índice para código de transação (usado em consolidação por família)
CREATE INDEX IF NOT EXISTS idx_pedidos_codigo 
ON pedidos(codigo_transacao);

-- Índice para CPF (usado em consolidação por CPF)
CREATE INDEX IF NOT EXISTS idx_pedidos_cpf 
ON pedidos(cpf_cliente);

-- Índice para email (usado em detecção de 2 cartões)
CREATE INDEX IF NOT EXISTS idx_pedidos_email 
ON pedidos(LOWER(TRIM(email_cliente)));

-- Índice para data de venda (usado em janelas de PV)
CREATE INDEX IF NOT EXISTS idx_pedidos_data 
ON pedidos(data_venda);

-- Índice para nome do produto (usado em filtros e estatísticas)
CREATE INDEX IF NOT EXISTS idx_pedidos_produto 
ON pedidos(nome_produto);

-- Índice para nome da oferta (usado em detecção de OB/US/PV)
CREATE INDEX IF NOT EXISTS idx_pedidos_oferta 
ON pedidos(nome_oferta);

-- Índice composto para endereço (usado em detecção de fraude)
CREATE INDEX IF NOT EXISTS idx_pedidos_endereco 
ON pedidos(cep, cidade, estado, rua, numero);

-- Índice para status (usado em filtros)
CREATE INDEX IF NOT EXISTS idx_pedidos_status 
ON pedidos(status);

-- Índice para flag de fraude (usado em filtros)
CREATE INDEX IF NOT EXISTS idx_pedidos_fraude 
ON pedidos(fraude_mesmo_endereco) 
WHERE fraude_mesmo_endereco = TRUE;

-- ================================================================
-- PARTE 3: POPULAR DADOS HISTÓRICOS
-- ================================================================

-- Atualizar flag de 2 cartões com base em dados existentes
-- (Se o campo forma_pagamento ou metadata contiver informação sobre 2 cartões)
UPDATE pedidos 
SET pagamento_2_cartoes = TRUE
WHERE (
  forma_pagamento ILIKE '%2 cart%'
  OR forma_pagamento ILIKE '%dois cart%'
  OR metadata::text ILIKE '%2 cart%'
  OR metadata::text ILIKE '%dois cart%'
)
AND pagamento_2_cartoes = FALSE;

-- ================================================================
-- PARTE 4: COMENTÁRIOS E DOCUMENTAÇÃO
-- ================================================================

COMMENT ON COLUMN pedidos.pagamento_2_cartoes IS 
'Flag que indica se o pagamento foi feito com 2 cartões diferentes';

COMMENT ON COLUMN pedidos.fraude_mesmo_endereco IS 
'Flag que indica se o pedido tem o mesmo endereço de outro pedido com CPF diferente (possível fraude)';

COMMENT ON COLUMN pedidos.status_consolidacao IS 
'Status de consolidação do pedido (PAI, OB, US, PV, etc.)';

-- ================================================================
-- PARTE 5: VERIFICAÇÃO DE INTEGRIDADE
-- ================================================================

-- Verificar se todas as colunas foram criadas
DO $$
DECLARE
  colunas_faltantes TEXT[] := ARRAY[]::TEXT[];
  col TEXT;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'codigo_transacao',
    'nome_oferta',
    'nome_produto',
    'cpf_cliente',
    'data_venda',
    'email_cliente',
    'cep',
    'cidade',
    'estado',
    'rua',
    'numero',
    'pagamento_2_cartoes',
    'fraude_mesmo_endereco'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'pedidos' 
        AND column_name = col
    ) THEN
      colunas_faltantes := array_append(colunas_faltantes, col);
    END IF;
  END LOOP;
  
  IF array_length(colunas_faltantes, 1) > 0 THEN
    RAISE EXCEPTION 'Faltam colunas obrigatórias na tabela pedidos: %', 
      array_to_string(colunas_faltantes, ', ');
  ELSE
    RAISE NOTICE '✅ Todas as colunas obrigatórias estão presentes!';
  END IF;
END $$;

-- ================================================================
-- FIM DA MIGRATION 008
-- ================================================================


-- ==========================================
-- MIGRATION: 009_funcao_janela_pv.sql
-- ==========================================

-- ================================================================
-- MIGRATION 009: Função de Janela PV Inteligente
-- Descrição: Cria função que calcula janela de Pós-Venda baseada no dia da semana
-- Regra: Quinta/Sexta = +4 dias, Outros dias = +2 dias
-- Data: 2026-01-27
-- ================================================================

-- ================================================================
-- FUNÇÃO: calcular_janela_pv_segura
-- ================================================================

CREATE OR REPLACE FUNCTION calcular_janela_pv_segura(data_pedido TIMESTAMP WITH TIME ZONE)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  dia_semana INTEGER;
  data_limite TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Extrai dia da semana (0=Domingo, 1=Segunda ... 6=Sábado)
  dia_semana := EXTRACT(DOW FROM data_pedido);
  
  data_limite := data_pedido;
  
  -- QUINTA (4) ou SEXTA (5) → +4 dias
  -- Motivo: Fim de semana no meio, precisa de mais tempo
  IF dia_semana = 4 OR dia_semana = 5 THEN
    data_limite := data_pedido + INTERVAL '4 days';
  -- OUTROS DIAS (Seg-Qua, Sab-Dom) → +2 dias
  ELSE
    data_limite := data_pedido + INTERVAL '2 days';
  END IF;
  
  RETURN data_limite;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ================================================================

COMMENT ON FUNCTION calcular_janela_pv_segura(TIMESTAMP WITH TIME ZONE) IS 
'Calcula a janela de Pós-Venda baseada no dia da semana da compra principal.
Quinta/Sexta: +4 dias (para cobrir fim de semana)
Outros dias: +2 dias (janela padrão)
Retorna o timestamp limite para consolidação de PVs.';

-- ================================================================
-- TESTES DA FUNÇÃO
-- ================================================================

-- Teste 1: Quinta-feira (deve retornar +4 dias)
DO $$
DECLARE
  data_teste TIMESTAMP WITH TIME ZONE := '2026-01-22 10:00:00'; -- Quinta
  resultado TIMESTAMP WITH TIME ZONE;
  esperado TIMESTAMP WITH TIME ZONE := '2026-01-26 10:00:00'; -- +4 dias
BEGIN
  resultado := calcular_janela_pv_segura(data_teste);
  
  IF resultado = esperado THEN
    RAISE NOTICE '✅ Teste 1 PASSOU: Quinta-feira → +4 dias';
  ELSE
    RAISE EXCEPTION '❌ Teste 1 FALHOU: Esperado %, Obtido %', esperado, resultado;
  END IF;
END $$;

-- Teste 2: Sexta-feira (deve retornar +4 dias)
DO $$
DECLARE
  data_teste TIMESTAMP WITH TIME ZONE := '2026-01-23 15:00:00'; -- Sexta
  resultado TIMESTAMP WITH TIME ZONE;
  esperado TIMESTAMP WITH TIME ZONE := '2026-01-27 15:00:00'; -- +4 dias
BEGIN
  resultado := calcular_janela_pv_segura(data_teste);
  
  IF resultado = esperado THEN
    RAISE NOTICE '✅ Teste 2 PASSOU: Sexta-feira → +4 dias';
  ELSE
    RAISE EXCEPTION '❌ Teste 2 FALHOU: Esperado %, Obtido %', esperado, resultado;
  END IF;
END $$;

-- Teste 3: Segunda-feira (deve retornar +2 dias)
DO $$
DECLARE
  data_teste TIMESTAMP WITH TIME ZONE := '2026-01-26 09:00:00'; -- Segunda
  resultado TIMESTAMP WITH TIME ZONE;
  esperado TIMESTAMP WITH TIME ZONE := '2026-01-28 09:00:00'; -- +2 dias
BEGIN
  resultado := calcular_janela_pv_segura(data_teste);
  
  IF resultado = esperado THEN
    RAISE NOTICE '✅ Teste 3 PASSOU: Segunda-feira → +2 dias';
  ELSE
    RAISE EXCEPTION '❌ Teste 3 FALHOU: Esperado %, Obtido %', esperado, resultado;
  END IF;
END $$;

-- Teste 4: Quarta-feira (deve retornar +2 dias)
DO $$
DECLARE
  data_teste TIMESTAMP WITH TIME ZONE := '2026-01-21 20:00:00'; -- Quarta
  resultado TIMESTAMP WITH TIME ZONE;
  esperado TIMESTAMP WITH TIME ZONE := '2026-01-23 20:00:00'; -- +2 dias
BEGIN
  resultado := calcular_janela_pv_segura(data_teste);
  
  IF resultado = esperado THEN
    RAISE NOTICE '✅ Teste 4 PASSOU: Quarta-feira → +2 dias';
  ELSE
    RAISE EXCEPTION '❌ Teste 4 FALHOU: Esperado %, Obtido %', esperado, resultado;
  END IF;
END $$;

-- ================================================================
-- QUERY DE VALIDAÇÃO
-- ================================================================

-- Visualizar janelas de PV para pedidos recentes
SELECT 
  data_venda,
  TO_CHAR(data_venda, 'Day') AS dia_semana,
  EXTRACT(DOW FROM data_venda) AS dow,
  calcular_janela_pv_segura(data_venda) AS janela_pv,
  calcular_janela_pv_segura(data_venda) - data_venda AS intervalo,
  CASE 
    WHEN EXTRACT(DOW FROM data_venda) IN (4, 5) THEN '4 dias (Thu/Fri)'
    ELSE '2 dias (outros)'
  END AS regra_aplicada
FROM pedidos
WHERE data_venda >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY data_venda DESC
LIMIT 20;

-- ================================================================
-- FIM DA MIGRATION 009
-- ================================================================


-- ==========================================
-- MIGRATION: 010_create_view_v3.sql
-- ==========================================

-- ================================================================
-- MIGRATION 010: VIEW Pedidos Consolidados V3
-- Descrição: Nova VIEW que replica a lógica do Google Apps Script
-- Inclui: Detecção de fraude, janela PV inteligente, consolidação por família
-- Data: 2026-01-27
-- ================================================================

-- ================================================================
-- CRIAR VIEW PEDIDOS_CONSOLIDADOS_V3
-- Nota: NÃO dropar v2, criar v3 em paralelo para testes
-- ================================================================

CREATE OR REPLACE VIEW pedidos_consolidados_v3 AS

WITH 
-- ================================================================
-- PASSO 1: DETECTAR FRAUDES (MESMO ENDEREÇO, CPFS DIFERENTES)
-- ================================================================
endereco_fraudes AS (
  SELECT 
    LOWER(TRIM(cep)) || '|' || 
    LOWER(TRIM(cidade)) || '|' || 
    LOWER(TRIM(estado)) || '|' || 
    LOWER(TRIM(rua)) || '|' || 
    LOWER(TRIM(numero)) AS chave_endereco,
    COUNT(DISTINCT REGEXP_REPLACE(cpf_cliente, '[^0-9]', '', 'g')) AS qtd_cpfs_distintos
  FROM pedidos
  WHERE cep IS NOT NULL 
    AND cidade IS NOT NULL 
    AND estado IS NOT NULL
    AND cpf_cliente IS NOT NULL
    AND status = 'Aprovado'
  GROUP BY chave_endereco
  HAVING COUNT(DISTINCT REGEXP_REPLACE(cpf_cliente, '[^0-9]', '', 'g')) > 1
),

-- ================================================================
-- PASSO 2: MARCAR PEDIDOS COM FRAUDE
-- ================================================================
pedidos_limpos AS (
  SELECT 
    p.*,
    CASE 
      WHEN ef.chave_endereco IS NOT NULL THEN TRUE 
      ELSE FALSE 
    END AS fraude_endereco_detectada
  FROM pedidos p
  LEFT JOIN endereco_fraudes ef 
    ON (LOWER(TRIM(p.cep)) || '|' || 
        LOWER(TRIM(p.cidade)) || '|' || 
        LOWER(TRIM(p.estado)) || '|' || 
        LOWER(TRIM(p.rua)) || '|' || 
        LOWER(TRIM(p.numero))) = ef.chave_endereco
  WHERE p.status = 'Aprovado'
    AND p.codigo_transacao IS NOT NULL  -- ⭐ Excluir pedidos sem código
    AND p.nome_produto NOT LIKE '%[Assinatura]%'
    AND p.nome_produto NOT LIKE '%[Afiliação]%'
),

-- ================================================================
-- PASSO 3: CALCULAR DATAS ÚTEIS E JANELAS
-- ================================================================
vendas_base AS (
  SELECT 
    p.*,
    proximo_dia_util(p.data_venda::DATE) as dia_pv,
    proximo_dia_util(proximo_dia_util(p.data_venda::DATE)) as dia_despacho,
    (proximo_dia_util(proximo_dia_util(p.data_venda::DATE))::TIMESTAMP + INTERVAL '8 hours 30 minutes') as corte_pv,
    calcular_janela_pv_segura(p.data_venda) as janela_pv_limite
  FROM pedidos_limpos p
  WHERE p.fraude_endereco_detectada = FALSE
),

-- ================================================================
-- PASSO 4: IDENTIFICAR VENDAS PRINCIPAIS E PÓS-VENDAS
-- ================================================================
pedidos_com_grupo AS (
  SELECT 
    v1.*,
    -- Encontra a venda principal para este pedido
    -- Se for um PV, encontra a venda anterior do mesmo CPF dentro da janela
    -- Se não for PV, o pedido é sua própria venda principal
    COALESCE(
      (
        SELECT v2.id
        FROM vendas_base v2
        WHERE v2.cpf_cliente = v1.cpf_cliente
          AND v2.id != v1.id
          -- ⭐ CRÍTICO: PV deve ser ESTRITAMENTE POSTERIOR (> não >=)
          AND v1.data_venda > v2.data_venda
          -- ⭐ CRÍTICO: PV deve estar dentro da janela inteligente
          AND v1.data_venda <= v2.janela_pv_limite
          -- Prioriza a venda mais recente anterior
        ORDER BY v2.data_venda DESC
        LIMIT 1
      ),
      v1.id  -- Se não encontrou venda anterior, é venda principal
    ) as venda_base_id
  FROM vendas_base v1
),

-- ================================================================
-- PASSO 5: AGRUPAMENTO E CONSOLIDAÇÃO
-- ================================================================
pedidos_agrupados AS (
  SELECT 
    venda_base_id as id,
    -- Dados do pedido principal (primeiro da lista)
    (ARRAY_AGG(cpf_cliente ORDER BY data_venda))[1] as cpf_cliente,
    (ARRAY_AGG(dia_despacho ORDER BY data_venda))[1] as dia_despacho,
    (ARRAY_AGG(codigo_transacao ORDER BY data_venda))[1] as codigo_transacao,
    (ARRAY_AGG(status ORDER BY data_venda))[1] as status,
    (ARRAY_AGG(nome_produto ORDER BY data_venda))[1] as nome_produto,
    (ARRAY_AGG(nome_oferta ORDER BY data_venda))[1] as nome_oferta,
    
    -- Valores agregados
    SUM(valor_total) as valor_total,
    
    -- Dados do cliente (do pedido principal)
    (ARRAY_AGG(forma_pagamento ORDER BY data_venda))[1] as forma_pagamento,
    (ARRAY_AGG(parcelas ORDER BY data_venda))[1] as parcelas,
    (ARRAY_AGG(nome_cliente ORDER BY data_venda))[1] as nome_cliente,
    (ARRAY_AGG(email_cliente ORDER BY data_venda))[1] as email_cliente,
    (ARRAY_AGG(telefone_cliente ORDER BY data_venda))[1] as telefone_cliente,
    
    -- Endereço (do pedido principal)
    (ARRAY_AGG(cep ORDER BY data_venda))[1] as cep,
    (ARRAY_AGG(rua ORDER BY data_venda))[1] as rua,
    (ARRAY_AGG(numero ORDER BY data_venda))[1] as numero,
    (ARRAY_AGG(complemento ORDER BY data_venda))[1] as complemento,
    (ARRAY_AGG(bairro ORDER BY data_venda))[1] as bairro,
    (ARRAY_AGG(cidade ORDER BY data_venda))[1] as cidade,
    (ARRAY_AGG(estado ORDER BY data_venda))[1] as estado,
    
    -- Datas
    (ARRAY_AGG(data_venda ORDER BY data_venda))[1] as data_venda,
    MIN(created_at) as created_at,
    
    -- Metadata
    (ARRAY_AGG(metadata ORDER BY data_venda))[1] as metadata,
    
    -- Descrição consolidada do pacote
    STRING_AGG(
      DISTINCT COALESCE(
        metadata->'offer'->>'name',
        nome_oferta,
        'Produto'
      ),
      ' + '
      ORDER BY COALESCE(
        metadata->'offer'->>'name',
        nome_oferta,
        'Produto'
      )
    ) as descricao_pacote,
    
    -- Array de códigos agrupados
    ARRAY_AGG(codigo_transacao ORDER BY data_venda) as codigos_agrupados,
    
    -- Quantidade de pedidos consolidados
    COUNT(*) as quantidade_pedidos,
    
    -- Identificar tipo de produto principal
    CASE 
      WHEN (ARRAY_AGG(nome_produto ORDER BY data_venda))[1] ILIKE '%desejo%' 
        OR (ARRAY_AGG(nome_produto ORDER BY data_venda))[1] ILIKE '%desejo proibido%' 
      THEN 'DP'
      WHEN (ARRAY_AGG(nome_produto ORDER BY data_venda))[1] ILIKE '%forma%' 
        OR (ARRAY_AGG(nome_produto ORDER BY data_venda))[1] ILIKE '%bela forma%' 
      THEN 'BF'
      WHEN (ARRAY_AGG(nome_produto ORDER BY data_venda))[1] ILIKE '%lumi%' 
        OR (ARRAY_AGG(nome_produto ORDER BY data_venda))[1] ILIKE '%bela lumi%' 
      THEN 'BL'
      ELSE 'OUTROS'
    END AS produto_principal,
    
    -- Rastreio e envio (pegar o primeiro valor, todos são iguais no grupo)
    (ARRAY_AGG(data_envio ORDER BY data_venda))[1] as data_envio,
    (ARRAY_AGG(codigo_rastreio ORDER BY data_venda))[1] as codigo_rastreio
    
  FROM pedidos_com_grupo
  GROUP BY venda_base_id
)

-- ================================================================
-- SELEÇÃO FINAL COM CAMPOS CALCULADOS
-- ================================================================
SELECT 
  pg.id,
  pg.codigo_transacao,
  pg.status,
  pg.nome_produto,
  pg.nome_oferta,
  pg.valor_total,
  pg.forma_pagamento,
  pg.parcelas,
  pg.nome_cliente,
  pg.email_cliente,
  pg.cpf_cliente,
  pg.telefone_cliente,
  pg.cep,
  pg.rua,
  pg.numero,
  pg.complemento,
  pg.bairro,
  pg.cidade,
  pg.estado,
  pg.data_venda,
  pg.created_at,
  pg.metadata,
  pg.descricao_pacote,
  pg.codigos_agrupados,
  pg.quantidade_pedidos,
  pg.produto_principal,
  
  -- Campos calculados de datas
  proximo_dia_util(pg.data_venda::DATE) as dia_pos_vendas,
  pg.dia_despacho,
  (pg.dia_despacho::TIMESTAMP + INTERVAL '8 hours 30 minutes') as corte_pv,
  calcular_janela_pv_segura(pg.data_venda) as janela_pv_limite,
  
  -- Rastreio e envio
  pg.data_envio,
  pg.codigo_rastreio,
  
  -- Detecção de fraude (mesmo endereço, CPFs diferentes)
  EXISTS (
    SELECT 1 FROM pedidos p2
    WHERE p2.cep = pg.cep
      AND p2.rua = pg.rua
      AND p2.numero = pg.numero
      AND p2.cpf_cliente != pg.cpf_cliente
      AND p2.status = 'Aprovado'
  ) as mesmo_endereco
  
FROM pedidos_agrupados pg
ORDER BY pg.data_venda DESC;

-- ================================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ================================================================

COMMENT ON VIEW pedidos_consolidados_v3 IS 
'VIEW que consolida pedidos replicando a lógica do Google Apps Script V25.
Inclui:
- Detecção de fraude (mesmo endereço, CPFs diferentes)
- Janela de PV inteligente (Thu/Fri = +4 dias, outros = +2 dias)
- Validação de data PV (estritamente maior que venda principal)
- Consolidação por CPF e janela de tempo
- Cálculo de dias úteis para despacho
Criada em paralelo com v2 para testes e migração gradual.';

-- ================================================================
-- FIM DA MIGRATION 010
-- ================================================================


-- ==========================================
-- MIGRATION: 011_testes_validacao_v3.sql
-- ==========================================

-- ================================================================
-- SCRIPT DE TESTES: Validação da VIEW Pedidos Consolidados V3
-- Descrição: Testes comparativos entre v2 e v3, validação de regras
-- Data: 2026-01-27
-- ================================================================

-- ================================================================
-- TESTE 1: COMPARAÇÃO DE CONTAGENS (V2 vs V3)
-- ================================================================

SELECT 
  'v2' as versao,
  COUNT(*) as pedidos_consolidados,
  SUM(quantidade_pedidos) as total_registros,
  SUM(quantidade_pedidos) - COUNT(*) as registros_consolidados
FROM pedidos_consolidados_v2
WHERE data_venda::DATE BETWEEN '2026-01-23' AND '2026-01-25'

UNION ALL

SELECT 
  'v3' as versao,
  COUNT(*) as pedidos_consolidados,
  SUM(quantidade_pedidos) as total_registros,
  SUM(quantidade_pedidos) - COUNT(*) as registros_consolidados
FROM pedidos_consolidados_v3
WHERE data_venda::DATE BETWEEN '2026-01-23' AND '2026-01-25';

-- ================================================================
-- TESTE 2: VALIDAÇÃO DE JANELA PV (THU/FRI vs OUTROS)
-- ================================================================

SELECT 
  data_venda::DATE as dia,
  TO_CHAR(data_venda, 'Day') AS dia_semana,
  EXTRACT(DOW FROM data_venda) AS dow,
  calcular_janela_pv_segura(data_venda) AS janela_pv,
  calcular_janela_pv_segura(data_venda) - data_venda AS intervalo,
  CASE 
    WHEN EXTRACT(DOW FROM data_venda) IN (4, 5) THEN '4 dias (Thu/Fri)'
    ELSE '2 dias (outros)'
  END AS regra_esperada,
  CASE 
    WHEN EXTRACT(DOW FROM data_venda) IN (4, 5) 
      AND calcular_janela_pv_segura(data_venda) - data_venda = INTERVAL '4 days'
    THEN '✅ CORRETO'
    WHEN EXTRACT(DOW FROM data_venda) NOT IN (4, 5) 
      AND calcular_janela_pv_segura(data_venda) - data_venda = INTERVAL '2 days'
    THEN '✅ CORRETO'
    ELSE '❌ INCORRETO'
  END AS validacao
FROM pedidos
WHERE data_venda >= '2026-01-20'
  AND status = 'Aprovado'
ORDER BY data_venda DESC
LIMIT 20;

-- ================================================================
-- TESTE 3: DETECÇÃO DE FRAUDE (MESMO ENDEREÇO)
-- ================================================================

-- Listar endereços com múltiplos CPFs
SELECT 
  cep,
  rua,
  numero,
  cidade,
  estado,
  COUNT(DISTINCT cpf_cliente) as cpfs_distintos,
  ARRAY_AGG(DISTINCT cpf_cliente ORDER BY cpf_cliente) as cpfs,
  ARRAY_AGG(DISTINCT nome_cliente ORDER BY nome_cliente) as nomes,
  COUNT(*) as total_pedidos
FROM pedidos
WHERE cep IS NOT NULL
  AND status = 'Aprovado'
GROUP BY cep, rua, numero, cidade, estado
HAVING COUNT(DISTINCT cpf_cliente) > 1
ORDER BY total_pedidos DESC
LIMIT 10;

-- ================================================================
-- TESTE 4: VALIDAÇÃO DE DATA PV (> NÃO >=)
-- ================================================================

-- Verificar se há PVs do mesmo dia sendo consolidados (NÃO DEVERIA)
WITH pvs_mesmo_dia AS (
  SELECT 
    p1.id AS pedido_principal,
    p1.data_venda::DATE AS data_principal,
    p2.id AS pedido_pv,
    p2.data_venda::DATE AS data_pv,
    p2.nome_oferta
  FROM pedidos p1
  JOIN pedidos p2 
    ON p2.cpf_cliente = p1.cpf_cliente
    AND p2.id != p1.id
    AND p2.nome_oferta ILIKE '%cc%'
    AND p2.data_venda::DATE = p1.data_venda::DATE  -- MESMO DIA
  WHERE p1.data_venda >= CURRENT_DATE - INTERVAL '30 days'
    AND p1.status = 'Aprovado'
    AND p2.status = 'Aprovado'
)
SELECT 
  COUNT(*) as pvs_mesmo_dia_encontrados,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ CORRETO: Nenhum PV do mesmo dia'
    ELSE '❌ ERRO: ' || COUNT(*) || ' PVs do mesmo dia encontrados'
  END AS validacao
FROM pvs_mesmo_dia;

-- ================================================================
-- TESTE 5: ESTATÍSTICAS POR PRODUTO (DP/BF/BL)
-- ================================================================

SELECT 
  produto_principal,
  COUNT(*) AS total_pedidos,
  SUM(quantidade_pedidos) AS total_registros,
  SUM(quantidade_pedidos) - COUNT(*) AS registros_consolidados,
  ROUND(AVG(valor_total), 2) AS valor_medio,
  SUM(valor_total) AS valor_total_produto
FROM pedidos_consolidados_v3
WHERE data_venda::DATE BETWEEN '2026-01-23' AND '2026-01-25'
GROUP BY produto_principal
ORDER BY produto_principal;

-- ================================================================
-- TESTE 6: COMPARAÇÃO DETALHADA DE UM PEDIDO ESPECÍFICO
-- ================================================================

-- Substituir 'CODIGO_EXEMPLO' por um código real de teste
WITH pedido_v2 AS (
  SELECT 
    'v2' as versao,
    *
  FROM pedidos_consolidados_v2
  WHERE codigo_transacao = 'CODIGO_EXEMPLO'
),
pedido_v3 AS (
  SELECT 
    'v3' as versao,
    *
  FROM pedidos_consolidados_v3
  WHERE codigo_transacao = 'CODIGO_EXEMPLO'
)
SELECT * FROM pedido_v2
UNION ALL
SELECT * FROM pedido_v3;

-- ================================================================
-- TESTE 7: PERFORMANCE (TEMPO DE EXECUÇÃO)
-- ================================================================

-- Medir tempo de execução da VIEW v2
EXPLAIN ANALYZE
SELECT COUNT(*) 
FROM pedidos_consolidados_v2
WHERE data_venda >= CURRENT_DATE - INTERVAL '7 days';

-- Medir tempo de execução da VIEW v3
EXPLAIN ANALYZE
SELECT COUNT(*) 
FROM pedidos_consolidados_v3
WHERE data_venda >= CURRENT_DATE - INTERVAL '7 days';

-- ================================================================
-- TESTE 8: VALIDAÇÃO DE CONSOLIDAÇÃO POR CPF
-- ================================================================

-- Verificar se pedidos do mesmo CPF estão sendo consolidados corretamente
SELECT 
  cpf_cliente,
  COUNT(*) as pedidos_consolidados,
  SUM(quantidade_pedidos) as total_pedidos,
  ARRAY_AGG(codigo_transacao ORDER BY data_venda) as codigos,
  ARRAY_AGG(data_venda::DATE ORDER BY data_venda) as datas,
  MIN(data_venda) as primeira_compra,
  MAX(data_venda) as ultima_compra,
  MAX(data_venda) - MIN(data_venda) as intervalo
FROM pedidos_consolidados_v3
WHERE data_venda >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY cpf_cliente
HAVING COUNT(*) > 1
ORDER BY total_pedidos DESC
LIMIT 10;

-- ================================================================
-- TESTE 9: VERIFICAR PEDIDOS EXCLUÍDOS POR FRAUDE
-- ================================================================

-- Contar pedidos que foram excluídos da consolidação por fraude
WITH pedidos_fraude AS (
  SELECT 
    p.id,
    p.codigo_transacao,
    p.cpf_cliente,
    p.cep,
    p.rua,
    p.numero,
    p.cidade,
    p.estado
  FROM pedidos p
  WHERE EXISTS (
    SELECT 1 FROM pedidos p2
    WHERE p2.cep = p.cep
      AND p2.rua = p.rua
      AND p2.numero = p.numero
      AND p2.cpf_cliente != p.cpf_cliente
      AND p2.status = 'Aprovado'
  )
  AND p.status = 'Aprovado'
  AND p.data_venda >= CURRENT_DATE - INTERVAL '30 days'
)
SELECT 
  COUNT(*) as total_pedidos_fraude,
  COUNT(DISTINCT cpf_cliente) as cpfs_envolvidos,
  COUNT(DISTINCT (cep || '|' || rua || '|' || numero)) as enderecos_suspeitos
FROM pedidos_fraude;

-- ================================================================
-- TESTE 10: RESUMO GERAL DE VALIDAÇÃO
-- ================================================================

SELECT 
  '1. Contagem Total' as teste,
  (SELECT COUNT(*) FROM pedidos_consolidados_v3 
   WHERE data_venda::DATE BETWEEN '2026-01-23' AND '2026-01-25')::TEXT as resultado,
  '106 esperado' as esperado

UNION ALL

SELECT 
  '2. Janela PV Thu/Fri',
  CASE 
    WHEN (SELECT COUNT(*) FROM pedidos 
          WHERE EXTRACT(DOW FROM data_venda) IN (4,5)
          AND calcular_janela_pv_segura(data_venda) - data_venda != INTERVAL '4 days') = 0
    THEN '✅ Todas corretas'
    ELSE '❌ Erro detectado'
  END,
  '✅ Todas corretas'

UNION ALL

SELECT 
  '3. PVs Mesmo Dia',
  CASE 
    WHEN (SELECT COUNT(*) FROM pedidos p1
          JOIN pedidos p2 ON p2.cpf_cliente = p1.cpf_cliente
          AND p2.data_venda::DATE = p1.data_venda::DATE
          AND p2.nome_oferta ILIKE '%cc%') = 0
    THEN '✅ Nenhum encontrado'
    ELSE '❌ Encontrados'
  END,
  '✅ Nenhum encontrado'

UNION ALL

SELECT 
  '4. Detecção Fraude',
  (SELECT COUNT(DISTINCT (cep || rua || numero)) 
   FROM pedidos 
   WHERE EXISTS (
     SELECT 1 FROM pedidos p2
     WHERE p2.cep = pedidos.cep
     AND p2.rua = pedidos.rua
     AND p2.numero = pedidos.numero
     AND p2.cpf_cliente != pedidos.cpf_cliente
   ))::TEXT || ' endereços',
  'Variável';

-- ================================================================
-- FIM DOS TESTES
-- ================================================================


-- ==========================================
-- MIGRATION: 012_protecao_status_aprovado.sql
-- ==========================================

-- ================================================================
-- MIGRATION 012: Proteção de Status Aprovado
-- Descrição: Impede que pedidos aprovados tenham status alterado
-- Data: 2026-01-27
-- ================================================================

-- ================================================================
-- CRIAR TABELA DE HISTÓRICO DE STATUS
-- ================================================================

CREATE TABLE IF NOT EXISTS pedidos_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  codigo_transacao TEXT NOT NULL,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  evento_origem TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida
CREATE INDEX idx_pedidos_status_log_pedido ON pedidos_status_log(pedido_id);
CREATE INDEX idx_pedidos_status_log_codigo ON pedidos_status_log(codigo_transacao);
CREATE INDEX idx_pedidos_status_log_created ON pedidos_status_log(created_at DESC);

-- ================================================================
-- CRIAR FUNÇÃO DE PROTEÇÃO DE STATUS
-- ================================================================

CREATE OR REPLACE FUNCTION proteger_status_aprovado()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o status anterior era "Aprovado" e o novo é diferente
  IF OLD.status = 'Aprovado' AND NEW.status != 'Aprovado' THEN
    
    -- Permitir apenas mudança para "Reembolsado" ou "Cancelado"
    IF NEW.status NOT IN ('Reembolsado', 'Cancelado') THEN
      
      -- Registar tentativa de mudança no log
      INSERT INTO pedidos_status_log (
        pedido_id,
        codigo_transacao,
        status_anterior,
        status_novo,
        evento_origem,
        metadata
      ) VALUES (
        OLD.id,
        OLD.codigo_transacao,
        OLD.status,
        NEW.status,
        'BLOQUEADO',
        jsonb_build_object(
          'tentativa_mudanca', NEW.status,
          'motivo', 'Proteção de status aprovado',
          'timestamp', NOW()
        )
      );
      
      -- Manter o status "Aprovado"
      NEW.status := OLD.status;
      
      RAISE WARNING 'Tentativa de alterar status de Aprovado para % bloqueada para pedido %', 
        NEW.status, OLD.codigo_transacao;
    END IF;
  END IF;
  
  -- Registrar mudança de status bem-sucedida
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO pedidos_status_log (
      pedido_id,
      codigo_transacao,
      status_anterior,
      status_novo,
      metadata
    ) VALUES (
      NEW.id,
      NEW.codigo_transacao,
      OLD.status,
      NEW.status,
      jsonb_build_object(
        'updated_at', NOW()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- CRIAR TRIGGER
-- ================================================================

DROP TRIGGER IF EXISTS trigger_proteger_status_aprovado ON pedidos;

CREATE TRIGGER trigger_proteger_status_aprovado
  BEFORE UPDATE ON pedidos
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION proteger_status_aprovado();

-- ================================================================
-- COMENTÁRIOS
-- ================================================================

COMMENT ON TABLE pedidos_status_log IS 
'Log de mudanças de status dos pedidos. Registra todas as tentativas de mudança, incluindo bloqueadas.';

COMMENT ON FUNCTION proteger_status_aprovado() IS 
'Impede que pedidos com status "Aprovado" sejam alterados para outros status (exceto Reembolsado/Cancelado).';

-- ================================================================
-- FIM DA MIGRATION 012
-- ================================================================


-- ==========================================
-- MIGRATION: 013_add_shipping_tracking.sql
-- ==========================================

-- ================================================================
-- MIGRATION 013: Adicionar Colunas de Rastreio e Envio
-- Descrição: Adiciona colunas para rastrear data de envio e código de rastreio
-- Data: 2026-01-27
-- ================================================================

-- ================================================================
-- ADICIONAR COLUNAS NA TABELA PEDIDOS
-- ================================================================

ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS data_envio TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS codigo_rastreio TEXT;

-- Criar índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_pedidos_data_envio ON pedidos(data_envio) WHERE data_envio IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_codigo_rastreio ON pedidos(codigo_rastreio) WHERE codigo_rastreio IS NOT NULL;

-- ================================================================
-- COMENTÁRIOS
-- ================================================================

COMMENT ON COLUMN pedidos.data_envio IS 
'Data e hora em que o pedido foi enviado/despachado';

COMMENT ON COLUMN pedidos.codigo_rastreio IS 
'Código de rastreio dos Correios ou transportadora';

-- ================================================================
-- MARCAR PVs ÓRFÃOS COMO ENVIADOS (já despachados no dia 26/01)
-- ================================================================

UPDATE pedidos
SET 
  data_envio = '2026-01-26 18:00:00-03',
  codigo_rastreio = 'DESPACHADO_26/01'
WHERE codigo_transacao IN (
  'TOCDFBF22301YZA73YH',
  'TOCE4E932301BTA6IJ'
)
AND data_envio IS NULL;  -- Só atualizar se ainda não foi marcado

-- ================================================================
-- FIM DA MIGRATION 013
-- ================================================================


-- ==========================================
-- MIGRATION: 014_create_estoque_tables.sql
-- ==========================================

-- ================================================================
-- MIGRATION: Sistema de Controle de Estoque
-- Data: 2026-02-01
-- Objetivo: Criar tabelas de estoque com trigger na tabela 'pedidos'
-- ================================================================

-- ================================================================
-- PASSO 1: CRIAR TABELA DE ESTOQUE
-- ================================================================

CREATE TABLE IF NOT EXISTS estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto TEXT NOT NULL UNIQUE,      -- 'DP', 'BF', 'BL'
  nome_produto TEXT NOT NULL,        -- Nome completo
  quantidade_atual INTEGER NOT NULL DEFAULT 0,
  limite_alerta INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para buscas por produto
CREATE INDEX IF NOT EXISTS idx_estoque_produto ON estoque(produto);

-- ================================================================
-- PASSO 2: CRIAR TABELA DE MOVIMENTAÇÕES (HISTÓRICO)
-- ================================================================

CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estoque_id UUID REFERENCES estoque(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  quantidade INTEGER NOT NULL,
  quantidade_anterior INTEGER NOT NULL,
  quantidade_nova INTEGER NOT NULL,
  motivo TEXT,                       -- Motivo/observação
  usuario_id UUID REFERENCES profiles(id),
  pedido_id UUID,                    -- Referência ao pedido (se saída automática)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_movimentacoes_estoque ON estoque_movimentacoes(estoque_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_created ON estoque_movimentacoes(created_at DESC);

-- ================================================================
-- PASSO 3: INSERIR DADOS INICIAIS (100 unidades cada)
-- ================================================================

INSERT INTO estoque (produto, nome_produto, quantidade_atual, limite_alerta) VALUES
  ('DP', 'Desejo Proibido', 100, 150),
  ('BF', 'Bela Forma', 100, 100),
  ('BL', 'Bela Lumi', 100, 100)
ON CONFLICT (produto) DO NOTHING;

-- ================================================================
-- PASSO 4: CRIAR TRIGGER NA TABELA 'pedidos' (TABELA BASE)
-- ================================================================

-- Função que reduz estoque quando status_aprovacao muda para 'Aprovado'
CREATE OR REPLACE FUNCTION reduzir_estoque_on_aprovado()
RETURNS TRIGGER AS $$
DECLARE
  v_produto_prefixo TEXT;
  v_estoque_id UUID;
  v_quantidade_anterior INTEGER;
BEGIN
  -- Verifica se status_aprovacao mudou para 'Aprovado'
  IF (NEW.status_aprovacao = 'Aprovado' OR NEW.status = 'Aprovado') 
     AND (OLD.status_aprovacao IS NULL OR OLD.status_aprovacao != 'Aprovado')
     AND (OLD.status IS NULL OR OLD.status != 'Aprovado') THEN
    
    -- Extrai prefixo do produto (primeiros 2 caracteres de descricao_pacote)
    v_produto_prefixo := UPPER(LEFT(COALESCE(NEW.descricao_pacote, ''), 2));
    
    -- Só processa se for um dos produtos conhecidos
    IF v_produto_prefixo IN ('DP', 'BF', 'BL') THEN
      -- Busca estoque atual
      SELECT id, quantidade_atual INTO v_estoque_id, v_quantidade_anterior
      FROM estoque
      WHERE produto = v_produto_prefixo;
      
      IF v_estoque_id IS NOT NULL THEN
        -- Atualiza quantidade (nunca abaixo de 0)
        UPDATE estoque
        SET quantidade_atual = GREATEST(quantidade_atual - 1, 0),
            updated_at = now()
        WHERE id = v_estoque_id;
        
        -- Registra movimentação
        INSERT INTO estoque_movimentacoes (
          estoque_id, 
          tipo, 
          quantidade, 
          quantidade_anterior, 
          quantidade_nova, 
          motivo,
          pedido_id
        ) VALUES (
          v_estoque_id,
          'saida',
          1,
          v_quantidade_anterior,
          GREATEST(v_quantidade_anterior - 1, 0),
          'Venda aprovada automaticamente',
          NEW.id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_reduzir_estoque ON pedidos;

-- Cria trigger na tabela pedidos
CREATE TRIGGER trigger_reduzir_estoque
AFTER UPDATE ON pedidos
FOR EACH ROW
EXECUTE FUNCTION reduzir_estoque_on_aprovado();

-- ================================================================
-- PASSO 5: HABILITAR RLS (ROW LEVEL SECURITY)
-- ================================================================

ALTER TABLE estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

-- Políticas para estoque
DROP POLICY IF EXISTS "estoque_select_authenticated" ON estoque;
DROP POLICY IF EXISTS "estoque_update_authenticated" ON estoque;

CREATE POLICY "estoque_select_authenticated" ON estoque
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "estoque_update_authenticated" ON estoque
  FOR UPDATE TO authenticated USING (true);

-- Políticas para movimentações
DROP POLICY IF EXISTS "movimentacoes_select_authenticated" ON estoque_movimentacoes;
DROP POLICY IF EXISTS "movimentacoes_insert_authenticated" ON estoque_movimentacoes;

CREATE POLICY "movimentacoes_select_authenticated" ON estoque_movimentacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "movimentacoes_insert_authenticated" ON estoque_movimentacoes
  FOR INSERT TO authenticated WITH CHECK (true);

-- ================================================================
-- PASSO 6: HABILITAR REALTIME
-- ================================================================

-- Adiciona tabela ao Realtime (para atualizações em tempo real no frontend)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'estoque'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE estoque;
  END IF;
END $$;

-- ================================================================
-- VERIFICAÇÃO
-- ================================================================

DO $$
DECLARE
  v_estoque_count INTEGER;
  v_trigger_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_estoque_count FROM estoque;
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_reduzir_estoque'
  ) INTO v_trigger_exists;
  
  RAISE NOTICE '✅ Estoque: % produtos cadastrados', v_estoque_count;
  RAISE NOTICE '✅ Trigger: %', CASE WHEN v_trigger_exists THEN 'Criado com sucesso' ELSE 'NÃO CRIADO!' END;
END $$;

SELECT produto, nome_produto, quantidade_atual, limite_alerta FROM estoque;


-- ==========================================
-- MIGRATION: 015_fix_estoque_trigger.sql
-- ==========================================

-- ================================================================
-- CORREÇÃO: Trigger 'reduzir_estoque_on_aprovado' 
-- Problema: Referencia coluna 'status_aprovacao' que não existe
-- Solução: Usar apenas coluna 'status'
-- ================================================================

-- Recriar a função SEM referência a status_aprovacao
CREATE OR REPLACE FUNCTION reduzir_estoque_on_aprovado()
RETURNS TRIGGER AS $$
DECLARE
  v_produto_prefixo TEXT;
  v_estoque_id UUID;
  v_quantidade_anterior INTEGER;
BEGIN
  -- Verifica se status mudou para 'Aprovado'
  IF NEW.status = 'Aprovado' 
     AND (OLD.status IS NULL OR OLD.status != 'Aprovado') THEN
    
    -- Extrai prefixo do produto (primeiros 2 caracteres de nome_produto)
    v_produto_prefixo := UPPER(LEFT(COALESCE(NEW.nome_produto, ''), 2));
    
    -- Só processa se for um dos produtos conhecidos
    IF v_produto_prefixo IN ('DP', 'BF', 'BL') THEN
      -- Busca estoque atual
      SELECT id, quantidade_atual INTO v_estoque_id, v_quantidade_anterior
      FROM estoque
      WHERE produto = v_produto_prefixo;
      
      IF v_estoque_id IS NOT NULL THEN
        -- Atualiza quantidade (nunca abaixo de 0)
        UPDATE estoque
        SET quantidade_atual = GREATEST(quantidade_atual - 1, 0),
            updated_at = now()
        WHERE id = v_estoque_id;
        
        -- Registra movimentação
        INSERT INTO estoque_movimentacoes (
          estoque_id, 
          tipo, 
          quantidade, 
          quantidade_anterior, 
          quantidade_nova, 
          motivo,
          pedido_id
        ) VALUES (
          v_estoque_id,
          'saida',
          1,
          v_quantidade_anterior,
          GREATEST(v_quantidade_anterior - 1, 0),
          'Baixa automática - Pedido aprovado',
          NEW.id
        );
        
        RAISE NOTICE 'Estoque reduzido para produto %: % -> %', 
          v_produto_prefixo, v_quantidade_anterior, GREATEST(v_quantidade_anterior - 1, 0);
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verificar se o trigger existe e recriá-lo
DROP TRIGGER IF EXISTS trigger_reduzir_estoque_aprovado ON pedidos;

CREATE TRIGGER trigger_reduzir_estoque_aprovado
  AFTER INSERT OR UPDATE OF status ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION reduzir_estoque_on_aprovado();

-- Confirmar
SELECT 'Trigger corrigido com sucesso!' AS resultado;


-- ==========================================
-- MIGRATION: 016_reprocessar_logs.sql
-- ==========================================

-- ================================================================
-- REPROCESSAR LOGS DA TABELA ticto_logs PARA pedidos
-- Este SQL extrai dados dos logs brutos e insere na tabela pedidos
-- Usa UPSERT para não duplicar pedidos existentes
-- ================================================================

-- Função para limpar CPF
CREATE OR REPLACE FUNCTION clean_cpf(cpf_raw TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN regexp_replace(COALESCE(cpf_raw, ''), '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para formatar telefone
CREATE OR REPLACE FUNCTION clean_phone(phone_raw TEXT) RETURNS TEXT AS $$
BEGIN
  IF phone_raw IS NULL OR phone_raw = 'Não informado' THEN
    RETURN NULL;
  END IF;
  RETURN regexp_replace(phone_raw, '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para mapear status
CREATE OR REPLACE FUNCTION map_status(status_raw TEXT) RETURNS TEXT AS $$
BEGIN
  IF status_raw IN ('approved', 'authorized', 'succeeded', 'completed') THEN
    RETURN 'Aprovado';
  ELSIF status_raw IN ('refused', 'denied', 'failed') THEN
    RETURN 'Recusado';
  ELSIF status_raw IN ('pending', 'waiting_payment', 'pix_created') THEN
    RETURN 'Pendente';
  ELSIF status_raw = 'expired' THEN
    RETURN 'Expirado';
  ELSIF status_raw = 'refunded' THEN
    RETURN 'Reembolsado';
  ELSIF status_raw = 'abandoned_cart' THEN
    RETURN 'Carrinho Abandonado';
  ELSE
    RETURN 'Pendente';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Inserir dados faltantes (UPSERT baseado em email + produto + data)
-- Isso evita duplicatas
INSERT INTO pedidos (
  codigo_transacao,
  status,
  nome_produto,
  nome_oferta,
  valor_total,
  forma_pagamento,
  parcelas,
  nome_cliente,
  email_cliente,
  cpf_cliente,
  telefone_cliente,
  cep,
  rua,
  numero,
  complemento,
  bairro,
  cidade,
  estado,
  data_venda,
  metadata,
  created_at
)
SELECT 
  COALESCE(
    (json_completo->>'transaction_hash'),
    (json_completo->'order'->>'hash'),
    ('LOG-' || id)
  ) as codigo_transacao,
  
  map_status(json_completo->>'status') as status,
  
  COALESCE(
    json_completo->>'product_name',
    json_completo->'item'->>'product_name'
  ) as nome_produto,
  
  json_completo->'item'->>'offer_name' as nome_oferta,
  
  CASE 
    WHEN json_completo->'item'->>'amount' IS NOT NULL 
    THEN (json_completo->'item'->>'amount')::numeric / 100
    WHEN json_completo->'order'->>'paid_amount' IS NOT NULL 
    THEN (json_completo->'order'->>'paid_amount')::numeric / 100
    ELSE NULL
  END as valor_total,
  
  COALESCE(json_completo->>'payment_method', 'Não informado') as forma_pagamento,
  
  (json_completo->'order'->>'installments')::integer as parcelas,
  
  COALESCE(
    json_completo->>'name',
    json_completo->'customer'->>'name'
  ) as nome_cliente,
  
  COALESCE(
    json_completo->>'email',
    json_completo->'customer'->>'email'
  ) as email_cliente,
  
  clean_cpf(COALESCE(
    json_completo->>'document',
    json_completo->'customer'->>'cpf'
  )) as cpf_cliente,
  
  clean_phone(COALESCE(
    json_completo->>'phone',
    CONCAT(
      COALESCE(json_completo->'customer'->'phone'->>'ddi', ''),
      COALESCE(json_completo->'customer'->'phone'->>'ddd', ''),
      COALESCE(json_completo->'customer'->'phone'->>'number', '')
    )
  )) as telefone_cliente,
  
  json_completo->'customer'->'address'->>'zip_code' as cep,
  json_completo->'customer'->'address'->>'street' as rua,
  json_completo->'customer'->'address'->>'street_number' as numero,
  json_completo->'customer'->'address'->>'complement' as complemento,
  json_completo->'customer'->'address'->>'neighborhood' as bairro,
  json_completo->'customer'->'address'->>'city' as cidade,
  json_completo->'customer'->'address'->>'state' as estado,
  
  COALESCE(
    (json_completo->>'created_at')::timestamp,
    (json_completo->'order'->>'order_date')::timestamp,
    created_at
  ) as data_venda,
  
  json_completo as metadata,
  
  created_at

FROM ticto_logs
WHERE 
  -- Ignora carrinhos abandonados (opcional - remova esta linha se quiser incluí-los)
  evento != 'abandoned_cart'
  -- Não processa logs que já existem em pedidos (baseado em email + produto + data aproximada)
  AND NOT EXISTS (
    SELECT 1 FROM pedidos p 
    WHERE p.email_cliente = COALESCE(json_completo->>'email', json_completo->'customer'->>'email')
    AND p.nome_produto = COALESCE(json_completo->>'product_name', json_completo->'item'->>'product_name')
    AND DATE(p.data_venda) = DATE(COALESCE(
      (json_completo->>'created_at')::timestamp,
      (json_completo->'order'->>'order_date')::timestamp,
      ticto_logs.created_at
    ))
  )
ON CONFLICT (codigo_transacao) DO UPDATE SET
  status = EXCLUDED.status,
  nome_cliente = COALESCE(EXCLUDED.nome_cliente, pedidos.nome_cliente),
  telefone_cliente = COALESCE(EXCLUDED.telefone_cliente, pedidos.telefone_cliente),
  updated_at = now();

-- Mostrar quantos foram inseridos
SELECT 
  (SELECT count(*) FROM pedidos) as total_pedidos_depois,
  (SELECT count(*) FROM ticto_logs WHERE evento != 'abandoned_cart') as total_logs_processaveis;


-- ==========================================
-- MIGRATION: 017_identify_duplicates.sql
-- ==========================================

-- ================================================================
-- IDENTIFICAR E REMOVER DUPLICATAS DE PEDIDOS
-- Critério: mesmo email_cliente + nome_produto + data_venda (dia)
-- Mantém: o registro mais recente (created_at mais recente)
-- ================================================================

-- PASSO 1: Ver quantas duplicatas existem (APENAS VISUALIZAÇÃO)
WITH duplicatas AS (
    SELECT 
        email_cliente,
        nome_produto,
        DATE(data_venda) as dia_venda,
        COUNT(*) as total,
        array_agg(id ORDER BY created_at DESC) as ids,
        array_agg(codigo_transacao ORDER BY created_at DESC) as codigos,
        array_agg(status ORDER BY created_at DESC) as statuses,
        array_agg(created_at ORDER BY created_at DESC) as datas_criacao
    FROM pedidos
    WHERE email_cliente IS NOT NULL
    GROUP BY email_cliente, nome_produto, DATE(data_venda)
    HAVING COUNT(*) > 1
)
SELECT 
    email_cliente,
    nome_produto,
    dia_venda,
    total as "Qtd Duplicatas",
    codigos[1] as "Código Mantido",
    codigos[2] as "Código Removido",
    statuses[1] as "Status Mantido",
    statuses[2] as "Status Removido"
FROM duplicatas
ORDER BY total DESC
LIMIT 20;

-- ================================================================
-- PASSO 2: Contar total de duplicatas
-- ================================================================
SELECT 
    'Total de grupos com duplicatas' as metrica,
    COUNT(*) as valor
FROM (
    SELECT email_cliente, nome_produto, DATE(data_venda)
    FROM pedidos
    WHERE email_cliente IS NOT NULL
    GROUP BY email_cliente, nome_produto, DATE(data_venda)
    HAVING COUNT(*) > 1
) as grupos

UNION ALL

SELECT 
    'Registros que serão removidos' as metrica,
    (SELECT COUNT(*) FROM pedidos) - (
        SELECT COUNT(*) FROM (
            SELECT DISTINCT ON (email_cliente, nome_produto, DATE(data_venda)) id
            FROM pedidos
            WHERE email_cliente IS NOT NULL
            ORDER BY email_cliente, nome_produto, DATE(data_venda), created_at DESC
        ) as unicos
    ) as valor;


-- ==========================================
-- MIGRATION: 018_remove_duplicates.sql
-- ==========================================

-- ================================================================
-- REMOVER DUPLICATAS DE PEDIDOS
-- ATENÇÃO: Execute APENAS após verificar o script 017_identify_duplicates.sql
-- ================================================================

-- PASSO 1: Criar tabela temporária com IDs a MANTER
CREATE TEMP TABLE ids_para_manter AS
SELECT DISTINCT ON (email_cliente, nome_produto, DATE(data_venda)) 
    id,
    email_cliente,
    nome_produto,
    DATE(data_venda) as dia_venda,
    created_at
FROM pedidos
WHERE email_cliente IS NOT NULL
ORDER BY email_cliente, nome_produto, DATE(data_venda), created_at DESC;

-- PASSO 2: Contar quantos serão deletados
SELECT 
    (SELECT COUNT(*) FROM pedidos) as "Total antes",
    (SELECT COUNT(*) FROM ids_para_manter) as "Total após limpeza",
    (SELECT COUNT(*) FROM pedidos) - (SELECT COUNT(*) FROM ids_para_manter) as "Serão removidos";

-- PASSO 3: Deletar duplicatas (mantém apenas o mais recente de cada grupo)
-- DESCOMENTE AS LINHAS ABAIXO APENAS SE TIVER CERTEZA!

/*
DELETE FROM pedidos
WHERE id NOT IN (SELECT id FROM ids_para_manter)
AND email_cliente IS NOT NULL;
*/

-- PASSO 4: Verificação final
-- SELECT COUNT(*) as "Total final" FROM pedidos;

-- ================================================================
-- ALTERNATIVA: Se preferir manter o registro do WEBHOOK (não do CSV)
-- Use esta query em vez da anterior
-- ================================================================

/*
-- Manter pedidos que NÃO começam com SHEETS- (são do webhook/N8N)
-- e também os do CSV que não tem equivalente no webhook

DELETE FROM pedidos p1
WHERE EXISTS (
    SELECT 1 FROM pedidos p2
    WHERE p2.email_cliente = p1.email_cliente
    AND p2.nome_produto = p1.nome_produto
    AND DATE(p2.data_venda) = DATE(p1.data_venda)
    AND p2.created_at > p1.created_at
    AND p1.id != p2.id
);
*/


-- ==========================================
-- MIGRATION: 019_padronizar_status.sql
-- ==========================================

-- ================================================================
-- ATUALIZAR VIEW PARA ACEITAR MÚLTIPLOS STATUS
-- Problema: VIEW filtra apenas 'Aprovado', mas CSV tem 'Autorizado'
-- Solução: Alterar VIEW para aceitar ambos
-- ================================================================

-- Verificar status atuais
SELECT status, COUNT(*) as quantidade
FROM pedidos
GROUP BY status
ORDER BY quantidade DESC;

-- Atualizar a condição WHERE na VIEW (em todos os lugares que filtra por status)
-- Trocar: WHERE p.status = 'Aprovado'
-- Por:    WHERE p.status IN ('Aprovado', 'Autorizado')

-- ================================================================
-- INSTRUÇÕES MANUAIS:
-- 1. Abra a VIEW pedidos_consolidados_v3 no Supabase (Database > Views)
-- 2. Edite e substitua TODAS as ocorrências de:
--    status = 'Aprovado' 
-- Por:
--    status IN ('Aprovado', 'Autorizado')
--
-- OU execute o SQL abaixo que recria a VIEW com a correção
-- ================================================================

-- ALTERNATIVA: Padronizar os status (mais limpo a longo prazo)
-- Descomente se preferir:

/*
UPDATE pedidos
SET status = 'Aprovado', updated_at = now()
WHERE status = 'Autorizado';
*/

-- Verificar contagem final
SELECT 
    (SELECT COUNT(*) FROM pedidos) as total_pedidos,
    (SELECT COUNT(*) FROM pedidos WHERE status IN ('Aprovado', 'Autorizado')) as pedidos_pagos,
    (SELECT COUNT(*) FROM pedidos_consolidados_v3) as consolidados_v3;


-- ==========================================
-- MIGRATION: 020_update_view_status.sql
-- ==========================================

-- ================================================================
-- ATUALIZAR MATERIALIZED VIEW pedidos_consolidados_v3
-- ================================================================

-- Para MATERIALIZED VIEW, use REFRESH:
REFRESH MATERIALIZED VIEW pedidos_consolidados_v3;

-- Verificar contagem após refresh
SELECT 
    (SELECT COUNT(*) FROM pedidos) as total_pedidos,
    (SELECT COUNT(*) FROM pedidos WHERE status IN ('Aprovado', 'Autorizado')) as pedidos_pagos,
    (SELECT COUNT(*) FROM pedidos_consolidados_v3) as consolidados_v3;


-- ==========================================
-- MIGRATION: 021_limpar_consolidados.sql
-- ==========================================

-- ================================================================
-- RECRIAR MATERIALIZED VIEW pedidos_consolidados_v3
-- Com lógica de consolidação (OB, US, PV, 2 Cartões)
-- SOMENTE status Aprovado/Autorizado
-- ================================================================

-- Dropar a MView atual
DROP MATERIALIZED VIEW IF EXISTS pedidos_consolidados_v3;

-- Criar nova MView com lógica de consolidação
CREATE MATERIALIZED VIEW pedidos_consolidados_v3 AS
WITH 
-- ================================================================
-- 1. PEDIDOS APROVADOS/AUTORIZADOS
-- ================================================================
pedidos_aprovados AS (
  SELECT *,
    -- Normaliza CPF para busca
    REGEXP_REPLACE(COALESCE(cpf_cliente, ''), '[^0-9]', '', 'g') as cpf_limpo,
    -- Normaliza nome da oferta
    UPPER(COALESCE(nome_oferta, '')) as oferta_upper,
    -- Extrai prefixo do produto (DP, BF, BL)
    UPPER(LEFT(COALESCE(nome_produto, ''), 2)) as produto_prefixo,
    -- Data sem hora para comparações
    data_venda::DATE as data_venda_dia
  FROM pedidos
  WHERE status IN ('Aprovado', 'Autorizado')
    AND codigo_transacao IS NOT NULL
),

-- ================================================================
-- 2. IDENTIFICAR ORDER BUMPS (mesmo código + "ORDERBUMP" na oferta)
-- ================================================================
order_bumps AS (
  SELECT codigo_transacao, 
         array_agg(nome_oferta) as ofertas_ob
  FROM pedidos_aprovados
  WHERE oferta_upper LIKE '%ORDERBUMP%' 
     OR oferta_upper LIKE '%ORDER BUMP%'
     OR oferta_upper LIKE '%ORDER_BUMP%'
  GROUP BY codigo_transacao
),

-- ================================================================
-- 3. IDENTIFICAR UPSELLS (mesmo CPF + até +1 dia + "UPSELL")
-- ================================================================
upsells AS (
  SELECT p1.codigo_transacao as codigo_principal,
         array_agg(p2.nome_oferta) as ofertas_us
  FROM pedidos_aprovados p1
  JOIN pedidos_aprovados p2 ON p2.cpf_limpo = p1.cpf_limpo
    AND p2.codigo_transacao != p1.codigo_transacao
    AND p2.data_venda_dia BETWEEN p1.data_venda_dia AND p1.data_venda_dia + INTERVAL '1 day'
    AND (p2.oferta_upper LIKE '%UPSELL%' OR p2.oferta_upper LIKE '%UP SELL%')
  WHERE p1.produto_prefixo IN ('DP', 'DE', 'BF', 'BE', 'BL')
    AND p1.oferta_upper NOT LIKE '%ORDERBUMP%'
    AND p1.oferta_upper NOT LIKE '%UPSELL%'
    AND p1.oferta_upper NOT LIKE '%CC%'
  GROUP BY p1.codigo_transacao
),

-- ================================================================
-- 4. IDENTIFICAR PÓS VENDAS (mesmo CPF + 2 a 4 dias + "CC" na oferta)
-- ================================================================
pos_vendas AS (
  SELECT p1.codigo_transacao as codigo_principal,
         array_agg(p2.nome_oferta) as ofertas_pv,
         array_agg(UPPER(LEFT(p2.nome_produto, 2))) as produtos_pv
  FROM pedidos_aprovados p1
  JOIN pedidos_aprovados p2 ON p2.cpf_limpo = p1.cpf_limpo
    AND p2.codigo_transacao != p1.codigo_transacao
    AND p2.data_venda_dia > p1.data_venda_dia
    AND p2.data_venda_dia <= p1.data_venda_dia + INTERVAL '4 days'
    AND p2.oferta_upper LIKE '%CC%'
  WHERE p1.produto_prefixo IN ('DP', 'DE', 'BF', 'BE', 'BL')
    AND p1.oferta_upper NOT LIKE '%ORDERBUMP%'
    AND p1.oferta_upper NOT LIKE '%UPSELL%'
    AND p1.oferta_upper NOT LIKE '%CC%'
  GROUP BY p1.codigo_transacao
),

-- ================================================================
-- 5. PEDIDOS PRINCIPAIS (não são OB, US nem CC)
-- ================================================================
pedidos_principais AS (
  SELECT p.*
  FROM pedidos_aprovados p
  WHERE p.oferta_upper NOT LIKE '%ORDERBUMP%'
    AND p.oferta_upper NOT LIKE '%ORDER BUMP%'
    AND p.oferta_upper NOT LIKE '%UPSELL%'
    AND p.oferta_upper NOT LIKE '%UP SELL%'
    -- CC pode ser principal se não tiver pedido pai
)

-- ================================================================
-- 6. SELECT FINAL COM CONSOLIDAÇÃO
-- ================================================================
SELECT 
  pp.id,
  pp.codigo_transacao,
  'Aprovado' as status_aprovacao,  -- Padroniza para Aprovado
  pp.nome_produto,
  -- Nome da oferta consolidado
  pp.nome_oferta || 
    COALESCE(' + ' || array_length(ob.ofertas_ob, 1)::TEXT || ' Order Bump', '') ||
    COALESCE(' + ' || array_length(us.ofertas_us, 1)::TEXT || ' UPSELL', '') ||
    COALESCE(' + ' || array_length(pv.ofertas_pv, 1)::TEXT || ' PV', '') as nome_oferta,
  pp.valor_total,
  pp.forma_pagamento,
  pp.parcelas,
  pp.nome_cliente,
  pp.email_cliente as email,
  pp.cpf_cliente as cpf,
  pp.telefone_cliente as telefone,
  pp.cep,
  pp.rua as logradouro,
  pp.numero,
  pp.complemento,
  pp.bairro,
  pp.cidade,
  pp.estado,
  CONCAT_WS(', ', pp.rua, pp.numero, pp.bairro, pp.cidade, pp.estado) as endereco_completo,
  pp.data_venda,
  pp.created_at,
  pp.metadata,
  pp.nome_produto as descricao_pacote,
  -- Códigos agrupados
  ARRAY[pp.codigo_transacao] || 
    COALESCE((SELECT array_agg(codigo_transacao) FROM pedidos_aprovados WHERE cpf_limpo = pp.cpf_limpo AND codigo_transacao != pp.codigo_transacao), ARRAY[]::TEXT[]) as codigos_agrupados,
  1 + COALESCE(array_length(ob.ofertas_ob, 1), 0) + 
      COALESCE(array_length(us.ofertas_us, 1), 0) + 
      COALESCE(array_length(pv.ofertas_pv, 1), 0) as quantidade_pedidos,
  pp.nome_produto as produto_principal,
  -- Calcula dia de despacho (próximo dia útil + 1)
  pp.data_venda::DATE + INTERVAL '2 days' as dia_despacho,
  pp.data_envio,
  pp.codigo_rastreio,
  NULL as status_envio,
  NULL as observacao,
  FALSE as foi_editado,
  pp.metadata->>'customer' as customer,
  pp.metadata->>'shipping' as shipping,
  NULL as dados_entrega,
  NULL as endereco_json,
  pp.updated_at
FROM pedidos_principais pp
LEFT JOIN order_bumps ob ON ob.codigo_transacao = pp.codigo_transacao
LEFT JOIN upsells us ON us.codigo_principal = pp.codigo_transacao
LEFT JOIN pos_vendas pv ON pv.codigo_principal = pp.codigo_transacao
ORDER BY pp.data_venda DESC;

-- Criar índice para performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_consolidados_v3_id ON pedidos_consolidados_v3 (id);
CREATE INDEX IF NOT EXISTS idx_consolidados_v3_codigo ON pedidos_consolidados_v3 (codigo_transacao);
CREATE INDEX IF NOT EXISTS idx_consolidados_v3_email ON pedidos_consolidados_v3 (email);
CREATE INDEX IF NOT EXISTS idx_consolidados_v3_cpf ON pedidos_consolidados_v3 (cpf);

-- Verificar resultado
SELECT 
    COUNT(*) as total_consolidados,
    (SELECT COUNT(*) FROM pedidos WHERE status IN ('Aprovado', 'Autorizado')) as pedidos_aprovados
FROM pedidos_consolidados_v3;


-- ==========================================
-- MIGRATION: 022_criar_tabela_consolidados.sql
-- ==========================================

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


-- ==========================================
-- MIGRATION: 023_stored_procedure_consolidar.sql
-- ==========================================

-- ================================================================
-- STORED PROCEDURE: CONSOLIDAR PEDIDOS (V2)
-- Regras exatas baseadas na documentação do usuário
-- ================================================================

-- ================================================================
-- FUNÇÃO AUXILIAR: Calcular Janela de PV
-- Quinta-feira (4) ou Sexta-feira (5): +4 dias
-- Outros dias: +2 dias
-- ================================================================
CREATE OR REPLACE FUNCTION calcular_janela_pv(data_pedido DATE)
RETURNS DATE AS $$
DECLARE
    dia_semana INTEGER;
BEGIN
    IF data_pedido IS NULL THEN
        RETURN CURRENT_DATE;
    END IF;
    
    -- PostgreSQL: 0=domingo, 1=segunda, ..., 4=quinta, 5=sexta, 6=sábado
    dia_semana := EXTRACT(DOW FROM data_pedido);
    
    IF dia_semana IN (4, 5) THEN  -- Quinta ou Sexta
        RETURN data_pedido + INTERVAL '4 days';
    ELSE
        RETURN data_pedido + INTERVAL '2 days';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- FUNÇÃO AUXILIAR: Normalizar Documento (CPF/CNPJ)
-- Remove caracteres não numéricos e zeros à esquerda
-- ================================================================
CREATE OR REPLACE FUNCTION normalizar_documento(doc_raw TEXT)
RETURNS TEXT AS $$
DECLARE
    doc_limpo TEXT;
BEGIN
    IF doc_raw IS NULL OR doc_raw = '' THEN
        RETURN '';
    END IF;
    -- Remove tudo que não é número
    doc_limpo := REGEXP_REPLACE(doc_raw, '[^0-9]', '', 'g');
    -- Remove zeros à esquerda (converte para integer e volta para text)
    IF doc_limpo = '' THEN
        RETURN '';
    END IF;
    RETURN LTRIM(doc_limpo, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- FUNÇÃO AUXILIAR: Chave de Endereço (para detecção de fraude)
-- ================================================================
CREATE OR REPLACE FUNCTION chave_endereco(cep TEXT, cidade TEXT, estado TEXT, rua TEXT, numero TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(TRIM(COALESCE(cep, ''))) || '|' ||
           LOWER(TRIM(COALESCE(cidade, ''))) || '|' ||
           LOWER(TRIM(COALESCE(estado, ''))) || '|' ||
           LOWER(TRIM(COALESCE(rua, ''))) || '|' ||
           LOWER(TRIM(COALESCE(numero, '')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- FUNÇÃO AUXILIAR: Identificar Sigla do Produto
-- ================================================================
CREATE OR REPLACE FUNCTION sigla_produto(nome_produto TEXT)
RETURNS TEXT AS $$
DECLARE
    produto_upper TEXT;
BEGIN
    produto_upper := UPPER(COALESCE(nome_produto, ''));
    
    IF produto_upper LIKE '%DESEJO PROIBIDO%' OR produto_upper LIKE '%DESEJO%' THEN
        RETURN 'DP';
    ELSIF produto_upper LIKE '%BELA LUMI%' OR produto_upper LIKE '%LUMI%' THEN
        RETURN 'BL';
    ELSIF produto_upper LIKE '%BELA FORMA%' OR produto_upper LIKE '%FORMA%' THEN
        RETURN 'BF';
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- STORED PROCEDURE PRINCIPAL: CONSOLIDAR_PEDIDOS_V2
-- ================================================================
CREATE OR REPLACE FUNCTION consolidar_pedidos()
RETURNS TABLE (
    total_principais INTEGER,
    total_order_bumps INTEGER,
    total_upsells INTEGER,
    total_pos_vendas INTEGER,
    total_dois_cartoes INTEGER,
    total_mesmo_endereco INTEGER
) AS $$
DECLARE
    v_total_principais INTEGER := 0;
    v_total_order_bumps INTEGER := 0;
    v_total_upsells INTEGER := 0;
    v_total_pos_vendas INTEGER := 0;
    v_total_dois_cartoes INTEGER := 0;
    v_total_mesmo_endereco INTEGER := 0;
    
    rec RECORD;
    pedido_pai RECORD;
    
    v_codigos_filhos TEXT[];
    v_order_bumps TEXT[];
    v_upsells TEXT[];
    v_pos_vendas_dp TEXT[];
    v_pos_vendas_bf TEXT[];
    v_pos_vendas_bl TEXT[];
    v_nome_oferta_consolidado TEXT;
    v_quantidade_pedidos INTEGER;
    v_doc_limpo TEXT;
    v_data_limite DATE;
    v_tem_dois_cartoes BOOLEAN;
    v_eh_mesmo_endereco BOOLEAN;
    v_sigla_produto TEXT;
BEGIN
    -- ================================================================
    -- PREPARAÇÃO: Limpar tabela e criar tabela temporária de processados
    -- ================================================================
    DELETE FROM pedidos_consolidados_v3;
    
    CREATE TEMP TABLE IF NOT EXISTS temp_processados (
        codigo_transacao TEXT PRIMARY KEY
    ) ON COMMIT DROP;
    
    DELETE FROM temp_processados;
    
    -- ================================================================
    -- PASSO 1: Identificar Endereços Compartilhados (Fraude)
    -- Mesmo CEP + Cidade + Estado + Rua + Número
    -- MAS com Documento OU Nome diferentes
    -- ================================================================
    CREATE TEMP TABLE IF NOT EXISTS temp_enderecos AS
    SELECT 
        chave_endereco(cep, cidade, estado, rua, numero) as chave_end,
        normalizar_documento(cpf_cliente) as doc_normalizado,
        LOWER(TRIM(COALESCE(nome_cliente, ''))) as nome_lower,
        codigo_transacao
    FROM pedidos
    WHERE status IN ('Aprovado', 'Autorizado')
      AND cep IS NOT NULL AND cep != ''
      AND cidade IS NOT NULL AND cidade != '';
    
    CREATE TEMP TABLE IF NOT EXISTS temp_fraudes AS
    SELECT DISTINCT e1.codigo_transacao
    FROM temp_enderecos e1
    JOIN temp_enderecos e2 ON e1.chave_end = e2.chave_end
    WHERE e1.codigo_transacao != e2.codigo_transacao
      AND (e1.doc_normalizado != e2.doc_normalizado 
           OR e1.nome_lower != e2.nome_lower);
    
    -- ================================================================
    -- PASSO 2: Processar Pedidos Principais
    -- O PAI é o pedido que NÃO tem "ORDERBUMP" ou "UPSELL" na oferta
    -- ================================================================
    FOR pedido_pai IN
        SELECT p.*,
               normalizar_documento(p.cpf_cliente) as doc_limpo,
               UPPER(COALESCE(p.nome_oferta, '')) as oferta_upper,
               sigla_produto(p.nome_produto) as sigla
        FROM pedidos p
        WHERE p.status IN ('Aprovado', 'Autorizado')
          AND p.codigo_transacao IS NOT NULL
          -- Não é Order Bump
          AND UPPER(COALESCE(p.nome_oferta, '')) NOT LIKE '%ORDERBUMP%'
          -- Não é Upsell  
          AND UPPER(COALESCE(p.nome_oferta, '')) NOT LIKE '%UPSELL%'
          AND UPPER(COALESCE(p.nome_oferta, '')) NOT LIKE '%UP SELL%'
          -- É um produto conhecido (DP, BF ou BL)
          AND sigla_produto(p.nome_produto) IS NOT NULL
        ORDER BY p.data_venda ASC
    LOOP
        -- Pular se já foi processado como filho de outro pedido
        IF EXISTS (SELECT 1 FROM temp_processados WHERE codigo_transacao = pedido_pai.codigo_transacao) THEN
            CONTINUE;
        END IF;
        
        -- Inicializar variáveis
        v_codigos_filhos := ARRAY[]::TEXT[];
        v_order_bumps := ARRAY[]::TEXT[];
        v_upsells := ARRAY[]::TEXT[];
        v_pos_vendas_dp := ARRAY[]::TEXT[];
        v_pos_vendas_bf := ARRAY[]::TEXT[];
        v_pos_vendas_bl := ARRAY[]::TEXT[];
        v_quantidade_pedidos := 1;
        v_doc_limpo := pedido_pai.doc_limpo;
        v_tem_dois_cartoes := FALSE;
        
        -- ============================================================
        -- Verificar Endereço Compartilhado (Fraude)
        -- ============================================================
        v_eh_mesmo_endereco := EXISTS (
            SELECT 1 FROM temp_fraudes 
            WHERE codigo_transacao = pedido_pai.codigo_transacao
        );
        
        IF v_eh_mesmo_endereco THEN
            v_total_mesmo_endereco := v_total_mesmo_endereco + 1;
            -- Inserir com status "Mesmo End" (não pula, apenas marca)
            INSERT INTO pedidos_consolidados_v3 (
                id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
                valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
                telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
                endereco_completo, data_venda, created_at, metadata, produto_principal,
                fraude_endereco
            ) VALUES (
                pedido_pai.id, pedido_pai.codigo_transacao, 'Mesmo End', 
                pedido_pai.nome_produto, pedido_pai.nome_oferta,
                pedido_pai.valor_total, pedido_pai.forma_pagamento, pedido_pai.parcelas,
                pedido_pai.nome_cliente, pedido_pai.email_cliente, pedido_pai.cpf_cliente,
                pedido_pai.telefone_cliente, pedido_pai.cep, pedido_pai.rua, pedido_pai.numero,
                pedido_pai.complemento, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado,
                CONCAT_WS(', ', pedido_pai.rua, pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
                pedido_pai.data_venda, pedido_pai.created_at, pedido_pai.metadata,
                pedido_pai.sigla, TRUE
            ) ON CONFLICT (codigo_transacao) DO UPDATE SET 
                status_aprovacao = 'Mesmo End', 
                fraude_endereco = TRUE,
                updated_at = now();
            INSERT INTO temp_processados VALUES (pedido_pai.codigo_transacao) ON CONFLICT DO NOTHING;
            CONTINUE;  -- Não processa OB/US/PV para pedidos "Mesmo End"
        END IF;
        
        -- ============================================================
        -- 3. Buscar ORDER BUMPS (mesmo código + "ORDERBUMP" na oferta)
        -- ============================================================
        FOR rec IN
            SELECT p.codigo_transacao, p.nome_oferta
            FROM pedidos p
            WHERE p.status IN ('Aprovado', 'Autorizado')
              AND p.codigo_transacao != pedido_pai.codigo_transacao
              AND NOT EXISTS (SELECT 1 FROM temp_processados WHERE codigo_transacao = p.codigo_transacao)
              -- Mesmo código base ou metadata codigo_pedido igual
              AND (
                  -- Código começa igual (ex: TOP123 e TOP123-OB)
                  LEFT(p.codigo_transacao, 10) = LEFT(pedido_pai.codigo_transacao, 10)
                  -- Ou mesmo email + mesma data + código parecido
                  OR (p.email_cliente = pedido_pai.email_cliente 
                      AND p.data_venda::DATE = pedido_pai.data_venda::DATE)
              )
              AND UPPER(COALESCE(p.nome_oferta, '')) LIKE '%ORDERBUMP%'
        LOOP
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            v_order_bumps := array_append(v_order_bumps, rec.nome_oferta);
            v_quantidade_pedidos := v_quantidade_pedidos + 1;
            v_total_order_bumps := v_total_order_bumps + 1;
            INSERT INTO temp_processados VALUES (rec.codigo_transacao) ON CONFLICT DO NOTHING;
        END LOOP;
        
        -- ============================================================
        -- 4. Buscar UPSELL por Documento
        -- Mesmo documento + data entre D e D+1 + "UPSELL" ou "UP SELL"
        -- ============================================================
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            FOR rec IN
                SELECT p.codigo_transacao, p.nome_oferta
                FROM pedidos p
                WHERE p.status IN ('Aprovado', 'Autorizado')
                  AND p.codigo_transacao != pedido_pai.codigo_transacao
                  AND NOT EXISTS (SELECT 1 FROM temp_processados WHERE codigo_transacao = p.codigo_transacao)
                  AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
                  -- Data entre D e D+1
                  AND p.data_venda::DATE >= pedido_pai.data_venda::DATE
                  AND p.data_venda::DATE <= pedido_pai.data_venda::DATE + INTERVAL '1 day'
                  -- Oferta contém UPSELL
                  AND (
                      UPPER(COALESCE(p.nome_oferta, '')) LIKE '%UPSELL%'
                      OR UPPER(COALESCE(p.nome_oferta, '')) LIKE '%UP SELL%'
                  )
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_upsells := array_append(v_upsells, rec.nome_oferta);
                v_quantidade_pedidos := v_quantidade_pedidos + 1;
                v_total_upsells := v_total_upsells + 1;
                INSERT INTO temp_processados VALUES (rec.codigo_transacao) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;
        
        -- ============================================================
        -- 5. Detecção de 2 Cartões
        -- Mesmo email + mesma oferta exata
        -- (Coluna Pagamento2Cartoes não existe na tabela, então verificamos duplicatas)
        -- ============================================================
        FOR rec IN
            SELECT p.codigo_transacao
            FROM pedidos p
            WHERE p.status IN ('Aprovado', 'Autorizado')
              AND p.codigo_transacao != pedido_pai.codigo_transacao
              AND NOT EXISTS (SELECT 1 FROM temp_processados WHERE codigo_transacao = p.codigo_transacao)
              AND LOWER(p.email_cliente) = LOWER(pedido_pai.email_cliente)
              AND p.nome_oferta = pedido_pai.nome_oferta
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            v_total_dois_cartoes := v_total_dois_cartoes + 1;
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            INSERT INTO temp_processados VALUES (rec.codigo_transacao) ON CONFLICT DO NOTHING;
        END LOOP;
        
        -- ============================================================
        -- 6. Buscar PÓS VENDAS CC
        -- Mesmo documento + data > D + dentro da janela + "CC" na oferta
        -- ============================================================
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            v_data_limite := calcular_janela_pv(pedido_pai.data_venda::DATE);
            
            FOR rec IN
                SELECT p.codigo_transacao, p.nome_oferta, p.nome_produto,
                       sigla_produto(p.nome_produto) as sigla_pv
                FROM pedidos p
                WHERE p.status IN ('Aprovado', 'Autorizado')
                  AND p.codigo_transacao != pedido_pai.codigo_transacao
                  AND NOT EXISTS (SELECT 1 FROM temp_processados WHERE codigo_transacao = p.codigo_transacao)
                  AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
                  -- Data estritamente posterior
                  AND p.data_venda::DATE > pedido_pai.data_venda::DATE
                  -- Dentro da janela de PV
                  AND p.data_venda::DATE <= v_data_limite
                  -- Oferta contém CC
                  AND UPPER(COALESCE(p.nome_oferta, '')) LIKE '%CC%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_quantidade_pedidos := v_quantidade_pedidos + 1;
                v_total_pos_vendas := v_total_pos_vendas + 1;
                
                -- Agrupar por sigla do produto PV
                IF rec.sigla_pv = 'DP' THEN
                    v_pos_vendas_dp := array_append(v_pos_vendas_dp, rec.nome_oferta);
                ELSIF rec.sigla_pv = 'BF' THEN
                    v_pos_vendas_bf := array_append(v_pos_vendas_bf, rec.nome_oferta);
                ELSIF rec.sigla_pv = 'BL' THEN
                    v_pos_vendas_bl := array_append(v_pos_vendas_bl, rec.nome_oferta);
                END IF;
                
                INSERT INTO temp_processados VALUES (rec.codigo_transacao) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;
        
        -- ============================================================
        -- 7. Montar Nome da Oferta Consolidado
        -- Formato: [Oferta Principal] + Order Bump + UPSELL + [Qtd] [Sigla PV]
        -- ============================================================
        v_nome_oferta_consolidado := pedido_pai.nome_oferta;
        
        IF array_length(v_order_bumps, 1) > 0 THEN
            v_nome_oferta_consolidado := v_nome_oferta_consolidado || ' + Order Bump';
        END IF;
        
        IF array_length(v_upsells, 1) > 0 THEN
            v_nome_oferta_consolidado := v_nome_oferta_consolidado || ' + UPSELL';
        END IF;
        
        IF array_length(v_pos_vendas_dp, 1) > 0 THEN
            v_nome_oferta_consolidado := v_nome_oferta_consolidado || ' + ' || 
                array_length(v_pos_vendas_dp, 1)::TEXT || ' DP';
        END IF;
        
        IF array_length(v_pos_vendas_bf, 1) > 0 THEN
            v_nome_oferta_consolidado := v_nome_oferta_consolidado || ' + ' || 
                array_length(v_pos_vendas_bf, 1)::TEXT || ' BF';
        END IF;
        
        IF array_length(v_pos_vendas_bl, 1) > 0 THEN
            v_nome_oferta_consolidado := v_nome_oferta_consolidado || ' + ' || 
                array_length(v_pos_vendas_bl, 1)::TEXT || ' BL';
        END IF;
        
        -- ============================================================
        -- INSERIR PEDIDO CONSOLIDADO
        -- ============================================================
        INSERT INTO pedidos_consolidados_v3 (
            id,
            codigo_transacao,
            status_aprovacao,
            nome_produto,
            nome_oferta,
            valor_total,
            forma_pagamento,
            parcelas,
            nome_cliente,
            email,
            cpf,
            telefone,
            cep,
            logradouro,
            numero,
            complemento,
            bairro,
            cidade,
            estado,
            endereco_completo,
            data_venda,
            created_at,
            metadata,
            descricao_pacote,
            codigos_agrupados,
            quantidade_pedidos,
            produto_principal,
            dia_despacho,
            data_envio,
            codigo_rastreio,
            order_bumps,
            upsells,
            pos_vendas,
            codigos_filhos,
            tem_dois_cartoes,
            fraude_endereco
        ) VALUES (
            pedido_pai.id,
            pedido_pai.codigo_transacao,
            'Aprovado',
            pedido_pai.nome_produto,
            v_nome_oferta_consolidado,
            pedido_pai.valor_total,
            pedido_pai.forma_pagamento,
            pedido_pai.parcelas,
            pedido_pai.nome_cliente,
            pedido_pai.email_cliente,
            pedido_pai.cpf_cliente,
            pedido_pai.telefone_cliente,
            pedido_pai.cep,
            pedido_pai.rua,
            pedido_pai.numero,
            pedido_pai.complemento,
            pedido_pai.bairro,
            pedido_pai.cidade,
            pedido_pai.estado,
            CONCAT_WS(', ', pedido_pai.rua, pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
            pedido_pai.data_venda,
            pedido_pai.created_at,
            pedido_pai.metadata,
            pedido_pai.nome_produto,
            ARRAY[pedido_pai.codigo_transacao] || v_codigos_filhos,
            v_quantidade_pedidos,
            pedido_pai.sigla,
            (pedido_pai.data_venda::DATE + INTERVAL '2 days')::DATE,
            pedido_pai.data_envio,
            pedido_pai.codigo_rastreio,
            v_order_bumps,
            v_upsells,
            v_pos_vendas_dp || v_pos_vendas_bf || v_pos_vendas_bl,
            v_codigos_filhos,
            v_tem_dois_cartoes,
            FALSE
        )
        ON CONFLICT (codigo_transacao) DO UPDATE SET
            nome_oferta = EXCLUDED.nome_oferta,
            codigos_agrupados = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps = EXCLUDED.order_bumps,
            upsells = EXCLUDED.upsells,
            pos_vendas = EXCLUDED.pos_vendas,
            codigos_filhos = EXCLUDED.codigos_filhos,
            tem_dois_cartoes = EXCLUDED.tem_dois_cartoes,
            updated_at = now();
        
        INSERT INTO temp_processados VALUES (pedido_pai.codigo_transacao) ON CONFLICT DO NOTHING;
        v_total_principais := v_total_principais + 1;
    END LOOP;
    
    -- Limpar tabelas temporárias
    DROP TABLE IF EXISTS temp_enderecos;
    DROP TABLE IF EXISTS temp_fraudes;
    
    -- Retornar estatísticas
    RETURN QUERY SELECT 
        v_total_principais,
        v_total_order_bumps,
        v_total_upsells,
        v_total_pos_vendas,
        v_total_dois_cartoes,
        v_total_mesmo_endereco;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- COMENTÁRIO
-- ================================================================
COMMENT ON FUNCTION consolidar_pedidos() IS 
'Consolida pedidos aplicando todas as regras do Apps Script V27:
- Agrupa Order Bumps (mesmo código + ORDERBUMP)
- Agrupa Upsells (mesmo CPF + D→D+1 + UPSELL)  
- Agrupa PVs CC (mesmo CPF + D+1→janela + CC) com siglas DP/BF/BL
- Detecta 2 Cartões (mesmo email + mesma oferta)
- Exclui endereços compartilhados (fraude)

Executar: SELECT * FROM consolidar_pedidos();';

SELECT 'Stored Procedure consolidar_pedidos() V2 criada!' as resultado;


-- ==========================================
-- MIGRATION: 024_rpc_dashboard_metrics.sql
-- ==========================================

-- ================================================================
-- RPC: DASHBOARD METRICS
-- Calcula todas as métricas do dashboard no servidor
-- Evita puxar 20.000+ registros para o frontend
-- ================================================================

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
    v_status TEXT;
    v_val NUMERIC;
    v_method TEXT;
BEGIN
    -- Processar vendas por status
    FOR rec IN
        SELECT 
            LOWER(TRIM(COALESCE(status, ''))) as status_norm,
            COALESCE(valor_total, 0)::NUMERIC as valor,
            LOWER(TRIM(COALESCE(
                forma_pagamento, 
                metodo_pagamento, 
                ''
            ))) as metodo
        FROM pedidos
        WHERE created_at >= p_start_date
          AND created_at <= p_end_date
    LOOP
        v_status := rec.status_norm;
        v_val := rec.valor;
        v_method := rec.metodo;

        IF v_status IN ('aprovado', 'pago', 'paid', 'approved', 'completed', 'succeeded', 'authorized') THEN
            v_approved := v_approved + v_val;
            v_count_approved := v_count_approved + 1;
        ELSIF v_status IN ('pendente', 'waiting payment', 'aguardando', 'pending', 'waiting_payment', 'processing') THEN
            v_pending := v_pending + v_val;
            v_count_pending := v_count_pending + 1;
            IF v_method LIKE '%pix%' THEN
                v_pending_pix := v_pending_pix + v_val;
            ELSE
                v_pending_other := v_pending_other + v_val;
            END IF;
        ELSIF v_status LIKE '%expirado%' OR v_status LIKE '%expired%' THEN
            v_expired := v_expired + v_val;
            v_count_expired := v_count_expired + 1;
        ELSIF v_status LIKE '%recusado%' OR v_status LIKE '%refused%' OR v_status LIKE '%denied%' OR v_status LIKE '%falha%' OR v_status LIKE '%failed%' THEN
            v_refused := v_refused + v_val;
            v_count_refused := v_count_refused + 1;
        ELSIF v_status LIKE '%reembolsado%' OR v_status LIKE '%refunded%' OR v_status LIKE '%estornado%' THEN
            v_refunded := v_refunded + v_val;
            v_count_refunded := v_count_refunded + 1;
        END IF;
    END LOOP;

    -- Aguardando envio
    SELECT COUNT(*) INTO v_awaiting_shipment
    FROM pedidos_consolidados_v3
    WHERE status_envio = 'Pendente'
      AND created_at >= p_start_date
      AND created_at <= p_end_date;

    -- Assinaturas atrasadas
    SELECT COUNT(*) INTO v_late_subscriptions
    FROM assinaturas
    WHERE (LOWER(status) LIKE '%atrasada%' OR LOWER(status) IN ('late'))
      AND created_at >= p_start_date
      AND created_at <= p_end_date;

    -- Carrinhos abandonados
    SELECT COUNT(*) INTO v_abandoned_carts
    FROM carrinhos_abandonados
    WHERE created_at >= p_start_date
      AND created_at <= p_end_date;

    -- Montar resultado JSON
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

COMMENT ON FUNCTION dashboard_metrics(TIMESTAMPTZ, TIMESTAMPTZ) IS 
'Calcula todas as métricas do dashboard no lado do servidor.
Elimina a necessidade de puxar milhares de registros para o frontend.
Uso: SELECT dashboard_metrics(''2026-01-01''::timestamptz, ''2026-01-31''::timestamptz);';


-- ==========================================
-- MIGRATION: 025_fix_permissions.sql
-- ==========================================

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


-- ==========================================
-- MIGRATION: 026_espelhar_schema_dev.sql
-- ==========================================

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


-- ==========================================
-- MIGRATION: 027_fix_rpc_producao.sql
-- ==========================================

-- ================================================================
-- FIX RPC PARA PRODUÇÃO (cgyxinpejaoadsqrxbhy)
-- Corrige: column "metodo_pagamento" does not exist
-- Execute no SQL Editor do projeto PRODUÇÃO
-- ================================================================

-- A tabela pedidos na produção NÃO tem metodo_pagamento, só forma_pagamento
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
BEGIN
    FOR rec IN
        SELECT 
            LOWER(TRIM(COALESCE(status, ''))) as status_norm,
            COALESCE(valor_total, 0)::NUMERIC as valor,
            LOWER(TRIM(COALESCE(forma_pagamento, ''))) as metodo
        FROM pedidos
        WHERE data_venda >= p_start_date
          AND data_venda <= p_end_date
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

    -- Aguardando envio
    BEGIN
        SELECT COUNT(*) INTO v_awaiting_shipment
        FROM pedidos_consolidados_v3
        WHERE status_envio = 'Pendente'
          AND created_at >= p_start_date AND created_at <= p_end_date;
    EXCEPTION WHEN OTHERS THEN
        v_awaiting_shipment := 0;
    END;

    -- Assinaturas atrasadas (sem filtro de data - tabela pode não ter created_at)
    BEGIN
        SELECT COUNT(*) INTO v_late_subscriptions
        FROM assinaturas
        WHERE LOWER(status) LIKE '%atrasada%' OR LOWER(status) = 'late';
    EXCEPTION WHEN OTHERS THEN
        v_late_subscriptions := 0;
    END;

    -- Carrinhos abandonados (sem filtro de data)
    BEGIN
        SELECT COUNT(*) INTO v_abandoned_carts
        FROM carrinhos_abandonados;
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

-- Também garantir permissões nas tabelas secundárias
GRANT SELECT ON public.assinaturas TO anon, authenticated;
GRANT SELECT ON public.carrinhos_abandonados TO anon, authenticated;
GRANT SELECT ON public.pedidos_consolidados_v3 TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

SELECT 'RPC dashboard_metrics atualizada com sucesso!' as resultado;


-- ==========================================
-- MIGRATION: 028_consolidar_pedidos_v3.sql
-- ==========================================

-- ================================================================
-- STORED PROCEDURE: CONSOLIDAR PEDIDOS (V3 - INCREMENTAL)
-- Baseado nas regras do Script GAS V27
-- ================================================================
-- REGRAS:
-- 1. PAI = pedido aprovado, oferta sem ORDERBUMP/UPSELL/CC
-- 2. ORDER BUMP = mesmo email + mesma data + ORDERBUMP na oferta
-- 3. UPSELL = mesmo CPF + data D→D+1 + UPSELL na oferta
-- 4. 2 CARTÕES = mesmo email + mesma oferta + mesma data
-- 5. PÓS VENDA CC = mesmo CPF + data D+1→janela + CC na oferta
-- 6. MESMO ENDEREÇO = mesmo CEP+rua+número, CPF/nome diferente → flag
-- ================================================================

-- Funções auxiliares (idempotent)
CREATE OR REPLACE FUNCTION calcular_janela_pv(data_pedido DATE)
RETURNS DATE AS $$
BEGIN
    IF data_pedido IS NULL THEN RETURN CURRENT_DATE; END IF;
    IF EXTRACT(DOW FROM data_pedido) IN (4, 5) THEN
        RETURN data_pedido + INTERVAL '4 days';
    END IF;
    RETURN data_pedido + INTERVAL '2 days';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION normalizar_documento(doc_raw TEXT)
RETURNS TEXT AS $$
DECLARE doc_limpo TEXT;
BEGIN
    IF doc_raw IS NULL OR doc_raw = '' THEN RETURN ''; END IF;
    doc_limpo := REGEXP_REPLACE(doc_raw, '[^0-9]', '', 'g');
    IF doc_limpo = '' THEN RETURN ''; END IF;
    RETURN LTRIM(doc_limpo, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION chave_endereco(p_cep TEXT, p_cidade TEXT, p_estado TEXT, p_rua TEXT, p_numero TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(TRIM(COALESCE(p_cep,''))) || '|' ||
           LOWER(TRIM(COALESCE(p_cidade,''))) || '|' ||
           LOWER(TRIM(COALESCE(p_estado,''))) || '|' ||
           LOWER(TRIM(COALESCE(p_rua,''))) || '|' ||
           LOWER(TRIM(COALESCE(p_numero,'')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION sigla_produto(nome TEXT)
RETURNS TEXT AS $$
DECLARE u TEXT;
BEGIN
    u := UPPER(COALESCE(nome, ''));
    IF u LIKE '%DESEJO PROIBIDO%' OR u LIKE '%DESEJO%' THEN RETURN 'DP'; END IF;
    IF u LIKE '%BELA LUMI%' OR u LIKE '%LUMI%' THEN RETURN 'BL'; END IF;
    IF u LIKE '%BELA FORMA%' OR u LIKE '%FORMA%' THEN RETURN 'BF'; END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- PROCEDIMENTO PRINCIPAL (INCREMENTAL)
-- ================================================================
CREATE OR REPLACE FUNCTION consolidar_pedidos()
RETURNS TABLE (
    total_principais INTEGER,
    total_order_bumps INTEGER,
    total_upsells INTEGER,
    total_pos_vendas INTEGER,
    total_dois_cartoes INTEGER,
    total_mesmo_endereco INTEGER
) AS $$
DECLARE
    v_total_principais INTEGER := 0;
    v_total_order_bumps INTEGER := 0;
    v_total_upsells INTEGER := 0;
    v_total_pos_vendas INTEGER := 0;
    v_total_dois_cartoes INTEGER := 0;
    v_total_mesmo_endereco INTEGER := 0;

    pedido_pai RECORD;
    rec RECORD;

    v_codigos_filhos TEXT[];
    v_order_bumps TEXT[];
    v_upsells TEXT[];
    v_pos_vendas TEXT[];
    v_nome_oferta TEXT;
    v_quantidade INTEGER;
    v_doc_limpo TEXT;
    v_data_limite DATE;
    v_tem_dois_cartoes BOOLEAN;
    v_sigla TEXT;
    v_descricao TEXT;
BEGIN
    -- ============================================================
    -- PASSO 0: PRESERVAR REGISTROS COM RASTREIO/EDITADOS
    -- ============================================================
    DROP TABLE IF EXISTS _locked_ids;
    CREATE TEMP TABLE _locked_ids (id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _locked_ids
    SELECT c.id FROM pedidos_consolidados_v3 c
    WHERE c.codigo_rastreio IS NOT NULL
       OR c.foi_editado = TRUE
       OR c.data_envio IS NOT NULL;

    -- Códigos de transação que pertencem a registros locked
    DROP TABLE IF EXISTS _locked_codes;
    CREATE TEMP TABLE _locked_codes (code TEXT PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _locked_codes
    SELECT codigo_transacao FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids)
    ON CONFLICT DO NOTHING;

    INSERT INTO _locked_codes
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids)
    ON CONFLICT DO NOTHING;

    -- Deletar registros NÃO locked (serão re-processados)
    -- Usa LEFT JOIN + IS NULL em vez de NOT IN para evitar bloqueio do Supabase
    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
    ) to_delete
    WHERE c.id = to_delete.id;

    -- IDs de pedidos já consumidos
    DROP TABLE IF EXISTS _processed;
    CREATE TEMP TABLE _processed (pedido_id UUID PRIMARY KEY) ON COMMIT DROP;

    -- Marcar pedidos que pertencem a registros locked
    INSERT INTO _processed
    SELECT p.id FROM pedidos p
    WHERE p.codigo_transacao IN (SELECT code FROM _locked_codes)
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- PASSO 1: DETECTAR ENDEREÇOS COMPARTILHADOS (FRAUDE)
    -- ============================================================
    DROP TABLE IF EXISTS _addr_map;
    CREATE TEMP TABLE _addr_map (
        pedido_id UUID,
        chave TEXT,
        doc TEXT,
        nome TEXT
    ) ON COMMIT DROP;

    INSERT INTO _addr_map
    SELECT p.id,
           chave_endereco(p.cep, p.cidade, p.estado, COALESCE(p.logradouro, p.rua), p.numero),
           normalizar_documento(COALESCE(p.cpf_cliente, p.cpf)),
           LOWER(TRIM(COALESCE(p.nome_cliente, '')))
    FROM pedidos p
    WHERE COALESCE(p.status, p.status_aprovacao) IN ('Aprovado','Autorizado','Pago','Paid','Approved')
      AND p.cep IS NOT NULL AND p.cep != '';

    DROP TABLE IF EXISTS _fraud_ids;
    CREATE TEMP TABLE _fraud_ids (pedido_id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _fraud_ids
    SELECT DISTINCT a1.pedido_id
    FROM _addr_map a1
    JOIN _addr_map a2 ON a1.chave = a2.chave AND a1.pedido_id != a2.pedido_id
    WHERE a1.doc != a2.doc OR a1.nome != a2.nome
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- PASSO 2: PROCESSAR PEDIDOS PRINCIPAIS
    -- ============================================================
    FOR pedido_pai IN
        SELECT p.*,
               normalizar_documento(COALESCE(p.cpf_cliente, p.cpf)) as doc_limpo,
               LOWER(COALESCE(p.email_cliente, p.email, '')) as email_lower,
               UPPER(REPLACE(COALESCE(p.nome_oferta, ''), ' ', '')) as oferta_norm,
               sigla_produto(p.nome_produto) as sigla
        FROM pedidos p
        WHERE COALESCE(p.status, p.status_aprovacao) IN ('Aprovado','Autorizado','Pago','Paid','Approved')
          AND p.codigo_transacao IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
          AND sigla_produto(p.nome_produto) IS NOT NULL
          -- Não é Order Bump, Upsell, nem CC
          AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) NOT LIKE '%ORDERBUMP%'
          AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) NOT LIKE '%UPSELL%'
          AND UPPER(COALESCE(p.nome_oferta,'')) NOT LIKE '%CC%'
        ORDER BY p.data_venda ASC NULLS LAST
    LOOP
        IF EXISTS (SELECT 1 FROM _processed WHERE pedido_id = pedido_pai.id) THEN
            CONTINUE;
        END IF;

        -- Init
        v_codigos_filhos := ARRAY[]::TEXT[];
        v_order_bumps := ARRAY[]::TEXT[];
        v_upsells := ARRAY[]::TEXT[];
        v_pos_vendas := ARRAY[]::TEXT[];
        v_quantidade := 1;
        v_doc_limpo := pedido_pai.doc_limpo;
        v_tem_dois_cartoes := FALSE;
        v_sigla := pedido_pai.sigla;

        -- Marcar como processado
        INSERT INTO _processed VALUES (pedido_pai.id) ON CONFLICT DO NOTHING;

        -- ========================================================
        -- CHECAR FRAUDE DE ENDEREÇO
        -- ========================================================
        IF EXISTS (SELECT 1 FROM _fraud_ids WHERE pedido_id = pedido_pai.id) THEN
            v_total_mesmo_endereco := v_total_mesmo_endereco + 1;
            INSERT INTO pedidos_consolidados_v3 (
                id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
                valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
                telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
                endereco_completo, data_venda, created_at, metadata, produto_principal,
                descricao_pacote, fraude_endereco, status_envio,
                dia_despacho, codigos_agrupados, quantidade_pedidos
            ) VALUES (
                pedido_pai.id, pedido_pai.codigo_transacao, 'Mesmo End',
                pedido_pai.nome_produto, pedido_pai.nome_oferta,
                pedido_pai.valor_total, pedido_pai.forma_pagamento, pedido_pai.parcelas,
                pedido_pai.nome_cliente, COALESCE(pedido_pai.email_cliente,pedido_pai.email),
                COALESCE(pedido_pai.cpf_cliente,pedido_pai.cpf),
                COALESCE(pedido_pai.telefone_cliente,pedido_pai.telefone),
                pedido_pai.cep, COALESCE(pedido_pai.logradouro,pedido_pai.rua),
                pedido_pai.numero, pedido_pai.complemento, pedido_pai.bairro,
                pedido_pai.cidade, pedido_pai.estado,
                CONCAT_WS(', ', COALESCE(pedido_pai.logradouro,pedido_pai.rua), pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
                pedido_pai.data_venda, pedido_pai.created_at, pedido_pai.metadata,
                v_sigla, v_sigla || ' - ' || pedido_pai.nome_oferta,
                TRUE, 'Bloqueado',
                (pedido_pai.data_venda::DATE + INTERVAL '2 days')::DATE,
                ARRAY[pedido_pai.codigo_transacao], 1
            ) ON CONFLICT (codigo_transacao) DO UPDATE SET
                status_aprovacao = 'Mesmo End', fraude_endereco = TRUE, updated_at = now();
            CONTINUE;
        END IF;

        -- ========================================================
        -- 3. ORDER BUMPS (mesmo email + mesma data + ORDERBUMP)
        -- ========================================================
        FOR rec IN
            SELECT p.id, p.codigo_transacao, p.nome_oferta
            FROM pedidos p
            WHERE p.id != pedido_pai.id
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND COALESCE(p.status, p.status_aprovacao) IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(COALESCE(p.email_cliente, p.email, '')) = pedido_pai.email_lower
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
              AND (
                  UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%ORDERBUMP%'
              )
        LOOP
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            v_order_bumps := array_append(v_order_bumps, rec.nome_oferta);
            v_quantidade := v_quantidade + 1;
            v_total_order_bumps := v_total_order_bumps + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- ========================================================
        -- 4. UPSELL POR DOCUMENTO (mesmo CPF + D→D+1 + UPSELL)
        -- ========================================================
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            FOR rec IN
                SELECT p.id, p.codigo_transacao, p.nome_oferta
                FROM pedidos p
                WHERE p.id != pedido_pai.id
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                  AND COALESCE(p.status, p.status_aprovacao) IN ('Aprovado','Autorizado','Pago','Paid','Approved')
                  AND normalizar_documento(COALESCE(p.cpf_cliente, p.cpf)) = v_doc_limpo
                  AND p.data_venda::DATE >= pedido_pai.data_venda::DATE
                  AND p.data_venda::DATE <= pedido_pai.data_venda::DATE + INTERVAL '1 day'
                  AND (
                      UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%UPSELL%'
                  )
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_upsells := array_append(v_upsells, rec.nome_oferta);
                v_quantidade := v_quantidade + 1;
                v_total_upsells := v_total_upsells + 1;
                INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- ========================================================
        -- 5. DOIS CARTÕES (mesmo email + mesma oferta + mesma data)
        -- ========================================================
        FOR rec IN
            SELECT p.id, p.codigo_transacao
            FROM pedidos p
            WHERE p.id != pedido_pai.id
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND COALESCE(p.status, p.status_aprovacao) IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(COALESCE(p.email_cliente, p.email, '')) = pedido_pai.email_lower
              AND pedido_pai.email_lower != ''
              AND TRIM(p.nome_oferta) = TRIM(pedido_pai.nome_oferta)
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            v_total_dois_cartoes := v_total_dois_cartoes + 1;
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- ========================================================
        -- 6. PÓS VENDAS CC (mesmo CPF + D+1→janela + CC na oferta)
        -- ========================================================
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            v_data_limite := calcular_janela_pv(pedido_pai.data_venda::DATE);

            FOR rec IN
                SELECT p.id, p.codigo_transacao, p.nome_oferta, p.nome_produto,
                       sigla_produto(p.nome_produto) as sigla_pv
                FROM pedidos p
                WHERE p.id != pedido_pai.id
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                  AND COALESCE(p.status, p.status_aprovacao) IN ('Aprovado','Autorizado','Pago','Paid','Approved')
                  AND normalizar_documento(COALESCE(p.cpf_cliente, p.cpf)) = v_doc_limpo
                  AND p.data_venda::DATE > pedido_pai.data_venda::DATE
                  AND p.data_venda::DATE <= v_data_limite
                  AND UPPER(COALESCE(p.nome_oferta, '')) LIKE '%CC%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_pos_vendas := array_append(v_pos_vendas, COALESCE(rec.sigla_pv,'') || ':' || rec.nome_oferta);
                v_quantidade := v_quantidade + 1;
                v_total_pos_vendas := v_total_pos_vendas + 1;
                INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- ========================================================
        -- 7. MONTAR NOME DA OFERTA CONSOLIDADO
        -- ========================================================
        v_nome_oferta := pedido_pai.nome_oferta;

        -- Cada OB adiciona " + Order Bump"
        v_nome_oferta := v_nome_oferta || REPEAT(' + Order Bump', COALESCE(array_length(v_order_bumps, 1), 0));

        -- Cada US adiciona " + UPSELL"
        v_nome_oferta := v_nome_oferta || REPEAT(' + UPSELL', COALESCE(array_length(v_upsells, 1), 0));

        -- PVs CC agrupados por sigla
        DECLARE
            v_pv_dp INT := 0; v_pv_bf INT := 0; v_pv_bl INT := 0;
            v_pv_item TEXT;
        BEGIN
            IF v_pos_vendas IS NOT NULL THEN
                FOREACH v_pv_item IN ARRAY v_pos_vendas LOOP
                    IF v_pv_item LIKE 'DP:%' THEN v_pv_dp := v_pv_dp + 1;
                    ELSIF v_pv_item LIKE 'BF:%' THEN v_pv_bf := v_pv_bf + 1;
                    ELSIF v_pv_item LIKE 'BL:%' THEN v_pv_bl := v_pv_bl + 1;
                    END IF;
                END LOOP;
            END IF;
            IF v_pv_dp > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_dp || ' DP'; END IF;
            IF v_pv_bf > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bf || ' BF'; END IF;
            IF v_pv_bl > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bl || ' BL'; END IF;
        END;

        -- descricao_pacote = sigla + sufixo (para filtro de etiquetas)
        v_descricao := v_sigla || ' - ' || v_nome_oferta;

        -- ========================================================
        -- INSERIR REGISTRO CONSOLIDADO
        -- ========================================================
        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
            valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
            telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
            endereco_completo, data_venda, created_at, metadata,
            descricao_pacote, codigos_agrupados, quantidade_pedidos, produto_principal,
            dia_despacho, status_envio,
            order_bumps, upsells, pos_vendas, codigos_filhos,
            tem_dois_cartoes, fraude_endereco
        ) VALUES (
            pedido_pai.id,
            pedido_pai.codigo_transacao,
            CASE
                WHEN v_tem_dois_cartoes THEN '2 Cartões'
                ELSE 'Aprovado'
            END,
            pedido_pai.nome_produto,
            v_nome_oferta,
            pedido_pai.valor_total,
            pedido_pai.forma_pagamento,
            pedido_pai.parcelas,
            pedido_pai.nome_cliente,
            COALESCE(pedido_pai.email_cliente, pedido_pai.email),
            COALESCE(pedido_pai.cpf_cliente, pedido_pai.cpf),
            COALESCE(pedido_pai.telefone_cliente, pedido_pai.telefone),
            pedido_pai.cep,
            COALESCE(pedido_pai.logradouro, pedido_pai.rua),
            pedido_pai.numero,
            pedido_pai.complemento,
            pedido_pai.bairro,
            pedido_pai.cidade,
            pedido_pai.estado,
            CONCAT_WS(', ', COALESCE(pedido_pai.logradouro,pedido_pai.rua), pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
            pedido_pai.data_venda,
            pedido_pai.created_at,
            pedido_pai.metadata,
            v_descricao,
            ARRAY[pedido_pai.codigo_transacao] || v_codigos_filhos,
            v_quantidade,
            v_sigla,
            (pedido_pai.data_venda::DATE + INTERVAL '2 days')::DATE,
            'Pendente',
            v_order_bumps,
            v_upsells,
            v_pos_vendas,
            v_codigos_filhos,
            v_tem_dois_cartoes,
            FALSE
        ) ON CONFLICT (codigo_transacao) DO UPDATE SET
            nome_oferta = EXCLUDED.nome_oferta,
            descricao_pacote = EXCLUDED.descricao_pacote,
            codigos_agrupados = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps = EXCLUDED.order_bumps,
            upsells = EXCLUDED.upsells,
            pos_vendas = EXCLUDED.pos_vendas,
            codigos_filhos = EXCLUDED.codigos_filhos,
            tem_dois_cartoes = EXCLUDED.tem_dois_cartoes,
            updated_at = now();

        v_total_principais := v_total_principais + 1;
    END LOOP;

    -- Cleanup
    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;
    DROP TABLE IF EXISTS _addr_map;
    DROP TABLE IF EXISTS _fraud_ids;

    RETURN QUERY SELECT
        v_total_principais,
        v_total_order_bumps,
        v_total_upsells,
        v_total_pos_vendas,
        v_total_dois_cartoes,
        v_total_mesmo_endereco;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissões
GRANT EXECUTE ON FUNCTION consolidar_pedidos() TO anon, authenticated, service_role;

-- Garantir INSERT/UPDATE/DELETE no pedidos_consolidados_v3
GRANT SELECT, INSERT, UPDATE, DELETE ON pedidos_consolidados_v3 TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
SELECT 'consolidar_pedidos() V3 INCREMENTAL criada!' as resultado;


-- ==========================================
-- MIGRATION: 029_fix_consolidados_rls.sql
-- ==========================================

-- ================================================================
-- FIX: RLS policies faltantes para pedidos_consolidados_v3
-- Execute no SQL Editor do Supabase Produção
-- ================================================================

-- INSERT policy (necessário para consolidar_pedidos e operações do front)
DROP POLICY IF EXISTS "Insert autenticado consolidados" ON pedidos_consolidados_v3;
CREATE POLICY "Insert autenticado consolidados" ON pedidos_consolidados_v3
    FOR INSERT WITH CHECK (true);

-- DELETE policy (necessário para re-processamento incremental)
DROP POLICY IF EXISTS "Delete autenticado consolidados" ON pedidos_consolidados_v3;
CREATE POLICY "Delete autenticado consolidados" ON pedidos_consolidados_v3
    FOR DELETE USING (true);

-- Garantir que service_role e anon têm permissões DML
GRANT SELECT, INSERT, UPDATE, DELETE ON pedidos_consolidados_v3 TO anon, authenticated, service_role;

-- Índice extra para performance do dia_despacho (filtro mais usado na Logística)
CREATE INDEX IF NOT EXISTS idx_consolidados_dia_despacho ON pedidos_consolidados_v3 (dia_despacho);
CREATE INDEX IF NOT EXISTS idx_consolidados_status_envio ON pedidos_consolidados_v3 (status_envio);

NOTIFY pgrst, 'reload schema';
SELECT 'RLS e índices fix aplicados!' as resultado;


-- ==========================================
-- MIGRATION: 030_criar_ticto_pedidos.sql
-- ==========================================

-- ================================================================
-- MIGRATION 030: Criar tabela ticto_pedidos
-- Objetivo: Armazenar TODOS os dados do webhook Ticto
-- Deduplicação: UNIQUE em transaction_hash (UPSERT)
-- Execute no SQL Editor do Supabase Produção
-- ================================================================

-- ============================================================
-- ETAPA 1: CRIAR TABELA PRINCIPAL
-- ============================================================

DROP TABLE IF EXISTS ticto_pedidos CASCADE;

CREATE TABLE ticto_pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ── Identificação do Pedido ──────────────────────────────
    transaction_hash TEXT UNIQUE NOT NULL,
    order_id INTEGER,
    order_hash TEXT,

    -- ── Status ───────────────────────────────────────────────
    status TEXT NOT NULL DEFAULT 'authorized',
    status_date TIMESTAMPTZ,
    commission_type TEXT,

    -- ── Pagamento ────────────────────────────────────────────
    payment_method TEXT,
    paid_amount NUMERIC(10,2),
    installments INTEGER DEFAULT 1,
    shipping_amount NUMERIC(10,2) DEFAULT 0,
    shipping_type TEXT,
    shipping_method TEXT,
    shipping_delivery_days INTEGER,
    marketplace_commission NUMERIC(10,2) DEFAULT 0,

    -- ── Produto / Oferta ─────────────────────────────────────
    product_name TEXT,
    product_id INTEGER,
    offer_name TEXT,
    offer_id INTEGER,
    offer_code TEXT,
    offer_price NUMERIC(10,2),
    is_subscription BOOLEAN DEFAULT FALSE,
    offer_interval TEXT,
    offer_trial_days INTEGER,
    offer_first_charge_price NUMERIC(10,2),
    item_quantity INTEGER DEFAULT 1,
    item_amount NUMERIC(10,2),
    coupon_id TEXT,
    coupon_name TEXT,
    coupon_value TEXT,
    refund_deadline INTEGER,

    -- ── Cliente ──────────────────────────────────────────────
    customer_name TEXT,
    customer_email TEXT,
    customer_cpf TEXT,
    customer_cnpj TEXT,
    customer_code TEXT,
    customer_phone TEXT,
    customer_type TEXT DEFAULT 'person',
    customer_is_foreign BOOLEAN DEFAULT FALSE,
    customer_language TEXT DEFAULT 'pt-BR',

    -- ── Endereço ─────────────────────────────────────────────
    address_street TEXT,
    address_number TEXT,
    address_neighborhood TEXT,
    address_city TEXT,
    address_state TEXT,
    address_zip_code TEXT,
    address_country TEXT DEFAULT 'Brasil',

    -- ── Comissões (JSONB para flexibilidade) ─────────────────
    producer JSONB,
    affiliates JSONB DEFAULT '[]'::jsonb,
    coproducers JSONB DEFAULT '[]'::jsonb,
    owner_commissions JSONB DEFAULT '[]'::jsonb,

    -- ── Tracking / UTM ───────────────────────────────────────
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    src TEXT,
    sck TEXT,
    checkout_url TEXT,

    -- ── Meta ─────────────────────────────────────────────────
    webhook_version TEXT DEFAULT '2.0',
    token TEXT,
    query_params JSONB,
    tracking JSONB,
    transaction_pix_qr_code TEXT,
    transaction_pix_url TEXT,
    transaction_bank_slip_code TEXT,
    transaction_bank_slip_url TEXT,

    -- ── Endereço extras ──────────────────────────────────────
    address_complement TEXT,

    -- ── Datas ────────────────────────────────────────────────
    order_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- ── Backup integral do payload ───────────────────────────
    payload_completo JSONB
);

-- ============================================================
-- ETAPA 2: ÍNDICES PARA PERFORMANCE
-- ============================================================

-- Busca por status (dashboard principal)
CREATE INDEX idx_ticto_pedidos_status ON ticto_pedidos (status);

-- Busca por data (filtros de período)
CREATE INDEX idx_ticto_pedidos_order_date ON ticto_pedidos (order_date);
CREATE INDEX idx_ticto_pedidos_created ON ticto_pedidos (created_at);

-- Busca por cliente (página de clientes)
CREATE INDEX idx_ticto_pedidos_email ON ticto_pedidos (customer_email);
CREATE INDEX idx_ticto_pedidos_cpf ON ticto_pedidos (customer_cpf);
CREATE INDEX idx_ticto_pedidos_phone ON ticto_pedidos (customer_phone);

-- Busca por produto (relatórios por produto)
CREATE INDEX idx_ticto_pedidos_product ON ticto_pedidos (product_name);
CREATE INDEX idx_ticto_pedidos_product_id ON ticto_pedidos (product_id);

-- Busca por forma de pagamento (dashboard financeiro)
CREATE INDEX idx_ticto_pedidos_payment ON ticto_pedidos (payment_method);

-- Busca por oferta (análise de ofertas)
CREATE INDEX idx_ticto_pedidos_offer_code ON ticto_pedidos (offer_code);

-- Busca por order_hash (vinculação com consolidados)
CREATE INDEX idx_ticto_pedidos_order_hash ON ticto_pedidos (order_hash);

-- GIN index para queries em comissões JSONB
CREATE INDEX idx_ticto_pedidos_producer_gin ON ticto_pedidos USING GIN (producer);
CREATE INDEX idx_ticto_pedidos_affiliates_gin ON ticto_pedidos USING GIN (affiliates);

-- Índice composto para dashboard: status + data (query mais comum)
CREATE INDEX idx_ticto_pedidos_status_date ON ticto_pedidos (status, order_date);

-- ============================================================
-- ETAPA 3: TRIGGER PARA updated_at AUTOMÁTICO
-- ============================================================

CREATE OR REPLACE FUNCTION update_ticto_pedidos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticto_pedidos_updated_at
    BEFORE UPDATE ON ticto_pedidos
    FOR EACH ROW
    EXECUTE FUNCTION update_ticto_pedidos_updated_at();

-- ============================================================
-- ETAPA 4: RLS + POLICIES
-- ============================================================

ALTER TABLE ticto_pedidos ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer autenticado pode ler
CREATE POLICY "select_all_ticto_pedidos" ON ticto_pedidos
    FOR SELECT USING (true);

-- INSERT: service_role e autenticados (Edge Function usa service_role)
CREATE POLICY "insert_ticto_pedidos" ON ticto_pedidos
    FOR INSERT WITH CHECK (true);

-- UPDATE: service_role e autenticados
CREATE POLICY "update_ticto_pedidos" ON ticto_pedidos
    FOR UPDATE USING (true) WITH CHECK (true);

-- DELETE: apenas service_role (proteção contra exclusão acidental)
CREATE POLICY "delete_ticto_pedidos" ON ticto_pedidos
    FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- ETAPA 5: GRANT PERMISSÕES
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON ticto_pedidos TO anon, authenticated;
GRANT ALL ON ticto_pedidos TO service_role;

-- ============================================================
-- ETAPA 6: COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE ticto_pedidos IS 'Registro completo de todos os webhooks recebidos da Ticto. 1 webhook = 1 registro. Deduplicação por transaction_hash via UPSERT.';
COMMENT ON COLUMN ticto_pedidos.transaction_hash IS 'Identificador único da transação Ticto. Usado como chave de deduplicação.';
COMMENT ON COLUMN ticto_pedidos.paid_amount IS 'Valor pago em REAIS (já convertido de centavos).';
COMMENT ON COLUMN ticto_pedidos.payload_completo IS 'Backup integral do payload JSON recebido no webhook, sem transformação.';
COMMENT ON COLUMN ticto_pedidos.producer IS 'Dados do produtor: {id, name, email, phone, amount, cms, document}';
COMMENT ON COLUMN ticto_pedidos.affiliates IS 'Array de afiliados: [{id, name, email, phone, amount, cms, document, pid}]';
COMMENT ON COLUMN ticto_pedidos.coproducers IS 'Array de coprodutores: [{id, name, email, phone, amount, cms, document}]';

-- ============================================================
-- ETAPA 7: RELOAD + VERIFICAÇÃO
-- ============================================================

NOTIFY pgrst, 'reload schema';

SELECT 'Tabela ticto_pedidos criada com sucesso!' as resultado;

-- Verificar estrutura
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ticto_pedidos'
  AND table_schema = 'public'
ORDER BY ordinal_position;


-- ==========================================
-- MIGRATION: 031_consolidar_ticto.sql
-- ==========================================

-- ================================================================
-- MIGRATION 031: Consolidação baseada na tabela 'ticto_pedidos'
-- Objetivo: Migrar lógica de 'pedidos' para 'ticto_pedidos'
-- Agendamento: pg_cron Seg-Sex às 08:30 BRT (11:30 UTC)
-- Notificações: Tabela e Trigger para pós-vendas atrasados
-- Proteção: Não roda em feriados cadastrados na tabela 'feriados'
-- Retorno: JSONB com status da execução
-- ================================================================

-- 1. Habilitar extensão pg_cron (se possível via Dashboard)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Tabela de Notificações
CREATE TABLE IF NOT EXISTS notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL, -- 'atraso_pv', 'fraude', etc.
    mensagem TEXT NOT NULL,
    lida BOOLEAN DEFAULT FALSE,
    dados JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ativar RLS para notificações
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total a autenticados" ON notificacoes;
CREATE POLICY "Acesso total a autenticados" ON notificacoes FOR ALL TO authenticated USING (true);


-- ================================================================
-- 3. PROCEDURE: CONSOLIDAR PEDIDOS (V4 - TICTO SOURCE)
-- ================================================================
CREATE OR REPLACE FUNCTION consolidar_pedidos_ticto()
RETURNS jsonb AS $$
DECLARE
    -- Variáveis de controle
    v_total_principais INTEGER := 0;
    
    pedido_pai RECORD;
    rec RECORD;
    
    v_codigos_filhos TEXT[];
    v_order_bumps TEXT[];
    v_upsells TEXT[];
    v_pos_vendas TEXT[];
    v_nome_oferta TEXT;
    v_quantidade INTEGER;
    v_doc_limpo TEXT;
    v_data_limite DATE;
    v_tem_dois_cartoes BOOLEAN;
    v_sigla TEXT;
    v_descricao TEXT;
    
    -- Variáveis de data
    v_hoje DATE;
    v_nome_feriado TEXT;
    v_dia_pv DATE;
    v_dia_despacho DATE;
BEGIN
    -- ============================================================
    -- PRE-CHECK: FERIADOS (Proteção)
    -- ============================================================
    -- Garantir data correta no fuso Brasil (UTC-3)
    v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

    -- Se hoje for feriado, abortar execução
    SELECT nome INTO v_nome_feriado FROM feriados WHERE data = v_hoje;
    
    IF v_nome_feriado IS NOT NULL THEN
        RETURN jsonb_build_object(
            'status', 'skipped',
            'message', 'Feriado: ' || v_nome_feriado,
            'details', jsonb_build_object('data', v_hoje, 'motivo', 'Tabela de Feriados')
        );
    END IF;

    -- ============================================================
    -- LÓGICA DE CONSOLIDAÇÃO (Segue fluxo normal)
    -- ============================================================

    -- Limpar tabelas temporárias antigas se existirem
    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;

    -- PASSO 0: PRESERVAR REGISTROS LOCKED (JÁ DESPACHADOS)
    CREATE TEMP TABLE _locked_ids AS
    SELECT id FROM pedidos_consolidados_v3
    WHERE codigo_rastreio IS NOT NULL
       OR foi_editado = TRUE
       OR data_envio IS NOT NULL;

    CREATE TEMP TABLE _locked_codes AS
    SELECT codigo_transacao FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids)
    UNION
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids);

    -- Remover registros consolidados que NÃO estão travados (para reprocessar)
    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
    ) to_delete
    WHERE c.id = to_delete.id;

    -- Tabela de hashes processados nesta execução
    CREATE TEMP TABLE _processed (hash TEXT PRIMARY KEY);
    
    -- Marcar hashes travados como já processados
    INSERT INTO _processed (hash)
    SELECT codigo_transacao FROM _locked_codes;

    -- PASSO 1: ITERAR SOBRE PEDIDOS "PAI" (Novos na ticto_pedidos)
    FOR pedido_pai IN
        SELECT 
            p.*,
            -- Normalizações
            REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') as doc_limpo,
            LOWER(COALESCE(p.customer_email, '')) as email_lower,
            UPPER(REPLACE(COALESCE(p.offer_name, ''), ' ', '')) as oferta_norm,
            -- Cálculo de Sigla (Regra do Produto)
            CASE 
                WHEN UPPER(p.product_name) LIKE '%DESEJO%' THEN 'DP'
                WHEN UPPER(p.product_name) LIKE '%LUMI%' THEN 'BL'
                WHEN UPPER(p.product_name) LIKE '%FORMA%' THEN 'BF'
                ELSE NULL
            END as sigla
        FROM ticto_pedidos p
        WHERE p.status IN ('authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago')
          -- Não processar se já foi (locked ou nesta execução)
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
          -- Filtrar tipos (Pai não pode ser Bump/Upsell/CC)
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%ORDERBUMP%'
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%UPSELL%'
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%CC%'
        ORDER BY p.order_date ASC
    LOOP
        -- Sigla obrigatória
        IF pedido_pai.sigla IS NULL THEN CONTINUE; END IF;

        -- Inicializar Arrays
        v_codigos_filhos := ARRAY[]::TEXT[];
        v_order_bumps := ARRAY[]::TEXT[];
        v_upsells := ARRAY[]::TEXT[];
        v_pos_vendas := ARRAY[]::TEXT[];
        v_quantidade := 1;
        v_tem_dois_cartoes := FALSE;
        v_nome_oferta := pedido_pai.offer_name;

        -- Marcar Pai como processado
        INSERT INTO _processed (hash) VALUES (pedido_pai.transaction_hash) ON CONFLICT DO NOTHING;

        -- ========================================================
        -- CÁLCULO DE DATAS (Utilizando função de dias úteis existente)
        -- ========================================================
        -- Padrão: Venda -> +1 dia útil (PV) -> +1 dia útil (Despacho) = Total ~2 dias úteis
        -- Se proximo_dia_util não existir, fallback para data simples
        BEGIN
            v_dia_pv := proximo_dia_util(pedido_pai.order_date::DATE);
            v_dia_despacho := proximo_dia_util(v_dia_pv);
        EXCEPTION WHEN OTHERS THEN
            v_dia_despacho := (pedido_pai.order_date::DATE + 2);
        END;

        -- ========================================================
        -- BUSCA: ORDER BUMPS (Mesmo Email + Mesma Data + OrderBump)
        -- ========================================================
        FOR rec IN
            SELECT transaction_hash, offer_name FROM ticto_pedidos p
            WHERE p.transaction_hash != pedido_pai.transaction_hash
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.order_date::DATE = pedido_pai.order_date::DATE
            AND UPPER(p.offer_name) LIKE '%ORDERBUMP%'
        LOOP
            v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            v_order_bumps := array_append(v_order_bumps, rec.offer_name);
            v_quantidade := v_quantidade + 1;
            INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
        END LOOP;

        -- ========================================================
        -- BUSCA: UPSELLS (Mesmo CPF + Data D ou D+1 + Upsell)
        -- ========================================================
        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT transaction_hash, offer_name FROM ticto_pedidos p
                WHERE p.transaction_hash != pedido_pai.transaction_hash
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE BETWEEN pedido_pai.order_date::DATE AND (pedido_pai.order_date::DATE + 1)
                AND UPPER(p.offer_name) LIKE '%UPSELL%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                v_upsells := array_append(v_upsells, rec.offer_name);
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- ========================================================
        -- BUSCA: 2 CARTÕES (Mesmo Email + Mesma Oferta + Mesma Data)
        -- ========================================================
        FOR rec IN
            SELECT transaction_hash FROM ticto_pedidos p
            WHERE p.transaction_hash != pedido_pai.transaction_hash
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.offer_name = pedido_pai.offer_name
            AND p.order_date::DATE = pedido_pai.order_date::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
        END LOOP;

        -- ========================================================
        -- BUSCA: PÓS-VENDAS CC (Mesmo CPF + Janela de Dias + CC)
        -- ========================================================
        -- Janela: Se Qui/Sex -> +4 dias. Senão +2 dias.
        IF EXTRACT(DOW FROM pedido_pai.order_date) IN (4, 5) THEN
            v_data_limite := pedido_pai.order_date::DATE + 4;
        ELSE
            v_data_limite := pedido_pai.order_date::DATE + 2;
        END IF;

        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT transaction_hash, offer_name, product_name FROM ticto_pedidos p
                WHERE p.transaction_hash != pedido_pai.transaction_hash
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE > pedido_pai.order_date::DATE
                AND p.order_date::DATE <= v_data_limite
                AND UPPER(p.offer_name) LIKE '%CC%'
            LOOP
                -- Sigla do PV
                DECLARE v_sigla_pv TEXT;
                BEGIN
                    v_sigla_pv := CASE 
                        WHEN UPPER(rec.product_name) LIKE '%DESEJO%' THEN 'DP'
                        WHEN UPPER(rec.product_name) LIKE '%LUMI%' THEN 'BL'
                        WHEN UPPER(rec.product_name) LIKE '%FORMA%' THEN 'BF'
                        ELSE 'OUTRO' END;
                    v_pos_vendas := array_append(v_pos_vendas, v_sigla_pv || ':' || rec.offer_name);
                END;
                
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- ========================================================
        -- INSERIR NA CONSOLIDADA
        -- ========================================================
        -- Montar nome oferta
        IF array_length(v_order_bumps, 1) > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || array_length(v_order_bumps, 1) || ' OB'; END IF;
        IF array_length(v_upsells, 1) > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || array_length(v_upsells, 1) || ' UP'; END IF;
        IF array_length(v_pos_vendas, 1) > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || array_length(v_pos_vendas, 1) || ' PV'; END IF;

        v_descricao := pedido_pai.sigla || ' - ' || v_nome_oferta;

        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
            valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
            telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
            endereco_completo, data_venda, created_at, 
            descricao_pacote, codigos_agrupados, quantidade_pedidos, produto_principal,
            dia_despacho, status_envio,
            order_bumps, upsells, pos_vendas, codigos_filhos, tem_dois_cartoes, fraude_endereco
        ) VALUES (
            pedido_pai.id,
            pedido_pai.transaction_hash,
            CASE WHEN v_tem_dois_cartoes THEN '2 Cartões' ELSE 'Aprovado' END,
            pedido_pai.product_name,
            v_nome_oferta,
            pedido_pai.paid_amount,
            pedido_pai.payment_method,
            pedido_pai.installments,
            pedido_pai.customer_name,
            pedido_pai.customer_email,
            pedido_pai.customer_cpf,
            pedido_pai.customer_phone,
            pedido_pai.address_zip_code,
            pedido_pai.address_street,
            pedido_pai.address_number,
            pedido_pai.address_complement,
            pedido_pai.address_neighborhood,
            pedido_pai.address_city,
            pedido_pai.address_state,
            CONCAT_WS(', ', pedido_pai.address_street, pedido_pai.address_number, pedido_pai.address_neighborhood, pedido_pai.address_city, pedido_pai.address_state),
            pedido_pai.order_date,
            pedido_pai.created_at,
            v_descricao,
            ARRAY[pedido_pai.transaction_hash] || v_codigos_filhos,
            v_quantidade,
            pedido_pai.sigla,
            v_dia_despacho, 
            'Pendente',
            v_order_bumps, v_upsells, v_pos_vendas, v_codigos_filhos,
            v_tem_dois_cartoes, FALSE
        )
        ON CONFLICT (codigo_transacao) DO UPDATE SET
            nome_oferta = EXCLUDED.nome_oferta,
            descricao_pacote = EXCLUDED.descricao_pacote,
            codigos_agrupados = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps = EXCLUDED.order_bumps,
            upsells = EXCLUDED.upsells,
            pos_vendas = EXCLUDED.pos_vendas,
            codigos_filhos = EXCLUDED.codigos_filhos,
            updated_at = now();
            
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Consolidação concluída com sucesso'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissões
GRANT EXECUTE ON FUNCTION consolidar_pedidos_ticto() TO anon, authenticated, service_role;


-- ================================================================
-- 4. TRIGGER PARA NOTIFICAR ATRASOS
-- ================================================================
CREATE OR REPLACE FUNCTION check_late_pos_vendas()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_id UUID;
    v_parent_despacho DATE;
    v_corte TIMESTAMPTZ;
BEGIN
    -- Se for OB, Upsell ou PV (CC)
    IF UPPER(NEW.offer_name) LIKE '%UPSELL%' 
    OR UPPER(NEW.offer_name) LIKE '%ORDERBUMP%'
    OR UPPER(NEW.offer_name) LIKE '%CC%' THEN
        
        -- Achar o pai consolidado mais recente desse cliente
        SELECT id, dia_despacho INTO v_parent_id, v_parent_despacho
        FROM pedidos_consolidados_v3
        WHERE (cpf = NEW.customer_cpf OR email = NEW.customer_email)
        ORDER BY data_venda DESC LIMIT 1;

        IF v_parent_id IS NOT NULL THEN
            -- Corte é 11:30 UTC (08:30 BRT) do dia do despacho
            v_corte := v_parent_despacho + TIME '11:30:00';
            
            -- Se chegou DEPOIS do corte (NOW() é UTC no Supabase)
            IF NOW() > v_corte THEN
                 INSERT INTO notificacoes (tipo, mensagem, dados)
                 VALUES ('atraso_pv', 
                         'Item chegou após corte de envio (08:30)! ' || NEW.transaction_hash,
                         jsonb_build_object('pai_id', v_parent_id, 'item_hash', NEW.transaction_hash));
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_late_pv ON ticto_pedidos;
CREATE TRIGGER trg_check_late_pv
    AFTER INSERT ON ticto_pedidos
    FOR EACH ROW
    EXECUTE FUNCTION check_late_pos_vendas();


-- ================================================================
-- 5. AGENDAMENTO CRON (11:30 UTC = 08:30 BRT, Seg a Sex)
-- ================================================================

SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname = 'consolidacao_diaria_ticto';

SELECT cron.schedule(
    'consolidacao_diaria_ticto',
    '30 11 * * 1-5', 
    'SELECT consolidar_pedidos_ticto()'
);


-- ==========================================
-- MIGRATION: 032_seed_feriados_indaiatuba.sql
-- ==========================================

-- ================================================================
-- SEED FERIADOS INDAIATUBA/SP (2026)
-- Garante que feriados locais e estaduais estejam na tabela
-- ================================================================

INSERT INTO feriados (data, nome, descricao, tipo) VALUES
  -- Estaduais SP
  ('2026-07-09', 'Revolução Constitucionalista', 'Feriado Estadual SP', 'estadual'),
  ('2026-11-20', 'Consciência Negra', 'Feriado Estadual SP', 'estadual'),

  -- Municipais Indaiatuba
  ('2026-02-02', 'Nossa Senhora da Candelária', 'Padroeira de Indaiatuba', 'municipal'),
  ('2026-05-11', 'Aniversário de Indaiatuba', 'Emancipação Política', 'municipal'),
  ('2026-12-09', 'Indaiatuba (Dia da Bíblia/Outro)', 'Feriado Municipal', 'municipal') -- Verificar calendário exato se necessário, apenas exemplo

ON CONFLICT (data) DO UPDATE SET 
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  tipo = EXCLUDED.tipo;


-- ==========================================
-- MIGRATION: 033_view_recuperacao.sql
-- ==========================================

-- ================================================================
-- MIGRATION 033: View de Recuperação de Carrinho
-- Objetivo: Listar pedidos não convertidos para ação de recuperação
-- ================================================================

DROP VIEW IF EXISTS view_recuperacao;

CREATE VIEW view_recuperacao AS
SELECT 
    p.id,
    p.transaction_hash,
    p.order_date,
    p.status,
    p.payment_method,
    p.paid_amount,
    
    -- Dados do Cliente
    p.customer_name,
    p.customer_email,
    p.customer_phone,
    p.customer_cpf,
    
    -- Dados do Produto
    p.product_name,
    p.offer_name,
    
    -- Links de Pagamento (Recuperação)
    COALESCE(p.transaction_pix_url, p.transaction_bank_slip_url, p.checkout_url) as link_pagamento,
    p.transaction_pix_qr_code,
    p.transaction_bank_slip_code,
    
    -- Metadata
    p.utm_source,
    p.utm_campaign,
    
    -- Status visual (Normalizado)
    CASE 
        WHEN p.status IN ('cart_abandoned', 'abandoned') THEN 'Carrinho Abandonado'
        WHEN p.status IN ('waiting_payment', 'pending') THEN 'Pendente'
        WHEN p.status IN ('refused', 'denied', 'failed') THEN 'Recusado'
        WHEN p.status IN ('canceled', 'cancelled') THEN 'Cancelado'
        WHEN p.status IN ('expired') THEN 'Expirado'
        WHEN p.status IN ('chargeback') THEN 'Chargeback'
        ELSE p.status
    END as status_label,
    
    -- Prioridade (Para ordenação de oportunidades)
    CASE 
        WHEN p.status IN ('cart_abandoned', 'abandoned') THEN 0    -- Crítico (Abandono Real)
        WHEN p.status IN ('waiting_payment', 'pending') THEN 1     -- Alta (Boleto/Pix gerado)
        WHEN p.status IN ('refused', 'denied', 'failed') THEN 2    -- Média (Cartão negado)
        WHEN p.status IN ('canceled', 'cancelled') THEN 3          -- Baixa
        ELSE 4
    END as prioridade

FROM ticto_pedidos p
WHERE 
    p.status NOT IN ('authorized', 'approved', 'paid', 'completed', 'refunded', 'Pre-Order')
    -- Filtrar apenas pedidos recentes (últimos 30 dias) para manter a lista acionável
    AND p.order_date >= (NOW() - INTERVAL '30 days');

-- Comentários
COMMENT ON VIEW view_recuperacao IS 'Lista consolidada de oportunidades de recuperação (Carrinho Abandonado, Pix Pendente, Cartão Recusado)';

-- Permissões
GRANT SELECT ON view_recuperacao TO authenticated;
GRANT SELECT ON view_recuperacao TO service_role;


-- ==========================================
-- MIGRATION: 034_fix_ticto_logs_columns.sql
-- ==========================================

-- ================================================================
-- MIGRATION 034: Adicionar colunas faltantes em ticto_logs
-- Objetivo: Garantir paridade entre produção e staging
-- Aplicar em: Staging (se tabela já existir sem estas colunas)
-- ================================================================

-- Adicionar codigo_rastreio se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticto_logs' AND column_name = 'codigo_rastreio'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN codigo_rastreio TEXT;
        COMMENT ON COLUMN ticto_logs.codigo_rastreio IS 'Código de rastreio vinculado ao log (quando disponível)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticto_logs' AND column_name = 'resposta'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN resposta JSONB;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticto_logs' AND column_name = 'status_code'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN status_code INTEGER;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticto_logs' AND column_name = 'erro_processamento'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN erro_processamento TEXT;
        COMMENT ON COLUMN ticto_logs.erro_processamento IS 'Descrição do erro de processamento (quando aplicável)';
    END IF;
END $$;

SELECT 'Colunas adicionadas em ticto_logs!' as resultado;


-- ==========================================
-- MIGRATION: 035_fix_consolidar_ticto_v2.sql
-- ==========================================

-- ================================================================
-- MIGRATION 035: CORREÇÃO consolidar_pedidos_ticto()
-- Problema: Patterns LIKE sem espaço (%ORDERBUMP%) não casam com 
--           dados reais ("Order Bump"). Falta agrupamento por order_id.
-- Solução:  Normaliza offer_name removendo espaços antes de comparar.
--           Agrupa por order_id (família) como o script Google Apps Script.
-- ================================================================

-- 1. DROP obrigatório (return type não pode mudar com CREATE OR REPLACE)
DROP FUNCTION IF EXISTS consolidar_pedidos_ticto();

-- 2. Recriar função com lógica corrigida
CREATE OR REPLACE FUNCTION consolidar_pedidos_ticto()
RETURNS jsonb AS $$
DECLARE
    pedido_pai RECORD;
    rec RECORD;
    
    v_codigos_filhos TEXT[];
    v_order_bumps TEXT[];
    v_upsells TEXT[];
    v_pos_vendas TEXT[];
    v_nome_oferta TEXT;
    v_quantidade INTEGER;
    v_doc_limpo TEXT;
    v_data_limite DATE;
    v_tem_dois_cartoes BOOLEAN;
    v_sigla TEXT;
    v_descricao TEXT;
    v_oferta_norm TEXT;
    
    v_hoje DATE;
    v_nome_feriado TEXT;
    v_dia_pv DATE;
    v_dia_despacho DATE;
    
    v_total_processados INTEGER := 0;
BEGIN
    -- ============================================================
    -- PRE-CHECK: FERIADOS
    -- ============================================================
    v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

    SELECT nome INTO v_nome_feriado FROM feriados WHERE data = v_hoje;
    
    IF v_nome_feriado IS NOT NULL THEN
        RETURN jsonb_build_object(
            'status', 'skipped',
            'message', 'Feriado: ' || v_nome_feriado
        );
    END IF;

    -- ============================================================
    -- PREPARAÇÃO
    -- ============================================================
    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;

    -- PRESERVAR registros já despachados/editados
    CREATE TEMP TABLE _locked_ids AS
    SELECT id FROM pedidos_consolidados_v3
    WHERE codigo_rastreio IS NOT NULL
       OR foi_editado = TRUE
       OR data_envio IS NOT NULL;

    CREATE TEMP TABLE _locked_codes AS
    SELECT codigo_transacao FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids)
    UNION
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids);

    -- Remover não-travados para reprocessar
    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
    ) to_delete
    WHERE c.id = to_delete.id;

    -- Hashes já processados
    CREATE TEMP TABLE _processed (hash TEXT PRIMARY KEY);
    
    INSERT INTO _processed (hash)
    SELECT codigo_transacao FROM _locked_codes;

    -- ============================================================
    -- ITERAÇÃO: PEDIDOS "PAI"
    -- Um pedido é PAI se NÃO contém OrderBump/Upsell/CC no offer_name
    -- CORREÇÃO: Remove espaços antes de comparar (REPLACE)
    -- ============================================================
    FOR pedido_pai IN
        SELECT 
            p.*,
            REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') as doc_limpo,
            LOWER(COALESCE(p.customer_email, '')) as email_lower,
            -- Sigla do produto
            CASE 
                WHEN UPPER(p.product_name) LIKE '%DESEJO%' THEN 'DP'
                WHEN UPPER(p.product_name) LIKE '%LUMI%' THEN 'BL'
                WHEN UPPER(p.product_name) LIKE '%FORMA%' THEN 'BF'
                ELSE NULL
            END as sigla
        FROM ticto_pedidos p
        WHERE p.status IN ('authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago')
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
          -- CORREÇÃO: Normaliza removendo espaços antes de comparar
          AND REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') NOT LIKE '%ORDERBUMP%'
          AND REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') NOT LIKE '%UPSELL%'
          AND REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') NOT LIKE '%UPSELL%'
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%CC%'
        ORDER BY p.order_date ASC
    LOOP
        -- Sigla obrigatória
        IF pedido_pai.sigla IS NULL THEN CONTINUE; END IF;

        -- Inicializar
        v_codigos_filhos := ARRAY[]::TEXT[];
        v_order_bumps := ARRAY[]::TEXT[];
        v_upsells := ARRAY[]::TEXT[];
        v_pos_vendas := ARRAY[]::TEXT[];
        v_quantidade := 1;
        v_tem_dois_cartoes := FALSE;
        v_nome_oferta := pedido_pai.offer_name;
        -- LIMPEZA: Remove qualquer sufixo "- Palavra" no final (ex: - Trafego, - Promocional, - Organico, etc.)
        v_nome_oferta := REGEXP_REPLACE(v_nome_oferta, '\s*-\s+\w+\s*$', '', 'i');
        v_nome_oferta := TRIM(v_nome_oferta);

        -- Marcar como processado
        INSERT INTO _processed (hash) VALUES (pedido_pai.transaction_hash) ON CONFLICT DO NOTHING;

        -- ========================================================
        -- CÁLCULO DE DATAS (dias úteis)
        -- ========================================================
        BEGIN
            v_dia_pv := proximo_dia_util(pedido_pai.order_date::DATE);
            v_dia_despacho := proximo_dia_util(v_dia_pv);
        EXCEPTION WHEN OTHERS THEN
            v_dia_despacho := (pedido_pai.order_date::DATE + 2);
        END;

        -- ========================================================
        -- BUSCA 1: FAMÍLIA POR ORDER_ID (mesmo pedido = OB/US)
        -- O Google Script agrupa por "Código do Pedido" primeiro
        -- ========================================================
        IF pedido_pai.order_id IS NOT NULL THEN
            FOR rec IN
                SELECT p.transaction_hash, p.offer_name, p.product_name,
                       REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') as oferta_norm
                FROM ticto_pedidos p
                WHERE p.order_id = pedido_pai.order_id
                  AND p.transaction_hash != pedido_pai.transaction_hash
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
            LOOP
                v_oferta_norm := rec.oferta_norm;
                
                IF v_oferta_norm LIKE '%ORDERBUMP%' THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                    v_order_bumps := array_append(v_order_bumps, rec.offer_name);
                    v_quantidade := v_quantidade + 1;
                ELSIF v_oferta_norm LIKE '%UPSELL%' THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                    v_upsells := array_append(v_upsells, rec.offer_name);
                    v_quantidade := v_quantidade + 1;
                ELSE
                    -- Mesmo order_id mas não é OB/US = possível 2 cartões ou item extra
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                END IF;
                
                INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- ========================================================
        -- BUSCA 2: ORDER BUMPS extras (Mesmo Email + Mesma Data)
        -- Pega OB que possam ter order_id diferente
        -- ========================================================
        FOR rec IN
            SELECT transaction_hash, offer_name FROM ticto_pedidos p
            WHERE p.transaction_hash != pedido_pai.transaction_hash
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.order_date::DATE = pedido_pai.order_date::DATE
            AND REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') LIKE '%ORDERBUMP%'
        LOOP
            v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            v_order_bumps := array_append(v_order_bumps, rec.offer_name);
            v_quantidade := v_quantidade + 1;
            INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
        END LOOP;

        -- ========================================================
        -- BUSCA 3: UPSELLS por Documento (Mesmo CPF + Data D ou D+1)
        -- ========================================================
        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT transaction_hash, offer_name FROM ticto_pedidos p
                WHERE p.transaction_hash != pedido_pai.transaction_hash
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE BETWEEN pedido_pai.order_date::DATE AND (pedido_pai.order_date::DATE + 1)
                AND (
                    REPLACE(UPPER(COALESCE(p.offer_name,'')), ' ', '') LIKE '%UPSELL%'
                    OR UPPER(COALESCE(p.offer_name,'')) LIKE '%UP SELL%'
                )
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                v_upsells := array_append(v_upsells, rec.offer_name);
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- ========================================================
        -- BUSCA 4: 2 CARTÕES (Mesmo Email + Mesma Oferta + Mesma Data)
        -- ========================================================
        FOR rec IN
            SELECT transaction_hash FROM ticto_pedidos p
            WHERE p.transaction_hash != pedido_pai.transaction_hash
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.offer_name = pedido_pai.offer_name
            AND p.order_date::DATE = pedido_pai.order_date::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
        END LOOP;

        -- ========================================================
        -- BUSCA 5: PÓS-VENDAS CC (Mesmo CPF + Janela + CC no nome)
        -- Janela: Se Qui/Sex → +4 dias. Senão +2 dias.
        -- ========================================================
        IF EXTRACT(DOW FROM pedido_pai.order_date) IN (4, 5) THEN
            v_data_limite := pedido_pai.order_date::DATE + 4;
        ELSE
            v_data_limite := pedido_pai.order_date::DATE + 2;
        END IF;

        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT transaction_hash, offer_name, product_name FROM ticto_pedidos p
                WHERE p.transaction_hash != pedido_pai.transaction_hash
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE hash = p.transaction_hash)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE > pedido_pai.order_date::DATE
                AND p.order_date::DATE <= v_data_limite
                AND UPPER(p.offer_name) LIKE '%CC%'
            LOOP
                DECLARE v_sigla_pv TEXT;
                BEGIN
                    v_sigla_pv := CASE 
                        WHEN UPPER(rec.product_name) LIKE '%DESEJO%' THEN 'DP'
                        WHEN UPPER(rec.product_name) LIKE '%LUMI%' THEN 'BL'
                        WHEN UPPER(rec.product_name) LIKE '%FORMA%' THEN 'BF'
                        ELSE 'OUTRO' END;
                    v_pos_vendas := array_append(v_pos_vendas, v_sigla_pv || ':' || rec.offer_name);
                END;
                
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (hash) VALUES (rec.transaction_hash) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- ========================================================
        -- MONTAR NOME DA OFERTA (replica lógica do Google Script)
        -- Ex: "Compre 1 e Leve 2 + Order Bump + Order Bump + 2 DP"
        -- ========================================================
        -- Order Bumps: cada um adiciona " + Order Bump"
        FOR rec IN SELECT unnest(v_order_bumps) as nome
        LOOP
            v_nome_oferta := v_nome_oferta || ' + Order Bump';
        END LOOP;
        
        -- Upsells: cada um adiciona " + UPSELL"
        FOR rec IN SELECT unnest(v_upsells) as nome
        LOOP
            v_nome_oferta := v_nome_oferta || ' + UPSELL';
        END LOOP;

        -- Pós-Vendas: adiciona sigla (ex: " + 1 BF")
        FOR rec IN SELECT unnest(v_pos_vendas) as nome
        LOOP
            DECLARE 
                v_pv_sigla TEXT;
                v_pv_oferta TEXT;
            BEGIN
                v_pv_sigla := SPLIT_PART(rec.nome, ':', 1);
                v_pv_oferta := SPLIT_PART(rec.nome, ':', 2);
                IF v_pv_sigla != '' AND v_pv_sigla != 'OUTRO' THEN
                    v_nome_oferta := v_nome_oferta || ' + 1 ' || v_pv_sigla;
                ELSE
                    v_nome_oferta := v_nome_oferta || ' + ' || v_pv_oferta;
                END IF;
            END;
        END LOOP;

        v_descricao := pedido_pai.sigla || ' - ' || v_nome_oferta;

        -- ========================================================
        -- INSERIR NA CONSOLIDADA
        -- ========================================================
        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
            valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
            telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
            endereco_completo, data_venda, created_at, 
            descricao_pacote, codigos_agrupados, quantidade_pedidos, produto_principal,
            dia_despacho, status_envio,
            order_bumps, upsells, pos_vendas, codigos_filhos, tem_dois_cartoes, fraude_endereco
        ) VALUES (
            pedido_pai.id,
            pedido_pai.transaction_hash,
            CASE WHEN v_tem_dois_cartoes THEN '2 Cartões' ELSE 'Aprovado' END,
            pedido_pai.product_name,
            v_nome_oferta,
            pedido_pai.paid_amount,
            pedido_pai.payment_method,
            pedido_pai.installments,
            pedido_pai.customer_name,
            pedido_pai.customer_email,
            pedido_pai.customer_cpf,
            pedido_pai.customer_phone,
            pedido_pai.address_zip_code,
            pedido_pai.address_street,
            pedido_pai.address_number,
            pedido_pai.address_complement,
            pedido_pai.address_neighborhood,
            pedido_pai.address_city,
            pedido_pai.address_state,
            CONCAT_WS(', ', pedido_pai.address_street, pedido_pai.address_number, pedido_pai.address_neighborhood, pedido_pai.address_city, pedido_pai.address_state),
            pedido_pai.order_date,
            pedido_pai.created_at,
            v_descricao,
            ARRAY[pedido_pai.transaction_hash] || v_codigos_filhos,
            v_quantidade,
            pedido_pai.sigla,
            v_dia_despacho, 
            'Pendente',
            v_order_bumps, v_upsells, v_pos_vendas, v_codigos_filhos,
            v_tem_dois_cartoes, FALSE
        )
        ON CONFLICT (codigo_transacao) DO UPDATE SET
            nome_oferta = EXCLUDED.nome_oferta,
            descricao_pacote = EXCLUDED.descricao_pacote,
            codigos_agrupados = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps = EXCLUDED.order_bumps,
            upsells = EXCLUDED.upsells,
            pos_vendas = EXCLUDED.pos_vendas,
            codigos_filhos = EXCLUDED.codigos_filhos,
            updated_at = now();
            
        v_total_processados := v_total_processados + 1;
    END LOOP;

    -- Cleanup
    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Consolidação concluída: ' || v_total_processados || ' pedidos processados'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissões
GRANT EXECUTE ON FUNCTION consolidar_pedidos_ticto() TO anon, authenticated, service_role;

-- Recarregar schema
NOTIFY pgrst, 'reload schema';

SELECT 'Função consolidar_pedidos_ticto() recriada com sucesso!' as resultado;


-- ==========================================
-- MIGRATION: 036_pv_realizado.sql
-- ==========================================

-- ================================================================
-- MIGRATION 036: PÓS-VENDA REALIZADO
-- Adiciona colunas para marcar pedidos como PV realizado
-- e function RPC para a vendedora usar
-- ================================================================

-- 1. Adicionar colunas
ALTER TABLE pedidos_consolidados_v3
  ADD COLUMN IF NOT EXISTS pv_realizado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pv_realizado_at TIMESTAMPTZ;

-- 2. Índice para consultas rápidas por PV
CREATE INDEX IF NOT EXISTS idx_consolidados_pv_realizado
  ON pedidos_consolidados_v3 (pv_realizado) WHERE pv_realizado = TRUE;

-- 3. Function RPC: marcar PV como realizado
CREATE OR REPLACE FUNCTION marcar_pv_realizado(p_order_id UUID)
RETURNS jsonb AS $$
BEGIN
    UPDATE pedidos_consolidados_v3
    SET pv_realizado = TRUE,
        pv_realizado_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'Pedido não encontrado: ' || p_order_id
        );
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'PV marcado como realizado'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function RPC: desmarcar PV (reverter)
CREATE OR REPLACE FUNCTION desmarcar_pv_realizado(p_order_id UUID)
RETURNS jsonb AS $$
BEGIN
    UPDATE pedidos_consolidados_v3
    SET pv_realizado = FALSE,
        pv_realizado_at = NULL,
        updated_at = NOW()
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'Pedido não encontrado: ' || p_order_id
        );
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'PV desmarcado'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Permissões
GRANT EXECUTE ON FUNCTION marcar_pv_realizado(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION desmarcar_pv_realizado(UUID) TO anon, authenticated, service_role;

-- 6. Recarregar schema
NOTIFY pgrst, 'reload schema';

SELECT 'Migration 036: PV Realizado - colunas e functions criadas com sucesso!' as resultado;


-- ==========================================
-- MIGRATION: 037_update_pedidos_consolidados.sql
-- ==========================================

-- ================================================================
-- MIGRATION 037: CRIAR FUNÇÃO update_pedidos_consolidados
-- ================================================================
-- A função RPC chamada pelo front-end para editar dados de pedidos
-- na tabela pedidos_consolidados_v3
-- ================================================================

DROP FUNCTION IF EXISTS update_pedidos_consolidados(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT);

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
  -- Montar endereço completo
  v_endereco_completo := p_logradouro || ', ' || p_numero;
  IF p_complemento IS NOT NULL AND p_complemento != '' THEN
    v_endereco_completo := v_endereco_completo || ' - ' || p_complemento;
  END IF;
  v_endereco_completo := v_endereco_completo || ' - ' || p_bairro || ', ' || p_cidade || ' - ' || p_estado || ', ' || p_cep;

  -- Atualizar pedidos_consolidados_v3 (tabela principal)
  UPDATE pedidos_consolidados_v3
  SET 
    cpf = p_cpf_novo,
    nome_cliente = p_nome,
    email = p_email,
    telefone = p_telefone,
    cep = p_cep,
    logradouro = p_logradouro,
    numero = p_numero,
    complemento = p_complemento,
    bairro = p_bairro,
    cidade = p_cidade,
    estado = p_estado,
    endereco_completo = v_endereco_completo,
    observacao = p_observacao,
    foi_editado = true,
    updated_at = NOW()
  WHERE cpf = p_cpf_antigo;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Tentar atualizar tabela pedidos (fonte original) — protegido contra schema diferente
  BEGIN
    UPDATE pedidos
    SET 
      nome_cliente = p_nome,
      email = p_email,
      telefone = p_telefone,
      cep = p_cep,
      logradouro = p_logradouro,
      numero = p_numero,
      complemento = p_complemento,
      bairro = p_bairro,
      cidade = p_cidade,
      estado = p_estado,
      endereco_completo = v_endereco_completo,
      observacao = p_observacao,
      foi_editado = true,
      updated_at = NOW()
    WHERE cpf_cliente = p_cpf_antigo;
  EXCEPTION WHEN OTHERS THEN
    -- Ignora erros (tabela pode não existir ou ter schema diferente)
    NULL;
  END;

  RETURN v_count;
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION update_pedidos_consolidados(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

SELECT 'Função update_pedidos_consolidados criada!' as resultado;


-- ==========================================
-- MIGRATION: 038_fix_cpf_leading_zeros.sql
-- ==========================================

-- ================================================================
-- MIGRATION 038: FIX CPFs MISSING LEADING ZEROS
-- ================================================================
-- Problema: A Ticto envia CPFs como número, perdendo zeros à esquerda.
-- Ex: CPF "02345678901" chega como "2345678901" (10 dígitos).
-- Solução:
--   1. Corrigir CPFs existentes com LPAD (pad até 11 dígitos)
--   2. Garantir que futuras consolidações preservem zeros
-- ================================================================

-- PASSO 1: Corrigir CPFs existentes na pedidos_consolidados_v3
-- Apenas CPFs com 10 dígitos (faltando 1 zero à esquerda)
UPDATE pedidos_consolidados_v3
SET cpf = LPAD(cpf, 11, '0'),
    updated_at = NOW()
WHERE cpf IS NOT NULL 
  AND cpf != ''
  AND cpf ~ '^\d+$'
  AND LENGTH(cpf) = 10;

-- Também corrigir CPFs com 9 dígitos (faltando 2 zeros)
UPDATE pedidos_consolidados_v3
SET cpf = LPAD(cpf, 11, '0'),
    updated_at = NOW()
WHERE cpf IS NOT NULL 
  AND cpf != ''
  AND cpf ~ '^\d+$'
  AND LENGTH(cpf) = 9;

-- PASSO 2: Corrigir CPFs na tabela ticto_pedidos (fonte)
UPDATE ticto_pedidos
SET customer_cpf = LPAD(customer_cpf, 11, '0')
WHERE customer_cpf IS NOT NULL 
  AND customer_cpf != ''
  AND customer_cpf ~ '^\d+$'
  AND LENGTH(customer_cpf) BETWEEN 9 AND 10;

-- PASSO 3: TRIGGER para auto-corrigir CPFs futuros
-- Qualquer INSERT ou UPDATE na pedidos_consolidados_v3 terá CPF padronizado
CREATE OR REPLACE FUNCTION pad_cpf_zeros()
RETURNS TRIGGER AS $$
DECLARE
  cpf_limpo TEXT;
BEGIN
  IF NEW.cpf IS NOT NULL AND NEW.cpf != '' THEN
    cpf_limpo := REGEXP_REPLACE(NEW.cpf, '[^0-9]', '', 'g');
    IF LENGTH(cpf_limpo) BETWEEN 9 AND 10 THEN
      NEW.cpf := LPAD(cpf_limpo, 11, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pad_cpf_consolidados ON pedidos_consolidados_v3;
CREATE TRIGGER trg_pad_cpf_consolidados
  BEFORE INSERT OR UPDATE ON pedidos_consolidados_v3
  FOR EACH ROW
  EXECUTE FUNCTION pad_cpf_zeros();

-- PASSO 4: Corrigir normalizar_documento (usada na migration 028)
-- Troca LTRIM(doc_limpo, '0') por LPAD para preservar zeros
CREATE OR REPLACE FUNCTION normalizar_documento(doc_raw TEXT)
RETURNS TEXT AS $$
DECLARE doc_limpo TEXT;
BEGIN
    IF doc_raw IS NULL OR doc_raw = '' THEN RETURN ''; END IF;
    doc_limpo := REGEXP_REPLACE(doc_raw, '[^0-9]', '', 'g');
    IF doc_limpo = '' THEN RETURN ''; END IF;
    RETURN LPAD(doc_limpo, 11, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- PASSO 5: Relatório
SELECT 
  'CPFs corrigidos + trigger ativo!' as resultado,
  (SELECT COUNT(*) FROM pedidos_consolidados_v3 WHERE cpf IS NOT NULL AND LENGTH(cpf) < 11 AND cpf ~ '^\d+$') as cpfs_ainda_curtos;


-- ==========================================
-- MIGRATION: 039_melhor_envio_tracking.sql
-- ==========================================

-- ================================================================
-- MIGRATION 039: MELHOR ENVIO TRACKING COLUMNS
-- ================================================================
-- Adiciona colunas para suportar rastreio automático via webhook
-- da Melhor Envio, separando o UUID do carrinho do tracking real.
-- ================================================================

-- Coluna para guardar o UUID original do Melhor Envio
-- (quando o tracking real substituir o codigo_rastreio)
ALTER TABLE pedidos_consolidados_v3
ADD COLUMN IF NOT EXISTS melhor_envio_id TEXT;

-- URL de rastreio do Melhor Envio
ALTER TABLE pedidos_consolidados_v3
ADD COLUMN IF NOT EXISTS tracking_url TEXT;

-- Data de entrega confirmada (via webhook)
ALTER TABLE pedidos_consolidados_v3
ADD COLUMN IF NOT EXISTS data_entrega TIMESTAMPTZ;

-- Índice para busca rápida por melhor_envio_id (usado pelo webhook)
CREATE INDEX IF NOT EXISTS idx_consolidados_melhor_envio_id
ON pedidos_consolidados_v3 (melhor_envio_id)
WHERE melhor_envio_id IS NOT NULL;


-- ==========================================
-- MIGRATION: 040_rpc_desempenho_vendedoras.sql
-- ==========================================

-- ================================================================
-- MIGRATION 040: RPC Desempenho Vendedoras (Pós-Venda)
-- Objetivo: Agregar métricas de performance por vendedora/afiliada
-- Fonte: campo JSONB 'affiliates' da tabela ticto_pedidos
-- Execute no SQL Editor do Supabase Produção
-- ================================================================

-- ============================================================
-- FUNÇÃO 1: Desempenho por vendedora no período
-- Retorna ranking com vendas, valor, comissão, taxa de conversão
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_desempenho_vendedoras(
    p_data_inicio TIMESTAMPTZ,
    p_data_fim TIMESTAMPTZ
)
RETURNS TABLE (
    affiliate_id INTEGER,
    affiliate_name TEXT,
    affiliate_email TEXT,
    affiliate_phone TEXT,
    affiliate_pid TEXT,
    total_vendas BIGINT,
    vendas_aprovadas BIGINT,
    vendas_pendentes BIGINT,
    vendas_recusadas BIGINT,
    valor_total_aprovado NUMERIC,
    valor_total_pendente NUMERIC,
    comissao_total NUMERIC,
    ticket_medio NUMERIC,
    taxa_conversao NUMERIC,
    primeira_venda TIMESTAMPTZ,
    ultima_venda TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        (aff->>'id')::INTEGER AS affiliate_id,
        aff->>'name' AS affiliate_name,
        aff->>'email' AS affiliate_email,
        aff->>'phone' AS affiliate_phone,
        aff->>'pid' AS affiliate_pid,

        -- Contadores
        COUNT(*) AS total_vendas,
        COUNT(*) FILTER (WHERE tp.status = 'Aprovado') AS vendas_aprovadas,
        COUNT(*) FILTER (WHERE tp.status IN ('Pendente', 'Aguardando')) AS vendas_pendentes,
        COUNT(*) FILTER (WHERE tp.status IN ('Recusado', 'Expirado', 'Cancelado')) AS vendas_recusadas,

        -- Valores
        COALESCE(SUM(tp.paid_amount) FILTER (WHERE tp.status = 'Aprovado'), 0) AS valor_total_aprovado,
        COALESCE(SUM(tp.paid_amount) FILTER (WHERE tp.status = 'Pendente'), 0) AS valor_total_pendente,

        -- Comissão (campo amount vem em centavos no JSON)
        COALESCE(SUM((aff->>'amount')::NUMERIC / 100) FILTER (WHERE tp.status = 'Aprovado'), 0) AS comissao_total,

        -- Ticket médio (aprovados)
        CASE
            WHEN COUNT(*) FILTER (WHERE tp.status = 'Aprovado') > 0
            THEN ROUND(
                COALESCE(SUM(tp.paid_amount) FILTER (WHERE tp.status = 'Aprovado'), 0)
                / COUNT(*) FILTER (WHERE tp.status = 'Aprovado'),
            2)
            ELSE 0
        END AS ticket_medio,

        -- Taxa de conversão (aprovados / total * 100)
        CASE
            WHEN COUNT(*) > 0
            THEN ROUND((COUNT(*) FILTER (WHERE tp.status = 'Aprovado'))::NUMERIC / COUNT(*) * 100, 1)
            ELSE 0
        END AS taxa_conversao,

        MIN(tp.order_date) AS primeira_venda,
        MAX(tp.order_date) AS ultima_venda

    FROM ticto_pedidos tp,
         LATERAL jsonb_array_elements(tp.affiliates) AS aff
    WHERE tp.affiliates IS NOT NULL
      AND tp.affiliates != '[]'::jsonb
      AND tp.order_date >= p_data_inicio
      AND tp.order_date <= p_data_fim
    GROUP BY
        (aff->>'id')::INTEGER,
        aff->>'name',
        aff->>'email',
        aff->>'phone',
        aff->>'pid'
    ORDER BY valor_total_aprovado DESC;
$$;

-- ============================================================
-- FUNÇÃO 2: Métricas gerais do pós-venda + meta coletiva
-- Meta = 15% do faturamento aprovado do PERÍODO ANTERIOR
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_metricas_pos_venda(
    p_data_inicio TIMESTAMPTZ,
    p_data_fim TIMESTAMPTZ
)
RETURNS TABLE (
    total_vendedoras INTEGER,
    total_vendas_pv BIGINT,
    total_vendas_aprovadas BIGINT,
    faturamento_pv NUMERIC,
    faturamento_pendente_pv NUMERIC,
    comissao_total NUMERIC,
    ticket_medio_geral NUMERIC,
    taxa_conversao_geral NUMERIC,
    meta_valor NUMERIC,
    meta_atingida_pct NUMERIC,
    faturamento_periodo_anterior NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    WITH
    -- Período atual: apenas pedidos de afiliados
    periodo_atual AS (
        SELECT
            tp.paid_amount,
            tp.status,
            (aff->>'amount')::NUMERIC / 100 AS comissao_aff
        FROM ticto_pedidos tp,
             LATERAL jsonb_array_elements(tp.affiliates) AS aff
        WHERE tp.affiliates IS NOT NULL
          AND tp.affiliates != '[]'::jsonb
          AND tp.order_date >= p_data_inicio
          AND tp.order_date <= p_data_fim
    ),
    -- Período anterior (mesmo tamanho): TODOS os pedidos aprovados
    periodo_anterior AS (
        SELECT COALESCE(SUM(paid_amount), 0) AS fat_anterior
        FROM ticto_pedidos
        WHERE status = 'Aprovado'
          AND order_date >= p_data_inicio - (p_data_fim - p_data_inicio)
          AND order_date < p_data_inicio
    ),
    -- Vendedoras únicas no período
    vendedoras AS (
        SELECT COUNT(DISTINCT (aff->>'id')) AS cnt
        FROM ticto_pedidos tp,
             LATERAL jsonb_array_elements(tp.affiliates) AS aff
        WHERE tp.affiliates IS NOT NULL
          AND tp.affiliates != '[]'::jsonb
          AND tp.order_date >= p_data_inicio
          AND tp.order_date <= p_data_fim
    )
    SELECT
        v.cnt::INTEGER AS total_vendedoras,
        COUNT(*)::BIGINT AS total_vendas_pv,
        COUNT(*) FILTER (WHERE pa.status = 'Aprovado')::BIGINT AS total_vendas_aprovadas,
        COALESCE(SUM(pa.paid_amount) FILTER (WHERE pa.status = 'Aprovado'), 0) AS faturamento_pv,
        COALESCE(SUM(pa.paid_amount) FILTER (WHERE pa.status = 'Pendente'), 0) AS faturamento_pendente_pv,
        COALESCE(SUM(pa.comissao_aff) FILTER (WHERE pa.status = 'Aprovado'), 0) AS comissao_total,

        -- Ticket médio
        CASE
            WHEN COUNT(*) FILTER (WHERE pa.status = 'Aprovado') > 0
            THEN ROUND(
                COALESCE(SUM(pa.paid_amount) FILTER (WHERE pa.status = 'Aprovado'), 0)
                / COUNT(*) FILTER (WHERE pa.status = 'Aprovado'),
            2)
            ELSE 0
        END AS ticket_medio_geral,

        -- Taxa de conversão
        CASE
            WHEN COUNT(*) > 0
            THEN ROUND(COUNT(*) FILTER (WHERE pa.status = 'Aprovado')::NUMERIC / COUNT(*) * 100, 1)
            ELSE 0
        END AS taxa_conversao_geral,

        -- Meta: 15% do faturamento do período anterior
        ROUND(pant.fat_anterior * 0.15, 2) AS meta_valor,

        -- % da meta atingida
        CASE
            WHEN pant.fat_anterior > 0
            THEN ROUND(
                COALESCE(SUM(pa.paid_amount) FILTER (WHERE pa.status = 'Aprovado'), 0)
                / (pant.fat_anterior * 0.15) * 100,
            1)
            ELSE 0
        END AS meta_atingida_pct,

        pant.fat_anterior AS faturamento_periodo_anterior

    FROM periodo_atual pa
    CROSS JOIN periodo_anterior pant
    CROSS JOIN vendedoras v
    GROUP BY v.cnt, pant.fat_anterior;
$$;

-- ============================================================
-- PERMISSÕES
-- ============================================================

GRANT EXECUTE ON FUNCTION rpc_desempenho_vendedoras(TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rpc_metricas_pos_venda(TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated;

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================

NOTIFY pgrst, 'reload schema';

SELECT 'RPC rpc_desempenho_vendedoras criada com sucesso!' AS resultado
UNION ALL
SELECT 'RPC rpc_metricas_pos_venda criada com sucesso!' AS resultado;


-- ==========================================
-- MIGRATION: 041_criar_tabela_afiliados.sql
-- ==========================================

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


-- ==========================================
-- MIGRATION: 042_rpc_desempenho_com_tipo.sql
-- ==========================================

-- ================================================================
-- MIGRATION 042: RPC atualizada com filtro por tipo de afiliado
-- Substitui as RPCs da migration 040
-- Execute no SQL Editor do Supabase Produção (APÓS a 041)
-- ================================================================

-- ============================================================
-- FUNÇÃO 1: Desempenho por vendedora no período (com filtro tipo)
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_desempenho_vendedoras(
    p_data_inicio TIMESTAMPTZ,
    p_data_fim TIMESTAMPTZ,
    p_tipo TEXT DEFAULT NULL
)
RETURNS TABLE (
    affiliate_id INTEGER,
    affiliate_name TEXT,
    affiliate_email TEXT,
    affiliate_phone TEXT,
    affiliate_pid TEXT,
    affiliate_tipo TEXT,
    is_coprodutor BOOLEAN,
    is_afiliado BOOLEAN,
    total_vendas BIGINT,
    vendas_aprovadas BIGINT,
    vendas_pendentes BIGINT,
    vendas_recusadas BIGINT,
    valor_total_aprovado NUMERIC,
    valor_total_pendente NUMERIC,
    comissao_total NUMERIC,
    ticket_medio NUMERIC,
    taxa_conversao NUMERIC,
    primeira_venda TIMESTAMPTZ,
    ultima_venda TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        (aff->>'id')::INTEGER AS affiliate_id,
        COALESCE(af.nome, aff->>'name') AS affiliate_name,
        COALESCE(af.email, aff->>'email') AS affiliate_email,
        aff->>'phone' AS affiliate_phone,
        aff->>'pid' AS affiliate_pid,
        COALESCE(af.tipo, 'nao_classificado') AS affiliate_tipo,
        COALESCE(af.is_coprodutor, FALSE) AS is_coprodutor,
        COALESCE(af.is_afiliado, TRUE) AS is_afiliado,

        COUNT(*) AS total_vendas,
        COUNT(*) FILTER (WHERE tp.status = 'Aprovado') AS vendas_aprovadas,
        COUNT(*) FILTER (WHERE tp.status IN ('Pendente', 'Aguardando')) AS vendas_pendentes,
        COUNT(*) FILTER (WHERE tp.status IN ('Recusado', 'Expirado', 'Cancelado')) AS vendas_recusadas,

        COALESCE(SUM(tp.paid_amount) FILTER (WHERE tp.status = 'Aprovado'), 0) AS valor_total_aprovado,
        COALESCE(SUM(tp.paid_amount) FILTER (WHERE tp.status = 'Pendente'), 0) AS valor_total_pendente,
        COALESCE(SUM((aff->>'amount')::NUMERIC / 100) FILTER (WHERE tp.status = 'Aprovado'), 0) AS comissao_total,

        CASE
            WHEN COUNT(*) FILTER (WHERE tp.status = 'Aprovado') > 0
            THEN ROUND(
                COALESCE(SUM(tp.paid_amount) FILTER (WHERE tp.status = 'Aprovado'), 0)
                / COUNT(*) FILTER (WHERE tp.status = 'Aprovado'),
            2)
            ELSE 0
        END AS ticket_medio,

        CASE
            WHEN COUNT(*) > 0
            THEN ROUND((COUNT(*) FILTER (WHERE tp.status = 'Aprovado'))::NUMERIC / COUNT(*) * 100, 1)
            ELSE 0
        END AS taxa_conversao,

        MIN(tp.order_date) AS primeira_venda,
        MAX(tp.order_date) AS ultima_venda

    FROM ticto_pedidos tp,
         LATERAL jsonb_array_elements(tp.affiliates) AS aff
         LEFT JOIN afiliados af ON af.affiliate_id = (aff->>'id')::INTEGER
    WHERE tp.affiliates IS NOT NULL
      AND tp.affiliates != '[]'::jsonb
      AND tp.order_date >= p_data_inicio
      AND tp.order_date <= p_data_fim
      AND (p_tipo IS NULL OR COALESCE(af.tipo, 'nao_classificado') = p_tipo)
    GROUP BY
        (aff->>'id')::INTEGER,
        af.nome, aff->>'name',
        af.email, aff->>'email',
        aff->>'phone',
        aff->>'pid',
        af.tipo,
        af.is_coprodutor,
        af.is_afiliado
    ORDER BY valor_total_aprovado DESC;
$$;

-- ============================================================
-- FUNÇÃO 2: Métricas gerais PV + meta (com filtro tipo)
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_metricas_pos_venda(
    p_data_inicio TIMESTAMPTZ,
    p_data_fim TIMESTAMPTZ,
    p_tipo TEXT DEFAULT NULL
)
RETURNS TABLE (
    total_vendedoras INTEGER,
    total_vendas_pv BIGINT,
    total_vendas_aprovadas BIGINT,
    faturamento_pv NUMERIC,
    faturamento_pendente_pv NUMERIC,
    comissao_total NUMERIC,
    ticket_medio_geral NUMERIC,
    taxa_conversao_geral NUMERIC,
    meta_valor NUMERIC,
    meta_atingida_pct NUMERIC,
    faturamento_periodo_anterior NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    WITH
    periodo_atual AS (
        SELECT
            tp.paid_amount,
            tp.status,
            (aff->>'amount')::NUMERIC / 100 AS comissao_aff
        FROM ticto_pedidos tp,
             LATERAL jsonb_array_elements(tp.affiliates) AS aff
             LEFT JOIN afiliados af ON af.affiliate_id = (aff->>'id')::INTEGER
        WHERE tp.affiliates IS NOT NULL
          AND tp.affiliates != '[]'::jsonb
          AND tp.order_date >= p_data_inicio
          AND tp.order_date <= p_data_fim
          AND (p_tipo IS NULL OR COALESCE(af.tipo, 'nao_classificado') = p_tipo)
    ),
    periodo_anterior AS (
        SELECT COALESCE(SUM(paid_amount), 0) AS fat_anterior
        FROM ticto_pedidos
        WHERE status = 'Aprovado'
          AND order_date >= p_data_inicio - (p_data_fim - p_data_inicio)
          AND order_date < p_data_inicio
    ),
    vendedoras AS (
        SELECT COUNT(DISTINCT (aff->>'id')) AS cnt
        FROM ticto_pedidos tp,
             LATERAL jsonb_array_elements(tp.affiliates) AS aff
             LEFT JOIN afiliados af ON af.affiliate_id = (aff->>'id')::INTEGER
        WHERE tp.affiliates IS NOT NULL
          AND tp.affiliates != '[]'::jsonb
          AND tp.order_date >= p_data_inicio
          AND tp.order_date <= p_data_fim
          AND (p_tipo IS NULL OR COALESCE(af.tipo, 'nao_classificado') = p_tipo)
    )
    SELECT
        v.cnt::INTEGER AS total_vendedoras,
        COUNT(*)::BIGINT AS total_vendas_pv,
        COUNT(*) FILTER (WHERE pa.status = 'Aprovado')::BIGINT AS total_vendas_aprovadas,
        COALESCE(SUM(pa.paid_amount) FILTER (WHERE pa.status = 'Aprovado'), 0) AS faturamento_pv,
        COALESCE(SUM(pa.paid_amount) FILTER (WHERE pa.status = 'Pendente'), 0) AS faturamento_pendente_pv,
        COALESCE(SUM(pa.comissao_aff) FILTER (WHERE pa.status = 'Aprovado'), 0) AS comissao_total,
        CASE
            WHEN COUNT(*) FILTER (WHERE pa.status = 'Aprovado') > 0
            THEN ROUND(
                COALESCE(SUM(pa.paid_amount) FILTER (WHERE pa.status = 'Aprovado'), 0)
                / COUNT(*) FILTER (WHERE pa.status = 'Aprovado'),
            2)
            ELSE 0
        END AS ticket_medio_geral,
        CASE
            WHEN COUNT(*) > 0
            THEN ROUND(COUNT(*) FILTER (WHERE pa.status = 'Aprovado')::NUMERIC / COUNT(*) * 100, 1)
            ELSE 0
        END AS taxa_conversao_geral,
        ROUND(pant.fat_anterior * 0.15, 2) AS meta_valor,
        CASE
            WHEN pant.fat_anterior > 0
            THEN ROUND(
                COALESCE(SUM(pa.paid_amount) FILTER (WHERE pa.status = 'Aprovado'), 0)
                / (pant.fat_anterior * 0.15) * 100,
            1)
            ELSE 0
        END AS meta_atingida_pct,
        pant.fat_anterior AS faturamento_periodo_anterior
    FROM periodo_atual pa
    CROSS JOIN periodo_anterior pant
    CROSS JOIN vendedoras v
    GROUP BY v.cnt, pant.fat_anterior;
$$;

-- ============================================================
-- PERMISSÕES
-- ============================================================

GRANT EXECUTE ON FUNCTION rpc_desempenho_vendedoras(TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rpc_metricas_pos_venda(TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

SELECT 'RPCs atualizadas com filtro por tipo!' AS resultado;


-- ==========================================
-- MIGRATION: 043_fix_ticto_logs_production.sql
-- ==========================================

-- ================================================================
-- MIGRATION 043: Corrigir tabela ticto_logs em produção
-- Data: 2026-02-20
-- Problema: O webhook smooth-function tenta inserir logs com
--   colunas (payload, erro, duracao_ms) que NÃO existem na produção.
--   Isso faz 100% dos logs falharem silenciosamente.
-- ================================================================

-- 1. Adicionar colunas faltantes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ticto_logs' AND column_name = 'payload'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN payload JSONB;
        COMMENT ON COLUMN ticto_logs.payload IS 'Dados do payload recebido pelo webhook';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ticto_logs' AND column_name = 'erro'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN erro TEXT;
        COMMENT ON COLUMN ticto_logs.erro IS 'Mensagem de erro quando o webhook falha';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ticto_logs' AND column_name = 'duracao_ms'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN duracao_ms INTEGER;
        COMMENT ON COLUMN ticto_logs.duracao_ms IS 'Tempo de processamento em milissegundos';
    END IF;
END $$;

-- 2. Garantir que a service_role pode inserir (bypassa RLS, mas vamos criar policy explícita)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'ticto_logs' AND policyname = 'service_role_full_access'
    ) THEN
        CREATE POLICY service_role_full_access ON ticto_logs
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- 3. Recarregar o schema cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- 4. Verificação
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'ticto_logs'
ORDER BY ordinal_position;


-- ==========================================
-- MIGRATION: 044_fix_ticto_logs_remaining.sql
-- ==========================================

-- ================================================================
-- MIGRATION 044: Adicionar colunas faltantes restantes em ticto_logs
-- Data: 2026-02-20
-- Problema: A migration 043 adicionou payload/erro/duracao_ms,
--   mas ainda faltam: tipo, sucesso, resposta, status_code
-- ================================================================

-- 1. Adicionar colunas faltantes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ticto_logs' AND column_name = 'tipo'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN tipo TEXT;
        COMMENT ON COLUMN ticto_logs.tipo IS 'Tipo do log: webhook, api, sync, error';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ticto_logs' AND column_name = 'sucesso'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN sucesso BOOLEAN DEFAULT TRUE;
        COMMENT ON COLUMN ticto_logs.sucesso IS 'Se a operação foi bem-sucedida';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ticto_logs' AND column_name = 'resposta'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN resposta JSONB;
        COMMENT ON COLUMN ticto_logs.resposta IS 'Resposta recebida (quando aplicável)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ticto_logs' AND column_name = 'status_code'
    ) THEN
        ALTER TABLE ticto_logs ADD COLUMN status_code INTEGER;
        COMMENT ON COLUMN ticto_logs.status_code IS 'Código HTTP da resposta';
    END IF;
END $$;

-- 2. Recarregar o schema cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- 3. Verificação final
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'ticto_logs'
ORDER BY ordinal_position;


-- ==========================================
-- MIGRATION: 045_fix_transaction_hash_collision.sql
-- ==========================================

-- ================================================================
-- MIGRATION 045: Corrigir chave de deduplicação na ticto_pedidos
-- Data: 2026-02-20
-- Problema: A Ticto envia o mesmo transaction_hash para o pedido
--   principal e seu Order Bump (mesma transação de pagamento).
--   O UNIQUE(transaction_hash) faz o OB sobrescrever o pai (ou vice-versa).
-- Solução: Usar chave composta (transaction_hash, offer_code) para
--   permitir que pai e OB coexistam como registros separados.
-- ================================================================

-- 1. Remover a constraint UNIQUE atual em transaction_hash
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Encontrar o nome da constraint (pode ser index ou constraint)
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'ticto_pedidos'
      AND c.contype = 'u'  -- unique constraint
      AND EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = t.oid
            AND a.attnum = ANY(c.conkey)
            AND a.attname = 'transaction_hash'
      );

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE ticto_pedidos DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE 'Removida constraint: %', constraint_name;
    ELSE
        -- Pode ser um índice UNIQUE ao invés de constraint
        PERFORM 1 FROM pg_indexes
        WHERE tablename = 'ticto_pedidos'
          AND indexdef LIKE '%UNIQUE%transaction_hash%'
          AND indexdef NOT LIKE '%offer_code%';

        IF FOUND THEN
            -- Buscar e dropar o índice
            FOR constraint_name IN
                SELECT indexname FROM pg_indexes
                WHERE tablename = 'ticto_pedidos'
                  AND indexdef LIKE '%UNIQUE%transaction_hash%'
                  AND indexdef NOT LIKE '%offer_code%'
            LOOP
                EXECUTE format('DROP INDEX IF EXISTS %I', constraint_name);
                RAISE NOTICE 'Removido índice: %', constraint_name;
            END LOOP;
        END IF;
    END IF;
END $$;

-- 2. Criar nova constraint UNIQUE composta
ALTER TABLE ticto_pedidos
    ADD CONSTRAINT ticto_pedidos_tx_hash_offer_unique
    UNIQUE (transaction_hash, offer_code);

-- 3. Criar índice para buscas por transaction_hash sozinho (performance)
CREATE INDEX IF NOT EXISTS idx_ticto_pedidos_tx_hash
    ON ticto_pedidos(transaction_hash);

-- 4. Recarregar schema cache
NOTIFY pgrst, 'reload schema';

-- 5. Verificação
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'ticto_pedidos'::regclass
  AND contype = 'u'
ORDER BY conname;


-- ==========================================
-- MIGRATION: 046_sync_all_environments.sql
-- ==========================================

-- ================================================================
-- MIGRATION 046: Sincronização completa ticto_pedidos + ticto_logs
-- Data: 2026-02-21
-- Objetivo: Garantir que QUALQUER ambiente (produção/testes) tenha
--   a estrutura correta. Idempotente — pode rodar múltiplas vezes.
-- Consolida: migrations 043, 044, 045
-- ================================================================

-- ========================================
-- PARTE 1: TABELA ticto_logs
-- ========================================

-- 1.1 Garantir todas as colunas necessárias
DO $$
BEGIN
    -- Colunas usadas pelo webhook (smooth-function / webhook-ticto)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'payload') THEN
        ALTER TABLE ticto_logs ADD COLUMN payload JSONB;
        COMMENT ON COLUMN ticto_logs.payload IS 'Dados do payload recebido pelo webhook';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'erro') THEN
        ALTER TABLE ticto_logs ADD COLUMN erro TEXT;
        COMMENT ON COLUMN ticto_logs.erro IS 'Mensagem de erro quando o webhook falha';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'duracao_ms') THEN
        ALTER TABLE ticto_logs ADD COLUMN duracao_ms INTEGER;
        COMMENT ON COLUMN ticto_logs.duracao_ms IS 'Tempo de processamento em milissegundos';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'tipo') THEN
        ALTER TABLE ticto_logs ADD COLUMN tipo TEXT;
        COMMENT ON COLUMN ticto_logs.tipo IS 'Tipo do log: webhook, api, sync, error';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'sucesso') THEN
        ALTER TABLE ticto_logs ADD COLUMN sucesso BOOLEAN DEFAULT TRUE;
        COMMENT ON COLUMN ticto_logs.sucesso IS 'Se a operação foi bem-sucedida';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'resposta') THEN
        ALTER TABLE ticto_logs ADD COLUMN resposta JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'status_code') THEN
        ALTER TABLE ticto_logs ADD COLUMN status_code INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'codigo_rastreio') THEN
        ALTER TABLE ticto_logs ADD COLUMN codigo_rastreio TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticto_logs' AND column_name = 'erro_processamento') THEN
        ALTER TABLE ticto_logs ADD COLUMN erro_processamento TEXT;
    END IF;
END $$;

-- 1.2 Garantir índices
CREATE INDEX IF NOT EXISTS idx_ticto_logs_evento ON ticto_logs(evento);
CREATE INDEX IF NOT EXISTS idx_ticto_logs_tipo ON ticto_logs(tipo);
CREATE INDEX IF NOT EXISTS idx_ticto_logs_sucesso ON ticto_logs(sucesso);
CREATE INDEX IF NOT EXISTS idx_ticto_logs_created ON ticto_logs(created_at);

-- 1.3 Garantir RLS + policy para service_role
ALTER TABLE ticto_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'ticto_logs' AND policyname = 'service_role_full_access'
    ) THEN
        EXECUTE 'CREATE POLICY service_role_full_access ON ticto_logs FOR ALL TO service_role USING (true) WITH CHECK (true)';
    END IF;
END $$;

-- ========================================
-- PARTE 2: TABELA ticto_pedidos
-- ========================================

-- 2.1 Remover constraint UNIQUE antiga (apenas transaction_hash)
DO $$
DECLARE
    v_constraint TEXT;
    v_index TEXT;
BEGIN
    -- Verificar se existe constraint UNIQUE só em transaction_hash (sem offer_code)
    SELECT c.conname INTO v_constraint
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'ticto_pedidos'
      AND c.contype = 'u'
      AND array_length(c.conkey, 1) = 1  -- constraint de 1 coluna só
      AND EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = t.oid
            AND a.attnum = ANY(c.conkey)
            AND a.attname = 'transaction_hash'
      );

    IF v_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE ticto_pedidos DROP CONSTRAINT %I', v_constraint);
        RAISE NOTICE 'Removida constraint antiga: %', v_constraint;
    END IF;

    -- Também remover índices UNIQUE de transaction_hash sozinho
    FOR v_index IN
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'ticto_pedidos'
          AND indexdef LIKE '%UNIQUE%transaction_hash%'
          AND indexdef NOT LIKE '%offer_code%'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', v_index);
        RAISE NOTICE 'Removido índice antigo: %', v_index;
    END LOOP;
END $$;

-- 2.2 Criar constraint UNIQUE composta (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'ticto_pedidos'::regclass
          AND conname = 'ticto_pedidos_tx_hash_offer_unique'
    ) THEN
        ALTER TABLE ticto_pedidos
            ADD CONSTRAINT ticto_pedidos_tx_hash_offer_unique
            UNIQUE (transaction_hash, offer_code);
        RAISE NOTICE 'Criada constraint composta: ticto_pedidos_tx_hash_offer_unique';
    ELSE
        RAISE NOTICE 'Constraint composta já existe — OK';
    END IF;
END $$;

-- 2.3 Garantir índice de busca por transaction_hash (performance)
CREATE INDEX IF NOT EXISTS idx_ticto_pedidos_tx_hash ON ticto_pedidos(transaction_hash);

-- ========================================
-- PARTE 3: RECARREGAR SCHEMA + VERIFICAÇÃO
-- ========================================

NOTIFY pgrst, 'reload schema';

-- Verificar estrutura da ticto_logs
SELECT 'ticto_logs' AS tabela, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ticto_logs'
ORDER BY ordinal_position;

-- Verificar constraints da ticto_pedidos
SELECT 'ticto_pedidos' AS tabela, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'ticto_pedidos'::regclass
  AND contype = 'u';


-- ==========================================
-- MIGRATION: 047_fix_marcar_etiqueta_gerada.sql
-- ==========================================

-- ================================================================
-- MIGRATION 047: FIX Marcar Etiqueta Gerada em Produção
-- Data: 2026-02-24
-- Problema: atualização direta via cliente falha silenciosamente em
--           produção por possível problema de permissão/RLS.
-- Solução: RPC com SECURITY DEFINER para bypass seguro do RLS.
-- ================================================================

-- 1. RPC: marcar pedido(s) como Etiqueta Gerada (manual)
CREATE OR REPLACE FUNCTION marcar_etiqueta_gerada(p_ids UUID[])
RETURNS JSONB AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE pedidos_consolidados_v3
    SET
        codigo_rastreio = 'MANUAL',
        status_envio    = 'Etiqueta Manual',
        updated_at      = NOW()
    WHERE id = ANY(p_ids);

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'status',     'success',
        'atualizados', v_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'error',
        'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC: desfazer etiqueta (reverter para Pendente)
CREATE OR REPLACE FUNCTION desfazer_etiqueta_gerada(p_ids UUID[])
RETURNS JSONB AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE pedidos_consolidados_v3
    SET
        codigo_rastreio = NULL,
        status_envio    = 'Pendente',
        updated_at      = NOW()
    WHERE id = ANY(p_ids);

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'status',     'success',
        'atualizados', v_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'error',
        'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Garantir permissões de UPDATE na tabela (caso a policy UPDATE falte em produção)
DO $$
BEGIN
    -- Garantir policy UPDATE para authenticated
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'pedidos_consolidados_v3'
          AND policyname = 'allow_update_auth'
    ) THEN
        CREATE POLICY allow_update_auth
            ON public.pedidos_consolidados_v3
            FOR UPDATE TO authenticated
            USING (true) WITH CHECK (true);
        RAISE NOTICE 'Policy allow_update_auth criada';
    ELSE
        RAISE NOTICE 'Policy allow_update_auth já existe — OK';
    END IF;

    -- Garantir policy UPDATE para anon (webhook / service)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'pedidos_consolidados_v3'
          AND policyname = 'allow_update_anon'
    ) THEN
        CREATE POLICY allow_update_anon
            ON public.pedidos_consolidados_v3
            FOR UPDATE TO anon
            USING (true) WITH CHECK (true);
        RAISE NOTICE 'Policy allow_update_anon criada';
    ELSE
        RAISE NOTICE 'Policy allow_update_anon já existe — OK';
    END IF;
END $$;

-- 4. GRANT nas funções
GRANT EXECUTE ON FUNCTION marcar_etiqueta_gerada(UUID[])   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION desfazer_etiqueta_gerada(UUID[]) TO anon, authenticated, service_role;

-- 5. GRANT DML na tabela (idempotente)
GRANT SELECT, INSERT, UPDATE, DELETE ON pedidos_consolidados_v3 TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
SELECT 'Migration 047: marcar_etiqueta_gerada e desfazer_etiqueta_gerada criadas com sucesso!' AS resultado;


-- ==========================================
-- MIGRATION: 048_fix_pv_locked_parents.sql
-- ==========================================

-- ================================================================
-- MIGRATION 048: Fix OB + PV orphans para Parents Locked
-- Data: 2026-02-24 (v2 — colunas corretas + suporte a OB)
-- Problema 1: pedidos CC (Pós Venda) que chegam após o parent
--   ficar locked (codigo_rastreio / foi_editado) ficavam orphans.
-- Problema 2: Order Bumps do mesmo parent locked ficavam orphans.
-- Solução: PASSO 0.5-CC e PASSO 0.5-OB no consolidar_pedidos().
-- Correção: usa p.status e p.email_cliente (colunas reais do banco).
-- ================================================================

-- Funções auxiliares (idempotentes)
CREATE OR REPLACE FUNCTION calcular_janela_pv(data_pedido DATE)
RETURNS DATE AS $$
BEGIN
    IF data_pedido IS NULL THEN RETURN CURRENT_DATE; END IF;
    IF EXTRACT(DOW FROM data_pedido) IN (4, 5) THEN
        RETURN data_pedido + INTERVAL '4 days';
    END IF;
    RETURN data_pedido + INTERVAL '2 days';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION normalizar_documento(doc_raw TEXT)
RETURNS TEXT AS $$
DECLARE doc_limpo TEXT;
BEGIN
    IF doc_raw IS NULL OR doc_raw = '' THEN RETURN ''; END IF;
    doc_limpo := REGEXP_REPLACE(doc_raw, '[^0-9]', '', 'g');
    IF doc_limpo = '' THEN RETURN ''; END IF;
    RETURN LTRIM(doc_limpo, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION chave_endereco(p_cep TEXT, p_cidade TEXT, p_estado TEXT, p_rua TEXT, p_numero TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(TRIM(COALESCE(p_cep,''))) || '|' ||
           LOWER(TRIM(COALESCE(p_cidade,''))) || '|' ||
           LOWER(TRIM(COALESCE(p_estado,''))) || '|' ||
           LOWER(TRIM(COALESCE(p_rua,''))) || '|' ||
           LOWER(TRIM(COALESCE(p_numero,'')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION sigla_produto(nome TEXT)
RETURNS TEXT AS $$
DECLARE u TEXT;
BEGIN
    u := UPPER(COALESCE(nome, ''));
    IF u LIKE '%DESEJO PROIBIDO%' OR u LIKE '%DESEJO%' THEN RETURN 'DP'; END IF;
    IF u LIKE '%BELA LUMI%' OR u LIKE '%LUMI%' THEN RETURN 'BL'; END IF;
    IF u LIKE '%BELA FORMA%' OR u LIKE '%FORMA%' THEN RETURN 'BF'; END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- PROCEDIMENTO PRINCIPAL
-- ================================================================
CREATE OR REPLACE FUNCTION consolidar_pedidos()
RETURNS TABLE (
    total_principais INTEGER,
    total_order_bumps INTEGER,
    total_upsells INTEGER,
    total_pos_vendas INTEGER,
    total_dois_cartoes INTEGER,
    total_mesmo_endereco INTEGER
) AS $$
DECLARE
    v_total_principais    INTEGER := 0;
    v_total_order_bumps   INTEGER := 0;
    v_total_upsells       INTEGER := 0;
    v_total_pos_vendas    INTEGER := 0;
    v_total_dois_cartoes  INTEGER := 0;
    v_total_mesmo_endereco INTEGER := 0;

    pedido_pai     RECORD;
    locked_parent  RECORD;
    rec            RECORD;

    v_codigos_filhos TEXT[];
    v_order_bumps    TEXT[];
    v_upsells        TEXT[];
    v_pos_vendas     TEXT[];
    v_nome_oferta    TEXT;
    v_quantidade     INTEGER;
    v_doc_limpo      TEXT;
    v_email_lower    TEXT;
    v_data_limite    DATE;
    v_tem_dois_cartoes BOOLEAN;
    v_sigla          TEXT;
    v_descricao      TEXT;

    -- PASSO 0.5 vars
    v_novos_count  INTEGER;
    v_pv_append    TEXT[];
    v_ob_append    TEXT[];
    v_codes_append TEXT[];
    v_pv_dp INT; v_pv_bf INT; v_pv_bl INT;
    v_pv_item TEXT;
BEGIN
    -- ============================================================
    -- PASSO 0: PRESERVAR REGISTROS COM RASTREIO/EDITADOS
    -- ============================================================
    DROP TABLE IF EXISTS _locked_ids;
    CREATE TEMP TABLE _locked_ids (id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _locked_ids
    SELECT c.id FROM pedidos_consolidados_v3 c
    WHERE c.codigo_rastreio IS NOT NULL
       OR c.foi_editado = TRUE
       OR c.data_envio IS NOT NULL;

    DROP TABLE IF EXISTS _locked_codes;
    CREATE TEMP TABLE _locked_codes (code TEXT PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _locked_codes
    SELECT codigo_transacao FROM pedidos_consolidados_v3
    WHERE id IN (SELECT id FROM _locked_ids)
    ON CONFLICT DO NOTHING;

    INSERT INTO _locked_codes
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3
    WHERE id IN (SELECT id FROM _locked_ids)
    ON CONFLICT DO NOTHING;

    -- Deletar registros NÃO locked
    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
    ) to_delete
    WHERE c.id = to_delete.id;

    DROP TABLE IF EXISTS _processed;
    CREATE TEMP TABLE _processed (pedido_id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _processed
    SELECT p.id FROM pedidos p
    WHERE p.codigo_transacao IN (SELECT code FROM _locked_codes)
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- PASSO 0.5-CC: ANEXAR NOVOS PVs (CC) AOS PARENTS LOCKED
    -- ============================================================
    FOR locked_parent IN
        SELECT c.id, c.cpf, c.email, c.data_venda,
               c.codigos_filhos, c.pos_vendas, c.order_bumps,
               c.descricao_pacote, c.quantidade_pedidos
        FROM pedidos_consolidados_v3 c
        WHERE c.id IN (SELECT id FROM _locked_ids)
          AND c.cpf IS NOT NULL AND c.cpf != ''
          AND c.data_envio IS NULL
    LOOP
        v_data_limite  := calcular_janela_pv(locked_parent.data_venda::DATE);
        v_doc_limpo    := normalizar_documento(locked_parent.cpf);
        v_pv_append    := ARRAY[]::TEXT[];
        v_codes_append := ARRAY[]::TEXT[];
        v_novos_count  := 0;

        FOR rec IN
            SELECT p.id, p.codigo_transacao, p.nome_oferta, p.nome_produto,
                   sigla_produto(p.nome_produto) AS sigla_pv
            FROM pedidos p
            WHERE NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
              AND v_doc_limpo != ''
              AND p.data_venda::DATE >  locked_parent.data_venda::DATE
              AND p.data_venda::DATE <= v_data_limite
              AND UPPER(COALESCE(p.nome_oferta, '')) LIKE '%CC%'
              AND NOT (COALESCE(locked_parent.codigos_filhos, ARRAY[]::TEXT[])
                       @> ARRAY[p.codigo_transacao])
        LOOP
            v_codes_append := array_append(v_codes_append, rec.codigo_transacao);
            v_pv_append    := array_append(v_pv_append,
                COALESCE(rec.sigla_pv, '') || ':' || rec.nome_oferta);
            v_novos_count  := v_novos_count + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        IF v_novos_count > 0 THEN
            v_pv_dp := 0; v_pv_bf := 0; v_pv_bl := 0;
            FOREACH v_pv_item IN ARRAY v_pv_append LOOP
                IF    v_pv_item LIKE 'DP:%' THEN v_pv_dp := v_pv_dp + 1;
                ELSIF v_pv_item LIKE 'BF:%' THEN v_pv_bf := v_pv_bf + 1;
                ELSIF v_pv_item LIKE 'BL:%' THEN v_pv_bl := v_pv_bl + 1;
                END IF;
            END LOOP;

            v_descricao := locked_parent.descricao_pacote;
            IF v_pv_dp > 0 THEN v_descricao := v_descricao || ' + ' || v_pv_dp || ' DP'; END IF;
            IF v_pv_bf > 0 THEN v_descricao := v_descricao || ' + ' || v_pv_bf || ' BF'; END IF;
            IF v_pv_bl > 0 THEN v_descricao := v_descricao || ' + ' || v_pv_bl || ' BL'; END IF;

            UPDATE pedidos_consolidados_v3
            SET codigos_filhos     = COALESCE(codigos_filhos, '{}') || v_codes_append,
                pos_vendas         = COALESCE(pos_vendas, '{}') || v_pv_append,
                quantidade_pedidos = quantidade_pedidos + v_novos_count,
                descricao_pacote   = v_descricao,
                updated_at         = NOW()
            WHERE id = locked_parent.id;

            v_total_pos_vendas := v_total_pos_vendas + v_novos_count;
        END IF;
    END LOOP;

    -- ============================================================
    -- PASSO 0.5-OB: ANEXAR NOVOS ORDER BUMPS AOS PARENTS LOCKED
    -- OBs usam email + mesma data como chave de matching
    -- ============================================================
    FOR locked_parent IN
        SELECT c.id, c.email, c.data_venda,
               c.codigos_filhos, c.order_bumps,
               c.descricao_pacote, c.quantidade_pedidos
        FROM pedidos_consolidados_v3 c
        WHERE c.id IN (SELECT id FROM _locked_ids)
          AND c.email IS NOT NULL AND c.email != ''
          AND c.data_envio IS NULL
    LOOP
        v_email_lower  := LOWER(TRIM(locked_parent.email));
        v_ob_append    := ARRAY[]::TEXT[];
        v_codes_append := ARRAY[]::TEXT[];
        v_novos_count  := 0;

        FOR rec IN
            SELECT p.id, p.codigo_transacao, p.nome_oferta
            FROM pedidos p
            WHERE NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(TRIM(p.email_cliente)) = v_email_lower
              AND v_email_lower != ''
              AND p.data_venda::DATE = locked_parent.data_venda::DATE
              AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%ORDERBUMP%'
              AND NOT (COALESCE(locked_parent.codigos_filhos, ARRAY[]::TEXT[])
                       @> ARRAY[p.codigo_transacao])
        LOOP
            v_codes_append := array_append(v_codes_append, rec.codigo_transacao);
            v_ob_append    := array_append(v_ob_append, rec.nome_oferta);
            v_novos_count  := v_novos_count + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        IF v_novos_count > 0 THEN
            -- Reconstruir descricao: adicionar " + Order Bump" por cada novo OB
            v_descricao := locked_parent.descricao_pacote ||
                           REPEAT(' + Order Bump', v_novos_count);

            UPDATE pedidos_consolidados_v3
            SET codigos_filhos     = COALESCE(codigos_filhos, '{}') || v_codes_append,
                order_bumps        = COALESCE(order_bumps, '{}') || v_ob_append,
                quantidade_pedidos = quantidade_pedidos + v_novos_count,
                descricao_pacote   = v_descricao,
                updated_at         = NOW()
            WHERE id = locked_parent.id;

            v_total_order_bumps := v_total_order_bumps + v_novos_count;
        END IF;
    END LOOP;

    -- ============================================================
    -- PASSO 1: DETECTAR ENDEREÇOS COMPARTILHADOS (FRAUDE)
    -- ============================================================
    DROP TABLE IF EXISTS _addr_map;
    CREATE TEMP TABLE _addr_map (
        pedido_id UUID,
        chave TEXT,
        doc TEXT,
        nome TEXT
    ) ON COMMIT DROP;

    INSERT INTO _addr_map
    SELECT p.id,
           chave_endereco(p.cep, p.cidade, p.estado,
               COALESCE(p.logradouro, p.rua), p.numero),
           normalizar_documento(p.cpf_cliente),
           LOWER(TRIM(COALESCE(p.nome_cliente, '')))
    FROM pedidos p
    WHERE p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
      AND p.cep IS NOT NULL AND p.cep != '';

    DROP TABLE IF EXISTS _fraud_ids;
    CREATE TEMP TABLE _fraud_ids (pedido_id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _fraud_ids
    SELECT DISTINCT a1.pedido_id
    FROM _addr_map a1
    JOIN _addr_map a2 ON a1.chave = a2.chave AND a1.pedido_id != a2.pedido_id
    WHERE a1.doc != a2.doc OR a1.nome != a2.nome
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- PASSO 2: PROCESSAR PEDIDOS PRINCIPAIS
    -- ============================================================
    FOR pedido_pai IN
        SELECT p.*,
               normalizar_documento(p.cpf_cliente) AS doc_limpo,
               LOWER(COALESCE(p.email_cliente, '')) AS email_lower,
               UPPER(REPLACE(COALESCE(p.nome_oferta, ''), ' ', '')) AS oferta_norm,
               sigla_produto(p.nome_produto) AS sigla
        FROM pedidos p
        WHERE p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
          AND p.codigo_transacao IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
          AND sigla_produto(p.nome_produto) IS NOT NULL
          AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) NOT LIKE '%ORDERBUMP%'
          AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) NOT LIKE '%UPSELL%'
          AND UPPER(COALESCE(p.nome_oferta,'')) NOT LIKE '%CC%'
        ORDER BY p.data_venda ASC NULLS LAST
    LOOP
        IF EXISTS (SELECT 1 FROM _processed WHERE pedido_id = pedido_pai.id) THEN
            CONTINUE;
        END IF;

        v_codigos_filhos   := ARRAY[]::TEXT[];
        v_order_bumps      := ARRAY[]::TEXT[];
        v_upsells          := ARRAY[]::TEXT[];
        v_pos_vendas       := ARRAY[]::TEXT[];
        v_quantidade       := 1;
        v_doc_limpo        := pedido_pai.doc_limpo;
        v_email_lower      := pedido_pai.email_lower;
        v_tem_dois_cartoes := FALSE;
        v_sigla            := pedido_pai.sigla;

        INSERT INTO _processed VALUES (pedido_pai.id) ON CONFLICT DO NOTHING;

        -- Fraude de endereço
        IF EXISTS (SELECT 1 FROM _fraud_ids WHERE pedido_id = pedido_pai.id) THEN
            v_total_mesmo_endereco := v_total_mesmo_endereco + 1;
            INSERT INTO pedidos_consolidados_v3 (
                id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
                valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
                telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
                endereco_completo, data_venda, created_at, metadata, produto_principal,
                descricao_pacote, fraude_endereco, status_envio,
                dia_despacho, codigos_agrupados, quantidade_pedidos
            ) VALUES (
                pedido_pai.id, pedido_pai.codigo_transacao, 'Mesmo End',
                pedido_pai.nome_produto, pedido_pai.nome_oferta,
                pedido_pai.valor_total, pedido_pai.forma_pagamento, pedido_pai.parcelas,
                pedido_pai.nome_cliente, pedido_pai.email_cliente,
                pedido_pai.cpf_cliente, pedido_pai.telefone_cliente,
                pedido_pai.cep, COALESCE(pedido_pai.logradouro, pedido_pai.rua),
                pedido_pai.numero, pedido_pai.complemento, pedido_pai.bairro,
                pedido_pai.cidade, pedido_pai.estado,
                CONCAT_WS(', ', COALESCE(pedido_pai.logradouro,pedido_pai.rua),
                    pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
                pedido_pai.data_venda, pedido_pai.created_at, pedido_pai.metadata,
                v_sigla, v_sigla || ' - ' || pedido_pai.nome_oferta,
                TRUE, 'Bloqueado',
                (pedido_pai.data_venda::DATE + INTERVAL '2 days')::DATE,
                ARRAY[pedido_pai.codigo_transacao], 1
            ) ON CONFLICT (codigo_transacao) DO UPDATE SET
                status_aprovacao = 'Mesmo End', fraude_endereco = TRUE, updated_at = now();
            CONTINUE;
        END IF;

        -- Order Bumps (email + mesma data)
        FOR rec IN
            SELECT p.id, p.codigo_transacao, p.nome_oferta
            FROM pedidos p
            WHERE p.id != pedido_pai.id
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(COALESCE(p.email_cliente, '')) = v_email_lower
              AND v_email_lower != ''
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
              AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%ORDERBUMP%'
        LOOP
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            v_order_bumps    := array_append(v_order_bumps, rec.nome_oferta);
            v_quantidade     := v_quantidade + 1;
            v_total_order_bumps := v_total_order_bumps + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- Upsell (CPF + mesma data ou +1 dia)
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            FOR rec IN
                SELECT p.id, p.codigo_transacao, p.nome_oferta
                FROM pedidos p
                WHERE p.id != pedido_pai.id
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                  AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
                  AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
                  AND p.data_venda::DATE >= pedido_pai.data_venda::DATE
                  AND p.data_venda::DATE <= pedido_pai.data_venda::DATE + INTERVAL '1 day'
                  AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%UPSELL%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_upsells        := array_append(v_upsells, rec.nome_oferta);
                v_quantidade     := v_quantidade + 1;
                v_total_upsells  := v_total_upsells + 1;
                INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- Dois cartões (mesmo email + mesma oferta + mesma data)
        FOR rec IN
            SELECT p.id, p.codigo_transacao
            FROM pedidos p
            WHERE p.id != pedido_pai.id
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(COALESCE(p.email_cliente, '')) = v_email_lower
              AND v_email_lower != ''
              AND TRIM(p.nome_oferta) = TRIM(pedido_pai.nome_oferta)
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            v_total_dois_cartoes := v_total_dois_cartoes + 1;
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- Pós Vendas CC (CPF + janela PV)
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            v_data_limite := calcular_janela_pv(pedido_pai.data_venda::DATE);
            FOR rec IN
                SELECT p.id, p.codigo_transacao, p.nome_oferta, p.nome_produto,
                       sigla_produto(p.nome_produto) AS sigla_pv
                FROM pedidos p
                WHERE p.id != pedido_pai.id
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                  AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
                  AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
                  AND p.data_venda::DATE >  pedido_pai.data_venda::DATE
                  AND p.data_venda::DATE <= v_data_limite
                  AND UPPER(COALESCE(p.nome_oferta, '')) LIKE '%CC%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_pos_vendas     := array_append(v_pos_vendas,
                    COALESCE(rec.sigla_pv,'') || ':' || rec.nome_oferta);
                v_quantidade     := v_quantidade + 1;
                v_total_pos_vendas := v_total_pos_vendas + 1;
                INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- Montar nome oferta consolidado
        v_nome_oferta := pedido_pai.nome_oferta;
        v_nome_oferta := v_nome_oferta || REPEAT(' + Order Bump', COALESCE(array_length(v_order_bumps, 1), 0));
        v_nome_oferta := v_nome_oferta || REPEAT(' + UPSELL',     COALESCE(array_length(v_upsells, 1), 0));

        DECLARE
            v_pv_dp2 INT := 0; v_pv_bf2 INT := 0; v_pv_bl2 INT := 0;
            v_pv_item2 TEXT;
        BEGIN
            IF v_pos_vendas IS NOT NULL THEN
                FOREACH v_pv_item2 IN ARRAY v_pos_vendas LOOP
                    IF    v_pv_item2 LIKE 'DP:%' THEN v_pv_dp2 := v_pv_dp2 + 1;
                    ELSIF v_pv_item2 LIKE 'BF:%' THEN v_pv_bf2 := v_pv_bf2 + 1;
                    ELSIF v_pv_item2 LIKE 'BL:%' THEN v_pv_bl2 := v_pv_bl2 + 1;
                    END IF;
                END LOOP;
            END IF;
            IF v_pv_dp2 > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_dp2 || ' DP'; END IF;
            IF v_pv_bf2 > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bf2 || ' BF'; END IF;
            IF v_pv_bl2 > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bl2 || ' BL'; END IF;
        END;

        v_descricao := v_sigla || ' - ' || v_nome_oferta;

        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
            valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
            telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
            endereco_completo, data_venda, created_at, metadata,
            descricao_pacote, codigos_agrupados, quantidade_pedidos, produto_principal,
            dia_despacho, status_envio,
            order_bumps, upsells, pos_vendas, codigos_filhos,
            tem_dois_cartoes, fraude_endereco
        ) VALUES (
            pedido_pai.id, pedido_pai.codigo_transacao,
            CASE WHEN v_tem_dois_cartoes THEN '2 Cartões' ELSE 'Aprovado' END,
            pedido_pai.nome_produto, v_nome_oferta,
            pedido_pai.valor_total, pedido_pai.forma_pagamento, pedido_pai.parcelas,
            pedido_pai.nome_cliente, pedido_pai.email_cliente,
            pedido_pai.cpf_cliente, pedido_pai.telefone_cliente,
            pedido_pai.cep, COALESCE(pedido_pai.logradouro, pedido_pai.rua),
            pedido_pai.numero, pedido_pai.complemento, pedido_pai.bairro,
            pedido_pai.cidade, pedido_pai.estado,
            CONCAT_WS(', ', COALESCE(pedido_pai.logradouro,pedido_pai.rua),
                pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
            pedido_pai.data_venda, pedido_pai.created_at, pedido_pai.metadata,
            v_descricao,
            ARRAY[pedido_pai.codigo_transacao] || v_codigos_filhos,
            v_quantidade, v_sigla,
            (pedido_pai.data_venda::DATE + INTERVAL '2 days')::DATE,
            'Pendente',
            v_order_bumps, v_upsells, v_pos_vendas, v_codigos_filhos,
            v_tem_dois_cartoes, FALSE
        ) ON CONFLICT (codigo_transacao) DO UPDATE SET
            nome_oferta        = EXCLUDED.nome_oferta,
            descricao_pacote   = EXCLUDED.descricao_pacote,
            codigos_agrupados  = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps        = EXCLUDED.order_bumps,
            upsells            = EXCLUDED.upsells,
            pos_vendas         = EXCLUDED.pos_vendas,
            codigos_filhos     = EXCLUDED.codigos_filhos,
            tem_dois_cartoes   = EXCLUDED.tem_dois_cartoes,
            updated_at         = now();

        v_total_principais := v_total_principais + 1;
    END LOOP;

    -- Cleanup
    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;
    DROP TABLE IF EXISTS _addr_map;
    DROP TABLE IF EXISTS _fraud_ids;

    RETURN QUERY SELECT
        v_total_principais, v_total_order_bumps,
        v_total_upsells, v_total_pos_vendas,
        v_total_dois_cartoes, v_total_mesmo_endereco;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION consolidar_pedidos() TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON pedidos_consolidados_v3 TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
SELECT 'Migration 048 v2: consolidar_pedidos() com PASSO 0.5-CC + PASSO 0.5-OB (colunas corretas)!' AS resultado;


-- ==========================================
-- MIGRATION: 049_unificar_pedidos.sql
-- ==========================================

-- ================================================================
-- MIGRATION 049: Editar Descrição + Unificar Pedidos
-- Data: 2026-02-24
-- ================================================================

-- ----------------------------------------------------------------
-- RPC 1: Atualizar apenas o descricao_pacote (edição inline)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION atualizar_descricao_pacote(p_id UUID, p_descricao TEXT)
RETURNS JSONB AS $$
BEGIN
    UPDATE pedidos_consolidados_v3
    SET descricao_pacote = p_descricao,
        foi_editado      = TRUE,
        updated_at       = NOW()
    WHERE id = p_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Pedido não encontrado');
    END IF;

    RETURN jsonb_build_object('status', 'success');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------
-- RPC 2: Unificar dois pedidos em um só
-- p_manter_id  → pedido que sobrevive (o "principal")
-- p_absorver_id → pedido que será absorvido e removido
-- p_nova_descricao → nova descrição consolidada (ex: "BF - ... + 2 DP")
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION unificar_pedidos(
    p_manter_id      UUID,
    p_absorver_id    UUID,
    p_nova_descricao TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_absorver RECORD;
BEGIN
    SELECT * INTO v_absorver FROM pedidos_consolidados_v3 WHERE id = p_absorver_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Pedido a absorver não encontrado');
    END IF;

    -- Atualizar o pedido principal: mesclar filhos, códigos e nova descrição
    UPDATE pedidos_consolidados_v3
    SET
        descricao_pacote   = p_nova_descricao,
        -- Incorporar todos os códigos do pedido absorvido
        codigos_filhos     = array(
                                SELECT DISTINCT unnest(
                                    COALESCE(codigos_filhos, '{}') ||
                                    COALESCE(v_absorver.codigos_filhos, '{}') ||
                                    ARRAY[v_absorver.codigo_transacao]::TEXT[]
                                )
                             ),
        codigos_agrupados  = array(
                                SELECT DISTINCT unnest(
                                    COALESCE(codigos_agrupados, '{}') ||
                                    COALESCE(v_absorver.codigos_agrupados, '{}')
                                )
                             ),
        quantidade_pedidos = quantidade_pedidos + v_absorver.quantidade_pedidos,
        -- foi_editado=TRUE protege da re-consolidação automática futura
        foi_editado        = TRUE,
        updated_at         = NOW()
    WHERE id = p_manter_id;

    -- Remover o pedido absorvido
    DELETE FROM pedidos_consolidados_v3 WHERE id = p_absorver_id;

    RETURN jsonb_build_object(
        'status',  'success',
        'message', 'Pedidos unificados com sucesso'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissões
GRANT EXECUTE ON FUNCTION atualizar_descricao_pacote(UUID, TEXT)           TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION unificar_pedidos(UUID, UUID, TEXT)               TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
SELECT 'Migration 049: atualizar_descricao_pacote e unificar_pedidos criadas!' AS resultado;


-- ==========================================
-- MIGRATION: 050_fix_order_bump_duplicado.sql
-- ==========================================

-- ================================================================
-- MIGRATION 050: Fix Order Bump Duplicado em consolidar_pedidos()
-- Data: 2026-03-03
-- Problema: A plataforma Ticto envia DOIS registros para uma compra
--   com Order Bump:
--   1) "Compre 1 e Leve 2 + Order Bump" (registro "wrapper" — nome
--      completo da compra)
--   2) "Order Bump" (linha item do OB separada)
--   Ambos passam no filtro LIKE '%ORDERBUMP%', gerando um
--   "descricao_pacote" com "+ Order Bump + Order Bump".
-- Solução: No loop de coleta de OBs, filtrar registros cujo
--   nome_oferta já contém o nome_oferta do pedido pai (wrapper),
--   pois eles representam o MESMO OB, não um OB adicional.
--   Também aplica a mesma correção no PASSO 0.5-OB (locked parents).
-- ================================================================

CREATE OR REPLACE FUNCTION consolidar_pedidos()
RETURNS TABLE (
    total_principais INTEGER,
    total_order_bumps INTEGER,
    total_upsells INTEGER,
    total_pos_vendas INTEGER,
    total_dois_cartoes INTEGER,
    total_mesmo_endereco INTEGER
) AS $$
DECLARE
    v_total_principais    INTEGER := 0;
    v_total_order_bumps   INTEGER := 0;
    v_total_upsells       INTEGER := 0;
    v_total_pos_vendas    INTEGER := 0;
    v_total_dois_cartoes  INTEGER := 0;
    v_total_mesmo_endereco INTEGER := 0;

    pedido_pai     RECORD;
    locked_parent  RECORD;
    rec            RECORD;

    v_codigos_filhos TEXT[];
    v_order_bumps    TEXT[];
    v_upsells        TEXT[];
    v_pos_vendas     TEXT[];
    v_nome_oferta    TEXT;
    v_quantidade     INTEGER;
    v_doc_limpo      TEXT;
    v_email_lower    TEXT;
    v_data_limite    DATE;
    v_tem_dois_cartoes BOOLEAN;
    v_sigla          TEXT;
    v_descricao      TEXT;

    -- PASSO 0.5 vars
    v_novos_count  INTEGER;
    v_pv_append    TEXT[];
    v_ob_append    TEXT[];
    v_codes_append TEXT[];
    v_pv_dp INT; v_pv_bf INT; v_pv_bl INT;
    v_pv_item TEXT;
BEGIN
    -- ============================================================
    -- PASSO 0: PRESERVAR REGISTROS COM RASTREIO/EDITADOS
    -- ============================================================
    DROP TABLE IF EXISTS _locked_ids;
    CREATE TEMP TABLE _locked_ids (id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _locked_ids
    SELECT c.id FROM pedidos_consolidados_v3 c
    WHERE c.codigo_rastreio IS NOT NULL
       OR c.foi_editado = TRUE
       OR c.data_envio IS NOT NULL;

    DROP TABLE IF EXISTS _locked_codes;
    CREATE TEMP TABLE _locked_codes (code TEXT PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _locked_codes
    SELECT codigo_transacao FROM pedidos_consolidados_v3
    WHERE id IN (SELECT id FROM _locked_ids)
    ON CONFLICT DO NOTHING;

    INSERT INTO _locked_codes
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3
    WHERE id IN (SELECT id FROM _locked_ids)
    ON CONFLICT DO NOTHING;

    -- Deletar registros NÃO locked
    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
    ) to_delete
    WHERE c.id = to_delete.id;

    DROP TABLE IF EXISTS _processed;
    CREATE TEMP TABLE _processed (pedido_id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _processed
    SELECT p.id FROM pedidos p
    WHERE p.codigo_transacao IN (SELECT code FROM _locked_codes)
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- PASSO 0.5-CC: ANEXAR NOVOS PVs (CC) AOS PARENTS LOCKED
    -- ============================================================
    FOR locked_parent IN
        SELECT c.id, c.cpf, c.email, c.data_venda,
               c.codigos_filhos, c.pos_vendas, c.order_bumps,
               c.descricao_pacote, c.quantidade_pedidos
        FROM pedidos_consolidados_v3 c
        WHERE c.id IN (SELECT id FROM _locked_ids)
          AND c.cpf IS NOT NULL AND c.cpf != ''
          AND c.data_envio IS NULL
    LOOP
        v_data_limite  := calcular_janela_pv(locked_parent.data_venda::DATE);
        v_doc_limpo    := normalizar_documento(locked_parent.cpf);
        v_pv_append    := ARRAY[]::TEXT[];
        v_codes_append := ARRAY[]::TEXT[];
        v_novos_count  := 0;

        FOR rec IN
            SELECT p.id, p.codigo_transacao, p.nome_oferta, p.nome_produto,
                   sigla_produto(p.nome_produto) AS sigla_pv
            FROM pedidos p
            WHERE NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
              AND v_doc_limpo != ''
              AND p.data_venda::DATE >  locked_parent.data_venda::DATE
              AND p.data_venda::DATE <= v_data_limite
              AND UPPER(COALESCE(p.nome_oferta, '')) LIKE '%CC%'
              AND NOT (COALESCE(locked_parent.codigos_filhos, ARRAY[]::TEXT[])
                       @> ARRAY[p.codigo_transacao])
        LOOP
            v_codes_append := array_append(v_codes_append, rec.codigo_transacao);
            v_pv_append    := array_append(v_pv_append,
                COALESCE(rec.sigla_pv, '') || ':' || rec.nome_oferta);
            v_novos_count  := v_novos_count + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        IF v_novos_count > 0 THEN
            v_pv_dp := 0; v_pv_bf := 0; v_pv_bl := 0;
            FOREACH v_pv_item IN ARRAY v_pv_append LOOP
                IF    v_pv_item LIKE 'DP:%' THEN v_pv_dp := v_pv_dp + 1;
                ELSIF v_pv_item LIKE 'BF:%' THEN v_pv_bf := v_pv_bf + 1;
                ELSIF v_pv_item LIKE 'BL:%' THEN v_pv_bl := v_pv_bl + 1;
                END IF;
            END LOOP;

            v_descricao := locked_parent.descricao_pacote;
            IF v_pv_dp > 0 THEN v_descricao := v_descricao || ' + ' || v_pv_dp || ' DP'; END IF;
            IF v_pv_bf > 0 THEN v_descricao := v_descricao || ' + ' || v_pv_bf || ' BF'; END IF;
            IF v_pv_bl > 0 THEN v_descricao := v_descricao || ' + ' || v_pv_bl || ' BL'; END IF;

            UPDATE pedidos_consolidados_v3
            SET codigos_filhos     = COALESCE(codigos_filhos, '{}') || v_codes_append,
                pos_vendas         = COALESCE(pos_vendas, '{}') || v_pv_append,
                quantidade_pedidos = quantidade_pedidos + v_novos_count,
                descricao_pacote   = v_descricao,
                updated_at         = NOW()
            WHERE id = locked_parent.id;

            v_total_pos_vendas := v_total_pos_vendas + v_novos_count;
        END IF;
    END LOOP;

    -- ============================================================
    -- PASSO 0.5-OB: ANEXAR NOVOS ORDER BUMPS AOS PARENTS LOCKED
    -- ⭐ FIX: Filtrar registros "wrapper" (nome_oferta do OB já
    --    contém o nome_oferta do parent) para evitar duplicação.
    -- ============================================================
    FOR locked_parent IN
        SELECT c.id, c.email, c.data_venda, c.nome_oferta,
               c.codigos_filhos, c.order_bumps,
               c.descricao_pacote, c.quantidade_pedidos
        FROM pedidos_consolidados_v3 c
        WHERE c.id IN (SELECT id FROM _locked_ids)
          AND c.email IS NOT NULL AND c.email != ''
          AND c.data_envio IS NULL
    LOOP
        v_email_lower  := LOWER(TRIM(locked_parent.email));
        v_ob_append    := ARRAY[]::TEXT[];
        v_codes_append := ARRAY[]::TEXT[];
        v_novos_count  := 0;

        FOR rec IN
            SELECT p.id, p.codigo_transacao, p.nome_oferta
            FROM pedidos p
            WHERE NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(TRIM(p.email_cliente)) = v_email_lower
              AND v_email_lower != ''
              AND p.data_venda::DATE = locked_parent.data_venda::DATE
              AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%ORDERBUMP%'
              AND NOT (COALESCE(locked_parent.codigos_filhos, ARRAY[]::TEXT[])
                       @> ARRAY[p.codigo_transacao])
              -- ⭐ FIX: Ignorar registros "wrapper" onde o nome do OB
              --    já contém o nome do pedido pai (são o mesmo OB, não um adicional)
              AND NOT (
                  locked_parent.nome_oferta IS NOT NULL
                  AND locked_parent.nome_oferta != ''
                  AND UPPER(COALESCE(p.nome_oferta,'')) LIKE '%' || UPPER(TRIM(locked_parent.nome_oferta)) || '%'
              )
        LOOP
            v_codes_append := array_append(v_codes_append, rec.codigo_transacao);
            v_ob_append    := array_append(v_ob_append, rec.nome_oferta);
            v_novos_count  := v_novos_count + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        IF v_novos_count > 0 THEN
            v_descricao := locked_parent.descricao_pacote ||
                           REPEAT(' + Order Bump', v_novos_count);

            UPDATE pedidos_consolidados_v3
            SET codigos_filhos     = COALESCE(codigos_filhos, '{}') || v_codes_append,
                order_bumps        = COALESCE(order_bumps, '{}') || v_ob_append,
                quantidade_pedidos = quantidade_pedidos + v_novos_count,
                descricao_pacote   = v_descricao,
                updated_at         = NOW()
            WHERE id = locked_parent.id;

            v_total_order_bumps := v_total_order_bumps + v_novos_count;
        END IF;
    END LOOP;

    -- ============================================================
    -- PASSO 1: DETECTAR ENDEREÇOS COMPARTILHADOS (FRAUDE)
    -- ============================================================
    DROP TABLE IF EXISTS _addr_map;
    CREATE TEMP TABLE _addr_map (
        pedido_id UUID,
        chave TEXT,
        doc TEXT,
        nome TEXT
    ) ON COMMIT DROP;

    INSERT INTO _addr_map
    SELECT p.id,
           chave_endereco(p.cep, p.cidade, p.estado,
               COALESCE(p.logradouro, p.rua), p.numero),
           normalizar_documento(p.cpf_cliente),
           LOWER(TRIM(COALESCE(p.nome_cliente, '')))
    FROM pedidos p
    WHERE p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
      AND p.cep IS NOT NULL AND p.cep != '';

    DROP TABLE IF EXISTS _fraud_ids;
    CREATE TEMP TABLE _fraud_ids (pedido_id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _fraud_ids
    SELECT DISTINCT a1.pedido_id
    FROM _addr_map a1
    JOIN _addr_map a2 ON a1.chave = a2.chave AND a1.pedido_id != a2.pedido_id
    WHERE a1.doc != a2.doc OR a1.nome != a2.nome
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- PASSO 2: PROCESSAR PEDIDOS PRINCIPAIS
    -- ============================================================
    FOR pedido_pai IN
        SELECT p.*,
               normalizar_documento(p.cpf_cliente) AS doc_limpo,
               LOWER(COALESCE(p.email_cliente, '')) AS email_lower,
               UPPER(REPLACE(COALESCE(p.nome_oferta, ''), ' ', '')) AS oferta_norm,
               sigla_produto(p.nome_produto) AS sigla
        FROM pedidos p
        WHERE p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
          AND p.codigo_transacao IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
          AND sigla_produto(p.nome_produto) IS NOT NULL
          AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) NOT LIKE '%ORDERBUMP%'
          AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) NOT LIKE '%UPSELL%'
          AND UPPER(COALESCE(p.nome_oferta,'')) NOT LIKE '%CC%'
        ORDER BY p.data_venda ASC NULLS LAST
    LOOP
        IF EXISTS (SELECT 1 FROM _processed WHERE pedido_id = pedido_pai.id) THEN
            CONTINUE;
        END IF;

        v_codigos_filhos   := ARRAY[]::TEXT[];
        v_order_bumps      := ARRAY[]::TEXT[];
        v_upsells          := ARRAY[]::TEXT[];
        v_pos_vendas       := ARRAY[]::TEXT[];
        v_quantidade       := 1;
        v_doc_limpo        := pedido_pai.doc_limpo;
        v_email_lower      := pedido_pai.email_lower;
        v_tem_dois_cartoes := FALSE;
        v_sigla            := pedido_pai.sigla;

        INSERT INTO _processed VALUES (pedido_pai.id) ON CONFLICT DO NOTHING;

        -- Fraude de endereço
        IF EXISTS (SELECT 1 FROM _fraud_ids WHERE pedido_id = pedido_pai.id) THEN
            v_total_mesmo_endereco := v_total_mesmo_endereco + 1;
            INSERT INTO pedidos_consolidados_v3 (
                id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
                valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
                telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
                endereco_completo, data_venda, created_at, metadata, produto_principal,
                descricao_pacote, fraude_endereco, status_envio,
                dia_despacho, codigos_agrupados, quantidade_pedidos
            ) VALUES (
                pedido_pai.id, pedido_pai.codigo_transacao, 'Mesmo End',
                pedido_pai.nome_produto, pedido_pai.nome_oferta,
                pedido_pai.valor_total, pedido_pai.forma_pagamento, pedido_pai.parcelas,
                pedido_pai.nome_cliente, pedido_pai.email_cliente,
                pedido_pai.cpf_cliente, pedido_pai.telefone_cliente,
                pedido_pai.cep, COALESCE(pedido_pai.logradouro, pedido_pai.rua),
                pedido_pai.numero, pedido_pai.complemento, pedido_pai.bairro,
                pedido_pai.cidade, pedido_pai.estado,
                CONCAT_WS(', ', COALESCE(pedido_pai.logradouro,pedido_pai.rua),
                    pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
                pedido_pai.data_venda, pedido_pai.created_at, pedido_pai.metadata,
                v_sigla, v_sigla || ' - ' || pedido_pai.nome_oferta,
                TRUE, 'Bloqueado',
                (pedido_pai.data_venda::DATE + INTERVAL '2 days')::DATE,
                ARRAY[pedido_pai.codigo_transacao], 1
            ) ON CONFLICT (codigo_transacao) DO UPDATE SET
                status_aprovacao = 'Mesmo End', fraude_endereco = TRUE, updated_at = now();
            CONTINUE;
        END IF;

        -- ⭐ Order Bumps (email + mesma data)
        -- FIX: Filtrar registros "wrapper" cujo nome_oferta já contém o
        --      nome_oferta do pai. Ex: se pai="Compre 1 e Leve 2" e OB=
        --      "Compre 1 e Leve 2 + Order Bump", esse é um registro duplicado
        --      que a Ticto envia (o mesmo OB em dois formatos), não um OB extra.
        FOR rec IN
            SELECT p.id, p.codigo_transacao, p.nome_oferta
            FROM pedidos p
            WHERE p.id != pedido_pai.id
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(COALESCE(p.email_cliente, '')) = v_email_lower
              AND v_email_lower != ''
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
              AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%ORDERBUMP%'
              -- ⭐ FIX: Excluir OBs "wrapper" (nome já contém o nome do pai)
              AND NOT (
                  pedido_pai.nome_oferta IS NOT NULL
                  AND pedido_pai.nome_oferta != ''
                  AND UPPER(COALESCE(p.nome_oferta,'')) LIKE '%' || UPPER(TRIM(pedido_pai.nome_oferta)) || '%'
              )
        LOOP
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            v_order_bumps    := array_append(v_order_bumps, rec.nome_oferta);
            v_quantidade     := v_quantidade + 1;
            v_total_order_bumps := v_total_order_bumps + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- Upsell (CPF + mesma data ou +1 dia)
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            FOR rec IN
                SELECT p.id, p.codigo_transacao, p.nome_oferta
                FROM pedidos p
                WHERE p.id != pedido_pai.id
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                  AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
                  AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
                  AND p.data_venda::DATE >= pedido_pai.data_venda::DATE
                  AND p.data_venda::DATE <= pedido_pai.data_venda::DATE + INTERVAL '1 day'
                  AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%UPSELL%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_upsells        := array_append(v_upsells, rec.nome_oferta);
                v_quantidade     := v_quantidade + 1;
                v_total_upsells  := v_total_upsells + 1;
                INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- Dois cartões (mesmo email + mesma oferta + mesma data)
        FOR rec IN
            SELECT p.id, p.codigo_transacao
            FROM pedidos p
            WHERE p.id != pedido_pai.id
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(COALESCE(p.email_cliente, '')) = v_email_lower
              AND v_email_lower != ''
              AND TRIM(p.nome_oferta) = TRIM(pedido_pai.nome_oferta)
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            v_total_dois_cartoes := v_total_dois_cartoes + 1;
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- Pós Vendas CC (CPF + janela PV)
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            v_data_limite := calcular_janela_pv(pedido_pai.data_venda::DATE);
            FOR rec IN
                SELECT p.id, p.codigo_transacao, p.nome_oferta, p.nome_produto,
                       sigla_produto(p.nome_produto) AS sigla_pv
                FROM pedidos p
                WHERE p.id != pedido_pai.id
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                  AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
                  AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
                  AND p.data_venda::DATE >  pedido_pai.data_venda::DATE
                  AND p.data_venda::DATE <= v_data_limite
                  AND UPPER(COALESCE(p.nome_oferta, '')) LIKE '%CC%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_pos_vendas     := array_append(v_pos_vendas,
                    COALESCE(rec.sigla_pv,'') || ':' || rec.nome_oferta);
                v_quantidade     := v_quantidade + 1;
                v_total_pos_vendas := v_total_pos_vendas + 1;
                INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- Montar nome oferta consolidado
        v_nome_oferta := pedido_pai.nome_oferta;
        v_nome_oferta := v_nome_oferta || REPEAT(' + Order Bump', COALESCE(array_length(v_order_bumps, 1), 0));
        v_nome_oferta := v_nome_oferta || REPEAT(' + UPSELL',     COALESCE(array_length(v_upsells, 1), 0));

        DECLARE
            v_pv_dp2 INT := 0; v_pv_bf2 INT := 0; v_pv_bl2 INT := 0;
            v_pv_item2 TEXT;
        BEGIN
            IF v_pos_vendas IS NOT NULL THEN
                FOREACH v_pv_item2 IN ARRAY v_pos_vendas LOOP
                    IF    v_pv_item2 LIKE 'DP:%' THEN v_pv_dp2 := v_pv_dp2 + 1;
                    ELSIF v_pv_item2 LIKE 'BF:%' THEN v_pv_bf2 := v_pv_bf2 + 1;
                    ELSIF v_pv_item2 LIKE 'BL:%' THEN v_pv_bl2 := v_pv_bl2 + 1;
                    END IF;
                END LOOP;
            END IF;
            IF v_pv_dp2 > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_dp2 || ' DP'; END IF;
            IF v_pv_bf2 > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bf2 || ' BF'; END IF;
            IF v_pv_bl2 > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bl2 || ' BL'; END IF;
        END;

        v_descricao := v_sigla || ' - ' || v_nome_oferta;

        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
            valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
            telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
            endereco_completo, data_venda, created_at, metadata,
            descricao_pacote, codigos_agrupados, quantidade_pedidos, produto_principal,
            dia_despacho, status_envio,
            order_bumps, upsells, pos_vendas, codigos_filhos,
            tem_dois_cartoes, fraude_endereco
        ) VALUES (
            pedido_pai.id, pedido_pai.codigo_transacao,
            CASE WHEN v_tem_dois_cartoes THEN '2 Cartões' ELSE 'Aprovado' END,
            pedido_pai.nome_produto, v_nome_oferta,
            pedido_pai.valor_total, pedido_pai.forma_pagamento, pedido_pai.parcelas,
            pedido_pai.nome_cliente, pedido_pai.email_cliente,
            pedido_pai.cpf_cliente, pedido_pai.telefone_cliente,
            pedido_pai.cep, COALESCE(pedido_pai.logradouro, pedido_pai.rua),
            pedido_pai.numero, pedido_pai.complemento, pedido_pai.bairro,
            pedido_pai.cidade, pedido_pai.estado,
            CONCAT_WS(', ', COALESCE(pedido_pai.logradouro,pedido_pai.rua),
                pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
            pedido_pai.data_venda, pedido_pai.created_at, pedido_pai.metadata,
            v_descricao,
            ARRAY[pedido_pai.codigo_transacao] || v_codigos_filhos,
            v_quantidade, v_sigla,
            (pedido_pai.data_venda::DATE + INTERVAL '2 days')::DATE,
            'Pendente',
            v_order_bumps, v_upsells, v_pos_vendas, v_codigos_filhos,
            v_tem_dois_cartoes, FALSE
        ) ON CONFLICT (codigo_transacao) DO UPDATE SET
            nome_oferta        = EXCLUDED.nome_oferta,
            descricao_pacote   = EXCLUDED.descricao_pacote,
            codigos_agrupados  = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps        = EXCLUDED.order_bumps,
            upsells            = EXCLUDED.upsells,
            pos_vendas         = EXCLUDED.pos_vendas,
            codigos_filhos     = EXCLUDED.codigos_filhos,
            tem_dois_cartoes   = EXCLUDED.tem_dois_cartoes,
            updated_at         = now();

        v_total_principais := v_total_principais + 1;
    END LOOP;

    -- Cleanup
    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;
    DROP TABLE IF EXISTS _addr_map;
    DROP TABLE IF EXISTS _fraud_ids;

    RETURN QUERY SELECT
        v_total_principais, v_total_order_bumps,
        v_total_upsells, v_total_pos_vendas,
        v_total_dois_cartoes, v_total_mesmo_endereco;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- CORRIGIR REGISTROS EXISTENTES COM ORDER BUMP DUPLICADO
-- Remove o segundo "Order Bump" de registros que já estão no banco
-- com "nome_oferta LIKE '% + Order Bump + Order Bump%'"
-- ⚠️  Só corrige registros NÃO locked (sem rastreio/editados)
--    pois os locked devem ser tratados manualmente.
-- ================================================================
UPDATE pedidos_consolidados_v3
SET
    nome_oferta      = REGEXP_REPLACE(nome_oferta,      '(\s*\+\s*Order Bump){2,}', ' + Order Bump', 'gi'),
    descricao_pacote = REGEXP_REPLACE(descricao_pacote, '(\s*\+\s*Order Bump){2,}', ' + Order Bump', 'gi'),
    updated_at       = NOW()
WHERE (nome_oferta      ILIKE '%Order Bump%Order Bump%'
    OR descricao_pacote ILIKE '%Order Bump%Order Bump%')
  AND (codigo_rastreio IS NULL AND foi_editado IS NOT TRUE AND data_envio IS NULL);

GRANT EXECUTE ON FUNCTION consolidar_pedidos() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
SELECT 'Migration 050: Fix Order Bump duplicado em consolidar_pedidos() aplicado!' AS resultado;


-- ==========================================
-- MIGRATION: 051_fix_ob_wrapper_logic.sql
-- ==========================================

-- ================================================================
-- MIGRATION 051: Corrigir detecção de Order Bump (fix da 050)
-- Data: 2026-03-03
--
-- Problema com a migration 050:
--   O filtro de "wrapper OB" excluía registros cujo nome_oferta
--   contém o nome do pai — mas isso é o PADRÃO NORMAL da Ticto
--   para OBs legítimos (ex: "Compre 1 e Leve 2 + Order Bump").
--   Resultado: 5 OBs válidos foram ignorados.
--
-- Causa real do "Order Bump + Order Bump" duplicado:
--   Em ALGUNS casos, a Ticto envia 2 registros para o mesmo OB:
--   1) "Compre 1 e Leve 2 + Order Bump"  (wrapper — nome completo)
--   2) "Order Bump"                        (item avulso separado)
--   Ambos passavam no filtro LIKE '%ORDERBUMP%' → contagem dupla.
--
-- Fix correto:
--   Excluir o registro wrapper SOMENTE SE também existir um OB
--   standalone (puro) para o mesmo email+data. Se o único OB
--   disponível for o wrapper, mantê-lo como OB válido.
-- ================================================================

CREATE OR REPLACE FUNCTION consolidar_pedidos()
RETURNS TABLE (
    total_principais INTEGER,
    total_order_bumps INTEGER,
    total_upsells INTEGER,
    total_pos_vendas INTEGER,
    total_dois_cartoes INTEGER,
    total_mesmo_endereco INTEGER
) AS $$
DECLARE
    v_total_principais    INTEGER := 0;
    v_total_order_bumps   INTEGER := 0;
    v_total_upsells       INTEGER := 0;
    v_total_pos_vendas    INTEGER := 0;
    v_total_dois_cartoes  INTEGER := 0;
    v_total_mesmo_endereco INTEGER := 0;

    pedido_pai     RECORD;
    locked_parent  RECORD;
    rec            RECORD;

    v_codigos_filhos TEXT[];
    v_order_bumps    TEXT[];
    v_upsells        TEXT[];
    v_pos_vendas     TEXT[];
    v_nome_oferta    TEXT;
    v_quantidade     INTEGER;
    v_doc_limpo      TEXT;
    v_email_lower    TEXT;
    v_data_limite    DATE;
    v_tem_dois_cartoes BOOLEAN;
    v_sigla          TEXT;
    v_descricao      TEXT;

    v_novos_count  INTEGER;
    v_pv_append    TEXT[];
    v_ob_append    TEXT[];
    v_codes_append TEXT[];
    v_pv_dp INT; v_pv_bf INT; v_pv_bl INT;
    v_pv_item TEXT;

    -- Variável para checar se existe OB standalone
    v_has_standalone_ob BOOLEAN;
BEGIN
    -- ============================================================
    -- PASSO 0: PRESERVAR REGISTROS COM RASTREIO/EDITADOS
    -- ============================================================
    DROP TABLE IF EXISTS _locked_ids;
    CREATE TEMP TABLE _locked_ids (id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _locked_ids
    SELECT c.id FROM pedidos_consolidados_v3 c
    WHERE c.codigo_rastreio IS NOT NULL
       OR c.foi_editado = TRUE
       OR c.data_envio IS NOT NULL;

    DROP TABLE IF EXISTS _locked_codes;
    CREATE TEMP TABLE _locked_codes (code TEXT PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _locked_codes
    SELECT codigo_transacao FROM pedidos_consolidados_v3
    WHERE id IN (SELECT id FROM _locked_ids)
    ON CONFLICT DO NOTHING;

    INSERT INTO _locked_codes
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3
    WHERE id IN (SELECT id FROM _locked_ids)
    ON CONFLICT DO NOTHING;

    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
    ) to_delete
    WHERE c.id = to_delete.id;

    DROP TABLE IF EXISTS _processed;
    CREATE TEMP TABLE _processed (pedido_id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _processed
    SELECT p.id FROM pedidos p
    WHERE p.codigo_transacao IN (SELECT code FROM _locked_codes)
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- PASSO 0.5-CC: ANEXAR NOVOS PVs (CC) AOS PARENTS LOCKED
    -- ============================================================
    FOR locked_parent IN
        SELECT c.id, c.cpf, c.email, c.data_venda,
               c.codigos_filhos, c.pos_vendas, c.order_bumps,
               c.descricao_pacote, c.quantidade_pedidos
        FROM pedidos_consolidados_v3 c
        WHERE c.id IN (SELECT id FROM _locked_ids)
          AND c.cpf IS NOT NULL AND c.cpf != ''
          AND c.data_envio IS NULL
    LOOP
        v_data_limite  := calcular_janela_pv(locked_parent.data_venda::DATE);
        v_doc_limpo    := normalizar_documento(locked_parent.cpf);
        v_pv_append    := ARRAY[]::TEXT[];
        v_codes_append := ARRAY[]::TEXT[];
        v_novos_count  := 0;

        FOR rec IN
            SELECT p.id, p.codigo_transacao, p.nome_oferta, p.nome_produto,
                   sigla_produto(p.nome_produto) AS sigla_pv
            FROM pedidos p
            WHERE NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
              AND v_doc_limpo != ''
              AND p.data_venda::DATE >  locked_parent.data_venda::DATE
              AND p.data_venda::DATE <= v_data_limite
              AND UPPER(COALESCE(p.nome_oferta, '')) LIKE '%CC%'
              AND NOT (COALESCE(locked_parent.codigos_filhos, ARRAY[]::TEXT[])
                       @> ARRAY[p.codigo_transacao])
        LOOP
            v_codes_append := array_append(v_codes_append, rec.codigo_transacao);
            v_pv_append    := array_append(v_pv_append,
                COALESCE(rec.sigla_pv, '') || ':' || rec.nome_oferta);
            v_novos_count  := v_novos_count + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        IF v_novos_count > 0 THEN
            v_pv_dp := 0; v_pv_bf := 0; v_pv_bl := 0;
            FOREACH v_pv_item IN ARRAY v_pv_append LOOP
                IF    v_pv_item LIKE 'DP:%' THEN v_pv_dp := v_pv_dp + 1;
                ELSIF v_pv_item LIKE 'BF:%' THEN v_pv_bf := v_pv_bf + 1;
                ELSIF v_pv_item LIKE 'BL:%' THEN v_pv_bl := v_pv_bl + 1;
                END IF;
            END LOOP;

            v_descricao := locked_parent.descricao_pacote;
            IF v_pv_dp > 0 THEN v_descricao := v_descricao || ' + ' || v_pv_dp || ' DP'; END IF;
            IF v_pv_bf > 0 THEN v_descricao := v_descricao || ' + ' || v_pv_bf || ' BF'; END IF;
            IF v_pv_bl > 0 THEN v_descricao := v_descricao || ' + ' || v_pv_bl || ' BL'; END IF;

            UPDATE pedidos_consolidados_v3
            SET codigos_filhos     = COALESCE(codigos_filhos, '{}') || v_codes_append,
                pos_vendas         = COALESCE(pos_vendas, '{}') || v_pv_append,
                quantidade_pedidos = quantidade_pedidos + v_novos_count,
                descricao_pacote   = v_descricao,
                updated_at         = NOW()
            WHERE id = locked_parent.id;

            v_total_pos_vendas := v_total_pos_vendas + v_novos_count;
        END IF;
    END LOOP;

    -- ============================================================
    -- PASSO 0.5-OB: ANEXAR NOVOS ORDER BUMPS AOS PARENTS LOCKED
    -- ✅ FIX CORRETO: Excluir wrapper SOMENTE se existe OB standalone
    -- ============================================================
    FOR locked_parent IN
        SELECT c.id, c.email, c.data_venda, c.nome_oferta,
               c.codigos_filhos, c.order_bumps,
               c.descricao_pacote, c.quantidade_pedidos
        FROM pedidos_consolidados_v3 c
        WHERE c.id IN (SELECT id FROM _locked_ids)
          AND c.email IS NOT NULL AND c.email != ''
          AND c.data_envio IS NULL
    LOOP
        v_email_lower  := LOWER(TRIM(locked_parent.email));
        v_ob_append    := ARRAY[]::TEXT[];
        v_codes_append := ARRAY[]::TEXT[];
        v_novos_count  := 0;

        -- Determinar se existe OB standalone (puro) para este email+data
        -- OB standalone = contém ORDERBUMP no nome mas NÃO contém o nome do pai
        v_has_standalone_ob := EXISTS (
            SELECT 1 FROM pedidos p
            WHERE NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(TRIM(p.email_cliente)) = v_email_lower
              AND p.data_venda::DATE = locked_parent.data_venda::DATE
              AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%ORDERBUMP%'
              AND NOT (COALESCE(locked_parent.codigos_filhos, ARRAY[]::TEXT[])
                       @> ARRAY[p.codigo_transacao])
              -- OB puro = nome NÃO contém o nome do pai
              AND NOT (
                  locked_parent.nome_oferta IS NOT NULL
                  AND locked_parent.nome_oferta != ''
                  AND UPPER(COALESCE(p.nome_oferta,''))
                      LIKE '%' || UPPER(TRIM(locked_parent.nome_oferta)) || '%'
              )
        );

        FOR rec IN
            SELECT p.id, p.codigo_transacao, p.nome_oferta
            FROM pedidos p
            WHERE NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(TRIM(p.email_cliente)) = v_email_lower
              AND v_email_lower != ''
              AND p.data_venda::DATE = locked_parent.data_venda::DATE
              AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%ORDERBUMP%'
              AND NOT (COALESCE(locked_parent.codigos_filhos, ARRAY[]::TEXT[])
                       @> ARRAY[p.codigo_transacao])
              -- ✅ LÓGICA CORRIGIDA:
              -- Excluir wrapper SOMENTE se existir OB standalone para o mesmo cliente.
              -- Se OB standalone existe → ignora wrapper (evita duplicação).
              -- Se NÃO existe standalone → mantém wrapper (é o único OB válido).
              AND NOT (
                  v_has_standalone_ob = TRUE
                  AND locked_parent.nome_oferta IS NOT NULL
                  AND locked_parent.nome_oferta != ''
                  AND UPPER(COALESCE(p.nome_oferta,''))
                      LIKE '%' || UPPER(TRIM(locked_parent.nome_oferta)) || '%'
              )
        LOOP
            v_codes_append := array_append(v_codes_append, rec.codigo_transacao);
            v_ob_append    := array_append(v_ob_append, rec.nome_oferta);
            v_novos_count  := v_novos_count + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        IF v_novos_count > 0 THEN
            v_descricao := locked_parent.descricao_pacote ||
                           REPEAT(' + Order Bump', v_novos_count);

            UPDATE pedidos_consolidados_v3
            SET codigos_filhos     = COALESCE(codigos_filhos, '{}') || v_codes_append,
                order_bumps        = COALESCE(order_bumps, '{}') || v_ob_append,
                quantidade_pedidos = quantidade_pedidos + v_novos_count,
                descricao_pacote   = v_descricao,
                updated_at         = NOW()
            WHERE id = locked_parent.id;

            v_total_order_bumps := v_total_order_bumps + v_novos_count;
        END IF;
    END LOOP;

    -- ============================================================
    -- PASSO 1: DETECTAR ENDEREÇOS COMPARTILHADOS (FRAUDE)
    -- ============================================================
    DROP TABLE IF EXISTS _addr_map;
    CREATE TEMP TABLE _addr_map (
        pedido_id UUID,
        chave TEXT,
        doc TEXT,
        nome TEXT
    ) ON COMMIT DROP;

    INSERT INTO _addr_map
    SELECT p.id,
           chave_endereco(p.cep, p.cidade, p.estado,
               COALESCE(p.logradouro, p.rua), p.numero),
           normalizar_documento(p.cpf_cliente),
           LOWER(TRIM(COALESCE(p.nome_cliente, '')))
    FROM pedidos p
    WHERE p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
      AND p.cep IS NOT NULL AND p.cep != '';

    DROP TABLE IF EXISTS _fraud_ids;
    CREATE TEMP TABLE _fraud_ids (pedido_id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _fraud_ids
    SELECT DISTINCT a1.pedido_id
    FROM _addr_map a1
    JOIN _addr_map a2 ON a1.chave = a2.chave AND a1.pedido_id != a2.pedido_id
    WHERE a1.doc != a2.doc OR a1.nome != a2.nome
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- PASSO 2: PROCESSAR PEDIDOS PRINCIPAIS
    -- ============================================================
    FOR pedido_pai IN
        SELECT p.*,
               normalizar_documento(p.cpf_cliente) AS doc_limpo,
               LOWER(COALESCE(p.email_cliente, '')) AS email_lower,
               UPPER(REPLACE(COALESCE(p.nome_oferta, ''), ' ', '')) AS oferta_norm,
               sigla_produto(p.nome_produto) AS sigla
        FROM pedidos p
        WHERE p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
          AND p.codigo_transacao IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
          AND sigla_produto(p.nome_produto) IS NOT NULL
          AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) NOT LIKE '%ORDERBUMP%'
          AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) NOT LIKE '%UPSELL%'
          AND UPPER(COALESCE(p.nome_oferta,'')) NOT LIKE '%CC%'
        ORDER BY p.data_venda ASC NULLS LAST
    LOOP
        IF EXISTS (SELECT 1 FROM _processed WHERE pedido_id = pedido_pai.id) THEN
            CONTINUE;
        END IF;

        v_codigos_filhos   := ARRAY[]::TEXT[];
        v_order_bumps      := ARRAY[]::TEXT[];
        v_upsells          := ARRAY[]::TEXT[];
        v_pos_vendas       := ARRAY[]::TEXT[];
        v_quantidade       := 1;
        v_doc_limpo        := pedido_pai.doc_limpo;
        v_email_lower      := pedido_pai.email_lower;
        v_tem_dois_cartoes := FALSE;
        v_sigla            := pedido_pai.sigla;

        INSERT INTO _processed VALUES (pedido_pai.id) ON CONFLICT DO NOTHING;

        -- Fraude de endereço
        IF EXISTS (SELECT 1 FROM _fraud_ids WHERE pedido_id = pedido_pai.id) THEN
            v_total_mesmo_endereco := v_total_mesmo_endereco + 1;
            INSERT INTO pedidos_consolidados_v3 (
                id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
                valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
                telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
                endereco_completo, data_venda, created_at, metadata, produto_principal,
                descricao_pacote, fraude_endereco, status_envio,
                dia_despacho, codigos_agrupados, quantidade_pedidos
            ) VALUES (
                pedido_pai.id, pedido_pai.codigo_transacao, 'Mesmo End',
                pedido_pai.nome_produto, pedido_pai.nome_oferta,
                pedido_pai.valor_total, pedido_pai.forma_pagamento, pedido_pai.parcelas,
                pedido_pai.nome_cliente, pedido_pai.email_cliente,
                pedido_pai.cpf_cliente, pedido_pai.telefone_cliente,
                pedido_pai.cep, COALESCE(pedido_pai.logradouro, pedido_pai.rua),
                pedido_pai.numero, pedido_pai.complemento, pedido_pai.bairro,
                pedido_pai.cidade, pedido_pai.estado,
                CONCAT_WS(', ', COALESCE(pedido_pai.logradouro,pedido_pai.rua),
                    pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
                pedido_pai.data_venda, pedido_pai.created_at, pedido_pai.metadata,
                v_sigla, v_sigla || ' - ' || pedido_pai.nome_oferta,
                TRUE, 'Bloqueado',
                (pedido_pai.data_venda::DATE + INTERVAL '2 days')::DATE,
                ARRAY[pedido_pai.codigo_transacao], 1
            ) ON CONFLICT (codigo_transacao) DO UPDATE SET
                status_aprovacao = 'Mesmo End', fraude_endereco = TRUE, updated_at = now();
            CONTINUE;
        END IF;

        -- ✅ Order Bumps — lógica corrigida:
        -- verifica se existe OB standalone antes de filtrar wrapper
        v_has_standalone_ob := EXISTS (
            SELECT 1 FROM pedidos p
            WHERE p.id != pedido_pai.id
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(COALESCE(p.email_cliente, '')) = v_email_lower
              AND v_email_lower != ''
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
              AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%ORDERBUMP%'
              -- OB puro = não contém o nome do pai
              AND NOT (
                  pedido_pai.nome_oferta IS NOT NULL
                  AND pedido_pai.nome_oferta != ''
                  AND UPPER(COALESCE(p.nome_oferta,''))
                      LIKE '%' || UPPER(TRIM(pedido_pai.nome_oferta)) || '%'
              )
        );

        FOR rec IN
            SELECT p.id, p.codigo_transacao, p.nome_oferta
            FROM pedidos p
            WHERE p.id != pedido_pai.id
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(COALESCE(p.email_cliente, '')) = v_email_lower
              AND v_email_lower != ''
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
              AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%ORDERBUMP%'
              -- ✅ LÓGICA CORRIGIDA:
              -- Excluir o wrapper SOMENTE se existe OB standalone separado.
              AND NOT (
                  v_has_standalone_ob = TRUE
                  AND pedido_pai.nome_oferta IS NOT NULL
                  AND pedido_pai.nome_oferta != ''
                  AND UPPER(COALESCE(p.nome_oferta,''))
                      LIKE '%' || UPPER(TRIM(pedido_pai.nome_oferta)) || '%'
              )
        LOOP
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            v_order_bumps    := array_append(v_order_bumps, rec.nome_oferta);
            v_quantidade     := v_quantidade + 1;
            v_total_order_bumps := v_total_order_bumps + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- Upsell
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            FOR rec IN
                SELECT p.id, p.codigo_transacao, p.nome_oferta
                FROM pedidos p
                WHERE p.id != pedido_pai.id
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                  AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
                  AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
                  AND p.data_venda::DATE >= pedido_pai.data_venda::DATE
                  AND p.data_venda::DATE <= pedido_pai.data_venda::DATE + INTERVAL '1 day'
                  AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%UPSELL%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_upsells        := array_append(v_upsells, rec.nome_oferta);
                v_quantidade     := v_quantidade + 1;
                v_total_upsells  := v_total_upsells + 1;
                INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- Dois cartões
        FOR rec IN
            SELECT p.id, p.codigo_transacao
            FROM pedidos p
            WHERE p.id != pedido_pai.id
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(COALESCE(p.email_cliente, '')) = v_email_lower
              AND v_email_lower != ''
              AND TRIM(p.nome_oferta) = TRIM(pedido_pai.nome_oferta)
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            v_total_dois_cartoes := v_total_dois_cartoes + 1;
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- Pós Vendas CC
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            v_data_limite := calcular_janela_pv(pedido_pai.data_venda::DATE);
            FOR rec IN
                SELECT p.id, p.codigo_transacao, p.nome_oferta, p.nome_produto,
                       sigla_produto(p.nome_produto) AS sigla_pv
                FROM pedidos p
                WHERE p.id != pedido_pai.id
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                  AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
                  AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
                  AND p.data_venda::DATE >  pedido_pai.data_venda::DATE
                  AND p.data_venda::DATE <= v_data_limite
                  AND UPPER(COALESCE(p.nome_oferta, '')) LIKE '%CC%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_pos_vendas     := array_append(v_pos_vendas,
                    COALESCE(rec.sigla_pv,'') || ':' || rec.nome_oferta);
                v_quantidade     := v_quantidade + 1;
                v_total_pos_vendas := v_total_pos_vendas + 1;
                INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- Montar nome oferta consolidado
        v_nome_oferta := pedido_pai.nome_oferta;
        v_nome_oferta := v_nome_oferta || REPEAT(' + Order Bump', COALESCE(array_length(v_order_bumps, 1), 0));
        v_nome_oferta := v_nome_oferta || REPEAT(' + UPSELL',     COALESCE(array_length(v_upsells, 1), 0));

        DECLARE
            v_pv_dp2 INT := 0; v_pv_bf2 INT := 0; v_pv_bl2 INT := 0;
            v_pv_item2 TEXT;
        BEGIN
            IF v_pos_vendas IS NOT NULL THEN
                FOREACH v_pv_item2 IN ARRAY v_pos_vendas LOOP
                    IF    v_pv_item2 LIKE 'DP:%' THEN v_pv_dp2 := v_pv_dp2 + 1;
                    ELSIF v_pv_item2 LIKE 'BF:%' THEN v_pv_bf2 := v_pv_bf2 + 1;
                    ELSIF v_pv_item2 LIKE 'BL:%' THEN v_pv_bl2 := v_pv_bl2 + 1;
                    END IF;
                END LOOP;
            END IF;
            IF v_pv_dp2 > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_dp2 || ' DP'; END IF;
            IF v_pv_bf2 > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bf2 || ' BF'; END IF;
            IF v_pv_bl2 > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bl2 || ' BL'; END IF;
        END;

        v_descricao := v_sigla || ' - ' || v_nome_oferta;

        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
            valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
            telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
            endereco_completo, data_venda, created_at, metadata,
            descricao_pacote, codigos_agrupados, quantidade_pedidos, produto_principal,
            dia_despacho, status_envio,
            order_bumps, upsells, pos_vendas, codigos_filhos,
            tem_dois_cartoes, fraude_endereco
        ) VALUES (
            pedido_pai.id, pedido_pai.codigo_transacao,
            CASE WHEN v_tem_dois_cartoes THEN '2 Cartões' ELSE 'Aprovado' END,
            pedido_pai.nome_produto, v_nome_oferta,
            pedido_pai.valor_total, pedido_pai.forma_pagamento, pedido_pai.parcelas,
            pedido_pai.nome_cliente, pedido_pai.email_cliente,
            pedido_pai.cpf_cliente, pedido_pai.telefone_cliente,
            pedido_pai.cep, COALESCE(pedido_pai.logradouro, pedido_pai.rua),
            pedido_pai.numero, pedido_pai.complemento, pedido_pai.bairro,
            pedido_pai.cidade, pedido_pai.estado,
            CONCAT_WS(', ', COALESCE(pedido_pai.logradouro,pedido_pai.rua),
                pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
            pedido_pai.data_venda, pedido_pai.created_at, pedido_pai.metadata,
            v_descricao,
            ARRAY[pedido_pai.codigo_transacao] || v_codigos_filhos,
            v_quantidade, v_sigla,
            (pedido_pai.data_venda::DATE + INTERVAL '2 days')::DATE,
            'Pendente',
            v_order_bumps, v_upsells, v_pos_vendas, v_codigos_filhos,
            v_tem_dois_cartoes, FALSE
        ) ON CONFLICT (codigo_transacao) DO UPDATE SET
            nome_oferta        = EXCLUDED.nome_oferta,
            descricao_pacote   = EXCLUDED.descricao_pacote,
            codigos_agrupados  = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps        = EXCLUDED.order_bumps,
            upsells            = EXCLUDED.upsells,
            pos_vendas         = EXCLUDED.pos_vendas,
            codigos_filhos     = EXCLUDED.codigos_filhos,
            tem_dois_cartoes   = EXCLUDED.tem_dois_cartoes,
            updated_at         = now();

        v_total_principais := v_total_principais + 1;
    END LOOP;

    -- Cleanup
    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;
    DROP TABLE IF EXISTS _addr_map;
    DROP TABLE IF EXISTS _fraud_ids;

    RETURN QUERY SELECT
        v_total_principais, v_total_order_bumps,
        v_total_upsells, v_total_pos_vendas,
        v_total_dois_cartoes, v_total_mesmo_endereco;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION consolidar_pedidos() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
SELECT 'Migration 051: Lógica de OB corrigida — wrapper excluído somente se existe OB standalone!' AS resultado;


-- ==========================================
-- MIGRATION: 052_allow_ob_parents.sql
-- ==========================================

-- ================================================================
-- MIGRATION 052: Permitir que "Wrappers" de Order Bump sejam Pais
-- Data: 2026-03-03
--
-- Problema: 5 Order Bumps sumiram. Por quê?
-- A query que define os "pedidos principais" (pais) excluía QUALQUER
-- pedido cujo nome tivesse "ORDERBUMP".
-- Quando o cliente comprava 1 item + 1 OB e a Ticto enviava UM ÚNICO
-- registro ("Compre 1 e Leve 2 + Order Bump"), ele era
-- sumariamente IGNORADO. Não virava pai, nem virava filho (pois não tinha pai).
-- E assim escorria pelo ralo.
--
-- Solução:
-- No PASSO 2, ao listar os pedidos principais, o filtro de exclusão
-- de "%ORDERBUMP%" só deve ocorrer se **EXISTIR OUTRO PEDIDO** no mesmo
-- dia para o mesmo email que NÃO tenha OB no nome (ou seja, se houver
-- um pai legítimo separado).
-- Se for o ÚNICO pedido do cliente, ele DEVE ser o pedido pai.
-- ================================================================

CREATE OR REPLACE FUNCTION consolidar_pedidos()
RETURNS TABLE (
    total_principais INTEGER,
    total_order_bumps INTEGER,
    total_upsells INTEGER,
    total_pos_vendas INTEGER,
    total_dois_cartoes INTEGER,
    total_mesmo_endereco INTEGER
) AS $$
DECLARE
    v_total_principais    INTEGER := 0;
    v_total_order_bumps   INTEGER := 0;
    v_total_upsells       INTEGER := 0;
    v_total_pos_vendas    INTEGER := 0;
    v_total_dois_cartoes  INTEGER := 0;
    v_total_mesmo_endereco INTEGER := 0;

    pedido_pai     RECORD;
    locked_parent  RECORD;
    rec            RECORD;

    v_codigos_filhos TEXT[];
    v_order_bumps    TEXT[];
    v_upsells        TEXT[];
    v_pos_vendas     TEXT[];
    v_nome_oferta    TEXT;
    v_quantidade     INTEGER;
    v_doc_limpo      TEXT;
    v_email_lower    TEXT;
    v_data_limite    DATE;
    v_tem_dois_cartoes BOOLEAN;
    v_sigla          TEXT;
    v_descricao      TEXT;

    v_novos_count  INTEGER;
    v_pv_append    TEXT[];
    v_ob_append    TEXT[];
    v_codes_append TEXT[];
    v_pv_dp INT; v_pv_bf INT; v_pv_bl INT;
    v_pv_item TEXT;

    v_has_standalone_ob BOOLEAN;
BEGIN
    -- PASSO 0: Lidar com bloqueados
    DROP TABLE IF EXISTS _locked_ids;
    CREATE TEMP TABLE _locked_ids (id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _locked_ids
    SELECT c.id FROM pedidos_consolidados_v3 c
    WHERE c.codigo_rastreio IS NOT NULL
       OR c.foi_editado = TRUE
       OR c.data_envio IS NOT NULL;

    DROP TABLE IF EXISTS _locked_codes;
    CREATE TEMP TABLE _locked_codes (code TEXT PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _locked_codes
    SELECT codigo_transacao FROM pedidos_consolidados_v3
    WHERE id IN (SELECT id FROM _locked_ids)
    ON CONFLICT DO NOTHING;

    INSERT INTO _locked_codes
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3
    WHERE id IN (SELECT id FROM _locked_ids)
    ON CONFLICT DO NOTHING;

    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
    ) to_delete
    WHERE c.id = to_delete.id;

    DROP TABLE IF EXISTS _processed;
    CREATE TEMP TABLE _processed (pedido_id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _processed
    SELECT p.id FROM pedidos p
    WHERE p.codigo_transacao IN (SELECT code FROM _locked_codes)
    ON CONFLICT DO NOTHING;

    -- PASSO 0.5-CC
    FOR locked_parent IN
        SELECT c.id, c.cpf, c.email, c.data_venda,
               c.codigos_filhos, c.pos_vendas, c.order_bumps,
               c.descricao_pacote, c.quantidade_pedidos
        FROM pedidos_consolidados_v3 c
        WHERE c.id IN (SELECT id FROM _locked_ids)
          AND c.cpf IS NOT NULL AND c.cpf != ''
          AND c.data_envio IS NULL
    LOOP
        v_data_limite  := calcular_janela_pv(locked_parent.data_venda::DATE);
        v_doc_limpo    := normalizar_documento(locked_parent.cpf);
        v_pv_append    := ARRAY[]::TEXT[];
        v_codes_append := ARRAY[]::TEXT[];
        v_novos_count  := 0;

        FOR rec IN
            SELECT p.id, p.codigo_transacao, p.nome_oferta, p.nome_produto,
                   sigla_produto(p.nome_produto) AS sigla_pv
            FROM pedidos p
            WHERE NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
              AND v_doc_limpo != ''
              AND p.data_venda::DATE >  locked_parent.data_venda::DATE
              AND p.data_venda::DATE <= v_data_limite
              AND UPPER(COALESCE(p.nome_oferta, '')) LIKE '%CC%'
              AND NOT (COALESCE(locked_parent.codigos_filhos, ARRAY[]::TEXT[])
                       @> ARRAY[p.codigo_transacao])
        LOOP
            v_codes_append := array_append(v_codes_append, rec.codigo_transacao);
            v_pv_append    := array_append(v_pv_append,
                COALESCE(rec.sigla_pv, '') || ':' || rec.nome_oferta);
            v_novos_count  := v_novos_count + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        IF v_novos_count > 0 THEN
            v_pv_dp := 0; v_pv_bf := 0; v_pv_bl := 0;
            FOREACH v_pv_item IN ARRAY v_pv_append LOOP
                IF    v_pv_item LIKE 'DP:%' THEN v_pv_dp := v_pv_dp + 1;
                ELSIF v_pv_item LIKE 'BF:%' THEN v_pv_bf := v_pv_bf + 1;
                ELSIF v_pv_item LIKE 'BL:%' THEN v_pv_bl := v_pv_bl + 1;
                END IF;
            END LOOP;

            v_descricao := locked_parent.descricao_pacote;
            IF v_pv_dp > 0 THEN v_descricao := v_descricao || ' + ' || v_pv_dp || ' DP'; END IF;
            IF v_pv_bf > 0 THEN v_descricao := v_descricao || ' + ' || v_pv_bf || ' BF'; END IF;
            IF v_pv_bl > 0 THEN v_descricao := v_descricao || ' + ' || v_pv_bl || ' BL'; END IF;

            UPDATE pedidos_consolidados_v3
            SET codigos_filhos     = COALESCE(codigos_filhos, '{}') || v_codes_append,
                pos_vendas         = COALESCE(pos_vendas, '{}') || v_pv_append,
                quantidade_pedidos = quantidade_pedidos + v_novos_count,
                descricao_pacote   = v_descricao,
                updated_at         = NOW()
            WHERE id = locked_parent.id;

            v_total_pos_vendas := v_total_pos_vendas + v_novos_count;
        END IF;
    END LOOP;

    -- PASSO 0.5-OB
    FOR locked_parent IN
        SELECT c.id, c.email, c.data_venda, c.nome_oferta,
               c.codigos_filhos, c.order_bumps,
               c.descricao_pacote, c.quantidade_pedidos
        FROM pedidos_consolidados_v3 c
        WHERE c.id IN (SELECT id FROM _locked_ids)
          AND c.email IS NOT NULL AND c.email != ''
          AND c.data_envio IS NULL
    LOOP
        v_email_lower  := LOWER(TRIM(locked_parent.email));
        v_ob_append    := ARRAY[]::TEXT[];
        v_codes_append := ARRAY[]::TEXT[];
        v_novos_count  := 0;

        v_has_standalone_ob := EXISTS (
            SELECT 1 FROM pedidos p
            WHERE NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(TRIM(p.email_cliente)) = v_email_lower
              AND p.data_venda::DATE = locked_parent.data_venda::DATE
              AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%ORDERBUMP%'
              AND NOT (COALESCE(locked_parent.codigos_filhos, ARRAY[]::TEXT[])
                       @> ARRAY[p.codigo_transacao])
              AND NOT (
                  locked_parent.nome_oferta IS NOT NULL
                  AND locked_parent.nome_oferta != ''
                  AND UPPER(COALESCE(p.nome_oferta,''))
                      LIKE '%' || UPPER(TRIM(locked_parent.nome_oferta)) || '%'
              )
        );

        FOR rec IN
            SELECT p.id, p.codigo_transacao, p.nome_oferta
            FROM pedidos p
            WHERE NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(TRIM(p.email_cliente)) = v_email_lower
              AND v_email_lower != ''
              AND p.data_venda::DATE = locked_parent.data_venda::DATE
              AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%ORDERBUMP%'
              AND NOT (COALESCE(locked_parent.codigos_filhos, ARRAY[]::TEXT[])
                       @> ARRAY[p.codigo_transacao])
              AND NOT (
                  v_has_standalone_ob = TRUE
                  AND locked_parent.nome_oferta IS NOT NULL
                  AND locked_parent.nome_oferta != ''
                  AND UPPER(COALESCE(p.nome_oferta,''))
                      LIKE '%' || UPPER(TRIM(locked_parent.nome_oferta)) || '%'
              )
        LOOP
            v_codes_append := array_append(v_codes_append, rec.codigo_transacao);
            v_ob_append    := array_append(v_ob_append, rec.nome_oferta);
            v_novos_count  := v_novos_count + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        IF v_novos_count > 0 THEN
            v_descricao := locked_parent.descricao_pacote ||
                           REPEAT(' + Order Bump', v_novos_count);

            UPDATE pedidos_consolidados_v3
            SET codigos_filhos     = COALESCE(codigos_filhos, '{}') || v_codes_append,
                order_bumps        = COALESCE(order_bumps, '{}') || v_ob_append,
                quantidade_pedidos = quantidade_pedidos + v_novos_count,
                descricao_pacote   = v_descricao,
                updated_at         = NOW()
            WHERE id = locked_parent.id;

            v_total_order_bumps := v_total_order_bumps + v_novos_count;
        END IF;
    END LOOP;

    -- PASSO 1: FRAUDE
    DROP TABLE IF EXISTS _addr_map;
    CREATE TEMP TABLE _addr_map (
        pedido_id UUID,
        chave TEXT,
        doc TEXT,
        nome TEXT
    ) ON COMMIT DROP;

    INSERT INTO _addr_map
    SELECT p.id,
           chave_endereco(p.cep, p.cidade, p.estado,
               COALESCE(p.logradouro, p.rua), p.numero),
           normalizar_documento(p.cpf_cliente),
           LOWER(TRIM(COALESCE(p.nome_cliente, '')))
    FROM pedidos p
    WHERE p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
      AND p.cep IS NOT NULL AND p.cep != '';

    DROP TABLE IF EXISTS _fraud_ids;
    CREATE TEMP TABLE _fraud_ids (pedido_id UUID PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO _fraud_ids
    SELECT DISTINCT a1.pedido_id
    FROM _addr_map a1
    JOIN _addr_map a2 ON a1.chave = a2.chave AND a1.pedido_id != a2.pedido_id
    WHERE a1.doc != a2.doc OR a1.nome != a2.nome
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- PASSO 2: PEDIDOS PRINCIPAIS (✅ CORRIGIDO DA MIGRATION 052)
    -- ============================================================
    FOR pedido_pai IN
        SELECT p.*,
               normalizar_documento(p.cpf_cliente) AS doc_limpo,
               LOWER(COALESCE(p.email_cliente, '')) AS email_lower,
               UPPER(REPLACE(COALESCE(p.nome_oferta, ''), ' ', '')) AS oferta_norm,
               sigla_produto(p.nome_produto) AS sigla
        FROM pedidos p
        WHERE p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
          AND p.codigo_transacao IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
          AND sigla_produto(p.nome_produto) IS NOT NULL
          -- REGRA REVISADA: Não exclui Order Bump se não existir "pai legítimo".
          -- Só ignora se existir um PEDIDO NORMAL (sem OB nem Upsell nem CC) no mesmo dia.
          AND (
               UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) NOT LIKE '%ORDERBUMP%'
               OR NOT EXISTS (
                   SELECT 1 FROM pedidos px
                   WHERE LOWER(COALESCE(px.email_cliente, '')) = LOWER(COALESCE(p.email_cliente, ''))
                     AND px.data_venda::DATE = p.data_venda::DATE
                     AND px.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
                     AND px.id != p.id
                     AND UPPER(REPLACE(COALESCE(px.nome_oferta,''),' ','')) NOT LIKE '%ORDERBUMP%'
                     AND UPPER(REPLACE(COALESCE(px.nome_oferta,''),' ','')) NOT LIKE '%UPSELL%'
                     AND UPPER(COALESCE(px.nome_oferta,'')) NOT LIKE '%CC%'
               )
          )
          AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) NOT LIKE '%UPSELL%'
          AND UPPER(COALESCE(p.nome_oferta,'')) NOT LIKE '%CC%'
        -- ORDER BY modificado: priorizar pedidos REAIS ("puros") sem OB/Upsell
        -- Se houver empate de datas, os puros vêm primeiro para assumirem como "pai".
        ORDER BY
            p.data_venda ASC NULLS LAST,
            CASE WHEN UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) NOT LIKE '%ORDERBUMP%' THEN 0 ELSE 1 END
    LOOP
        IF EXISTS (SELECT 1 FROM _processed WHERE pedido_id = pedido_pai.id) THEN
            CONTINUE;
        END IF;

        v_codigos_filhos   := ARRAY[]::TEXT[];
        v_order_bumps      := ARRAY[]::TEXT[];
        v_upsells          := ARRAY[]::TEXT[];
        v_pos_vendas       := ARRAY[]::TEXT[];
        v_quantidade       := 1;
        v_doc_limpo        := pedido_pai.doc_limpo;
        v_email_lower      := pedido_pai.email_lower;
        v_tem_dois_cartoes := FALSE;
        v_sigla            := pedido_pai.sigla;

        INSERT INTO _processed VALUES (pedido_pai.id) ON CONFLICT DO NOTHING;

        IF EXISTS (SELECT 1 FROM _fraud_ids WHERE pedido_id = pedido_pai.id) THEN
            v_total_mesmo_endereco := v_total_mesmo_endereco + 1;
            INSERT INTO pedidos_consolidados_v3 (
                id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
                valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
                telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
                endereco_completo, data_venda, created_at, metadata, produto_principal,
                descricao_pacote, fraude_endereco, status_envio,
                dia_despacho, codigos_agrupados, quantidade_pedidos
            ) VALUES (
                pedido_pai.id, pedido_pai.codigo_transacao, 'Mesmo End',
                pedido_pai.nome_produto, pedido_pai.nome_oferta,
                pedido_pai.valor_total, pedido_pai.forma_pagamento, pedido_pai.parcelas,
                pedido_pai.nome_cliente, pedido_pai.email_cliente,
                pedido_pai.cpf_cliente, pedido_pai.telefone_cliente,
                pedido_pai.cep, COALESCE(pedido_pai.logradouro, pedido_pai.rua),
                pedido_pai.numero, pedido_pai.complemento, pedido_pai.bairro,
                pedido_pai.cidade, pedido_pai.estado,
                CONCAT_WS(', ', COALESCE(pedido_pai.logradouro,pedido_pai.rua),
                    pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
                pedido_pai.data_venda, pedido_pai.created_at, pedido_pai.metadata,
                v_sigla, v_sigla || ' - ' || pedido_pai.nome_oferta,
                TRUE, 'Bloqueado',
                (pedido_pai.data_venda::DATE + INTERVAL '2 days')::DATE,
                ARRAY[pedido_pai.codigo_transacao], 1
            ) ON CONFLICT (codigo_transacao) DO UPDATE SET
                status_aprovacao = 'Mesmo End', fraude_endereco = TRUE, updated_at = now();
            CONTINUE;
        END IF;

        -- Order Bumps
        v_has_standalone_ob := EXISTS (
            SELECT 1 FROM pedidos p
            WHERE p.id != pedido_pai.id
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(COALESCE(p.email_cliente, '')) = v_email_lower
              AND v_email_lower != ''
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
              AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%ORDERBUMP%'
              AND NOT (
                  pedido_pai.nome_oferta IS NOT NULL
                  AND pedido_pai.nome_oferta != ''
                  AND UPPER(COALESCE(p.nome_oferta,''))
                      LIKE '%' || UPPER(TRIM(pedido_pai.nome_oferta)) || '%'
              )
        );

        FOR rec IN
            SELECT p.id, p.codigo_transacao, p.nome_oferta
            FROM pedidos p
            WHERE p.id != pedido_pai.id
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(COALESCE(p.email_cliente, '')) = v_email_lower
              AND v_email_lower != ''
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
              AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%ORDERBUMP%'
              AND NOT (
                  v_has_standalone_ob = TRUE
                  AND pedido_pai.nome_oferta IS NOT NULL
                  AND pedido_pai.nome_oferta != ''
                  AND UPPER(COALESCE(p.nome_oferta,''))
                      LIKE '%' || UPPER(TRIM(pedido_pai.nome_oferta)) || '%'
              )
        LOOP
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            v_order_bumps    := array_append(v_order_bumps, rec.nome_oferta);
            v_quantidade     := v_quantidade + 1;
            v_total_order_bumps := v_total_order_bumps + 1;
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- Upsell
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            FOR rec IN
                SELECT p.id, p.codigo_transacao, p.nome_oferta
                FROM pedidos p
                WHERE p.id != pedido_pai.id
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                  AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
                  AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
                  AND p.data_venda::DATE >= pedido_pai.data_venda::DATE
                  AND p.data_venda::DATE <= pedido_pai.data_venda::DATE + INTERVAL '1 day'
                  AND UPPER(REPLACE(COALESCE(p.nome_oferta,''),' ','')) LIKE '%UPSELL%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_upsells        := array_append(v_upsells, rec.nome_oferta);
                v_quantidade     := v_quantidade + 1;
                v_total_upsells  := v_total_upsells + 1;
                INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- Dois cartões
        FOR rec IN
            SELECT p.id, p.codigo_transacao
            FROM pedidos p
            WHERE p.id != pedido_pai.id
              AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
              AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
              AND LOWER(COALESCE(p.email_cliente, '')) = v_email_lower
              AND v_email_lower != ''
              AND TRIM(p.nome_oferta) = TRIM(pedido_pai.nome_oferta)
              AND p.data_venda::DATE = pedido_pai.data_venda::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            v_total_dois_cartoes := v_total_dois_cartoes + 1;
            v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
            INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- Pós Vendas CC
        IF v_doc_limpo != '' AND LENGTH(v_doc_limpo) >= 5 THEN
            v_data_limite := calcular_janela_pv(pedido_pai.data_venda::DATE);
            FOR rec IN
                SELECT p.id, p.codigo_transacao, p.nome_oferta, p.nome_produto,
                       sigla_produto(p.nome_produto) AS sigla_pv
                FROM pedidos p
                WHERE p.id != pedido_pai.id
                  AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                  AND p.status IN ('Aprovado','Autorizado','Pago','Paid','Approved')
                  AND normalizar_documento(p.cpf_cliente) = v_doc_limpo
                  AND p.data_venda::DATE >  pedido_pai.data_venda::DATE
                  AND p.data_venda::DATE <= v_data_limite
                  AND UPPER(COALESCE(p.nome_oferta, '')) LIKE '%CC%'
            LOOP
                v_codigos_filhos := array_append(v_codigos_filhos, rec.codigo_transacao);
                v_pos_vendas     := array_append(v_pos_vendas,
                    COALESCE(rec.sigla_pv,'') || ':' || rec.nome_oferta);
                v_quantidade     := v_quantidade + 1;
                v_total_pos_vendas := v_total_pos_vendas + 1;
                INSERT INTO _processed VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- Montar nome oferta consolidado (✅ CORRIGIDO DA 052)
        -- Evita duplicar OB se o nome do pedido_pai JÁ incluir "Order Bump"
        v_nome_oferta := pedido_pai.nome_oferta;
        IF UPPER(v_nome_oferta) NOT LIKE '%ORDERBUMP%' THEN
            v_nome_oferta := v_nome_oferta || REPEAT(' + Order Bump', COALESCE(array_length(v_order_bumps, 1), 0));
        END IF;
        
        v_nome_oferta := v_nome_oferta || REPEAT(' + UPSELL', COALESCE(array_length(v_upsells, 1), 0));

        DECLARE
            v_pv_dp2 INT := 0; v_pv_bf2 INT := 0; v_pv_bl2 INT := 0;
            v_pv_item2 TEXT;
        BEGIN
            IF v_pos_vendas IS NOT NULL THEN
                FOREACH v_pv_item2 IN ARRAY v_pos_vendas LOOP
                    IF    v_pv_item2 LIKE 'DP:%' THEN v_pv_dp2 := v_pv_dp2 + 1;
                    ELSIF v_pv_item2 LIKE 'BF:%' THEN v_pv_bf2 := v_pv_bf2 + 1;
                    ELSIF v_pv_item2 LIKE 'BL:%' THEN v_pv_bl2 := v_pv_bl2 + 1;
                    END IF;
                END LOOP;
            END IF;
            IF v_pv_dp2 > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_dp2 || ' DP'; END IF;
            IF v_pv_bf2 > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bf2 || ' BF'; END IF;
            IF v_pv_bl2 > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bl2 || ' BL'; END IF;
        END;

        v_descricao := v_sigla || ' - ' || v_nome_oferta;

        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
            valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
            telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
            endereco_completo, data_venda, created_at, metadata,
            descricao_pacote, codigos_agrupados, quantidade_pedidos, produto_principal,
            dia_despacho, status_envio,
            order_bumps, upsells, pos_vendas, codigos_filhos,
            tem_dois_cartoes, fraude_endereco
        ) VALUES (
            pedido_pai.id, pedido_pai.codigo_transacao,
            CASE WHEN v_tem_dois_cartoes THEN '2 Cartões' ELSE 'Aprovado' END,
            pedido_pai.nome_produto, v_nome_oferta,
            pedido_pai.valor_total, pedido_pai.forma_pagamento, pedido_pai.parcelas,
            pedido_pai.nome_cliente, pedido_pai.email_cliente,
            pedido_pai.cpf_cliente, pedido_pai.telefone_cliente,
            pedido_pai.cep, COALESCE(pedido_pai.logradouro, pedido_pai.rua),
            pedido_pai.numero, pedido_pai.complemento, pedido_pai.bairro,
            pedido_pai.cidade, pedido_pai.estado,
            CONCAT_WS(', ', COALESCE(pedido_pai.logradouro,pedido_pai.rua),
                pedido_pai.numero, pedido_pai.bairro, pedido_pai.cidade, pedido_pai.estado),
            pedido_pai.data_venda, pedido_pai.created_at, pedido_pai.metadata,
            v_descricao,
            ARRAY[pedido_pai.codigo_transacao] || v_codigos_filhos,
            v_quantidade, v_sigla,
            (pedido_pai.data_venda::DATE + INTERVAL '2 days')::DATE,
            'Pendente',
            v_order_bumps, v_upsells, v_pos_vendas, v_codigos_filhos,
            v_tem_dois_cartoes, FALSE
        ) ON CONFLICT (codigo_transacao) DO UPDATE SET
            nome_oferta        = EXCLUDED.nome_oferta,
            descricao_pacote   = EXCLUDED.descricao_pacote,
            codigos_agrupados  = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps        = EXCLUDED.order_bumps,
            upsells            = EXCLUDED.upsells,
            pos_vendas         = EXCLUDED.pos_vendas,
            codigos_filhos     = EXCLUDED.codigos_filhos,
            tem_dois_cartoes   = EXCLUDED.tem_dois_cartoes,
            updated_at         = now();

        v_total_principais := v_total_principais + 1;
    END LOOP;

    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;
    DROP TABLE IF EXISTS _addr_map;
    DROP TABLE IF EXISTS _fraud_ids;

    RETURN QUERY SELECT
        v_total_principais, v_total_order_bumps,
        v_total_upsells, v_total_pos_vendas,
        v_total_dois_cartoes, v_total_mesmo_endereco;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION consolidar_pedidos() TO anon, authenticated, service_role;

SELECT 'Migration 052: Pedidos únicos com Order Bump no nome agora são aceitos como pais!' AS resultado;


-- ==========================================
-- MIGRATION: 053_fix_ticto_consolidation_ob.sql
-- ==========================================

-- ================================================================
-- MIGRATION 053: Corrigir identificador na consolidação do Ticto
-- Data: 2026-03-03
--
-- Problema: 
-- Quando o cliente comprou um produto e um Order Bump no mesmo checkout,
-- a plataforma Ticto enviava ambos os itens no payload do webhook,
-- resultando em DOIS registros na tabela `ticto_pedidos` com o MESMO
-- `transaction_hash`.
-- A função `consolidar_pedidos_ticto` (da migration 031) estava
-- usando o `transaction_hash` como flag de "já processado" na tabela
-- temporária `_processed` e também no WHERE (`p.transaction_hash != pai.hash`).
-- Isso fazia com que todos os Order Bumps / Upsells que compartilhassem o
-- MESMO hash do pai fossem instantaneamente ignorados.
--
-- Solução:
-- Alterar o controle de processamento para usar a PK da tabela `ticto_pedidos`
-- (o campo `id` UUID), permitindo processar múltiplos registros distintos
-- que tenham o mesmo `transaction_hash`.
-- ================================================================

CREATE OR REPLACE FUNCTION consolidar_pedidos_ticto()
RETURNS jsonb AS $$
DECLARE
    v_total_principais INTEGER := 0;
    
    pedido_pai RECORD;
    rec RECORD;
    
    v_codigos_filhos TEXT[];
    v_order_bumps TEXT[];
    v_upsells TEXT[];
    v_pos_vendas TEXT[];
    v_nome_oferta TEXT;
    v_quantidade INTEGER;
    v_doc_limpo TEXT;
    v_data_limite DATE;
    v_tem_dois_cartoes BOOLEAN;
    v_sigla TEXT;
    v_descricao TEXT;
    
    v_hoje DATE;
    v_nome_feriado TEXT;
    v_dia_pv DATE;
    v_dia_despacho DATE;
BEGIN
    v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

    SELECT nome INTO v_nome_feriado FROM feriados WHERE data = v_hoje;
    IF v_nome_feriado IS NOT NULL THEN
        RETURN jsonb_build_object(
            'status', 'skipped',
            'message', 'Feriado: ' || v_nome_feriado,
            'details', jsonb_build_object('data', v_hoje, 'motivo', 'Tabela de Feriados')
        );
    END IF;

    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;

    CREATE TEMP TABLE _locked_ids AS
    SELECT id FROM pedidos_consolidados_v3
    WHERE codigo_rastreio IS NOT NULL
       OR foi_editado = TRUE
       OR data_envio IS NOT NULL;

    CREATE TEMP TABLE _locked_codes AS
    SELECT codigo_transacao FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids)
    UNION
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids);

    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
    ) to_delete
    WHERE c.id = to_delete.id;

    -- =========================================================
    -- FIX: Usa UUID da linha em vez de hash global da transação
    -- =========================================================
    CREATE TEMP TABLE _processed (pedido_id UUID PRIMARY KEY);
    
    INSERT INTO _processed (pedido_id)
    SELECT id FROM ticto_pedidos WHERE transaction_hash IN (SELECT codigo_transacao FROM _locked_codes);

    FOR pedido_pai IN
        SELECT 
            p.*,
            REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') as doc_limpo,
            LOWER(COALESCE(p.customer_email, '')) as email_lower,
            UPPER(REPLACE(COALESCE(p.offer_name, ''), ' ', '')) as oferta_norm,
            CASE 
                WHEN UPPER(p.product_name) LIKE '%DESEJO%' THEN 'DP'
                WHEN UPPER(p.product_name) LIKE '%LUMI%' THEN 'BL'
                WHEN UPPER(p.product_name) LIKE '%FORMA%' THEN 'BF'
                ELSE NULL
            END as sigla
        FROM ticto_pedidos p
        WHERE p.status IN ('authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago')
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%ORDERBUMP%'
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%UPSELL%'
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%CC%'
        ORDER BY p.order_date ASC
    LOOP
        IF pedido_pai.sigla IS NULL THEN CONTINUE; END IF;

        v_codigos_filhos := ARRAY[]::TEXT[];
        v_order_bumps := ARRAY[]::TEXT[];
        v_upsells := ARRAY[]::TEXT[];
        v_pos_vendas := ARRAY[]::TEXT[];
        v_quantidade := 1;
        v_tem_dois_cartoes := FALSE;
        v_nome_oferta := pedido_pai.offer_name;

        INSERT INTO _processed (pedido_id) VALUES (pedido_pai.id) ON CONFLICT DO NOTHING;

        BEGIN
            v_dia_pv := proximo_dia_util(pedido_pai.order_date::DATE);
            v_dia_despacho := proximo_dia_util(v_dia_pv);
        EXCEPTION WHEN OTHERS THEN
            v_dia_despacho := (pedido_pai.order_date::DATE + 2);
        END;

        -- Order Bumps
        FOR rec IN
            SELECT id, transaction_hash, offer_name FROM ticto_pedidos p
            WHERE p.id != pedido_pai.id
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.order_date::DATE = pedido_pai.order_date::DATE
            AND UPPER(p.offer_name) LIKE '%ORDERBUMP%'
        LOOP
            IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            END IF;
            v_order_bumps := array_append(v_order_bumps, rec.offer_name);
            v_quantidade := v_quantidade + 1;
            INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- Upsells
        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT id, transaction_hash, offer_name FROM ticto_pedidos p
                WHERE p.id != pedido_pai.id
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE BETWEEN pedido_pai.order_date::DATE AND (pedido_pai.order_date::DATE + 1)
                AND UPPER(p.offer_name) LIKE '%UPSELL%'
            LOOP
                IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                END IF;
                v_upsells := array_append(v_upsells, rec.offer_name);
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- 2 Cartões (Mesma oferta)
        FOR rec IN
            SELECT id, transaction_hash FROM ticto_pedidos p
            WHERE p.id != pedido_pai.id
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.offer_name = pedido_pai.offer_name
            AND p.order_date::DATE = pedido_pai.order_date::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            END IF;
            INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- Pós-Vendas / Janela Recompra CC
        IF EXTRACT(DOW FROM pedido_pai.order_date) IN (4, 5) THEN
            v_data_limite := pedido_pai.order_date::DATE + 4;
        ELSE
            v_data_limite := pedido_pai.order_date::DATE + 2;
        END IF;

        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT id, transaction_hash, offer_name, product_name FROM ticto_pedidos p
                WHERE p.id != pedido_pai.id
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE > pedido_pai.order_date::DATE
                AND p.order_date::DATE <= v_data_limite
                AND UPPER(p.offer_name) LIKE '%CC%'
            LOOP
                DECLARE v_sigla_pv TEXT;
                BEGIN
                    v_sigla_pv := CASE 
                        WHEN UPPER(rec.product_name) LIKE '%DESEJO%' THEN 'DP'
                        WHEN UPPER(rec.product_name) LIKE '%LUMI%' THEN 'BL'
                        WHEN UPPER(rec.product_name) LIKE '%FORMA%' THEN 'BF'
                        ELSE 'OUTRO' END;
                    v_pos_vendas := array_append(v_pos_vendas, v_sigla_pv || ':' || rec.offer_name);
                END;
                
                IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                END IF;
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- Montar nome oferta
        IF array_length(v_order_bumps, 1) > 0 THEN v_nome_oferta := v_nome_oferta || ' + Order Bump'; END IF;
        IF array_length(v_upsells, 1) > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || array_length(v_upsells, 1) || ' UP'; END IF;
        
        DECLARE
            v_pv_dp INT := 0; v_pv_bf INT := 0; v_pv_bl INT := 0; v_pv_item TEXT;
        BEGIN
            IF v_pos_vendas IS NOT NULL THEN
                FOREACH v_pv_item IN ARRAY v_pos_vendas LOOP
                    IF    v_pv_item LIKE 'DP:%' THEN v_pv_dp := v_pv_dp + 1;
                    ELSIF v_pv_item LIKE 'BF:%' THEN v_pv_bf := v_pv_bf + 1;
                    ELSIF v_pv_item LIKE 'BL:%' THEN v_pv_bl := v_pv_bl + 1;
                    END IF;
                END LOOP;
            END IF;
            IF v_pv_dp > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_dp || ' DP'; END IF;
            IF v_pv_bf > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bf || ' BF'; END IF;
            IF v_pv_bl > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bl || ' BL'; END IF;
        END;

        v_descricao := pedido_pai.sigla || ' - ' || v_nome_oferta;

        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
            valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
            telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
            endereco_completo, data_venda, created_at, 
            descricao_pacote, codigos_agrupados, quantidade_pedidos, produto_principal,
            dia_despacho, status_envio,
            order_bumps, upsells, pos_vendas, codigos_filhos, tem_dois_cartoes, fraude_endereco
        ) VALUES (
            pedido_pai.id,
            pedido_pai.transaction_hash,
            CASE WHEN v_tem_dois_cartoes THEN '2 Cartões' ELSE 'Aprovado' END,
            pedido_pai.product_name,
            v_nome_oferta,
            pedido_pai.paid_amount,
            pedido_pai.payment_method,
            pedido_pai.installments,
            pedido_pai.customer_name,
            pedido_pai.customer_email,
            pedido_pai.customer_cpf,
            pedido_pai.customer_phone,
            pedido_pai.address_zip_code,
            pedido_pai.address_street,
            pedido_pai.address_number,
            pedido_pai.address_complement,
            pedido_pai.address_neighborhood,
            pedido_pai.address_city,
            pedido_pai.address_state,
            CONCAT_WS(', ', pedido_pai.address_street, pedido_pai.address_number, pedido_pai.address_neighborhood, pedido_pai.address_city, pedido_pai.address_state),
            pedido_pai.order_date,
            pedido_pai.created_at,
            v_descricao,
            ARRAY[pedido_pai.transaction_hash] || v_codigos_filhos,
            v_quantidade,
            pedido_pai.sigla,
            v_dia_despacho, 
            'Pendente',
            v_order_bumps, v_upsells, v_pos_vendas, v_codigos_filhos,
            v_tem_dois_cartoes, FALSE
        )
        ON CONFLICT (codigo_transacao) DO UPDATE SET
            nome_oferta = EXCLUDED.nome_oferta,
            descricao_pacote = EXCLUDED.descricao_pacote,
            codigos_agrupados = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps = EXCLUDED.order_bumps,
            upsells = EXCLUDED.upsells,
            pos_vendas = EXCLUDED.pos_vendas,
            codigos_filhos = EXCLUDED.codigos_filhos,
            updated_at = now();
            
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Consolidação concluída com sucesso'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION consolidar_pedidos_ticto() TO anon, authenticated, service_role;

SELECT 'Migration 053: Corrigido rastreamento por ID na tabela ticto_pedidos para permitir processar OBs de um mesmo checkout!' as resultado;


-- ==========================================
-- MIGRATION: 054_fix_oferta_principal_order.sql
-- ==========================================

-- ================================================================
-- MIGRATION 054: Forçar ordenação correta nos pedidos principais
-- Data: 2026-03-03
--
-- Problema:
-- Vimos na migration 053 que o webhook envia 2 itens do mesmo
-- checkout com a mesma Data/Hora e Hash. 
-- Ambos entravam na fila de candidatos a PAI. E devido à falta de
-- ordenação estrita, o PostgreSQL acabava elegendo o registro 
-- "Order Bump 2 Frascos" como pai de alguns clientes, ignorando o
-- produto principal "Compre 1 e Leve 2" que vinha na linha seguinte.
--
-- Solução:
-- No loop FOR de pedidos pai, adicionar um ORDER BY forte:
-- 1. data cresc
-- 2. CASE WHEN nome_oferta ILIKE '%ORDERBUMP%' THEN 1 ELSE 0 END
-- 
-- Isso força os produtos puros (Compre 1 e Leve 2) a saírem primeiro
-- na fila, se tornarem o pai, e assim o Order Bump (0) é colhido no
-- sub-loop de filhos logo em seguida.
-- ================================================================

CREATE OR REPLACE FUNCTION consolidar_pedidos_ticto()
RETURNS jsonb AS $$
DECLARE
    v_total_principais INTEGER := 0;
    
    pedido_pai RECORD;
    rec RECORD;
    
    v_codigos_filhos TEXT[];
    v_order_bumps TEXT[];
    v_upsells TEXT[];
    v_pos_vendas TEXT[];
    v_nome_oferta TEXT;
    v_quantidade INTEGER;
    v_doc_limpo TEXT;
    v_data_limite DATE;
    v_tem_dois_cartoes BOOLEAN;
    v_sigla TEXT;
    v_descricao TEXT;
    
    v_hoje DATE;
    v_nome_feriado TEXT;
    v_dia_pv DATE;
    v_dia_despacho DATE;
BEGIN
    v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

    SELECT nome INTO v_nome_feriado FROM feriados WHERE data = v_hoje;
    IF v_nome_feriado IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'skipped');
    END IF;

    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;

    CREATE TEMP TABLE _locked_ids AS
    SELECT id FROM pedidos_consolidados_v3
    WHERE codigo_rastreio IS NOT NULL OR foi_editado = TRUE OR data_envio IS NOT NULL;

    CREATE TEMP TABLE _locked_codes AS
    SELECT codigo_transacao FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids)
    UNION
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids);

    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
    ) to_delete
    WHERE c.id = to_delete.id;

    CREATE TEMP TABLE _processed (pedido_id UUID PRIMARY KEY);
    
    INSERT INTO _processed (pedido_id)
    SELECT id FROM ticto_pedidos WHERE transaction_hash IN (SELECT codigo_transacao FROM _locked_codes);

    -- =========================================================
    -- LOOP PRINCIPAL DE PAIS (COM ORDENAÇÃO CORRIGIDA)
    -- =========================================================
    FOR pedido_pai IN
        SELECT 
            p.*,
            REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') as doc_limpo,
            LOWER(COALESCE(p.customer_email, '')) as email_lower,
            UPPER(REPLACE(COALESCE(p.offer_name, ''), ' ', '')) as oferta_norm,
            CASE 
                WHEN UPPER(p.product_name) LIKE '%DESEJO%' THEN 'DP'
                WHEN UPPER(p.product_name) LIKE '%LUMI%' THEN 'BL'
                WHEN UPPER(p.product_name) LIKE '%FORMA%' THEN 'BF'
                ELSE NULL
            END as sigla
        FROM ticto_pedidos p
        WHERE p.status IN ('authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago')
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%UPSELL%'
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%CC%'
        ORDER BY 
          p.order_date ASC,
          -- ✅ A MÁGICA: Itens normais vêm PRIMEIRO. Order Bumps vão pro final da fila !
          CASE WHEN UPPER(COALESCE(p.offer_name,'')) LIKE '%ORDERBUMP%' THEN 1 ELSE 0 END ASC,
          p.created_at ASC
    LOOP
        IF pedido_pai.sigla IS NULL THEN CONTINUE; END IF;

        -- NOVO FIX: O cursor do FOR pre-carrega todos os registros antes do loop iniciar.
        -- Precisamos verificar novamente SE o pedido atual já foi processado como 
        -- Order Bump (filho) nos ciclos anteriores do mesmo loop!
        IF EXISTS (SELECT 1 FROM _processed WHERE pedido_id = pedido_pai.id) THEN
            CONTINUE;
        END IF;

        v_codigos_filhos := ARRAY[]::TEXT[];
        v_order_bumps := ARRAY[]::TEXT[];
        v_upsells := ARRAY[]::TEXT[];
        v_pos_vendas := ARRAY[]::TEXT[];
        v_quantidade := 1;
        v_tem_dois_cartoes := FALSE;
        
        v_nome_oferta := pedido_pai.offer_name;

        INSERT INTO _processed (pedido_id) VALUES (pedido_pai.id) ON CONFLICT DO NOTHING;

        BEGIN
            v_dia_pv := proximo_dia_util(pedido_pai.order_date::DATE);
            v_dia_despacho := proximo_dia_util(v_dia_pv);
        EXCEPTION WHEN OTHERS THEN
            v_dia_despacho := (pedido_pai.order_date::DATE + 2);
        END;

        -- Subloop: Recolher Order Bumps
        FOR rec IN
            SELECT id, transaction_hash, offer_name FROM ticto_pedidos p
            WHERE p.id != pedido_pai.id
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.order_date::DATE = pedido_pai.order_date::DATE
            AND UPPER(REPLACE(p.offer_name, ' ', '')) LIKE '%ORDERBUMP%'
        LOOP
            IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            END IF;
            v_order_bumps := array_append(v_order_bumps, rec.offer_name);
            v_quantidade := v_quantidade + 1;
            INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- Upsells
        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT id, transaction_hash, offer_name FROM ticto_pedidos p
                WHERE p.id != pedido_pai.id
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE BETWEEN pedido_pai.order_date::DATE AND (pedido_pai.order_date::DATE + 1)
                AND UPPER(p.offer_name) LIKE '%UPSELL%'
            LOOP
                IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                END IF;
                v_upsells := array_append(v_upsells, rec.offer_name);
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- 2 Cartões
        FOR rec IN
            SELECT id, transaction_hash FROM ticto_pedidos p
            WHERE p.id != pedido_pai.id
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.offer_name = pedido_pai.offer_name
            AND p.order_date::DATE = pedido_pai.order_date::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            END IF;
            INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- Pós-Vendas
        IF EXTRACT(DOW FROM pedido_pai.order_date) IN (4, 5) THEN
            v_data_limite := pedido_pai.order_date::DATE + 4;
        ELSE
            v_data_limite := pedido_pai.order_date::DATE + 2;
        END IF;

        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT id, transaction_hash, offer_name, product_name FROM ticto_pedidos p
                WHERE p.id != pedido_pai.id
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE > pedido_pai.order_date::DATE
                AND p.order_date::DATE <= v_data_limite
                AND UPPER(p.offer_name) LIKE '%CC%'
            LOOP
                DECLARE v_sigla_pv TEXT;
                BEGIN
                    v_sigla_pv := CASE 
                        WHEN UPPER(rec.product_name) LIKE '%DESEJO%' THEN 'DP'
                        WHEN UPPER(rec.product_name) LIKE '%LUMI%' THEN 'BL'
                        WHEN UPPER(rec.product_name) LIKE '%FORMA%' THEN 'BF'
                        ELSE 'OUTRO' END;
                    v_pos_vendas := array_append(v_pos_vendas, v_sigla_pv || ':' || rec.offer_name);
                END;
                
                IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                END IF;
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- =========================================================
        -- FORMATAÇÃO FINAL DO NOME DA OFERTA CONSOLIDADO
        -- =========================================================
        IF array_length(v_order_bumps, 1) > 0 THEN 
            IF UPPER(REPLACE(v_nome_oferta, ' ', '')) NOT LIKE '%ORDERBUMP%' THEN
                v_nome_oferta := v_nome_oferta || ' + Order Bump'; 
            END IF;
        END IF;
        
        IF array_length(v_upsells, 1) > 0 THEN 
            v_nome_oferta := v_nome_oferta || ' + ' || array_length(v_upsells, 1) || ' UP'; 
        END IF;
        
        DECLARE
            v_pv_dp INT := 0; v_pv_bf INT := 0; v_pv_bl INT := 0; v_pv_item TEXT;
        BEGIN
            IF v_pos_vendas IS NOT NULL THEN
                FOREACH v_pv_item IN ARRAY v_pos_vendas LOOP
                    IF    v_pv_item LIKE 'DP:%' THEN v_pv_dp := v_pv_dp + 1;
                    ELSIF v_pv_item LIKE 'BF:%' THEN v_pv_bf := v_pv_bf + 1;
                    ELSIF v_pv_item LIKE 'BL:%' THEN v_pv_bl := v_pv_bl + 1;
                    END IF;
                END LOOP;
            END IF;
            IF v_pv_dp > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_dp || ' DP'; END IF;
            IF v_pv_bf > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bf || ' BF'; END IF;
            IF v_pv_bl > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bl || ' BL'; END IF;
        END;

        v_descricao := pedido_pai.sigla || ' - ' || v_nome_oferta;

        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
            valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
            telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
            endereco_completo, data_venda, created_at, 
            descricao_pacote, codigos_agrupados, quantidade_pedidos, produto_principal,
            dia_despacho, status_envio,
            order_bumps, upsells, pos_vendas, codigos_filhos, tem_dois_cartoes, fraude_endereco
        ) VALUES (
            pedido_pai.id,
            pedido_pai.transaction_hash,
            CASE WHEN v_tem_dois_cartoes THEN '2 Cartões' ELSE 'Aprovado' END,
            pedido_pai.product_name,
            v_nome_oferta,
            pedido_pai.paid_amount,
            pedido_pai.payment_method,
            pedido_pai.installments,
            pedido_pai.customer_name,
            pedido_pai.customer_email,
            pedido_pai.customer_cpf,
            pedido_pai.customer_phone,
            pedido_pai.address_zip_code,
            pedido_pai.address_street,
            pedido_pai.address_number,
            pedido_pai.address_complement,
            pedido_pai.address_neighborhood,
            pedido_pai.address_city,
            pedido_pai.address_state,
            CONCAT_WS(', ', pedido_pai.address_street, pedido_pai.address_number, pedido_pai.address_neighborhood, pedido_pai.address_city, pedido_pai.address_state),
            pedido_pai.order_date,
            pedido_pai.created_at,
            v_descricao,
            ARRAY[pedido_pai.transaction_hash] || v_codigos_filhos,
            v_quantidade,
            pedido_pai.sigla,
            v_dia_despacho, 
            'Pendente',
            v_order_bumps, v_upsells, v_pos_vendas, v_codigos_filhos,
            v_tem_dois_cartoes, FALSE
        )
        ON CONFLICT (codigo_transacao) DO UPDATE SET
            nome_oferta = EXCLUDED.nome_oferta,
            descricao_pacote = EXCLUDED.descricao_pacote,
            codigos_agrupados = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps = EXCLUDED.order_bumps,
            upsells = EXCLUDED.upsells,
            pos_vendas = EXCLUDED.pos_vendas,
            codigos_filhos = EXCLUDED.codigos_filhos,
            updated_at = now();
            
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Consolidação concluída com sucesso'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION consolidar_pedidos_ticto() TO anon, authenticated, service_role;


-- ==========================================
-- MIGRATION: 055_fix_upsell_consolidation.sql
-- ==========================================

-- ================================================================
-- MIGRATION 055: Forçar ordenação e segurança correta para UPSELLS
-- Data: 2026-03-03
--
-- O que essa migration faz:
-- 1. Estende a lógica da Migration 054 (que arrumou os OBs)
--    para também cobrir os produtos de UPSELL.
-- 2. Assim como os Order Bumps, os Upsells não podem assumir como
--    Pedido Pai se houver um produto principal no mesmo dia.
-- 3. A restrição `NOT LIKE '%UPSELL%'` foi removida do WHERE principal
--    e tratada no `ORDER BY`, garantindo que o Upsell fique no final 
--    da fila e dê a preferência para o Produto Principal.
-- 4. Mantido o Fix do `IF EXISTS (_processed)` dentro do loop para 
--    evitar sobrescritas de nomes combinados.
-- 5. Atualiza a nomenclatura de '+ 1 UP' para o nome correto caso
--    seja o único pedido (ex: apenas o Upsell).
-- ================================================================

CREATE OR REPLACE FUNCTION consolidar_pedidos_ticto()
RETURNS jsonb AS $$
DECLARE
    v_total_principais INTEGER := 0;
    
    pedido_pai RECORD;
    rec RECORD;
    
    v_codigos_filhos TEXT[];
    v_order_bumps TEXT[];
    v_upsells TEXT[];
    v_pos_vendas TEXT[];
    v_nome_oferta TEXT;
    v_quantidade INTEGER;
    v_doc_limpo TEXT;
    v_data_limite DATE;
    v_tem_dois_cartoes BOOLEAN;
    v_sigla TEXT;
    v_descricao TEXT;
    
    v_hoje DATE;
    v_nome_feriado TEXT;
    v_dia_pv DATE;
    v_dia_despacho DATE;
BEGIN
    v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

    SELECT nome INTO v_nome_feriado FROM feriados WHERE data = v_hoje;
    IF v_nome_feriado IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'skipped');
    END IF;

    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;

    CREATE TEMP TABLE _locked_ids AS
    SELECT id FROM pedidos_consolidados_v3
    WHERE codigo_rastreio IS NOT NULL OR foi_editado = TRUE OR data_envio IS NOT NULL;

    CREATE TEMP TABLE _locked_codes AS
    SELECT codigo_transacao FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids)
    UNION
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids);

    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
    ) to_delete
    WHERE c.id = to_delete.id;

    CREATE TEMP TABLE _processed (pedido_id UUID PRIMARY KEY);
    
    INSERT INTO _processed (pedido_id)
    SELECT id FROM ticto_pedidos WHERE transaction_hash IN (SELECT codigo_transacao FROM _locked_codes);

    -- =========================================================
    -- LOOP PRINCIPAL DE PAIS 
    -- =========================================================
    FOR pedido_pai IN
        SELECT 
            p.*,
            REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') as doc_limpo,
            LOWER(COALESCE(p.customer_email, '')) as email_lower,
            UPPER(REPLACE(COALESCE(p.offer_name, ''), ' ', '')) as oferta_norm,
            CASE 
                WHEN UPPER(p.product_name) LIKE '%DESEJO%' THEN 'DP'
                WHEN UPPER(p.product_name) LIKE '%LUMI%' THEN 'BL'
                WHEN UPPER(p.product_name) LIKE '%FORMA%' THEN 'BF'
                ELSE NULL
            END as sigla
        FROM ticto_pedidos p
        WHERE p.status IN ('authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago')
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
          -- REMOVIDO as restrições sumárias (OB, UPSELL). Agora todo mundo entra na fila, mas quem for "normal" passa na frente.
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%CC%'
        ORDER BY 
          p.order_date ASC,
          -- ✅ A MÁGICA: Itens "normais" valem 0, OBs e UPSELLS valem 1. Ou seja, normais vêm PRIMEIRO!
          CASE 
               WHEN UPPER(COALESCE(p.offer_name,'')) LIKE '%ORDERBUMP%' THEN 1 
               WHEN UPPER(COALESCE(p.offer_name,'')) LIKE '%UPSELL%' THEN 1
               ELSE 0 
          END ASC,
          p.created_at ASC
    LOOP
        IF pedido_pai.sigla IS NULL THEN CONTINUE; END IF;

        -- CHECAGEM DE VIDA: Evita que um Order Bump ou Upsell já absorvido recrie a linha e apague o nome montado!
        IF EXISTS (SELECT 1 FROM _processed WHERE pedido_id = pedido_pai.id) THEN
            CONTINUE;
        END IF;

        v_codigos_filhos := ARRAY[]::TEXT[];
        v_order_bumps := ARRAY[]::TEXT[];
        v_upsells := ARRAY[]::TEXT[];
        v_pos_vendas := ARRAY[]::TEXT[];
        v_quantidade := 1;
        v_tem_dois_cartoes := FALSE;
        
        v_nome_oferta := pedido_pai.offer_name;

        INSERT INTO _processed (pedido_id) VALUES (pedido_pai.id) ON CONFLICT DO NOTHING;

        BEGIN
            v_dia_pv := proximo_dia_util(pedido_pai.order_date::DATE);
            v_dia_despacho := proximo_dia_util(v_dia_pv);
        EXCEPTION WHEN OTHERS THEN
            v_dia_despacho := (pedido_pai.order_date::DATE + 2);
        END;

        -- O BUMPS (Mesmo dia, Mesmo e-mail)
        FOR rec IN
            SELECT id, transaction_hash, offer_name FROM ticto_pedidos p
            WHERE p.id != pedido_pai.id
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.order_date::DATE = pedido_pai.order_date::DATE
            AND UPPER(REPLACE(p.offer_name, ' ', '')) LIKE '%ORDERBUMP%'
        LOOP
            IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            END IF;
            v_order_bumps := array_append(v_order_bumps, rec.offer_name);
            v_quantidade := v_quantidade + 1;
            INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- UPSELLS (Doc Limpo, até +1 dia)
        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT id, transaction_hash, offer_name FROM ticto_pedidos p
                WHERE p.id != pedido_pai.id
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE BETWEEN pedido_pai.order_date::DATE AND (pedido_pai.order_date::DATE + 1)
                AND UPPER(p.offer_name) LIKE '%UPSELL%'
            LOOP
                IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                END IF;
                v_upsells := array_append(v_upsells, rec.offer_name);
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- 2 CARTÕES (Mesmo nome, E-mail, data e oferta principal idêntica)
        FOR rec IN
            SELECT id, transaction_hash FROM ticto_pedidos p
            WHERE p.id != pedido_pai.id
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.offer_name = pedido_pai.offer_name
            AND p.order_date::DATE = pedido_pai.order_date::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            END IF;
            INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- PÓS-VENDAS / CALL CENTER
        IF EXTRACT(DOW FROM pedido_pai.order_date) IN (4, 5) THEN
            v_data_limite := pedido_pai.order_date::DATE + 4;
        ELSE
            v_data_limite := pedido_pai.order_date::DATE + 2;
        END IF;

        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT id, transaction_hash, offer_name, product_name FROM ticto_pedidos p
                WHERE p.id != pedido_pai.id
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE > pedido_pai.order_date::DATE
                AND p.order_date::DATE <= v_data_limite
                AND UPPER(p.offer_name) LIKE '%CC%'
            LOOP
                DECLARE v_sigla_pv TEXT;
                BEGIN
                    v_sigla_pv := CASE 
                        WHEN UPPER(rec.product_name) LIKE '%DESEJO%' THEN 'DP'
                        WHEN UPPER(rec.product_name) LIKE '%LUMI%' THEN 'BL'
                        WHEN UPPER(rec.product_name) LIKE '%FORMA%' THEN 'BF'
                        ELSE 'OUTRO' END;
                    v_pos_vendas := array_append(v_pos_vendas, v_sigla_pv || ':' || rec.offer_name);
                END;
                
                IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                END IF;
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- =========================================================
        -- FORMATAÇÃO FINAL 
        -- =========================================================
        IF array_length(v_order_bumps, 1) > 0 THEN 
            IF UPPER(REPLACE(v_nome_oferta, ' ', '')) NOT LIKE '%ORDERBUMP%' THEN
                v_nome_oferta := v_nome_oferta || ' + Order Bump'; 
            END IF;
        END IF;
        
        IF array_length(v_upsells, 1) > 0 THEN 
            IF UPPER(REPLACE(v_nome_oferta, ' ', '')) NOT LIKE '%UPSELL%' THEN
                v_nome_oferta := v_nome_oferta || ' + ' || array_length(v_upsells, 1) || ' UPSELL'; 
            END IF;
        END IF;
        
        -- Conta e formata os PVs (Pós-Vendas) anexados
        DECLARE
            v_pv_dp INT := 0; v_pv_bf INT := 0; v_pv_bl INT := 0; v_pv_item TEXT;
        BEGIN
            IF v_pos_vendas IS NOT NULL THEN
                FOREACH v_pv_item IN ARRAY v_pos_vendas LOOP
                    IF    v_pv_item LIKE 'DP:%' THEN v_pv_dp := v_pv_dp + 1;
                    ELSIF v_pv_item LIKE 'BF:%' THEN v_pv_bf := v_pv_bf + 1;
                    ELSIF v_pv_item LIKE 'BL:%' THEN v_pv_bl := v_pv_bl + 1;
                    END IF;
                END LOOP;
            END IF;
            IF v_pv_dp > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_dp || ' DP'; END IF;
            IF v_pv_bf > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bf || ' BF'; END IF;
            IF v_pv_bl > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bl || ' BL'; END IF;
        END;

        v_descricao := pedido_pai.sigla || ' - ' || v_nome_oferta;

        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
            valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
            telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
            endereco_completo, data_venda, created_at, 
            descricao_pacote, codigos_agrupados, quantidade_pedidos, produto_principal,
            dia_despacho, status_envio,
            order_bumps, upsells, pos_vendas, codigos_filhos, tem_dois_cartoes, fraude_endereco
        ) VALUES (
            pedido_pai.id,
            pedido_pai.transaction_hash,
            CASE WHEN v_tem_dois_cartoes THEN '2 Cartões' ELSE 'Aprovado' END,
            pedido_pai.product_name,
            v_nome_oferta,
            pedido_pai.paid_amount,
            pedido_pai.payment_method,
            pedido_pai.installments,
            pedido_pai.customer_name,
            pedido_pai.customer_email,
            pedido_pai.customer_cpf,
            pedido_pai.customer_phone,
            pedido_pai.address_zip_code,
            pedido_pai.address_street,
            pedido_pai.address_number,
            pedido_pai.address_complement,
            pedido_pai.address_neighborhood,
            pedido_pai.address_city,
            pedido_pai.address_state,
            CONCAT_WS(', ', pedido_pai.address_street, pedido_pai.address_number, pedido_pai.address_neighborhood, pedido_pai.address_city, pedido_pai.address_state),
            pedido_pai.order_date,
            pedido_pai.created_at,
            v_descricao,
            ARRAY[pedido_pai.transaction_hash] || v_codigos_filhos,
            v_quantidade,
            pedido_pai.sigla,
            v_dia_despacho, 
            'Pendente',
            v_order_bumps, v_upsells, v_pos_vendas, v_codigos_filhos,
            v_tem_dois_cartoes, FALSE
        )
        ON CONFLICT (codigo_transacao) DO UPDATE SET
            nome_oferta = EXCLUDED.nome_oferta,
            descricao_pacote = EXCLUDED.descricao_pacote,
            codigos_agrupados = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps = EXCLUDED.order_bumps,
            upsells = EXCLUDED.upsells,
            pos_vendas = EXCLUDED.pos_vendas,
            codigos_filhos = EXCLUDED.codigos_filhos,
            updated_at = now();
            
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Consolidação concluída com sucesso'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION consolidar_pedidos_ticto() TO anon, authenticated, service_role;


-- ==========================================
-- MIGRATION: 056_fix_pv_and_subloop_status.sql
-- ==========================================

-- ================================================================
-- MIGRATION 056: Filtros de Status nos subloops e Contagem Real de Frascos (PV)
-- Data: 2026-03-03
--
-- O que essa migration resolve:
-- 1. Faltava a validação de status de pagamento dentro dos subloops.
--    Isso fazia com que Upsells "Recusados" ou "Pix Gerados" de PV
--    fossem indevidamente anexados ao pedido pai pago.
-- 2. A consolidação dos produtos de Pós-Venda (CC) adicionava +1
--    para cada transação aprovada. Porém, o correto é ler a "quantidade
--    de frascos" da oferta (ex: "2 Frascos - CC" = + 2 BF, não 1).
--    Aplicamos extração via Regex no PostgreSQL para somar frascos reais.
-- ================================================================

CREATE OR REPLACE FUNCTION consolidar_pedidos_ticto()
RETURNS jsonb AS $$
DECLARE
    v_total_principais INTEGER := 0;
    
    pedido_pai RECORD;
    rec RECORD;
    
    v_codigos_filhos TEXT[];
    v_order_bumps TEXT[];
    v_upsells TEXT[];
    v_pos_vendas TEXT[];
    v_nome_oferta TEXT;
    v_quantidade INTEGER;
    v_doc_limpo TEXT;
    v_data_limite DATE;
    v_tem_dois_cartoes BOOLEAN;
    v_sigla TEXT;
    v_descricao TEXT;
    
    v_hoje DATE;
    v_nome_feriado TEXT;
    v_dia_pv DATE;
    v_dia_despacho DATE;
    
    -- Status esperados para pedidos serem considerados "faturados"
    -- Usado tanto na head quanto nos subloops
    v_valid_status TEXT[] := ARRAY['authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago'];
BEGIN
    v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

    SELECT nome INTO v_nome_feriado FROM feriados WHERE data = v_hoje;
    IF v_nome_feriado IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'skipped');
    END IF;

    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;

    CREATE TEMP TABLE _locked_ids AS
    SELECT id FROM pedidos_consolidados_v3
    WHERE codigo_rastreio IS NOT NULL OR foi_editado = TRUE OR data_envio IS NOT NULL;

    CREATE TEMP TABLE _locked_codes AS
    SELECT codigo_transacao FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids)
    UNION
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids);

    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
    ) to_delete
    WHERE c.id = to_delete.id;

    CREATE TEMP TABLE _processed (pedido_id UUID PRIMARY KEY);
    
    INSERT INTO _processed (pedido_id)
    SELECT id FROM ticto_pedidos WHERE transaction_hash IN (SELECT codigo_transacao FROM _locked_codes);

    -- =========================================================
    -- LOOP PRINCIPAL DE PAIS 
    -- =========================================================
    FOR pedido_pai IN
        SELECT 
            p.*,
            REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') as doc_limpo,
            LOWER(COALESCE(p.customer_email, '')) as email_lower,
            UPPER(REPLACE(COALESCE(p.offer_name, ''), ' ', '')) as oferta_norm,
            CASE 
                WHEN UPPER(p.product_name) LIKE '%DESEJO%' THEN 'DP'
                WHEN UPPER(p.product_name) LIKE '%LUMI%' THEN 'BL'
                WHEN UPPER(p.product_name) LIKE '%FORMA%' THEN 'BF'
                ELSE NULL
            END as sigla
        FROM ticto_pedidos p
        WHERE p.status = ANY(v_valid_status)
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%CC%'
        ORDER BY 
          p.order_date ASC,
          CASE 
               WHEN UPPER(COALESCE(p.offer_name,'')) LIKE '%ORDERBUMP%' THEN 1 
               WHEN UPPER(COALESCE(p.offer_name,'')) LIKE '%UPSELL%' THEN 1
               ELSE 0 
          END ASC,
          p.created_at ASC
    LOOP
        IF pedido_pai.sigla IS NULL THEN CONTINUE; END IF;

        IF EXISTS (SELECT 1 FROM _processed WHERE pedido_id = pedido_pai.id) THEN
            CONTINUE;
        END IF;

        v_codigos_filhos := ARRAY[]::TEXT[];
        v_order_bumps := ARRAY[]::TEXT[];
        v_upsells := ARRAY[]::TEXT[];
        v_pos_vendas := ARRAY[]::TEXT[];
        v_quantidade := 1;
        v_tem_dois_cartoes := FALSE;
        
        v_nome_oferta := pedido_pai.offer_name;

        INSERT INTO _processed (pedido_id) VALUES (pedido_pai.id) ON CONFLICT DO NOTHING;

        BEGIN
            v_dia_pv := proximo_dia_util(pedido_pai.order_date::DATE);
            v_dia_despacho := proximo_dia_util(v_dia_pv);
        EXCEPTION WHEN OTHERS THEN
            v_dia_despacho := (pedido_pai.order_date::DATE + 2);
        END;

        -- O BUMPS (Mesmo dia, Mesmo e-mail)
        FOR rec IN
            SELECT id, transaction_hash, offer_name FROM ticto_pedidos p
            WHERE p.id != pedido_pai.id
            AND p.status = ANY(v_valid_status) 
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.order_date::DATE = pedido_pai.order_date::DATE
            AND UPPER(REPLACE(p.offer_name, ' ', '')) LIKE '%ORDERBUMP%'
        LOOP
            IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            END IF;
            v_order_bumps := array_append(v_order_bumps, rec.offer_name);
            v_quantidade := v_quantidade + 1;
            INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- UPSELLS (Doc Limpo, até +1 dia)
        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT id, transaction_hash, offer_name FROM ticto_pedidos p
                WHERE p.id != pedido_pai.id
                AND p.status = ANY(v_valid_status) 
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE BETWEEN pedido_pai.order_date::DATE AND (pedido_pai.order_date::DATE + 1)
                AND UPPER(p.offer_name) LIKE '%UPSELL%'
            LOOP
                IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                END IF;
                v_upsells := array_append(v_upsells, rec.offer_name);
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- 2 CARTÕES (Mesmo nome, E-mail, data e oferta principal idêntica)
        FOR rec IN
            SELECT id, transaction_hash FROM ticto_pedidos p
            WHERE p.id != pedido_pai.id
            AND p.status = ANY(v_valid_status) 
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.offer_name = pedido_pai.offer_name
            AND p.order_date::DATE = pedido_pai.order_date::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            END IF;
            INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- PÓS-VENDAS / CALL CENTER
        IF EXTRACT(DOW FROM pedido_pai.order_date) IN (4, 5) THEN
            v_data_limite := pedido_pai.order_date::DATE + 4;
        ELSE
            v_data_limite := pedido_pai.order_date::DATE + 2;
        END IF;

        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT id, transaction_hash, offer_name, product_name FROM ticto_pedidos p
                WHERE p.id != pedido_pai.id
                AND p.status = ANY(v_valid_status) 
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE > pedido_pai.order_date::DATE
                AND p.order_date::DATE <= v_data_limite
                AND UPPER(p.offer_name) LIKE '%CC%'
            LOOP
                DECLARE 
                    v_sigla_pv TEXT;
                    v_match TEXT;
                    v_qtde INT;
                BEGIN
                    v_sigla_pv := CASE 
                        WHEN UPPER(rec.product_name) LIKE '%DESEJO%' THEN 'DP'
                        WHEN UPPER(rec.product_name) LIKE '%LUMI%' THEN 'BL'
                        WHEN UPPER(rec.product_name) LIKE '%FORMA%' THEN 'BF'
                        ELSE 'OUTRO' END;
                    
                    -- Regex segura para extrair o numerico antes de Frasco, Pote ou Unidade.
                    -- Usa grupos de captura e case-insensitivity default via UPPER.
                    v_match := substring(UPPER(rec.offer_name) from '([0-9]+)\s*FRASCO');
                    IF v_match IS NULL THEN v_match := substring(UPPER(rec.offer_name) from '([0-9]+)\s*POTE'); END IF;
                    IF v_match IS NULL THEN v_match := substring(UPPER(rec.offer_name) from '([0-9]+)\s*UNIDADE'); END IF;
                    IF v_match IS NULL THEN v_match := substring(UPPER(rec.offer_name) from '([0-9]+)'); END IF;
                    
                    IF v_match IS NOT NULL THEN 
                        v_qtde := v_match::INT; 
                    ELSE 
                        v_qtde := 1; 
                    END IF;

                    -- Guarda 'BL:2' para somar dps
                    v_pos_vendas := array_append(v_pos_vendas, v_sigla_pv || ':' || v_qtde::TEXT);
                END;
                
                IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                END IF;
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- =========================================================
        -- FORMATAÇÃO FINAL 
        -- =========================================================
        IF array_length(v_order_bumps, 1) > 0 THEN 
            IF UPPER(REPLACE(v_nome_oferta, ' ', '')) NOT LIKE '%ORDERBUMP%' THEN
                v_nome_oferta := v_nome_oferta || ' + Order Bump'; 
            END IF;
        END IF;
        
        IF array_length(v_upsells, 1) > 0 THEN 
            IF UPPER(REPLACE(v_nome_oferta, ' ', '')) NOT LIKE '%UPSELL%' THEN
                v_nome_oferta := v_nome_oferta || ' + ' || array_length(v_upsells, 1) || ' UPSELL'; 
            END IF;
        END IF;
        
        -- Conta e formata os PVs somando EXTRAÍDOS POR Regex
        DECLARE
            v_pv_dp INT := 0; v_pv_bf INT := 0; v_pv_bl INT := 0; v_pv_item TEXT;
            v_sigla_s TEXT; v_qtde_s INT;
        BEGIN
            IF v_pos_vendas IS NOT NULL THEN
                FOREACH v_pv_item IN ARRAY v_pos_vendas LOOP
                    v_sigla_s := split_part(v_pv_item, ':', 1);
                    BEGIN
                        v_qtde_s := split_part(v_pv_item, ':', 2)::INT;
                    EXCEPTION WHEN OTHERS THEN 
                        v_qtde_s := 1;
                    END;

                    IF    v_sigla_s = 'DP' THEN v_pv_dp := v_pv_dp + v_qtde_s;
                    ELSIF v_sigla_s = 'BF' THEN v_pv_bf := v_pv_bf + v_qtde_s;
                    ELSIF v_sigla_s = 'BL' THEN v_pv_bl := v_pv_bl + v_qtde_s;
                    END IF;
                END LOOP;
            END IF;
            IF v_pv_dp > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_dp || ' DP'; END IF;
            IF v_pv_bf > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bf || ' BF'; END IF;
            IF v_pv_bl > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bl || ' BL'; END IF;
        END;

        v_descricao := pedido_pai.sigla || ' - ' || v_nome_oferta;

        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
            valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
            telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
            endereco_completo, data_venda, created_at, 
            descricao_pacote, codigos_agrupados, quantidade_pedidos, produto_principal,
            dia_despacho, status_envio,
            order_bumps, upsells, pos_vendas, codigos_filhos, tem_dois_cartoes, fraude_endereco
        ) VALUES (
            pedido_pai.id,
            pedido_pai.transaction_hash,
            CASE WHEN v_tem_dois_cartoes THEN '2 Cartões' ELSE 'Aprovado' END,
            pedido_pai.product_name,
            v_nome_oferta,
            pedido_pai.paid_amount,
            pedido_pai.payment_method,
            pedido_pai.installments,
            pedido_pai.customer_name,
            pedido_pai.customer_email,
            pedido_pai.customer_cpf,
            pedido_pai.customer_phone,
            pedido_pai.address_zip_code,
            pedido_pai.address_street,
            pedido_pai.address_number,
            pedido_pai.address_complement,
            pedido_pai.address_neighborhood,
            pedido_pai.address_city,
            pedido_pai.address_state,
            CONCAT_WS(', ', pedido_pai.address_street, pedido_pai.address_number, pedido_pai.address_neighborhood, pedido_pai.address_city, pedido_pai.address_state),
            pedido_pai.order_date,
            pedido_pai.created_at,
            v_descricao,
            ARRAY[pedido_pai.transaction_hash] || v_codigos_filhos,
            v_quantidade,
            pedido_pai.sigla,
            v_dia_despacho, 
            'Pendente',
            v_order_bumps, v_upsells, v_pos_vendas, v_codigos_filhos,
            v_tem_dois_cartoes, FALSE
        )
        ON CONFLICT (codigo_transacao) DO UPDATE SET
            nome_oferta = EXCLUDED.nome_oferta,
            descricao_pacote = EXCLUDED.descricao_pacote,
            codigos_agrupados = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps = EXCLUDED.order_bumps,
            upsells = EXCLUDED.upsells,
            pos_vendas = EXCLUDED.pos_vendas,
            codigos_filhos = EXCLUDED.codigos_filhos,
            updated_at = now();
            
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Consolidação concluída com sucesso'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION consolidar_pedidos_ticto() TO anon, authenticated, service_role;


-- ==========================================
-- MIGRATION: 057_fix_pv_limite_fds.sql
-- ==========================================

-- ================================================================
-- MIGRATION 057: Regra Exata do Pós-Venda (Até 08:30 do dia_despacho)
-- Data: 2026-03-03
--
-- O que essa migration resolve:
-- 1. A regra anterior tentava adivinhar os dias úteis na marra 
--    (somando +2 ou +4 dependendo se era fim de semana).
-- 2. A usuária explicou a regra de ouro oficial: "A compra do
--    pós venda deve ocorrer até às 08:30 do Dia de Despacho" do
--    pedido original.
--    Ex: Bruna comprou Sábado (28/02). O Despacho dela era Terça (03/03).
--    O Pós Venda dela foi às 06:40 de 03/03. Logo, ela era plenamente elegível.
--
-- Como resolvemos:
-- - A função já possui a variável `v_dia_despacho` calculada perfeitamente
--   levando em conta finais de semana e a tabela de `feriados`.
-- - O subloop do Call Center agora varre pedidos cujas datas
--   são <= `v_dia_despacho + '08:30:59'`.
-- ================================================================

CREATE OR REPLACE FUNCTION consolidar_pedidos_ticto()
RETURNS jsonb AS $$
DECLARE
    v_total_principais INTEGER := 0;
    
    pedido_pai RECORD;
    rec RECORD;
    
    v_codigos_filhos TEXT[];
    v_order_bumps TEXT[];
    v_upsells TEXT[];
    v_pos_vendas TEXT[];
    v_nome_oferta TEXT;
    v_quantidade INTEGER;
    v_doc_limpo TEXT;
    
    v_data_limite_pv TIMESTAMP WITH TIME ZONE; -- << NOVA VARIÁVEL
    
    v_tem_dois_cartoes BOOLEAN;
    v_sigla TEXT;
    v_descricao TEXT;
    
    v_hoje DATE;
    v_nome_feriado TEXT;
    v_dia_pv DATE;
    v_dia_despacho DATE;
    
    v_valid_status TEXT[] := ARRAY['authorized', 'approved', 'paid', 'completed', 'Aprovado', 'Autorizado', 'Pago'];
BEGIN
    v_hoje := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

    SELECT nome INTO v_nome_feriado FROM feriados WHERE data = v_hoje;
    IF v_nome_feriado IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'skipped');
    END IF;

    DROP TABLE IF EXISTS _locked_ids;
    DROP TABLE IF EXISTS _locked_codes;
    DROP TABLE IF EXISTS _processed;

    CREATE TEMP TABLE _locked_ids AS
    SELECT id FROM pedidos_consolidados_v3
    WHERE codigo_rastreio IS NOT NULL OR foi_editado = TRUE OR data_envio IS NOT NULL;

    CREATE TEMP TABLE _locked_codes AS
    SELECT codigo_transacao FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids)
    UNION
    SELECT UNNEST(codigos_filhos) FROM pedidos_consolidados_v3 WHERE id IN (SELECT id FROM _locked_ids);

    DELETE FROM pedidos_consolidados_v3 c
    USING (
        SELECT c2.id FROM pedidos_consolidados_v3 c2
        LEFT JOIN _locked_ids l ON c2.id = l.id
        WHERE l.id IS NULL
    ) to_delete
    WHERE c.id = to_delete.id;

    CREATE TEMP TABLE _processed (pedido_id UUID PRIMARY KEY);
    
    INSERT INTO _processed (pedido_id)
    SELECT id FROM ticto_pedidos WHERE transaction_hash IN (SELECT codigo_transacao FROM _locked_codes);

    -- =========================================================
    -- LOOP PRINCIPAL DE PAIS 
    -- =========================================================
    FOR pedido_pai IN
        SELECT 
            p.*,
            REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') as doc_limpo,
            LOWER(COALESCE(p.customer_email, '')) as email_lower,
            UPPER(REPLACE(COALESCE(p.offer_name, ''), ' ', '')) as oferta_norm,
            CASE 
                WHEN UPPER(p.product_name) LIKE '%DESEJO%' THEN 'DP'
                WHEN UPPER(p.product_name) LIKE '%LUMI%' THEN 'BL'
                WHEN UPPER(p.product_name) LIKE '%FORMA%' THEN 'BF'
                ELSE NULL
            END as sigla
        FROM ticto_pedidos p
        WHERE p.status = ANY(v_valid_status)
          AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
          AND UPPER(COALESCE(p.offer_name,'')) NOT LIKE '%CC%'
        ORDER BY 
          p.order_date ASC,
          CASE 
               WHEN UPPER(COALESCE(p.offer_name,'')) LIKE '%ORDERBUMP%' THEN 1 
               WHEN UPPER(COALESCE(p.offer_name,'')) LIKE '%UPSELL%' THEN 1
               ELSE 0 
          END ASC,
          p.created_at ASC
    LOOP
        IF pedido_pai.sigla IS NULL THEN CONTINUE; END IF;

        IF EXISTS (SELECT 1 FROM _processed WHERE pedido_id = pedido_pai.id) THEN
            CONTINUE;
        END IF;

        v_codigos_filhos := ARRAY[]::TEXT[];
        v_order_bumps := ARRAY[]::TEXT[];
        v_upsells := ARRAY[]::TEXT[];
        v_pos_vendas := ARRAY[]::TEXT[];
        v_quantidade := 1;
        v_tem_dois_cartoes := FALSE;
        
        v_nome_oferta := pedido_pai.offer_name;

        INSERT INTO _processed (pedido_id) VALUES (pedido_pai.id) ON CONFLICT DO NOTHING;

        -- 1. Calcula o Dia do Despacho rigorosamente
        BEGIN
            v_dia_pv := proximo_dia_util(pedido_pai.order_date::DATE);
            v_dia_despacho := proximo_dia_util(v_dia_pv);
        EXCEPTION WHEN OTHERS THEN
            v_dia_despacho := (pedido_pai.order_date::DATE + 2);
        END;

        -- O BUMPS 
        FOR rec IN
            SELECT id, transaction_hash, offer_name FROM ticto_pedidos p
            WHERE p.id != pedido_pai.id
            AND p.status = ANY(v_valid_status) 
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.order_date::DATE = pedido_pai.order_date::DATE
            AND UPPER(REPLACE(p.offer_name, ' ', '')) LIKE '%ORDERBUMP%'
        LOOP
            IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            END IF;
            v_order_bumps := array_append(v_order_bumps, rec.offer_name);
            v_quantidade := v_quantidade + 1;
            INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- UPSELLS
        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT id, transaction_hash, offer_name FROM ticto_pedidos p
                WHERE p.id != pedido_pai.id
                AND p.status = ANY(v_valid_status) 
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date::DATE BETWEEN pedido_pai.order_date::DATE AND (pedido_pai.order_date::DATE + 1)
                AND UPPER(p.offer_name) LIKE '%UPSELL%'
            LOOP
                IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                END IF;
                v_upsells := array_append(v_upsells, rec.offer_name);
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- 2 CARTÕES
        FOR rec IN
            SELECT id, transaction_hash FROM ticto_pedidos p
            WHERE p.id != pedido_pai.id
            AND p.status = ANY(v_valid_status) 
            AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
            AND LOWER(p.customer_email) = pedido_pai.email_lower
            AND p.offer_name = pedido_pai.offer_name
            AND p.order_date::DATE = pedido_pai.order_date::DATE
        LOOP
            v_tem_dois_cartoes := TRUE;
            IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
            END IF;
            INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
        END LOOP;

        -- PÓS-VENDAS / CALL CENTER
        -- ================= FIX AQUI ===================
        -- A Regra é Clara: O limite de aceitação é 08:30 da manhã, horário SP, 
        -- do "v_dia_despacho" gerado no loop acima.
        v_data_limite_pv := ((v_dia_despacho::TEXT || ' 08:30:59')::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo');

        IF LENGTH(pedido_pai.doc_limpo) >= 11 THEN
            FOR rec IN
                SELECT id, transaction_hash, offer_name, product_name FROM ticto_pedidos p
                WHERE p.id != pedido_pai.id
                AND p.status = ANY(v_valid_status) 
                AND NOT EXISTS (SELECT 1 FROM _processed WHERE pedido_id = p.id)
                AND REGEXP_REPLACE(p.customer_cpf, '[^0-9]', '', 'g') = pedido_pai.doc_limpo
                AND p.order_date > pedido_pai.order_date
                AND p.order_date <= v_data_limite_pv    -- << UMA LÓGICA INFALÍVEL!
                AND UPPER(p.offer_name) LIKE '%CC%'
            LOOP
                DECLARE 
                    v_sigla_pv TEXT;
                    v_match TEXT;
                    v_qtde INT;
                BEGIN
                    v_sigla_pv := CASE 
                        WHEN UPPER(rec.product_name) LIKE '%DESEJO%' THEN 'DP'
                        WHEN UPPER(rec.product_name) LIKE '%LUMI%' THEN 'BL'
                        WHEN UPPER(rec.product_name) LIKE '%FORMA%' THEN 'BF'
                        ELSE 'OUTRO' END;
                    
                    v_match := substring(UPPER(rec.offer_name) from '([0-9]+)\s*FRASCO');
                    IF v_match IS NULL THEN v_match := substring(UPPER(rec.offer_name) from '([0-9]+)\s*POTE'); END IF;
                    IF v_match IS NULL THEN v_match := substring(UPPER(rec.offer_name) from '([0-9]+)\s*UNIDADE'); END IF;
                    IF v_match IS NULL THEN v_match := substring(UPPER(rec.offer_name) from '([0-9]+)'); END IF;
                    
                    IF v_match IS NOT NULL THEN 
                        v_qtde := v_match::INT; 
                    ELSE 
                        v_qtde := 1; 
                    END IF;

                    v_pos_vendas := array_append(v_pos_vendas, v_sigla_pv || ':' || v_qtde::TEXT);
                END;
                
                IF NOT (v_codigos_filhos @> ARRAY[rec.transaction_hash]) AND rec.transaction_hash != pedido_pai.transaction_hash THEN
                    v_codigos_filhos := array_append(v_codigos_filhos, rec.transaction_hash);
                END IF;
                v_quantidade := v_quantidade + 1;
                INSERT INTO _processed (pedido_id) VALUES (rec.id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;

        -- =========================================================
        -- FORMATAÇÃO FINAL 
        -- =========================================================
        IF array_length(v_order_bumps, 1) > 0 THEN 
            IF UPPER(REPLACE(v_nome_oferta, ' ', '')) NOT LIKE '%ORDERBUMP%' THEN
                v_nome_oferta := v_nome_oferta || ' + Order Bump'; 
            END IF;
        END IF;
        
        IF array_length(v_upsells, 1) > 0 THEN 
            IF UPPER(REPLACE(v_nome_oferta, ' ', '')) NOT LIKE '%UPSELL%' THEN
                v_nome_oferta := v_nome_oferta || ' + ' || array_length(v_upsells, 1) || ' UPSELL'; 
            END IF;
        END IF;
        
        DECLARE
            v_pv_dp INT := 0; v_pv_bf INT := 0; v_pv_bl INT := 0; v_pv_item TEXT;
            v_sigla_s TEXT; v_qtde_s INT;
        BEGIN
            IF v_pos_vendas IS NOT NULL THEN
                FOREACH v_pv_item IN ARRAY v_pos_vendas LOOP
                    v_sigla_s := split_part(v_pv_item, ':', 1);
                    BEGIN
                        v_qtde_s := split_part(v_pv_item, ':', 2)::INT;
                    EXCEPTION WHEN OTHERS THEN 
                        v_qtde_s := 1;
                    END;

                    IF    v_sigla_s = 'DP' THEN v_pv_dp := v_pv_dp + v_qtde_s;
                    ELSIF v_sigla_s = 'BF' THEN v_pv_bf := v_pv_bf + v_qtde_s;
                    ELSIF v_sigla_s = 'BL' THEN v_pv_bl := v_pv_bl + v_qtde_s;
                    END IF;
                END LOOP;
            END IF;
            IF v_pv_dp > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_dp || ' DP'; END IF;
            IF v_pv_bf > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bf || ' BF'; END IF;
            IF v_pv_bl > 0 THEN v_nome_oferta := v_nome_oferta || ' + ' || v_pv_bl || ' BL'; END IF;
        END;

        v_descricao := pedido_pai.sigla || ' - ' || v_nome_oferta;

        INSERT INTO pedidos_consolidados_v3 (
            id, codigo_transacao, status_aprovacao, nome_produto, nome_oferta,
            valor_total, forma_pagamento, parcelas, nome_cliente, email, cpf,
            telefone, cep, logradouro, numero, complemento, bairro, cidade, estado,
            endereco_completo, data_venda, created_at, 
            descricao_pacote, codigos_agrupados, quantidade_pedidos, produto_principal,
            dia_despacho, status_envio,
            order_bumps, upsells, pos_vendas, codigos_filhos, tem_dois_cartoes, fraude_endereco
        ) VALUES (
            pedido_pai.id,
            pedido_pai.transaction_hash,
            CASE WHEN v_tem_dois_cartoes THEN '2 Cartões' ELSE 'Aprovado' END,
            pedido_pai.product_name,
            v_nome_oferta,
            pedido_pai.paid_amount,
            pedido_pai.payment_method,
            pedido_pai.installments,
            pedido_pai.customer_name,
            pedido_pai.customer_email,
            pedido_pai.customer_cpf,
            pedido_pai.customer_phone,
            pedido_pai.address_zip_code,
            pedido_pai.address_street,
            pedido_pai.address_number,
            pedido_pai.address_complement,
            pedido_pai.address_neighborhood,
            pedido_pai.address_city,
            pedido_pai.address_state,
            CONCAT_WS(', ', pedido_pai.address_street, pedido_pai.address_number, pedido_pai.address_neighborhood, pedido_pai.address_city, pedido_pai.address_state),
            pedido_pai.order_date,
            pedido_pai.created_at,
            v_descricao,
            ARRAY[pedido_pai.transaction_hash] || v_codigos_filhos,
            v_quantidade,
            pedido_pai.sigla,
            v_dia_despacho, 
            'Pendente',
            v_order_bumps, v_upsells, v_pos_vendas, v_codigos_filhos,
            v_tem_dois_cartoes, FALSE
        )
        ON CONFLICT (codigo_transacao) DO UPDATE SET
            nome_oferta = EXCLUDED.nome_oferta,
            descricao_pacote = EXCLUDED.descricao_pacote,
            codigos_agrupados = EXCLUDED.codigos_agrupados,
            quantidade_pedidos = EXCLUDED.quantidade_pedidos,
            order_bumps = EXCLUDED.order_bumps,
            upsells = EXCLUDED.upsells,
            pos_vendas = EXCLUDED.pos_vendas,
            codigos_filhos = EXCLUDED.codigos_filhos,
            updated_at = now();
            
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Consolidação concluída com sucesso'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION consolidar_pedidos_ticto() TO anon, authenticated, service_role;


-- ==========================================
-- MIGRATION: 20260130_cleanup_final.sql
-- ==========================================

-- ================================================================
-- MIGRATION FINAL: Excluir Apenas Views Obsoletas
-- Data: 2026-01-30
-- Objetivo: Remover pedidos_consolidados (v1) e pedidos_consolidados_v2 (v2)
-- Decisão: Manter TODAS as tabelas para desenvolvimento futuro
-- ================================================================

-- CONTEXTO:
-- - pedidos_consolidados (v1) = VIEW obsoleta
-- - pedidos_consolidados_v2 (v2) = VIEW obsoleta
-- - pedidos_consolidados_v3 = TABLE ativa (manter)
-- - Código já migrado 100% para v3

-- ================================================================
-- PASSO 1: BACKUP (Materializar dados das views)
-- ================================================================

-- 1.1 Backup da VIEW v1 (se tiver dados)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'pedidos_consolidados') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS pedidos_consolidados_v1_backup AS SELECT * FROM pedidos_consolidados';
    RAISE NOTICE '✅ Backup de pedidos_consolidados (v1) criado';
  ELSE
    RAISE NOTICE '⚠️  VIEW pedidos_consolidados (v1) não existe';
  END IF;
END $$;

-- 1.2 Backup da VIEW v2 (se tiver dados)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'pedidos_consolidados_v2') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS pedidos_consolidados_v2_backup AS SELECT * FROM pedidos_consolidados_v2';
    RAISE NOTICE '✅ Backup de pedidos_consolidados_v2 criado';
  ELSE
    RAISE NOTICE '⚠️  VIEW pedidos_consolidados_v2 não existe';
  END IF;
END $$;

-- ================================================================
-- PASSO 2: EXCLUIR VIEWS OBSOLETAS
-- ================================================================

-- 2.1 Excluir VIEW v1
DROP VIEW IF EXISTS pedidos_consolidados CASCADE;

-- 2.2 Excluir VIEW v2
DROP VIEW IF EXISTS pedidos_consolidados_v2 CASCADE;

-- ================================================================
-- PASSO 3: VERIFICAÇÃO
-- ================================================================

-- 3.1 Confirmar que views foram removidas
DO $$
DECLARE
  v1_exists BOOLEAN;
  v2_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'pedidos_consolidados') INTO v1_exists;
  SELECT EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'pedidos_consolidados_v2') INTO v2_exists;
  
  IF NOT v1_exists AND NOT v2_exists THEN
    RAISE NOTICE '✅ SUCESSO! Ambas as views foram removidas';
  ELSE
    IF v1_exists THEN
      RAISE WARNING '❌ pedidos_consolidados (v1) ainda existe!';
    END IF;
    IF v2_exists THEN
      RAISE WARNING '❌ pedidos_consolidados_v2 ainda existe!';
    END IF;
  END IF;
END $$;

-- 3.2 Confirmar que v3 (TABLE) ainda existe
DO $$
DECLARE
  v3_exists BOOLEAN;
  v3_count INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'pedidos_consolidados_v3'
  ) INTO v3_exists;
  
  IF v3_exists THEN
    SELECT COUNT(*) INTO v3_count FROM pedidos_consolidados_v3;
    RAISE NOTICE '✅ pedidos_consolidados_v3 (TABLE) mantida com % registros', v3_count;
  ELSE
    RAISE EXCEPTION '❌ ERRO CRÍTICO! pedidos_consolidados_v3 não existe!';
  END IF;
END $$;

-- 3.3 Listar backups criados (se existirem)
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as tamanho
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('pedidos_consolidados_v1_backup', 'pedidos_consolidados_v2_backup')
ORDER BY tablename;

-- ================================================================
-- RESULTADO ESPERADO
-- ================================================================

-- ✅ pedidos_consolidados (VIEW v1) - REMOVIDA
-- ✅ pedidos_consolidados_v2 (VIEW v2) - REMOVIDA
-- ✅ pedidos_consolidados_v3 (TABLE) - MANTIDA
-- ✅ Backups criados (se views tinham dados)
-- ✅ Todas as outras tabelas mantidas para desenvolvimento futuro

-- ================================================================
-- TABELAS MANTIDAS PARA DESENVOLVIMENTO FUTURO:
-- ================================================================

-- Essenciais (em uso):
-- - pedidos, pedidos_consolidados_v3, pedidos_unificados, pedidos_agrupados
-- - profiles, solicitacoes, solicitacoes_historico, feriados

-- Planejadas (features futuras):
-- - assinaturas, carrinhos_abandonados

-- Infraestrutura (podem ser úteis):
-- - ticto_logs (logs de integração)
-- - pedidos_vendas (vendas)
-- - pedidos_status_log (histórico de status)
-- - notificacoes (sistema de notificações)
-- - metas (sistema de metas)

-- ================================================================
-- FIM DA MIGRATION
-- ================================================================


-- ==========================================
-- MIGRATION: 20260130_cleanup_production.sql
-- ==========================================

-- ================================================================
-- MIGRATION: Limpeza de Redundâncias - AMBIENTE DE PRODUÇÃO
-- Data: 2026-01-30
-- Objetivo: Remover tabelas e views obsoletas de produção
-- ================================================================

-- ⚠️ ATENÇÃO: EXECUTAR APENAS EM PRODUÇÃO
-- ⚠️ FAZER BACKUP COMPLETO ANTES DE EXECUTAR

-- PARTE 1: VALIDAÇÃO PRÉ-EXCLUSÃO
-- ================================================================

-- 1.1 Verificar contagem de registros
DO $$
DECLARE
  v2_count INTEGER;
  v3_count INTEGER;
BEGIN
  -- Verificar se v2 existe
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'pedidos_consolidados_v2'
  ) THEN
    SELECT COUNT(*) INTO v2_count FROM pedidos_consolidados_v2;
    RAISE NOTICE 'Registros em v2: %', v2_count;
  ELSE
    RAISE NOTICE 'pedidos_consolidados_v2 não existe';
    v2_count := 0;
  END IF;
  
  -- Verificar v3
  SELECT COUNT(*) INTO v3_count FROM pedidos_consolidados_v3;
  RAISE NOTICE 'Registros em v3: %', v3_count;
  
  IF v2_count > v3_count THEN
    RAISE WARNING '⚠️  ATENÇÃO: v2 tem mais registros que v3! NÃO PROSSIGA COM A EXCLUSÃO.';
  ELSIF v2_count > 0 THEN
    RAISE NOTICE '✅ v3 tem >= registros que v2. Seguro prosseguir.';
  END IF;
END $$;

-- 1.2 Listar objetos que serão removidos
SELECT 
  'VIEW' as type,
  viewname as name,
  schemaname,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||viewname)) as size
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('pedidos_consolidados')
UNION ALL
SELECT 
  'TABLE' as type,
  tablename as name,
  schemaname,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('pedidos_consolidados_v2')
ORDER BY type, name;

-- PARTE 2: BACKUP (Executar ANTES da exclusão)
-- ================================================================

-- 2.1 Criar backup de pedidos_consolidados_v2 como tabela temporária
-- DESCOMENTAR para criar backup
/*
CREATE TABLE pedidos_consolidados_v2_backup AS
SELECT * FROM pedidos_consolidados_v2;

COMMENT ON TABLE pedidos_consolidados_v2_backup IS 
  'Backup de pedidos_consolidados_v2 antes da exclusão - ' || NOW()::TEXT;
*/

-- PARTE 3: EXCLUSÃO (Executar APENAS após validação e backup)
-- ================================================================

-- ⚠️ DESCOMENTAR APENAS APÓS:
-- 1. Backup completo do banco
-- 2. Validação de que v3 >= v2
-- 3. Aprovação final

-- 3.1 Remover VIEW antiga
-- DROP VIEW IF EXISTS pedidos_consolidados CASCADE;

-- 3.2 Remover tabela v2
-- DROP TABLE IF EXISTS pedidos_consolidados_v2 CASCADE;

-- PARTE 4: LIMPEZA PÓS-EXCLUSÃO
-- ================================================================

-- 4.1 Vacuum para liberar espaço
-- VACUUM ANALYZE pedidos_consolidados_v3;

-- 4.2 Remover backup temporário (após validação de 7 dias)
-- DROP TABLE IF EXISTS pedidos_consolidados_v2_backup;

-- ================================================================
-- FIM DA MIGRATION - PRODUÇÃO
-- ================================================================

-- CHECKLIST DE EXECUÇÃO:
-- [ ] Backup completo do banco criado
-- [ ] PARTE 1 executada - validação OK
-- [ ] PARTE 2 executada - backup criado
-- [ ] Aplicação testada e funcionando
-- [ ] PARTE 3 executada - objetos removidos
-- [ ] Aplicação validada após remoção
-- [ ] PARTE 4 executada - limpeza concluída


-- ==========================================
-- MIGRATION: 20260130_cleanup_test.sql
-- ==========================================

-- ================================================================
-- MIGRATION: Excluir Views Obsoletas - AMBIENTE DE TESTE
-- Data: 2026-01-30
-- Objetivo: Remover apenas views v1 e v2 em teste
-- NOTA: pedidos_consolidados_v3 NÃO EXISTE em teste (só em produção)
-- ================================================================

-- ================================================================
-- PASSO 1: BACKUP (Materializar dados das views se existirem)
-- ================================================================

-- 1.1 Backup da VIEW v1 (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'pedidos_consolidados') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS pedidos_consolidados_v1_backup AS SELECT * FROM pedidos_consolidados';
    RAISE NOTICE '✅ Backup de pedidos_consolidados (v1) criado';
  ELSE
    RAISE NOTICE '⚠️  VIEW pedidos_consolidados (v1) não existe em teste';
  END IF;
END $$;

-- 1.2 Backup da VIEW v2 (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'pedidos_consolidados_v2') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS pedidos_consolidados_v2_backup AS SELECT * FROM pedidos_consolidados_v2';
    RAISE NOTICE '✅ Backup de pedidos_consolidados_v2 criado';
  ELSE
    RAISE NOTICE '⚠️  VIEW pedidos_consolidados_v2 não existe em teste';
  END IF;
END $$;

-- ================================================================
-- PASSO 2: EXCLUIR VIEWS OBSOLETAS
-- ================================================================

-- 2.1 Excluir VIEW v1
DROP VIEW IF EXISTS pedidos_consolidados CASCADE;

-- 2.2 Excluir VIEW v2
DROP VIEW IF EXISTS pedidos_consolidados_v2 CASCADE;

-- ================================================================
-- PASSO 3: VERIFICAÇÃO
-- ================================================================

-- 3.1 Confirmar que views foram removidas
DO $$
DECLARE
  v1_exists BOOLEAN;
  v2_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'pedidos_consolidados') INTO v1_exists;
  SELECT EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'pedidos_consolidados_v2') INTO v2_exists;
  
  IF NOT v1_exists AND NOT v2_exists THEN
    RAISE NOTICE '✅ SUCESSO! Ambas as views foram removidas (ou não existiam)';
  ELSE
    IF v1_exists THEN
      RAISE WARNING '❌ pedidos_consolidados (v1) ainda existe!';
    END IF;
    IF v2_exists THEN
      RAISE WARNING '❌ pedidos_consolidados_v2 ainda existe!';
    END IF;
  END IF;
END $$;

-- 3.2 Listar backups criados (se existirem)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename IN ('pedidos_consolidados_v1_backup', 'pedidos_consolidados_v2_backup')
  ) THEN
    RAISE NOTICE '✅ Backups disponíveis:';
    PERFORM tablename FROM pg_tables 
    WHERE tablename IN ('pedidos_consolidados_v1_backup', 'pedidos_consolidados_v2_backup');
  ELSE
    RAISE NOTICE 'ℹ️  Nenhum backup criado (views não existiam)';
  END IF;
END $$;

-- ================================================================
-- RESULTADO ESPERADO
-- ================================================================

-- ✅ pedidos_consolidados (VIEW v1) - REMOVIDA (se existia)
-- ✅ pedidos_consolidados_v2 (VIEW v2) - REMOVIDA (se existia)
-- ℹ️  pedidos_consolidados_v3 - NÃO EXISTE em teste (normal)
-- ✅ Ambiente de teste limpo e pronto

-- ================================================================
-- FIM DA MIGRATION - TESTE
-- ================================================================


-- ==========================================
-- MIGRATION: 20260130_enable_rls.sql
-- ==========================================

-- ================================================================
-- RLS (Row Level Security) - Políticas de Segurança
-- Data: 2026-01-30
-- Objetivo: Proteger todas as tabelas com RLS
-- ================================================================

-- ================================================================
-- PARTE 1: HABILITAR RLS EM TODAS AS TABELAS
-- ================================================================

-- Tabelas principais
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_consolidados_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_unificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_agrupados ENABLE ROW LEVEL SECURITY;

-- Tabelas de usuários
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Tabelas de features
ALTER TABLE solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrinhos_abandonados ENABLE ROW LEVEL SECURITY;

-- Tabelas de sistema (less restrictive)
ALTER TABLE feriados ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- PARTE 2: POLÍTICAS PARA TABELAS PRINCIPAIS
-- ================================================================

-- 2.1 Profiles: Usuário vê apenas seu próprio perfil
DROP POLICY IF EXISTS profile_select_own ON profiles;
CREATE POLICY profile_select_own ON profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS profile_update_own ON profiles;
CREATE POLICY profile_update_own ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- 2.2 Pedidos: Todos os usuários autenticados podem ler
DROP POLICY IF EXISTS pedidos_select_authenticated ON pedidos;
CREATE POLICY pedidos_select_authenticated ON pedidos
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS pedidos_insert_authenticated ON pedidos;
CREATE POLICY pedidos_insert_authenticated ON pedidos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS pedidos_update_authenticated ON pedidos;
CREATE POLICY pedidos_update_authenticated ON pedidos
  FOR UPDATE
  TO authenticated
  USING (true);

-- 2.3 Pedidos Consolidados V3: Acesso para usuários autenticados
DROP POLICY IF EXISTS pedidos_consolidados_v3_select ON pedidos_consolidados_v3;
CREATE POLICY pedidos_consolidados_v3_select ON pedidos_consolidados_v3
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS pedidos_consolidados_v3_update ON pedidos_consolidados_v3;
CREATE POLICY pedidos_consolidados_v3_update ON pedidos_consolidados_v3
  FOR UPDATE
  TO authenticated
  USING (true);

-- 2.4 Pedidos Unificados: Acesso para usuários autenticados
DROP POLICY IF EXISTS pedidos_unificados_select ON pedidos_unificados;
CREATE POLICY pedidos_unificados_select ON pedidos_unificados
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS pedidos_unificados_update ON pedidos_unificados;
CREATE POLICY pedidos_unificados_update ON pedidos_unificados
  FOR UPDATE
  TO authenticated
  USING (true);

-- 2.5 Pedidos Agrupados: Acesso para usuários autenticados
DROP POLICY IF EXISTS pedidos_agrupados_select ON pedidos_agrupados;
CREATE POLICY pedidos_agrupados_select ON pedidos_agrupados
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS pedidos_agrupados_update ON pedidos_agrupados;
CREATE POLICY pedidos_agrupados_update ON pedidos_agrupados
  FOR UPDATE
  TO authenticated
  USING (true);

-- ================================================================
-- PARTE 3: POLÍTICAS PARA FEATURES
-- ================================================================

-- 3.1 Solicitações: Acesso para autenticados
DROP POLICY IF EXISTS solicitacoes_select ON solicitacoes;
CREATE POLICY solicitacoes_select ON solicitacoes
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS solicitacoes_insert ON solicitacoes;
CREATE POLICY solicitacoes_insert ON solicitacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS solicitacoes_update ON solicitacoes;
CREATE POLICY solicitacoes_update ON solicitacoes
  FOR UPDATE
  TO authenticated
  USING (true);

-- 3.2 Histórico de Solicitações
DROP POLICY IF EXISTS solicitacoes_historico_select ON solicitacoes_historico;
CREATE POLICY solicitacoes_historico_select ON solicitacoes_historico
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS solicitacoes_historico_insert ON solicitacoes_historico;
CREATE POLICY solicitacoes_historico_insert ON solicitacoes_historico
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3.3 Assinaturas
DROP POLICY IF EXISTS assinaturas_select ON assinaturas;
CREATE POLICY assinaturas_select ON assinaturas
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS assinaturas_all ON assinaturas;
CREATE POLICY assinaturas_all ON assinaturas
  FOR ALL
  TO authenticated
  USING (true);

-- 3.4 Carrinhos Abandonados
DROP POLICY IF EXISTS carrinhos_abandonados_select ON carrinhos_abandonados;
CREATE POLICY carrinhos_abandonados_select ON carrinhos_abandonados
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS carrinhos_abandonados_all ON carrinhos_abandonados;
CREATE POLICY carrinhos_abandonados_all ON carrinhos_abandonados
  FOR ALL
  TO authenticated
  USING (true);

-- ================================================================
-- PARTE 4: POLÍTICAS PARA TABELAS DE SISTEMA
-- ================================================================

-- 4.1 Feriados: Leitura pública, escrita para autenticados
DROP POLICY IF EXISTS feriados_select_public ON feriados;
CREATE POLICY feriados_select_public ON feriados
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS feriados_insert_authenticated ON feriados;
CREATE POLICY feriados_insert_authenticated ON feriados
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ================================================================
-- PARTE 5: PERMITIR SERVICE ROLE (WEBHOOKS)
-- ================================================================

-- Service role bypassa RLS automaticamente
-- Isso permite que webhooks (usando service_role key) funcionem

-- ================================================================
-- VERIFICAÇÃO
-- ================================================================

DO $$
DECLARE
  table_rec RECORD;
  rls_enabled BOOLEAN;
BEGIN
  FOR table_rec IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    AND tablename IN (
      'pedidos', 'pedidos_consolidados_v3', 'pedidos_unificados',
      'pedidos_agrupados', 'profiles', 'solicitacoes', 
      'solicitacoes_historico', 'assinaturas', 'carrinhos_abandonados',
      'feriados'
    )
  LOOP
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = table_rec.tablename;
    
    IF rls_enabled THEN
      RAISE NOTICE '✅ RLS ativo em: %', table_rec.tablename;
    ELSE
      RAISE WARNING '❌ RLS NÃO ativo em: %', table_rec.tablename;
    END IF;
  END LOOP;
END $$;

-- ================================================================
-- FIM
-- ================================================================


-- ==========================================
-- MIGRATION: 20260130_sync_and_cleanup.sql
-- ==========================================

-- ================================================================
-- MIGRATION: Sincronização de Schema e Limpeza de Redundâncias
-- Data: 2026-01-30
-- Objetivo: Alinhar ambientes de produção e teste, remover tabelas obsoletas
-- ================================================================

-- PARTE 1: SINCRONIZAÇÃO DE SCHEMA (Executar em TESTE primeiro)
-- ================================================================

-- 1.1 Verificar se tabelas faltantes existem
-- Estas tabelas existem em produção mas podem não existir em teste

-- Criar solicitacoes_historico se não existir
CREATE TABLE IF NOT EXISTS solicitacoes_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID REFERENCES solicitacoes(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  usuario_id UUID,
  data_acao TIMESTAMPTZ DEFAULT NOW(),
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar assinaturas se não existir
CREATE TABLE IF NOT EXISTS assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID,
  cliente_nome TEXT,
  cliente_email TEXT,
  plano TEXT,
  status TEXT DEFAULT 'Ativa',
  valor DECIMAL(10,2),
  data_inicio DATE,
  data_fim DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar carrinhos_abandonados se não existir
CREATE TABLE IF NOT EXISTS carrinhos_abandonados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  produtos JSONB,
  valor_total DECIMAL(10,2),
  email TEXT,
  telefone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_solicitacoes_historico_solicitacao_id 
  ON solicitacoes_historico(solicitacao_id);

CREATE INDEX IF NOT EXISTS idx_assinaturas_status 
  ON assinaturas(status);

CREATE INDEX IF NOT EXISTS idx_assinaturas_created_at 
  ON assinaturas(created_at);

CREATE INDEX IF NOT EXISTS idx_carrinhos_abandonados_created_at 
  ON carrinhos_abandonados(created_at);

-- PARTE 2: PREPARAÇÃO PARA LIMPEZA (Executar em PRODUÇÃO e TESTE)
-- ================================================================

-- 2.1 Marcar objetos redundantes como deprecated
-- NOTA: pedidos_consolidados é uma VIEW, não uma TABLE
COMMENT ON VIEW pedidos_consolidados IS 
  'DEPRECATED: View obsoleta. Usar pedidos_consolidados_v3 diretamente. Será removida em breve.';

COMMENT ON TABLE pedidos_consolidados_v2 IS 
  'DEPRECATED: Versão intermediária obsoleta. Usar pedidos_consolidados_v3. Será removida em breve.';

-- 2.2 Criar view de compatibilidade (opcional, para rollback se necessário)
CREATE OR REPLACE VIEW pedidos_consolidados_legacy AS
SELECT * FROM pedidos_consolidados_v3;

COMMENT ON VIEW pedidos_consolidados_legacy IS 
  'View de compatibilidade temporária. Aponta para pedidos_consolidados_v3.';

-- PARTE 3: VALIDAÇÃO (Executar ANTES de excluir)
-- ================================================================

-- 3.1 Verificar se há dados em v2 que não estão em v3
DO $$
DECLARE
  v2_count INTEGER;
  v3_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v2_count FROM pedidos_consolidados_v2;
  SELECT COUNT(*) INTO v3_count FROM pedidos_consolidados_v3;
  
  RAISE NOTICE 'Registros em v2: %', v2_count;
  RAISE NOTICE 'Registros em v3: %', v3_count;
  
  IF v2_count > v3_count THEN
    RAISE WARNING 'ATENÇÃO: v2 tem mais registros que v3! Verifique antes de excluir.';
  END IF;
END $$;

-- 3.2 Listar objetos que serão afetados (tabelas e views)
SELECT 
  'TABLE' as type,
  tablename as name,
  schemaname,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('pedidos_consolidados_v2')
UNION ALL
SELECT 
  'VIEW' as type,
  viewname as name,
  schemaname,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||viewname)) as size
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('pedidos_consolidados')
ORDER BY type, name;

-- PARTE 4: EXCLUSÃO DE TABELAS REDUNDANTES (Executar APENAS após validação)
-- ================================================================

-- ⚠️ ATENÇÃO: Executar APENAS após:
-- 1. Backup completo do banco
-- 2. Validação de que v3 contém todos os dados
-- 3. Testes em ambiente de staging
-- 4. Aprovação final

-- 4.1 Excluir pedidos_consolidados (v1) - É uma VIEW, não TABLE
-- DROP VIEW IF EXISTS pedidos_consolidados CASCADE;

-- 4.2 Excluir pedidos_consolidados_v2 - É uma TABLE
-- DROP TABLE IF EXISTS pedidos_consolidados_v2 CASCADE;

-- PARTE 5: LIMPEZA PÓS-EXCLUSÃO (Executar APÓS exclusão bem-sucedida)
-- ================================================================

-- 5.1 Remover view de compatibilidade (se não for mais necessária)
-- DROP VIEW IF EXISTS pedidos_consolidados_legacy;

-- 5.2 Vacuum para liberar espaço
-- VACUUM ANALYZE pedidos_consolidados_v3;

-- ================================================================
-- FIM DA MIGRATION
-- ================================================================

-- INSTRUÇÕES DE EXECUÇÃO:
-- 
-- 1. TESTE (vkeshyusimduiwjaijjv.supabase.co):
--    - Executar PARTE 1 (Sincronização)
--    - Executar PARTE 2 (Preparação)
--    - Executar PARTE 3 (Validação)
--    - Executar PARTE 4 (Exclusão) - DESCOMENTAR os DROPs
--    - Testar aplicação
--
-- 2. PRODUÇÃO (cgyxinpejaoadsqrxbhy.supabase.co):
--    - Fazer BACKUP COMPLETO
--    - Executar PARTE 2 (Preparação)
--    - Executar PARTE 3 (Validação)
--    - Aguardar janela de manutenção
--    - Executar PARTE 4 (Exclusão) - DESCOMENTAR os DROPs
--    - Validar aplicação
--    - Executar PARTE 5 (Limpeza)


-- ==========================================
-- MIGRATION: 20260130_sync_missing_tables.sql
-- ==========================================

-- ================================================================
-- MIGRATION: Sincronização Completa Produção → Teste
-- Data: 2026-01-30
-- Objetivo: Criar todas as tabelas que existem em produção mas não em teste
-- ================================================================

-- PARTE 1: CRIAR TABELAS FALTANTES
-- ================================================================

-- 1.1 Tabela: feriados (64 kB)
CREATE TABLE IF NOT EXISTS feriados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL UNIQUE,
  nome TEXT,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('nacional', 'estadual', 'municipal')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feriados_data ON feriados(data);

COMMENT ON TABLE feriados IS 'Feriados nacionais, estaduais (SP) e municipais (Indaiatuba)';

-- 1.2 Tabela: metas (16 kB)
CREATE TABLE IF NOT EXISTS metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo TEXT NOT NULL, -- Ex: '2026-01', 'Q1-2026'
  tipo TEXT NOT NULL, -- 'mensal', 'trimestral', 'anual'
  valor_meta DECIMAL(10,2) NOT NULL,
  valor_realizado DECIMAL(10,2) DEFAULT 0,
  percentual_atingido DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN valor_meta > 0 THEN (valor_realizado / valor_meta * 100) ELSE 0 END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metas_periodo ON metas(periodo);

COMMENT ON TABLE metas IS 'Metas de faturamento e acompanhamento de performance';

-- 1.3 Tabela: notificacoes (32 kB)
CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID,
  tipo TEXT NOT NULL, -- 'info', 'warning', 'error', 'success'
  titulo TEXT NOT NULL,
  mensagem TEXT,
  lida BOOLEAN DEFAULT FALSE,
  data_leitura TIMESTAMPTZ,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON notificacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_created ON notificacoes(created_at);

COMMENT ON TABLE notificacoes IS 'Sistema de notificações para usuários';

-- 1.4 Tabela: pedidos_status_log (120 kB)
CREATE TABLE IF NOT EXISTS pedidos_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  usuario_id UUID,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_status_log_pedido ON pedidos_status_log(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status_log_created ON pedidos_status_log(created_at);

COMMENT ON TABLE pedidos_status_log IS 'Histórico de mudanças de status de pedidos';

-- 1.5 Tabela: pedidos_vendas (640 kB)
CREATE TABLE IF NOT EXISTS pedidos_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_transacao TEXT UNIQUE,
  status TEXT,
  nome_produto TEXT,
  valor_total DECIMAL(10,2),
  forma_pagamento TEXT,
  nome_cliente TEXT,
  email_cliente TEXT,
  cpf_cliente TEXT,
  telefone_cliente TEXT,
  data_venda TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_vendas_codigo ON pedidos_vendas(codigo_transacao);
CREATE INDEX IF NOT EXISTS idx_pedidos_vendas_status ON pedidos_vendas(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_vendas_cpf ON pedidos_vendas(cpf_cliente);
CREATE INDEX IF NOT EXISTS idx_pedidos_vendas_data ON pedidos_vendas(data_venda);

COMMENT ON TABLE pedidos_vendas IS 'Registro de vendas e transações';

-- 1.6 Tabela: ticto_logs (3784 kB - maior tabela)
CREATE TABLE IF NOT EXISTS ticto_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento TEXT NOT NULL,
  tipo TEXT, -- 'webhook', 'api', 'sync', 'error'
  payload JSONB,
  resposta JSONB,
  status_code INTEGER,
  sucesso BOOLEAN DEFAULT TRUE,
  erro TEXT,
  duracao_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticto_logs_evento ON ticto_logs(evento);
CREATE INDEX IF NOT EXISTS idx_ticto_logs_tipo ON ticto_logs(tipo);
CREATE INDEX IF NOT EXISTS idx_ticto_logs_sucesso ON ticto_logs(sucesso);
CREATE INDEX IF NOT EXISTS idx_ticto_logs_created ON ticto_logs(created_at);

COMMENT ON TABLE ticto_logs IS 'Logs de integração com Ticto e outros sistemas externos';

-- PARTE 2: HABILITAR RLS (Row Level Security)
-- ================================================================

-- 2.1 Habilitar RLS nas tabelas sensíveis
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_vendas ENABLE ROW LEVEL SECURITY;

-- 2.2 Criar políticas básicas (ajustar conforme necessidade)
-- Exemplo: notificacoes - usuário vê apenas suas notificações
CREATE POLICY notificacoes_select_own ON notificacoes
  FOR SELECT
  USING (usuario_id = auth.uid());

-- PARTE 3: VERIFICAÇÃO
-- ================================================================

-- 3.1 Listar todas as tabelas criadas
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'feriados',
    'metas',
    'notificacoes',
    'pedidos_status_log',
    'pedidos_vendas',
    'ticto_logs'
  )
ORDER BY tablename;

-- ================================================================
-- FIM DA MIGRATION
-- ================================================================

-- RESULTADO ESPERADO:
-- ✅ 6 tabelas criadas em teste
-- ✅ Índices adicionados para performance
-- ✅ RLS habilitado onde necessário
-- ✅ Teste agora tem mesma estrutura que produção


-- ==========================================
-- MIGRATION: 20260130_sync_test.sql
-- ==========================================

-- ================================================================
-- MIGRATION: Sincronização de Schema - AMBIENTE DE TESTE
-- Data: 2026-01-30
-- Objetivo: Preparar ambiente de teste para sincronização com produção
-- ================================================================

-- PARTE 1: CRIAR ESTRUTURA FALTANTE
-- ================================================================

-- 1.1 Criar tabelas que existem em produção mas não em teste
CREATE TABLE IF NOT EXISTS solicitacoes_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID REFERENCES solicitacoes(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  usuario_id UUID,
  data_acao TIMESTAMPTZ DEFAULT NOW(),
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID,
  cliente_nome TEXT,
  cliente_email TEXT,
  plano TEXT,
  status TEXT DEFAULT 'Ativa',
  valor DECIMAL(10,2),
  data_inicio DATE,
  data_fim DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carrinhos_abandonados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  produtos JSONB,
  valor_total DECIMAL(10,2),
  email TEXT,
  telefone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 Adicionar índices
CREATE INDEX IF NOT EXISTS idx_solicitacoes_historico_solicitacao_id 
  ON solicitacoes_historico(solicitacao_id);

CREATE INDEX IF NOT EXISTS idx_assinaturas_status 
  ON assinaturas(status);

CREATE INDEX IF NOT EXISTS idx_assinaturas_created_at 
  ON assinaturas(created_at);

CREATE INDEX IF NOT EXISTS idx_carrinhos_abandonados_created_at 
  ON carrinhos_abandonados(created_at);

-- PARTE 2: VERIFICAÇÃO
-- ================================================================

-- 2.1 Verificar se pedidos_consolidados é uma VIEW
DO $$
DECLARE
  is_view BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname = 'pedidos_consolidados'
  ) INTO is_view;
  
  IF is_view THEN
    RAISE NOTICE '✅ pedidos_consolidados é uma VIEW';
  ELSE
    RAISE NOTICE '⚠️  pedidos_consolidados não encontrada';
  END IF;
END $$;

-- 2.2 Verificar se pedidos_consolidados_v3 existe
DO $$
DECLARE
  table_exists BOOLEAN;
  record_count INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'pedidos_consolidados_v3'
  ) INTO table_exists;
  
  IF table_exists THEN
    SELECT COUNT(*) INTO record_count FROM pedidos_consolidados_v3;
    RAISE NOTICE '✅ pedidos_consolidados_v3 existe com % registros', record_count;
  ELSE
    RAISE NOTICE '❌ pedidos_consolidados_v3 NÃO EXISTE!';
  END IF;
END $$;

-- PARTE 3: LIMPEZA (Opcional - apenas se VIEW antiga existir)
-- ================================================================

-- 3.1 Remover VIEW antiga se existir
-- DESCOMENTAR apenas se quiser remover a VIEW antiga
-- DROP VIEW IF EXISTS pedidos_consolidados CASCADE;

-- ================================================================
-- FIM DA MIGRATION - TESTE
-- ================================================================

-- RESULTADO ESPERADO:
-- ✅ Tabelas faltantes criadas
-- ✅ Índices adicionados
-- ✅ Verificações executadas
-- ⚠️  pedidos_consolidados_v2 NÃO será criada (não é necessária)


-- ==========================================
-- MIGRATION: analise_dependencias.sql
-- ==========================================

-- ================================================================
-- SCRIPT: Análise Completa de Dependências e Objetos
-- Objetivo: Identificar por que pedidos_consolidados_v2 não pode ser deletada
-- ================================================================

-- PARTE 1: LISTAR TODAS AS TABELAS E VIEWS
-- ================================================================

-- 1.1 Listar todas as tabelas
SELECT 
  'TABLE' as type,
  tablename as name,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size,
  (SELECT COUNT(*) FROM information_schema.table_constraints 
   WHERE table_name = tablename AND constraint_type = 'FOREIGN KEY') as fk_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 1.2 Listar todas as views
SELECT 
  'VIEW' as type,
  viewname as name,
  pg_size_pretty(pg_total_relation_size('public.'||viewname)) as size
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- PARTE 2: ANALISAR DEPENDÊNCIAS DE pedidos_consolidados_v2
-- ================================================================

-- 2.1 Verificar foreign keys que REFERENCIAM pedidos_consolidados_v2
SELECT
  tc.table_name as tabela_dependente,
  kcu.column_name as coluna,
  ccu.table_name as tabela_referenciada,
  ccu.column_name as coluna_referenciada
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'pedidos_consolidados_v2';

-- 2.2 Verificar views que DEPENDEM de pedidos_consolidados_v2
SELECT 
  v.viewname,
  v.definition
FROM pg_views v
WHERE v.schemaname = 'public'
  AND v.definition ILIKE '%pedidos_consolidados_v2%';

-- 2.3 Verificar políticas RLS em pedidos_consolidados_v2
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'pedidos_consolidados_v2';

-- 2.4 Verificar triggers em pedidos_consolidados_v2
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'pedidos_consolidados_v2';

-- PARTE 3: VERIFICAR OBJETOS FALTANTES EM TESTE
-- ================================================================

-- 3.1 Listar objetos que existem em produção mas podem não existir em teste
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'metas',
    'notificacoes',
    'pedidos_status_log',
    'pedidos_vendas',
    'ticto_logs',
    'feriados'
  )
ORDER BY tablename;

-- PARTE 4: SOLUÇÃO - REMOVER DEPENDÊNCIAS ANTES DE EXCLUIR
-- ================================================================

-- 4.1 Desabilitar RLS temporariamente (se necessário)
-- ALTER TABLE pedidos_consolidados_v2 DISABLE ROW LEVEL SECURITY;

-- 4.2 Remover políticas RLS
-- DROP POLICY IF EXISTS [nome_da_politica] ON pedidos_consolidados_v2;

-- 4.3 Remover foreign keys que apontam para v2
-- ALTER TABLE [tabela_dependente] DROP CONSTRAINT [nome_constraint];

-- 4.4 Agora sim, excluir a tabela
-- DROP TABLE IF EXISTS pedidos_consolidados_v2 CASCADE;

-- ================================================================
-- INSTRUÇÕES DE USO:
-- ================================================================
-- 1. Execute PARTE 1 para listar todos os objetos
-- 2. Execute PARTE 2 para identificar dependências
-- 3. Execute PARTE 3 para ver objetos faltantes
-- 4. Use os resultados para criar migration de sincronização
-- 5. Execute PARTE 4 (descomentando) para remover v2


-- ==========================================
-- MIGRATION: debug_profiles_rls.sql
-- ==========================================

-- Verificar políticas RLS da tabela profiles
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- Verificar se RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles';

-- Testar query diretamente
SELECT * FROM profiles WHERE id = '0164bf84-15e4-40fa-96d1-d16a36192296';


-- ==========================================
-- MIGRATION: excluir_views_antigas.sql
-- ==========================================

-- ================================================================
-- SCRIPT: Excluir pedidos_consolidados_v2 (VIEW)
-- DESCOBERTA: pedidos_consolidados_v2 é uma VIEW, não uma TABLE!
-- ================================================================

-- PASSO 1: VERIFICAR TIPO DO OBJETO
-- ================================================================

-- 1.1 Confirmar que é uma VIEW
SELECT 
  'VIEW' as tipo,
  viewname as nome,
  pg_size_pretty(pg_total_relation_size('public.'||viewname)) as tamanho
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'pedidos_consolidados_v2';

-- PASSO 2: BACKUP (Criar tabela a partir da VIEW)
-- ================================================================

-- 2.1 Criar backup materializando os dados da VIEW
CREATE TABLE IF NOT EXISTS pedidos_consolidados_v2_backup AS
SELECT * FROM pedidos_consolidados_v2;

-- 2.2 Verificar backup
SELECT 
  COUNT(*) as total_registros,
  pg_size_pretty(pg_total_relation_size('pedidos_consolidados_v2_backup')) as tamanho
FROM pedidos_consolidados_v2_backup;

-- PASSO 3: IDENTIFICAR VIEWS DEPENDENTES
-- ================================================================

-- 3.1 Verificar se outras views dependem de pedidos_consolidados_v2
SELECT 
  v.viewname as view_dependente,
  v.definition
FROM pg_views v
WHERE v.schemaname = 'public'
  AND v.definition ILIKE '%pedidos_consolidados_v2%'
  AND v.viewname != 'pedidos_consolidados_v2';

-- PASSO 4: EXCLUIR A VIEW
-- ================================================================

-- 4.1 Excluir a VIEW com CASCADE (remove views dependentes também)
DROP VIEW IF EXISTS pedidos_consolidados_v2 CASCADE;

-- PASSO 5: VERIFICAÇÃO
-- ================================================================

-- 5.1 Confirmar que foi removida
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname = 'pedidos_consolidados_v2'
  ) THEN
    RAISE EXCEPTION '❌ VIEW pedidos_consolidados_v2 AINDA EXISTE!';
  ELSE
    RAISE NOTICE '✅ VIEW pedidos_consolidados_v2 foi REMOVIDA com sucesso!';
  END IF;
END $$;

-- 5.2 Verificar backup
SELECT 
  'Backup criado com sucesso!' as status,
  COUNT(*) as registros,
  pg_size_pretty(pg_total_relation_size('pedidos_consolidados_v2_backup')) as tamanho
FROM pedidos_consolidados_v2_backup;

-- ================================================================
-- RESUMO DA DESCOBERTA
-- ================================================================

-- pedidos_consolidados (v1) = VIEW
-- pedidos_consolidados_v2 = VIEW (não TABLE!)
-- pedidos_consolidados_v3 = TABLE (versão atual)

-- CONCLUSÃO:
-- Ambas v1 e v2 são VIEWS, não tabelas físicas.
-- Apenas v3 é uma tabela real com dados.

-- ================================================================
-- FIM DO SCRIPT
-- ================================================================


-- ==========================================
-- MIGRATION: forcar_exclusao_v2.sql
-- ==========================================

-- ================================================================
-- SCRIPT: Forçar Exclusão de pedidos_consolidados_v2
-- Objetivo: Remover TODAS as dependências e excluir a tabela
-- ================================================================

-- PASSO 1: BACKUP (CRÍTICO - NÃO PULE)
-- ================================================================

CREATE TABLE IF NOT EXISTS pedidos_consolidados_v2_backup AS
SELECT * FROM pedidos_consolidados_v2;

-- Verificar backup
SELECT COUNT(*) as registros_backup FROM pedidos_consolidados_v2_backup;

-- PASSO 2: REMOVER TODAS AS DEPENDÊNCIAS
-- ================================================================

-- 2.1 Desabilitar RLS
ALTER TABLE pedidos_consolidados_v2 DISABLE ROW LEVEL SECURITY;

-- 2.2 Remover TODAS as políticas RLS (se existirem)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'pedidos_consolidados_v2'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON pedidos_consolidados_v2', pol.policyname);
    RAISE NOTICE 'Removida política: %', pol.policyname;
  END LOOP;
END $$;

-- 2.3 Remover TODAS as foreign keys que apontam para v2
DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN 
    SELECT
      tc.table_name,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'pedidos_consolidados_v2'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I CASCADE', 
                   fk.table_name, fk.constraint_name);
    RAISE NOTICE 'Removida FK: % da tabela %', fk.constraint_name, fk.table_name;
  END LOOP;
END $$;

-- 2.4 Remover TODOS os triggers
DO $$
DECLARE
  trg RECORD;
BEGIN
  FOR trg IN 
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table = 'pedidos_consolidados_v2'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON pedidos_consolidados_v2 CASCADE', trg.trigger_name);
    RAISE NOTICE 'Removido trigger: %', trg.trigger_name;
  END LOOP;
END $$;

-- PASSO 3: EXCLUIR A TABELA
-- ================================================================

-- 3.1 Tentar exclusão com CASCADE (força remoção de dependências)
DROP TABLE IF EXISTS pedidos_consolidados_v2 CASCADE;

-- PASSO 4: VERIFICAÇÃO
-- ================================================================

-- 4.1 Verificar se foi removida
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'pedidos_consolidados_v2'
  ) THEN
    RAISE EXCEPTION '❌ pedidos_consolidados_v2 AINDA EXISTE!';
  ELSE
    RAISE NOTICE '✅ pedidos_consolidados_v2 foi REMOVIDA com sucesso!';
  END IF;
END $$;

-- 4.2 Verificar backup
SELECT 
  'pedidos_consolidados_v2_backup' as tabela,
  COUNT(*) as registros,
  pg_size_pretty(pg_total_relation_size('pedidos_consolidados_v2_backup')) as tamanho
FROM pedidos_consolidados_v2_backup;

-- ================================================================
-- FIM DO SCRIPT
-- ================================================================

-- RESULTADO ESPERADO:
-- ✅ Backup criado com 271 registros
-- ✅ Todas as dependências removidas
-- ✅ Tabela pedidos_consolidados_v2 excluída
-- ✅ Mensagem de sucesso exibida


-- ==========================================
-- MIGRATION: remover_views_simples.sql
-- ==========================================

-- ================================================================
-- SCRIPT SIMPLES: Remover Views em TESTE
-- ================================================================

-- Remover views (se existirem)
DROP VIEW IF EXISTS pedidos_consolidados CASCADE;
DROP VIEW IF EXISTS pedidos_consolidados_v2 CASCADE;

-- Confirmar
SELECT 'Views removidas com sucesso!' as status;


-- ==========================================
-- MIGRATION: resolver_bloqueio_v2.sql
-- ==========================================

-- ================================================================
-- SCRIPT: Resolver Bloqueio de pedidos_consolidados_v2
-- Objetivo: Identificar e remover dependências para permitir exclusão
-- ================================================================

-- PASSO 1: IDENTIFICAR DEPENDÊNCIAS
-- ================================================================

-- 1.1 Verificar se há foreign keys apontando para v2
SELECT
  tc.table_name as tabela_dependente,
  tc.constraint_name,
  kcu.column_name as coluna,
  ccu.table_name as tabela_referenciada,
  ccu.column_name as coluna_referenciada
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'pedidos_consolidados_v2';

-- 1.2 Verificar views que dependem de v2
SELECT 
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND definition ILIKE '%pedidos_consolidados_v2%';

-- 1.3 Verificar políticas RLS em v2
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'pedidos_consolidados_v2';

-- PASSO 2: REMOVER DEPENDÊNCIAS
-- ================================================================

-- 2.1 Se houver foreign keys, remover (DESCOMENTAR após identificar)
-- ALTER TABLE [tabela_dependente] DROP CONSTRAINT [nome_constraint];

-- 2.2 Se houver views dependentes, recriar apontando para v3
-- DROP VIEW IF EXISTS [nome_view] CASCADE;
-- CREATE VIEW [nome_view] AS SELECT * FROM pedidos_consolidados_v3;

-- 2.3 Remover políticas RLS de v2
-- DROP POLICY IF EXISTS [nome_politica] ON pedidos_consolidados_v2;

-- 2.4 Desabilitar RLS temporariamente
-- ALTER TABLE pedidos_consolidados_v2 DISABLE ROW LEVEL SECURITY;

-- PASSO 3: TENTAR EXCLUSÃO
-- ================================================================

-- 3.1 Criar backup antes de excluir
CREATE TABLE IF NOT EXISTS pedidos_consolidados_v2_backup AS
SELECT * FROM pedidos_consolidados_v2;

-- Adicionar comentário ao backup
DO $$
BEGIN
  EXECUTE format(
    'COMMENT ON TABLE pedidos_consolidados_v2_backup IS %L',
    'Backup de pedidos_consolidados_v2 antes da exclusão - ' || NOW()::TEXT
  );
END $$;

-- 3.2 Excluir a tabela (DESCOMENTAR após remover dependências)
-- DROP TABLE IF EXISTS pedidos_consolidados_v2 CASCADE;

-- PASSO 4: VERIFICAÇÃO
-- ================================================================

-- 4.1 Verificar se v2 foi removida
SELECT 
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'pedidos_consolidados_v2';

-- Se retornar vazio, exclusão foi bem-sucedida!

-- ================================================================
-- INSTRUÇÕES DE USO:
-- ================================================================
-- 1. Execute PASSO 1 para identificar dependências
-- 2. Use os resultados para descomentar comandos do PASSO 2
-- 3. Execute PASSO 2 para remover dependências
-- 4. Execute PASSO 3 para criar backup e excluir
-- 5. Execute PASSO 4 para confirmar exclusão


