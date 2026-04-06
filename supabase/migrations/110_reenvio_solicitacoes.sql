-- ================================================================
-- MIGRATION 110: REENVIO VINCULADO À SOLICITAÇÃO
-- ================================================================
-- Adiciona suporte a reenvios de pedidos:
--   - solicitacoes: campos de reenvio (flag, pedido linkado, responsável)
--   - pedidos_consolidados_v3: campos is_reenvio, pedido_origem_id, solicitacao_reenvio_id
--   - Função duplicar_pedido_como_reenvio()
-- ================================================================

-- ─── 1. Colunas na tabela solicitacoes ───────────────────────────────────────
ALTER TABLE solicitacoes
  ADD COLUMN IF NOT EXISTS necessita_reenvio         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pedido_reenvio_id         UUID,    -- ID do pedido original linkado
  ADD COLUMN IF NOT EXISTS responsavel_reenvio_id    UUID,    -- profile.id do responsável
  ADD COLUMN IF NOT EXISTS observacoes_reenvio       TEXT;

-- ─── 2. Colunas na tabela pedidos_consolidados_v3 ────────────────────────────
ALTER TABLE pedidos_consolidados_v3
  ADD COLUMN IF NOT EXISTS is_reenvio               BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pedido_origem_id          UUID,    -- FK para o pedido original
  ADD COLUMN IF NOT EXISTS solicitacao_reenvio_id    UUID;    -- FK para a solicitação que originou

-- ─── 3. Função que duplica o pedido original como reenvio ───────────────────
CREATE OR REPLACE FUNCTION duplicar_pedido_como_reenvio(
  p_pedido_id         UUID,
  p_solicitacao_id    UUID,
  p_observacao_extra  TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_novo_id UUID;
  v_pedido  pedidos_consolidados_v3%ROWTYPE;
BEGIN
  -- Busca o pedido original
  SELECT * INTO v_pedido FROM pedidos_consolidados_v3 WHERE id = p_pedido_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido original % não encontrado', p_pedido_id;
  END IF;

  -- Gera novo UUID para o reenvio
  v_novo_id := gen_random_uuid();

  -- Insere a cópia como reenvio
  INSERT INTO pedidos_consolidados_v3 (
    id,
    nome_cliente,
    email,
    telefone,
    cpf,
    descricao_pacote,
    valor_total,
    -- Endereço copiado do original
    address_zip_code,
    address_street,
    address_number,
    address_complement,
    address_neighborhood,
    address_city,
    address_state,
    -- Flags de reenvio
    is_reenvio,
    pedido_origem_id,
    solicitacao_reenvio_id,
    -- Status inicial
    status_envio,
    foi_editado,
    observacao,
    created_at,
    data_venda
  ) VALUES (
    v_novo_id,
    v_pedido.nome_cliente,
    v_pedido.email,
    v_pedido.telefone,
    v_pedido.cpf,
    v_pedido.descricao_pacote,
    v_pedido.valor_total,
    v_pedido.address_zip_code,
    v_pedido.address_street,
    v_pedido.address_number,
    v_pedido.address_complement,
    v_pedido.address_neighborhood,
    v_pedido.address_city,
    v_pedido.address_state,
    TRUE,           -- is_reenvio
    p_pedido_id,    -- pedido_origem_id
    p_solicitacao_id,
    'aguardando',   -- status_envio inicial
    TRUE,           -- foi_editado (protege de sobrescrita)
    COALESCE(
      'REENVIO — ' || COALESCE(p_observacao_extra, 'Originado de reclamação'),
      'REENVIO'
    ),
    NOW(),
    NOW()
  );

  -- Atualiza a solicitação com o ID do pedido de reenvio gerado
  UPDATE solicitacoes
  SET pedido_reenvio_id = v_novo_id
  WHERE id = p_solicitacao_id;

  RETURN v_novo_id;
END;
$$;

-- ─── 4. Permissões ───────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION duplicar_pedido_como_reenvio(UUID, UUID, TEXT)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 110: Reenvio vinculado à solicitação criado!' AS resultado;
