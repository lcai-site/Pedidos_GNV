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
