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
