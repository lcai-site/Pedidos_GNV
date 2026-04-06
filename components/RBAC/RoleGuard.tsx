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
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <div className="text-center p-8">
                    <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-200 mb-2">Acesso Restrito</h2>
                    <p className="text-slate-500 mb-4">
                        Você não tem permissão para acessar esta página.
                    </p>
                    <p className="text-sm text-slate-600">
                        Seu perfil: <span className="text-amber-400 font-medium">{profile.role}</span>
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                        Permissões necessárias: <span className="text-emerald-400">{allowedRoles.join(' ou ')}</span>
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
