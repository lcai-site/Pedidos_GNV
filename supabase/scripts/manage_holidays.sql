-- ============================================================================
-- SCRIPT: Gerenciamento de Feriados
-- Descrição: Adicionar, remover e listar feriados
-- ============================================================================

-- ============================================================================
-- LISTAR TODOS OS FERIADOS
-- ============================================================================

SELECT 
  data,
  TO_CHAR(data, 'DD/MM/YYYY (Day)') as data_formatada,
  nome,
  tipo,
  CASE tipo
    WHEN 'nacional' THEN '🇧🇷 Nacional'
    WHEN 'estadual' THEN '🏛️ Estadual (SP)'
    WHEN 'municipal' THEN '🏙️ Municipal (Indaiatuba)'
  END as tipo_formatado
FROM feriados
ORDER BY data;

-- ============================================================================
-- ADICIONAR NOVO FERIADO
-- ============================================================================

-- Exemplo: Adicionar feriado municipal
-- INSERT INTO feriados (data, nome, tipo) VALUES
--   ('2026-XX-XX', 'Nome do Feriado', 'municipal')
-- ON CONFLICT (data) DO NOTHING;

-- ============================================================================
-- REMOVER FERIADO
-- ============================================================================

-- Exemplo: Remover feriado específico
-- DELETE FROM feriados WHERE data = '2026-XX-XX';

-- ============================================================================
-- ADICIONAR FERIADOS DE 2027 (Executar no final de 2026)
-- ============================================================================

-- INSERT INTO feriados (data, nome, tipo) VALUES
--   -- Nacionais 2027
--   ('2027-01-01', 'Ano Novo', 'nacional'),
--   ('2027-02-08', 'Carnaval', 'nacional'),
--   ('2027-02-09', 'Carnaval', 'nacional'),
--   ('2027-03-26', 'Sexta-feira Santa', 'nacional'),
--   ('2027-04-21', 'Tiradentes', 'nacional'),
--   ('2027-05-01', 'Dia do Trabalho', 'nacional'),
--   ('2027-05-27', 'Corpus Christi', 'nacional'),
--   ('2027-09-07', 'Independência do Brasil', 'nacional'),
--   ('2027-10-12', 'Nossa Senhora Aparecida', 'nacional'),
--   ('2027-11-02', 'Finados', 'nacional'),
--   ('2027-11-15', 'Proclamação da República', 'nacional'),
--   ('2027-12-25', 'Natal', 'nacional'),
--   
--   -- Estaduais (SP)
--   ('2027-07-09', 'Revolução Constitucionalista', 'estadual'),
--   
--   -- Municipais (Indaiatuba)
--   ('2027-05-11', 'Aniversário de Indaiatuba', 'municipal')
-- ON CONFLICT (data) DO NOTHING;

-- ============================================================================
-- TESTAR FUNÇÃO DE PRÓXIMO DIA ÚTIL
-- ============================================================================

-- Teste 1: Segunda → Terça (dia normal)
SELECT 
  '2026-01-20'::DATE as data_base,
  proximo_dia_util('2026-01-20'::DATE) as proximo_dia_util,
  'Deve ser 2026-01-21 (Terça)' as esperado;

-- Teste 2: Sexta → Segunda (pula fim de semana)
SELECT 
  '2026-01-24'::DATE as data_base,
  proximo_dia_util('2026-01-24'::DATE) as proximo_dia_util,
  'Deve ser 2026-01-27 (Segunda)' as esperado;

-- Teste 3: Quinta → Sexta (dia normal)
SELECT 
  '2026-01-22'::DATE as data_base,
  proximo_dia_util('2026-01-22'::DATE) as proximo_dia_util,
  'Deve ser 2026-01-23 (Sexta)' as esperado;

-- Teste 4: Antes de feriado (30/04 → 02/05, pula 01/05)
SELECT 
  '2026-04-30'::DATE as data_base,
  proximo_dia_util('2026-04-30'::DATE) as proximo_dia_util,
  'Deve ser 2026-05-02 (Sábado é 02/05, então Segunda 04/05)' as esperado;

-- ============================================================================
-- TESTAR VIEW COMPLETA
-- ============================================================================

SELECT 
  codigo_transacao,
  data_venda::DATE as venda,
  CASE EXTRACT(DOW FROM data_venda)
    WHEN 0 THEN 'Dom'
    WHEN 1 THEN 'Seg'
    WHEN 2 THEN 'Ter'
    WHEN 3 THEN 'Qua'
    WHEN 4 THEN 'Qui'
    WHEN 5 THEN 'Sex'
    WHEN 6 THEN 'Sáb'
  END as dia_semana,
  dia_pos_vendas as pv,
  dia_despacho as despacho,
  TO_CHAR(corte_pv, 'DD/MM/YYYY HH24:MI') as corte
FROM pedidos_consolidados_v2
WHERE data_venda BETWEEN '2026-01-20' AND '2026-01-27'
ORDER BY data_venda
LIMIT 20;

-- ============================================================================
-- VERIFICAR CONTAGEM DE PEDIDOS
-- ============================================================================

SELECT 
  COUNT(*) as total_pedidos,
  COUNT(*) FILTER (WHERE NOW() >= corte_pv) as prontos,
  COUNT(*) FILTER (WHERE NOW() < corte_pv) as aguardando
FROM pedidos_consolidados_v2
WHERE data_venda BETWEEN '2026-01-23' AND '2026-01-27';
