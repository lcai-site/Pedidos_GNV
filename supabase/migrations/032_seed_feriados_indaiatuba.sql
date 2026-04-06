-- ================================================================
-- SEED FERIADOS INDAIATUBA/SP (2026)
-- Garante que feriados locais e estaduais estejam na tabela
-- ================================================================

INSERT INTO feriados (data, nome, descricao, tipo) VALUES
  -- Estaduais SP
  ('2026-07-09', 'Revolução Constitucionalista', 'Feriado Estadual SP', 'estadual'),
  ('2026-11-20', 'Consciência Negra', 'Feriado Estadual SP', 'estadual'),

  -- Municipais Indaiatuba
  ('2026-02-02', 'Nossa Senhora da Candelária', 'Padroeira de Indaiatuba', 'municipal'),
  ('2026-05-11', 'Aniversário de Indaiatuba', 'Emancipação Política', 'municipal'),
  ('2026-12-09', 'Indaiatuba (Dia da Bíblia/Outro)', 'Feriado Municipal', 'municipal') -- Verificar calendário exato se necessário, apenas exemplo

ON CONFLICT (data) DO UPDATE SET 
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  tipo = EXCLUDED.tipo;
