-- ============================================
-- EXPORTAR DADOS DE PRODUÇÃO
-- ============================================
-- Execute este script no banco de PRODUÇÃO
-- Copie o resultado de cada query

-- 1. Exportar tabela PEDIDOS
SELECT * FROM pedidos;

-- 2. Exportar tabela PEDIDOS_UNIFICADOS  
SELECT * FROM pedidos_unificados;

-- 3. Exportar tabela PEDIDOS_AGRUPADOS
SELECT * FROM pedidos_agrupados;

-- ============================================
-- INSTRUÇÕES:
-- ============================================
-- 1. Execute cada SELECT acima separadamente
-- 2. Na tabela de resultados, clique no botão "Download" ou "Export CSV"
-- 3. Salve cada arquivo como:
--    - pedidos.csv
--    - pedidos_unificados.csv
--    - pedidos_agrupados.csv
-- 4. Depois vá para o banco de TESTES e execute IMPORTAR_DADOS_TESTES.sql
