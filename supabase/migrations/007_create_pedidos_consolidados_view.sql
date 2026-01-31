-- ============================================================================
-- MIGRATION: Business Day Calculation with Holidays
-- Descrição: Implementa cálculo de dias úteis considerando feriados
-- Localização: Indaiatuba/SP
-- ============================================================================

-- ============================================================================
-- TABELA: feriados
-- Armazena feriados nacionais, estaduais (SP) e municipais (Indaiatuba)
-- ============================================================================

CREATE TABLE IF NOT EXISTS feriados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('nacional', 'estadual', 'municipal')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar coluna 'nome' se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feriados' AND column_name = 'nome'
  ) THEN
    ALTER TABLE feriados ADD COLUMN nome TEXT;
  END IF;
END $$;

-- Adicionar coluna 'descricao' se não existir (para compatibilidade)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feriados' AND column_name = 'descricao'
  ) THEN
    ALTER TABLE feriados ADD COLUMN descricao TEXT;
  END IF;
END $$;

-- Preencher valores NULL nas colunas nome e descricao
DO $$
BEGIN
  -- Preencher nome com descricao se nome estiver NULL
  UPDATE feriados SET nome = COALESCE(descricao, 'Feriado') WHERE nome IS NULL;
  
  -- Preencher descricao com nome se descricao estiver NULL
  UPDATE feriados SET descricao = COALESCE(nome, 'Feriado') WHERE descricao IS NULL;
END $$;

-- Índice para busca rápida por data
CREATE INDEX IF NOT EXISTS idx_feriados_data ON feriados(data);

-- Comentário da tabela
COMMENT ON TABLE feriados IS 'Feriados nacionais, estaduais (SP) e municipais (Indaiatuba)';

-- ============================================================================
-- INSERIR FERIADOS DE 2026
-- ============================================================================

INSERT INTO feriados (data, nome, descricao, tipo) VALUES
  -- Nacionais
  ('2026-01-01', 'Ano Novo', 'Confraternização Universal', 'nacional'),
  ('2026-02-16', 'Carnaval', 'Segunda-feira de Carnaval', 'nacional'),
  ('2026-02-17', 'Carnaval', 'Terça-feira de Carnaval', 'nacional'),
  ('2026-04-03', 'Sexta-feira Santa', 'Paixão de Cristo', 'nacional'),
  ('2026-04-21', 'Tiradentes', 'Dia de Tiradentes', 'nacional'),
  ('2026-05-01', 'Dia do Trabalho', 'Dia Mundial do Trabalho', 'nacional'),
  ('2026-06-04', 'Corpus Christi', 'Corpus Christi', 'nacional'),
  ('2026-09-07', 'Independência do Brasil', 'Independência do Brasil', 'nacional'),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'Padroeira do Brasil', 'nacional'),
  ('2026-11-02', 'Finados', 'Dia de Finados', 'nacional'),
  ('2026-11-15', 'Proclamação da República', 'Proclamação da República', 'nacional'),
  ('2026-12-25', 'Natal', 'Natal', 'nacional'),
  
  -- Estaduais (SP)
  ('2026-07-09', 'Revolução Constitucionalista', 'Revolução Constitucionalista de 1932', 'estadual'),
  
  -- Municipais (Indaiatuba)
  ('2026-05-11', 'Aniversário de Indaiatuba', 'Aniversário da cidade de Indaiatuba', 'municipal')
ON CONFLICT (data) DO UPDATE SET 
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  tipo = EXCLUDED.tipo;

-- ============================================================================
-- FUNÇÃO: proximo_dia_util
-- Calcula o próximo dia útil após uma data, pulando fins de semana e feriados
-- ============================================================================

CREATE OR REPLACE FUNCTION proximo_dia_util(data_base DATE)
RETURNS DATE AS $$
DECLARE
  data_resultado DATE := data_base + 1;
  max_iterations INT := 30; -- Proteção contra loop infinito
  iterations INT := 0;
BEGIN
  -- Loop até encontrar um dia útil
  WHILE iterations < max_iterations LOOP
    -- Verificar se é fim de semana (0=Domingo, 6=Sábado)
    IF EXTRACT(DOW FROM data_resultado) NOT IN (0, 6) THEN
      -- Verificar se não é feriado
      IF NOT EXISTS (SELECT 1 FROM feriados WHERE data = data_resultado) THEN
        RETURN data_resultado;
      END IF;
    END IF;
    
    data_resultado := data_resultado + 1;
    iterations := iterations + 1;
  END LOOP;
  
  -- Se chegou aqui, algo deu errado (30 dias sem dia útil?)
  RAISE EXCEPTION 'Não foi possível encontrar próximo dia útil após %', data_base;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comentário da função
COMMENT ON FUNCTION proximo_dia_util(DATE) IS 'Retorna o próximo dia útil após a data fornecida, pulando fins de semana e feriados';

-- ============================================================================
-- VIEW: pedidos_consolidados_v2
-- Consolida pedidos aprovados com cálculo automático de janela de PV
-- Agrupa pedidos por CPF + Data para consolidar Oferta Principal + Bumps + Upsells
-- ============================================================================

-- Dropar VIEW existente para permitir mudanças de schema
DROP VIEW IF EXISTS pedidos_consolidados_v2;

CREATE VIEW pedidos_consolidados_v2 AS
WITH vendas_base AS (
  -- Identifica vendas base (não PV) e calcula sua janela de PV
  SELECT 
    p.*,
    proximo_dia_util(p.data_venda::DATE) as dia_pv,
    proximo_dia_util(proximo_dia_util(p.data_venda::DATE)) as dia_despacho,
    (proximo_dia_util(proximo_dia_util(p.data_venda::DATE))::TIMESTAMP + INTERVAL '8 hours 30 minutes') as corte_pv
  FROM pedidos p
  WHERE p.status = 'Aprovado'
    AND p.nome_produto NOT LIKE '%[Assinatura]%'
    AND p.nome_produto NOT LIKE '%[Afiliação]%'
),
pedidos_com_grupo AS (
  -- Para cada pedido, encontra a venda base à qual ele pertence
  SELECT 
    v1.*,
    -- Procura a PRIMEIRA venda base (mais antiga) do mesmo CPF que tem janela válida
    COALESCE(
      (
        SELECT v2.id
        FROM vendas_base v2
        WHERE v2.cpf_cliente = v1.cpf_cliente
          AND v2.data_venda < v1.data_venda  -- Venda base deve ser ANTERIOR (não mesmo dia)
          AND v1.data_venda <= v2.corte_pv
        ORDER BY v2.data_venda ASC  -- Primeira venda (mais antiga)
        LIMIT 1
      ),
      v1.id  -- Se não encontrar, usa o próprio ID (é uma venda base)
    ) as venda_base_id
  FROM vendas_base v1
),
pedidos_agrupados AS (
  -- Agrupa pedidos pela venda base
  SELECT 
    venda_base_id as id,
    (ARRAY_AGG(cpf_cliente ORDER BY data_venda))[1] as cpf_cliente,
    (ARRAY_AGG(dia_despacho ORDER BY data_venda))[1] as dia_despacho,
    
    -- Dados do pedido principal (primeiro pedido do grupo)
    (ARRAY_AGG(codigo_transacao ORDER BY data_venda))[1] as codigo_transacao,
    (ARRAY_AGG(status ORDER BY data_venda))[1] as status,
    (ARRAY_AGG(nome_produto ORDER BY data_venda))[1] as nome_produto,
    (ARRAY_AGG(nome_oferta ORDER BY data_venda))[1] as nome_oferta,
    SUM(valor_total) as valor_total,
    (ARRAY_AGG(forma_pagamento ORDER BY data_venda))[1] as forma_pagamento,
    (ARRAY_AGG(parcelas ORDER BY data_venda))[1] as parcelas,
    (ARRAY_AGG(nome_cliente ORDER BY data_venda))[1] as nome_cliente,
    (ARRAY_AGG(email_cliente ORDER BY data_venda))[1] as email_cliente,
    (ARRAY_AGG(telefone_cliente ORDER BY data_venda))[1] as telefone_cliente,
    (ARRAY_AGG(cep ORDER BY data_venda))[1] as cep,
    (ARRAY_AGG(rua ORDER BY data_venda))[1] as rua,
    (ARRAY_AGG(numero ORDER BY data_venda))[1] as numero,
    (ARRAY_AGG(complemento ORDER BY data_venda))[1] as complemento,
    (ARRAY_AGG(bairro ORDER BY data_venda))[1] as bairro,
    (ARRAY_AGG(cidade ORDER BY data_venda))[1] as cidade,
    (ARRAY_AGG(estado ORDER BY data_venda))[1] as estado,
    (ARRAY_AGG(data_venda ORDER BY data_venda))[1] as data_venda,
    MIN(created_at) as created_at,
    (ARRAY_AGG(metadata ORDER BY data_venda))[1] as metadata,
    
    -- Consolidação de produtos (Oferta + Bumps + Upsells + PV)
    STRING_AGG(
      DISTINCT COALESCE(
        metadata->'offer'->>'name',
        nome_oferta,
        'Produto'
      ),
      ' + '
      ORDER BY COALESCE(
        metadata->'offer'->>'name',
        nome_oferta,
        'Produto'
      )
    ) as descricao_pacote,
    
    -- Códigos agrupados
    ARRAY_AGG(codigo_transacao ORDER BY data_venda) as codigos_agrupados,
    COUNT(*) as quantidade_pedidos
    
  FROM pedidos_com_grupo
  GROUP BY venda_base_id
)
SELECT 
  pg.id,
  pg.codigo_transacao,
  pg.status,
  pg.nome_produto,
  pg.nome_oferta,
  pg.valor_total,
  pg.forma_pagamento,
  pg.parcelas,
  pg.nome_cliente,
  pg.email_cliente,
  pg.cpf_cliente,
  pg.telefone_cliente,
  pg.cep,
  pg.rua,
  pg.numero,
  pg.complemento,
  pg.bairro,
  pg.cidade,
  pg.estado,
  pg.data_venda,
  pg.created_at,
  pg.metadata,
  pg.descricao_pacote,
  pg.codigos_agrupados,
  pg.quantidade_pedidos,
  
  -- Campos calculados (usando dia_despacho já calculado no CTE)
  proximo_dia_util(pg.data_venda::DATE) as dia_pos_vendas,
  pg.dia_despacho,
  (pg.dia_despacho::TIMESTAMP + INTERVAL '8 hours 30 minutes') as corte_pv,
  
  -- Flag de mesmo endereço (detecção de fraude)
  EXISTS (
    SELECT 1 FROM pedidos p2
    WHERE p2.cep = pg.cep
      AND p2.rua = pg.rua
      AND p2.numero = pg.numero
      AND p2.cpf_cliente != pg.cpf_cliente
      AND p2.status = 'Aprovado'
  ) as mesmo_endereco

FROM pedidos_agrupados pg;

-- Comentário da VIEW
COMMENT ON VIEW pedidos_consolidados_v2 IS 'Consolida automaticamente pedidos aprovados agrupando por CPF e data, com cálculo de janela de pós-vendas considerando dias úteis e feriados';

-- ============================================================================
-- TESTES
-- ============================================================================

-- Teste 1: Próximo dia útil (Segunda → Terça)
-- SELECT proximo_dia_util('2026-01-20'::DATE); -- Deve retornar 2026-01-21

-- Teste 2: Próximo dia útil (Sexta → Segunda)
-- SELECT proximo_dia_util('2026-01-24'::DATE); -- Deve retornar 2026-01-27

-- Teste 3: Próximo dia útil (Quinta → Sexta)
-- SELECT proximo_dia_util('2026-01-22'::DATE); -- Deve retornar 2026-01-23

-- Teste 4: VIEW completa
-- SELECT 
--   codigo_transacao,
--   data_venda::DATE,
--   EXTRACT(DOW FROM data_venda) as dow_venda,
--   dia_pos_vendas,
--   dia_despacho,
--   corte_pv
-- FROM pedidos_consolidados_v2
-- WHERE data_venda BETWEEN '2026-01-20' AND '2026-01-27'
-- ORDER BY data_venda
-- LIMIT 10;
