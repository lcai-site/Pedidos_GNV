-- ================================================================
-- MIGRATION 037: CRIAR FUNÇÃO update_pedidos_consolidados
-- ================================================================
-- A função RPC chamada pelo front-end para editar dados de pedidos
-- na tabela pedidos_consolidados_v3
-- ================================================================

DROP FUNCTION IF EXISTS update_pedidos_consolidados(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT);

CREATE OR REPLACE FUNCTION update_pedidos_consolidados(
  p_cpf_antigo TEXT,
  p_cpf_novo TEXT,
  p_nome TEXT,
  p_email TEXT,
  p_telefone TEXT,
  p_cep TEXT,
  p_logradouro TEXT,
  p_numero TEXT,
  p_complemento TEXT,
  p_bairro TEXT,
  p_cidade TEXT,
  p_estado TEXT,
  p_observacao TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_endereco_completo TEXT;
BEGIN
  -- Montar endereço completo
  v_endereco_completo := p_logradouro || ', ' || p_numero;
  IF p_complemento IS NOT NULL AND p_complemento != '' THEN
    v_endereco_completo := v_endereco_completo || ' - ' || p_complemento;
  END IF;
  v_endereco_completo := v_endereco_completo || ' - ' || p_bairro || ', ' || p_cidade || ' - ' || p_estado || ', ' || p_cep;

  -- Atualizar pedidos_consolidados_v3 (tabela principal)
  UPDATE pedidos_consolidados_v3
  SET 
    cpf = p_cpf_novo,
    nome_cliente = p_nome,
    email = p_email,
    telefone = p_telefone,
    cep = p_cep,
    logradouro = p_logradouro,
    numero = p_numero,
    complemento = p_complemento,
    bairro = p_bairro,
    cidade = p_cidade,
    estado = p_estado,
    endereco_completo = v_endereco_completo,
    observacao = p_observacao,
    foi_editado = true,
    updated_at = NOW()
  WHERE cpf = p_cpf_antigo;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Tentar atualizar tabela pedidos (fonte original) — protegido contra schema diferente
  BEGIN
    UPDATE pedidos
    SET 
      nome_cliente = p_nome,
      email = p_email,
      telefone = p_telefone,
      cep = p_cep,
      logradouro = p_logradouro,
      numero = p_numero,
      complemento = p_complemento,
      bairro = p_bairro,
      cidade = p_cidade,
      estado = p_estado,
      endereco_completo = v_endereco_completo,
      observacao = p_observacao,
      foi_editado = true,
      updated_at = NOW()
    WHERE cpf_cliente = p_cpf_antigo;
  EXCEPTION WHEN OTHERS THEN
    -- Ignora erros (tabela pode não existir ou ter schema diferente)
    NULL;
  END;

  RETURN v_count;
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION update_pedidos_consolidados(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

SELECT 'Função update_pedidos_consolidados criada!' as resultado;
