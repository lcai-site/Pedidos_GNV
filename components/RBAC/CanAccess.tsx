import React from 'react';
import { useAuth } from '../../lib/hooks/useAuth';
import { Permission } from '../../lib/rbac/permissions';

interface CanAccessProps {
    permission?: Permission;
    permissions?: Permission[];
    requireAll?: boolean;
    fallback?: React.ReactNode;
    children: React.ReactNode;
}

/**
 * Componente para controle de acesso baseado em permissões
 * 
 * @example
 * // Verificar uma permissão
 * <CanAccess permission="solicitacoes:approve">
 *   <button>Aprovar</button>
 * </CanAccess>
 * 
 * @example
 * // Verificar múltiplas permissões (qualquer uma)
 * <CanAccess permissions={['gestor', 'adm']}>
 *   <AdminPanel />
 * </CanAccess>
 * 
 * @example
 * // Verificar múltiplas permissões (todas)
 * <CanAccess permissions={['edit', 'delete']} requireAll>
 *   <button>Editar e Deletar</button>
 * </CanAccess>
 */
export function CanAccess({
    permission,
    permissions,
    requireAll = false,
    fallback = null,
    children,
}: CanAccessProps) {
    const { can, canAny, profile } = useAuth();

    // Se não tem perfil carregado, não mostrar nada
    if (!profile) {
        return <>{fallback}</>;
    }

    // Verificar permissão única
    if (permission) {
        if (!can(permission)) {
            return <>{fallback}</>;
        }
    }

    // Verificar múltiplas permissões
    if (permissions && permissions.length > 0) {
        if (requireAll) {
            // Verificar se tem TODAS as permissões
            const hasAll = permissions.every(p => can(p));
            if (!hasAll) {
                return <>{fallback}</>;
            }
        } else {
            // Verificar se tem PELO MENOS UMA permissão
            if (!canAny(permissions)) {
                return <>{fallback}</>;
            }
        }
    }

    return <>{children}</>;
}
