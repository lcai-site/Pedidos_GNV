-- ================================================================
-- MIGRATION 115: FUNÇÃO DE CANCELAMENTO / EXCLUSÃO LÓGICA DE PEDIDO
-- ================================================================
-- Adiciona a coluna motivo_cancelamento
-- Cria a função segura para o botão da Lixeira (excluir_pedido)
-- ================================================================

-- 1. Adicionar a coluna motivo_cancelamento
ALTER TABLE pedidos_consolidados_v3
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;

-- 2. Função RPC para cancelar o pedido
CREATE OR REPLACE FUNCTION cancelar_pedido_logistica(p_pedido_id UUID, p_motivo TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status_atual TEXT;
BEGIN
  -- Verifica se o pedido existe e puxa o status atual
  SELECT status_aprovacao INTO v_status_atual
  FROM pedidos_consolidados_v3
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Pedido não encontrado.');
  END IF;

  -- Impede cancelamento se já estiver cancelado
  IF v_status_atual = 'Cancelado' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'O pedido já encontra-se cancelado.');
  END IF;

  -- Atualiza o pedido para Cancelado
  UPDATE pedidos_consolidados_v3
  SET 
    status_aprovacao = 'Cancelado',
    status_envio = 'Cancelado',
    motivo_cancelamento = p_motivo,
    updated_at = NOW()
  WHERE id = p_pedido_id;

  RETURN jsonb_build_object('status', 'success', 'message', 'Pedido cancelado com sucesso.');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION cancelar_pedido_logistica(UUID, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 115: Cancelamento de pedidos criada com sucesso!' AS resultado;
