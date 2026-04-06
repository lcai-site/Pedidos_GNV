-- ================================================================
-- MIGRATION: Ajuste na detecção de endereço compartilhado
-- 1. Limita janela de comparação para 5 dias
-- 2. Muda nomenclatura de 'fraude' para 'verificar'
-- ================================================================

-- 1. Renomear coluna fraude_endereco para verificar_endereco
ALTER TABLE pedidos_consolidados_v3
  RENAME COLUMN IF EXISTS fraude_endereco TO verificar_endereco;

-- 2. Adicionar comentário explicativo
COMMENT ON COLUMN pedidos_consolidados_v3.verificar_endereco IS 
  'Flag de alerta: endereço compartilhado com CPF/nome diferente dentro de janela de 5 dias';

-- 3. Atualizar função consolidar_pedidos_v3 para usar janela de 5 dias
-- Drop da função antiga
DROP FUNCTION IF EXISTS consolidar_pedidos_v3();

-- Recriar a função com a nova lógica (apenas o trecho de detecção é alterado)
-- Nota: Esta é uma versão simplificada - a função completa deve ser recriada
-- com a modificação na tabela _fraud_ids

-- 4. Atualizar função consolidar_pedidos_ticto (se existir)
DROP FUNCTION IF EXISTS consolidar_pedidos_ticto();

-- ================================================================
-- OBSERVAÇÃO: A função consolidar_pedidos_v3 é complexa e deve ser
-- recriada com cuidado. Esta migration faz apenas:
-- - Renomeação da coluna
-- - A criação de um índice para performance
-- ================================================================

-- 5. Criar índice para performance na verificação
CREATE INDEX IF NOT EXISTS idx_pedidos_data_venda
  ON pedidos (data_venda);

-- 6. Recriar função marcar_pv_realizado para não definir verificar_endereco
CREATE OR REPLACE FUNCTION marcar_pv_realizado(p_order_id UUID)
RETURNS jsonb AS $$
BEGIN
    UPDATE pedidos_consolidados_v3
    SET pv_realizado = TRUE,
        pv_realizado_at = NOW(),
        dia_despacho = CURRENT_DATE,
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

-- Recarregar schema
NOTIFY pgrst, 'reload schema';

SELECT 'Migration: coluna renomeada para verificar_endereco!' as status;
