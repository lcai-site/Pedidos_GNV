export type Role = 'atendente' | 'gestor' | 'adm';

export type Permission =
  | 'dashboard:view'
  | 'dashboard_posvenda:view_all'
  | 'dashboard_posvenda:view_own'
  | 'logistics:view'
  | 'logistics:edit'
  | 'logistics:generate_labels'
  | 'clientes:view'
  | 'clientes:edit'
  | 'pedidos:view'
  | 'pedidos:edit'
  | 'solicitacoes:create'
  | 'solicitacoes:approve'
  | 'reembolsos:create'
  | 'reembolsos:approve'
  | 'reembolsos:notify_whatsapp'
  | 'usuarios:manage_all'
  | 'usuarios:manage_atendentes'
  | 'metas:define'
  | 'relatorios:export'
  | 'settings:view'
  | 'settings:edit'
  | 'estoque:view'
  | 'estoque:edit'
  | 'estoque:add'
  | 'estoque:adjust'
  | 'estoque:delete'
  | 'estoque:config';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  atendente: [
    'dashboard:view',
    'dashboard_posvenda:view_own',
    'logistics:view',
    'clientes:view',
    'clientes:edit',
    'pedidos:view',
    'pedidos:edit',
    'solicitacoes:create',
    'reembolsos:create',
    'settings:view',
    'estoque:view',
  ],
  gestor: [
    'dashboard:view',
    'dashboard_posvenda:view_all',
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
    'usuarios:manage_atendentes',
    'metas:define',
    'relatorios:export',
    'settings:view',
    'estoque:view',
    'estoque:edit',
    'estoque:add',
    'estoque:adjust',
  ],
  adm: [
    'dashboard:view',
    'dashboard_posvenda:view_all',
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
  ],
};

/**
 * Verifica se uma role tem uma permissão específica
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Verifica se uma role tem pelo menos uma das permissões fornecidas
 */
export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

/**
 * Verifica se uma role tem todas as permissões fornecidas
 */
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

/**
 * Retorna todas as permissões de uma role
 */
export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}
