-- ================================================================
-- MIGRATION 103: FORCE UPDATE DE ENDEREÇOS NULOS (BURLANDO O FOI_EDITADO)
-- ================================================================

-- Uma query rápida que copia cirurgicamente os dados de endereço 
-- da tabela primária para todos os consolidados afetados pelo bug, 
-- independentemente deles estarem travados (foi_editado = true)

UPDATE pedidos_consolidados_v3 c
SET 
  logradouro = p.address_street,
  numero = p.address_number,
  complemento = p.address_complement,
  bairro = p.address_neighborhood,
  cidade = p.address_city,
  estado = p.address_state,
  endereco_completo = COALESCE(p.address_street, '') || ', ' || COALESCE(p.address_number, '') || 
                      CASE WHEN p.address_complement IS NOT NULL AND p.address_complement != '' THEN ' - ' || p.address_complement ELSE '' END || 
                      ' - ' || COALESCE(p.address_neighborhood, '') || ', ' || COALESCE(p.address_city, '') || '/' || COALESCE(p.address_state, '') || 
                      ' - CEP: ' || COALESCE(p.address_zip_code, '')
FROM ticto_pedidos p
WHERE c.id = p.id
  AND c.logradouro IS NULL;
