import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/hooks/useAuth';
import { Role } from '../../lib/rbac/permissions';
import { Loader2 } from 'lucide-react';

interface RoleGuardProps {
    allowedRoles: Role[];
    redirectTo?: string;
    children: React.ReactNode;
}

/**
 * Componente para proteger rotas baseado em roles
 * Redireciona se o usuário não tiver a role necessária
 * 
 * @example
 * <RoleGuard allowedRoles={['gestor', 'adm']}>
 *   <AdminPage />
 * </RoleGuard>
 */
export function RoleGuard({
    allowedRoles,
    redirectTo = '/',
    children,
}: RoleGuardProps) {
    const { profile, loading } = useAuth();

    // Mostrar loading enquanto carrega
    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <span className="text-slate-500 text-sm">Verificando permissões...</span>
                </div>
            </div>
        );
    }

    // Se não tem perfil, redirecionar para login
    if (!profile) {
        return <Navigate to="/login" replace />;
    }

    // Verificar se a role do usuário está na lista de permitidas
    if (!allowedRoles.includes(profile.role)) {
        return <Navigate to={redirectTo} replace />;
    }

    return <>{children}</>;
}
