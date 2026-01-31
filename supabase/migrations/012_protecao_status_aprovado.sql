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
