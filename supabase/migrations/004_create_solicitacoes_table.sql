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
