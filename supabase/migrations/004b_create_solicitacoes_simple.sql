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
