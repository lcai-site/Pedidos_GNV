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
