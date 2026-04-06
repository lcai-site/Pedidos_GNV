import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import { Permission, Role } from '../rbac/permissions';

// Todas as permissões disponíveis organizadas por categoria
export const PERMISSIONS_BY_CATEGORY = {
  'Dashboard': [
    { id: 'dashboard:view', label: 'Visualizar Dashboard', description: 'Acesso ao dashboard principal' },
    { id: 'dashboard_posvenda:view_all', label: 'Ver Todos Pós-Venda', description: 'Ver todos os pedidos de pós-venda' },
    { id: 'dashboard_posvenda:view_own', label: 'Ver Próprio Pós-Venda', description: 'Ver apenas pedidos de pós-venda atribuídos' },
  ],
  'Pedidos & Clientes': [
    { id: 'pedidos:view', label: 'Visualizar Pedidos', description: 'Ver lista de pedidos' },
    { id: 'pedidos:edit', label: 'Editar Pedidos', description: 'Modificar informações de pedidos' },
    { id: 'clientes:view', label: 'Visualizar Clientes', description: 'Ver lista de clientes' },
    { id: 'clientes:edit', label: 'Editar Clientes', description: 'Modificar informações de clientes' },
  ],
  'Logística': [
    { id: 'logistics:view', label: 'Visualizar Logística', description: 'Ver envios e rastreamentos' },
    { id: 'logistics:edit', label: 'Editar Logística', description: 'Modificar informações de envio' },
    { id: 'logistics:generate_labels', label: 'Gerar Etiquetas', description: 'Criar etiquetas de envio' },
    { id: 'logistics:reset_labels', label: 'Resetar Etiquetas', description: 'Limpar códigos de rastreio' },
    { id: 'logistics:mark_posted', label: 'Marcar Postado', description: 'Mover para aba Enviados' },
    { id: 'logistics:consolidate', label: 'Consolidar Pedidos', description: 'Executar limpeza e agrupamento' },
    { id: 'logistics:sync', label: 'Sincronizar Staging', description: 'Copia dados de Produção para Staging' },
  ],
  'Estoque': [
    { id: 'estoque:view', label: 'Visualizar Estoque', description: 'Ver níveis de estoque' },
    { id: 'estoque:edit', label: 'Editar Estoque', description: 'Modificar produtos em estoque' },
    { id: 'estoque:add', label: 'Adicionar ao Estoque', description: 'Adicionar novos produtos' },
    { id: 'estoque:adjust', label: 'Ajustar Estoque', description: 'Fazer ajustes de quantidade' },
    { id: 'estoque:delete', label: 'Deletar do Estoque', description: 'Remover produtos' },
    { id: 'estoque:config', label: 'Configurar Estoque', description: 'Configurações avançadas' },
  ],
  'CRM': [
    { id: 'crm:view', label: 'Visualizar CRM', description: 'Acesso ao funil de vendas' },
    { id: 'crm:edit', label: 'Editar CRM', description: 'Mover leads, editar informações' },
    { id: 'crm:config', label: 'Configurar CRM', description: 'Configurar pipelines e etapas' },
  ],
  'Assinaturas & Recuperação': [
    { id: 'assinaturas:view', label: 'Visualizar Assinaturas', description: 'Ver assinaturas' },
    { id: 'assinaturas:edit', label: 'Editar Assinaturas', description: 'Gerenciar assinaturas' },
    { id: 'recuperacao:view', label: 'Visualizar Recuperação', description: 'Ver carrinhos abandonados' },
    { id: 'recuperacao:edit', label: 'Editar Recuperação', description: 'Gerenciar recuperação' },
  ],
  'Solicitações & Reembolsos': [
    { id: 'solicitacoes:create', label: 'Criar Solicitações', description: 'Abrir novas solicitações' },
    { id: 'solicitacoes:approve', label: 'Aprovar Solicitações', description: 'Aprovar ou rejeitar' },
    { id: 'reembolsos:create', label: 'Criar Reembolsos', description: 'Solicitar reembolsos' },
    { id: 'reembolsos:approve', label: 'Aprovar Reembolsos', description: 'Aprovar reembolsos' },
    { id: 'reembolsos:notify_whatsapp', label: 'Notificar WhatsApp', description: 'Enviar notificações' },
  ],
  'Usuários & Configurações': [
    { id: 'usuarios:manage_all', label: 'Gerenciar Todos Usuários', description: 'Criar, editar, deletar qualquer usuário' },
    { id: 'usuarios:manage_atendentes', label: 'Gerenciar Atendentes', description: 'Gerenciar apenas atendentes' },
    { id: 'metas:define', label: 'Definir Metas', description: 'Criar e editar metas' },
    { id: 'relatorios:export', label: 'Exportar Relatórios', description: 'Exportar dados para Excel/PDF' },
    { id: 'settings:view', label: 'Ver Configurações', description: 'Acesso às configurações' },
    { id: 'settings:edit', label: 'Editar Configurações', description: 'Modificar configurações do sistema' },
  ],
} as const;

export type PermissionCategory = keyof typeof PERMISSIONS_BY_CATEGORY;

// Hook para buscar permissões de um usuário específico
export function useUserPermissions(userId: string | null) {
  return useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .rpc('get_user_permissions_rpc', { p_user_id: userId });

      if (error) throw error;

      // Converter para objeto mais fácil de usar
      const permissionsMap: Record<string, { has: boolean; source: string }> = {};
      data?.forEach((p: any) => {
        permissionsMap[p.permission] = { has: p.has_permission, source: p.source };
      });

      return permissionsMap;
    },
    enabled: !!userId,
  });
}

// Hook para atualizar permissões customizadas
export function useUpdateUserPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      permissions,
    }: {
      userId: string;
      permissions: Array<{ permission: string; granted: boolean }>;
    }) => {
      const { data: currentUser } = await supabase.auth.getUser();
      const grantedBy = currentUser.user?.id;

      // Atualizar cada permissão
      for (const { permission, granted } of permissions) {
        const { error } = await supabase.rpc('set_user_permission', {
          p_user_id: userId,
          p_permission: permission,
          p_granted: granted,
          p_granted_by: grantedBy,
        });
        if (error) throw error;
      }

      return { success: true };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', vars.userId] });
      toast.success('Permissões atualizadas com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar permissões: ' + error.message);
    },
  });
}

// Hook para resetar permissões (voltar ao padrão do role)
export function useResetUserPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('reset_user_permissions', {
        p_user_id: userId,
      });
      if (error) throw error;
      return { success: true };
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', userId] });
      toast.success('Permissões resetadas para o padrão do cargo!');
    },
    onError: (error: any) => {
      toast.error('Erro ao resetar permissões: ' + error.message);
    },
  });
}

// Hook para verificar se usuário atual tem uma permissão
export function useCheckPermission(permission: Permission) {
  return useQuery({
    queryKey: ['check-permission', permission],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .rpc('check_user_permission', {
          p_user_id: user.id,
          p_permission: permission,
        });

      if (error) throw error;
      return data || false;
    },
  });
}

// Função auxiliar para obter permissões padrão de cada role
export function getDefaultPermissionsForRole(role: Role): Permission[] {
  switch (role) {
    case 'adm':
      return [
        'dashboard:view', 'dashboard_posvenda:view_all', 'logistics:view', 'logistics:edit',
        'logistics:generate_labels', 'clientes:view', 'clientes:edit', 'pedidos:view', 'pedidos:edit',
        'solicitacoes:create', 'solicitacoes:approve', 'reembolsos:create', 'reembolsos:approve',
        'reembolsos:notify_whatsapp', 'usuarios:manage_all', 'metas:define', 'relatorios:export',
        'settings:view', 'settings:edit', 'estoque:view', 'estoque:edit', 'estoque:add',
        'estoque:adjust', 'estoque:delete', 'estoque:config',
        'crm:view', 'crm:edit', 'crm:config',
        'assinaturas:view', 'assinaturas:edit',
        'recuperacao:view', 'recuperacao:edit',
      ];
    case 'gestor':
      return [
        'dashboard:view', 'dashboard_posvenda:view_all', 'logistics:view', 'logistics:edit',
        'logistics:generate_labels', 'clientes:view', 'clientes:edit', 'pedidos:view', 'pedidos:edit',
        'solicitacoes:create', 'solicitacoes:approve', 'reembolsos:create', 'reembolsos:approve',
        'reembolsos:notify_whatsapp', 'usuarios:manage_atendentes', 'metas:define', 'relatorios:export',
        'settings:view', 'estoque:view', 'estoque:edit', 'estoque:add', 'estoque:adjust',
        'crm:view', 'crm:edit',
        'assinaturas:view', 'assinaturas:edit',
        'recuperacao:view', 'recuperacao:edit',
      ];
    case 'atendente':
      return [
        'dashboard:view', 'dashboard_posvenda:view_own', 'logistics:view', 'clientes:view',
        'clientes:edit', 'pedidos:view', 'pedidos:edit', 'solicitacoes:create', 'reembolsos:create',
        'settings:view', 'estoque:view',
        'crm:view',
      ];
    default:
      return [];
  }
}

// Função para obter label de uma permissão
export function getPermissionLabel(permissionId: string): string {
  for (const category of Object.values(PERMISSIONS_BY_CATEGORY)) {
    const perm = category?.find(p => p.id === permissionId);
    if (perm) return perm.label;
  }
  return permissionId;
}
