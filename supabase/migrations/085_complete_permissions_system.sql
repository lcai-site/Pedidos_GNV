-- =====================================================
-- SISTEMA COMPLETO DE PERMISSÕES CUSTOMIZÁVEIS
-- Executar após o 084_user_custom_permissions.sql
-- =====================================================

-- Verificar se as funções existem, senão criar
DO $$
BEGIN
  -- Função para verificar permissão
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_user_permission') THEN
    CREATE OR REPLACE FUNCTION check_user_permission(p_user_id UUID, p_permission TEXT)
    RETURNS BOOLEAN AS $func$
    DECLARE
      v_role TEXT;
      v_custom_permission BOOLEAN;
    BEGIN
      SELECT role INTO v_role FROM profiles WHERE id = p_user_id;
      
      SELECT granted INTO v_custom_permission
      FROM user_custom_permissions
      WHERE user_id = p_user_id AND permission = p_permission;
      
      IF v_custom_permission IS NOT NULL THEN
        RETURN v_custom_permission;
      END IF;
      
      RETURN CASE v_role
        WHEN 'adm' THEN true
        WHEN 'gestor' THEN p_permission = ANY(ARRAY[
          'dashboard:view', 'dashboard_posvenda:view_all', 'logistics:view', 'logistics:edit',
          'logistics:generate_labels', 'clientes:view', 'clientes:edit', 'pedidos:view', 'pedidos:edit',
          'solicitacoes:create', 'solicitacoes:approve', 'reembolsos:create', 'reembolsos:approve',
          'reembolsos:notify_whatsapp', 'usuarios:manage_atendentes', 'metas:define', 'relatorios:export',
          'settings:view', 'estoque:view', 'estoque:edit', 'estoque:add', 'estoque:adjust',
          'crm:view', 'crm:edit', 'assinaturas:view', 'assinaturas:edit', 'recuperacao:view', 'recuperacao:edit'
        ])
        WHEN 'atendente' THEN p_permission = ANY(ARRAY[
          'dashboard:view', 'dashboard_posvenda:view_own', 'logistics:view', 'clientes:view',
          'clientes:edit', 'pedidos:view', 'pedidos:edit', 'solicitacoes:create', 'reembolsos:create',
          'settings:view', 'estoque:view'
        ])
        ELSE false
      END;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;
END $$;

-- Verificar estrutura
SELECT 
  'Permissões customizadas configuradas!' as status,
  (SELECT COUNT(*) FROM user_custom_permissions) as custom_permissions_count,
  (SELECT COUNT(*) FROM profiles WHERE ativo = true) as active_users;
