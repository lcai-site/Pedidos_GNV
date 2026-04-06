-- =====================================================
-- SISTEMA DE PERMISSÕES CUSTOMIZÁVEIS POR USUÁRIO
-- Permite ativar/desativar funcionalidades individualmente
-- =====================================================

-- 1. Criar tabela de permissões customizadas por usuário
CREATE TABLE IF NOT EXISTS user_custom_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted BOOLEAN DEFAULT true,
  granted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, permission)
);

-- 2. Criar view para visualizar todas as permissões efetivas do usuário
CREATE OR REPLACE VIEW user_effective_permissions AS
WITH base_permissions AS (
  -- Todas as permissões possíveis
  SELECT unnest(ARRAY[
    'dashboard:view',
    'dashboard_posvenda:view_all',
    'dashboard_posvenda:view_own',
    'logistics:view',
    'logistics:edit',
    'logistics:generate_labels',
    'clientes:view',
    'clientes:edit',
    'pedidos:view',
    'pedidos:edit',
    'solicitacoes:create',
    'solicitacoes:approve',
    'reembolsos:create',
    'reembolsos:approve',
    'reembolsos:notify_whatsapp',
    'usuarios:manage_all',
    'usuarios:manage_atendentes',
    'metas:define',
    'relatorios:export',
    'settings:view',
    'settings:edit',
    'estoque:view',
    'estoque:edit',
    'estoque:add',
    'estoque:adjust',
    'estoque:delete',
    'estoque:config',
    'crm:view',
    'crm:edit',
    'crm:config',
    'assinaturas:view',
    'assinaturas:edit',
    'recuperacao:view',
    'recuperacao:edit'
  ]) as permission
),
user_base AS (
  SELECT 
    p.id as user_id,
    p.role,
    p.nome_completo,
    p.email
  FROM profiles p
  WHERE p.ativo = true
)
SELECT 
  ub.user_id,
  ub.nome_completo,
  ub.email,
  ub.role,
  bp.permission,
  COALESCE(ucp.granted, 
    CASE ub.role
      WHEN 'adm' THEN true
      WHEN 'gestor' THEN bp.permission = ANY(ARRAY[
        'dashboard:view', 'dashboard_posvenda:view_all', 'logistics:view', 'logistics:edit',
        'logistics:generate_labels', 'clientes:view', 'clientes:edit', 'pedidos:view', 'pedidos:edit',
        'solicitacoes:create', 'solicitacoes:approve', 'reembolsos:create', 'reembolsos:approve',
        'reembolsos:notify_whatsapp', 'usuarios:manage_atendentes', 'metas:define', 'relatorios:export',
        'settings:view', 'estoque:view', 'estoque:edit', 'estoque:add', 'estoque:adjust',
        'crm:view', 'crm:edit', 'assinaturas:view', 'assinaturas:edit', 'recuperacao:view', 'recuperacao:edit'
      ])
      WHEN 'atendente' THEN bp.permission = ANY(ARRAY[
        'dashboard:view', 'dashboard_posvenda:view_own', 'logistics:view', 'clientes:view',
        'clientes:edit', 'pedidos:view', 'pedidos:edit', 'solicitacoes:create', 'reembolsos:create',
        'settings:view', 'estoque:view'
      ])
      ELSE false
    END
  ) as has_permission,
  CASE 
    WHEN ucp.id IS NOT NULL THEN 'custom'
    ELSE 'role_default'
  END as permission_source
FROM user_base ub
CROSS JOIN base_permissions bp
LEFT JOIN user_custom_permissions ucp ON ucp.user_id = ub.user_id AND ucp.permission = bp.permission;

-- 3. Criar function para verificar permissão do usuário
CREATE OR REPLACE FUNCTION check_user_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_custom_permission BOOLEAN;
BEGIN
  -- Buscar role do usuário
  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;
  
  -- Verificar se existe permissão customizada
  SELECT granted INTO v_custom_permission
  FROM user_custom_permissions
  WHERE user_id = p_user_id AND permission = p_permission;
  
  -- Se existe customização, usar ela
  IF v_custom_permission IS NOT NULL THEN
    RETURN v_custom_permission;
  END IF;
  
  -- Senão, usar permissões do role
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Criar function para atualizar permissões do usuário
CREATE OR REPLACE FUNCTION set_user_permission(
  p_user_id UUID, 
  p_permission TEXT, 
  p_granted BOOLEAN,
  p_granted_by UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_custom_permissions (user_id, permission, granted, granted_by)
  VALUES (p_user_id, p_permission, p_granted, p_granted_by)
  ON CONFLICT (user_id, permission) 
  DO UPDATE SET 
    granted = p_granted,
    granted_by = p_granted_by,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Criar function para resetar permissões (voltar ao padrão do role)
CREATE OR REPLACE FUNCTION reset_user_permissions(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM user_custom_permissions WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Criar function RPC para ser chamada do frontend
CREATE OR REPLACE FUNCTION get_user_permissions_rpc(p_user_id UUID)
RETURNS TABLE(permission TEXT, has_permission BOOLEAN, source TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uep.permission,
    uep.has_permission,
    uep.permission_source as source
  FROM user_effective_permissions uep
  WHERE uep.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RLS para user_custom_permissions
ALTER TABLE user_custom_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adm_can_manage_all_permissions"
  ON user_custom_permissions
  TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'adm')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'adm');

-- 8. Índices
CREATE INDEX IF NOT EXISTS idx_user_custom_permissions_user_id ON user_custom_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_custom_permissions_permission ON user_custom_permissions(permission);

-- 9. Verificar estrutura criada
SELECT 'Tabela user_custom_permissions criada com sucesso!' as status;
