-- ================================================================
-- MIGRATION 009: Função de Janela PV Inteligente
-- Descrição: Cria função que calcula janela de Pós-Venda baseada no dia da semana
-- Regra: Quinta/Sexta = +4 dias, Outros dias = +2 dias
-- Data: 2026-01-27
-- ================================================================

-- ================================================================
-- FUNÇÃO: calcular_janela_pv_segura
-- ================================================================

CREATE OR REPLACE FUNCTION calcular_janela_pv_segura(data_pedido TIMESTAMP WITH TIME ZONE)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  dia_semana INTEGER;
  data_limite TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Extrai dia da semana (0=Domingo, 1=Segunda ... 6=Sábado)
  dia_semana := EXTRACT(DOW FROM data_pedido);
  
  data_limite := data_pedido;
  
  -- QUINTA (4) ou SEXTA (5) → +4 dias
  -- Motivo: Fim de semana no meio, precisa de mais tempo
  IF dia_semana = 4 OR dia_semana = 5 THEN
    data_limite := data_pedido + INTERVAL '4 days';
  -- OUTROS DIAS (Seg-Qua, Sab-Dom) → +2 dias
  ELSE
    data_limite := data_pedido + INTERVAL '2 days';
  END IF;
  
  RETURN data_limite;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ================================================================

COMMENT ON FUNCTION calcular_janela_pv_segura(TIMESTAMP WITH TIME ZONE) IS 
'Calcula a janela de Pós-Venda baseada no dia da semana da compra principal.
Quinta/Sexta: +4 dias (para cobrir fim de semana)
Outros dias: +2 dias (janela padrão)
Retorna o timestamp limite para consolidação de PVs.';

-- ================================================================
-- TESTES DA FUNÇÃO
-- ================================================================

-- Teste 1: Quinta-feira (deve retornar +4 dias)
DO $$
DECLARE
  data_teste TIMESTAMP WITH TIME ZONE := '2026-01-22 10:00:00'; -- Quinta
  resultado TIMESTAMP WITH TIME ZONE;
  esperado TIMESTAMP WITH TIME ZONE := '2026-01-26 10:00:00'; -- +4 dias
BEGIN
  resultado := calcular_janela_pv_segura(data_teste);
  
  IF resultado = esperado THEN
    RAISE NOTICE '✅ Teste 1 PASSOU: Quinta-feira → +4 dias';
  ELSE
    RAISE EXCEPTION '❌ Teste 1 FALHOU: Esperado %, Obtido %', esperado, resultado;
  END IF;
END $$;

-- Teste 2: Sexta-feira (deve retornar +4 dias)
DO $$
DECLARE
  data_teste TIMESTAMP WITH TIME ZONE := '2026-01-23 15:00:00'; -- Sexta
  resultado TIMESTAMP WITH TIME ZONE;
  esperado TIMESTAMP WITH TIME ZONE := '2026-01-27 15:00:00'; -- +4 dias
BEGIN
  resultado := calcular_janela_pv_segura(data_teste);
  
  IF resultado = esperado THEN
    RAISE NOTICE '✅ Teste 2 PASSOU: Sexta-feira → +4 dias';
  ELSE
    RAISE EXCEPTION '❌ Teste 2 FALHOU: Esperado %, Obtido %', esperado, resultado;
  END IF;
END $$;

-- Teste 3: Segunda-feira (deve retornar +2 dias)
DO $$
DECLARE
  data_teste TIMESTAMP WITH TIME ZONE := '2026-01-26 09:00:00'; -- Segunda
  resultado TIMESTAMP WITH TIME ZONE;
  esperado TIMESTAMP WITH TIME ZONE := '2026-01-28 09:00:00'; -- +2 dias
BEGIN
  resultado := calcular_janela_pv_segura(data_teste);
  
  IF resultado = esperado THEN
    RAISE NOTICE '✅ Teste 3 PASSOU: Segunda-feira → +2 dias';
  ELSE
    RAISE EXCEPTION '❌ Teste 3 FALHOU: Esperado %, Obtido %', esperado, resultado;
  END IF;
END $$;

-- Teste 4: Quarta-feira (deve retornar +2 dias)
DO $$
DECLARE
  data_teste TIMESTAMP WITH TIME ZONE := '2026-01-21 20:00:00'; -- Quarta
  resultado TIMESTAMP WITH TIME ZONE;
  esperado TIMESTAMP WITH TIME ZONE := '2026-01-23 20:00:00'; -- +2 dias
BEGIN
  resultado := calcular_janela_pv_segura(data_teste);
  
  IF resultado = esperado THEN
    RAISE NOTICE '✅ Teste 4 PASSOU: Quarta-feira → +2 dias';
  ELSE
    RAISE EXCEPTION '❌ Teste 4 FALHOU: Esperado %, Obtido %', esperado, resultado;
  END IF;
END $$;

-- ================================================================
-- QUERY DE VALIDAÇÃO
-- ================================================================

-- Visualizar janelas de PV para pedidos recentes
SELECT 
  data_venda,
  TO_CHAR(data_venda, 'Day') AS dia_semana,
  EXTRACT(DOW FROM data_venda) AS dow,
  calcular_janela_pv_segura(data_venda) AS janela_pv,
  calcular_janela_pv_segura(data_venda) - data_venda AS intervalo,
  CASE 
    WHEN EXTRACT(DOW FROM data_venda) IN (4, 5) THEN '4 dias (Thu/Fri)'
    ELSE '2 dias (outros)'
  END AS regra_aplicada
FROM pedidos
WHERE data_venda >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY data_venda DESC
LIMIT 20;

-- ================================================================
-- FIM DA MIGRATION 009
-- ================================================================
