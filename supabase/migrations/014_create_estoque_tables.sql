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
