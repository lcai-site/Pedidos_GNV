import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../supabase';
import { User, Session } from '@supabase/supabase-js';
import { Role, Permission, hasPermission, hasAnyPermission } from '../rbac/permissions';

interface Profile {
    id: string;
    email: string;
    nome_completo: string | null;
    role: Role;
    ativo: boolean;
    vendedora_nome: string | null;
    meta_mensal: number | null;
}

interface AuthContextData {
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    permissions: Record<string, boolean>; // Permission -> hasAccess (true/false)
    loading: boolean;
    error: Error | null;
    can: (permission: Permission) => boolean;
    canAny: (permissions: Permission[]) => boolean;
    hasRole: (role: Role) => boolean;
    isManager: () => boolean;
    isAdmin: () => boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchProfile = useCallback(async (userId: string, currentSession: Session | null) => {
        try {
            // 1. Buscar Perfil (Base)
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (profileError) throw profileError;

            if (profileData) {
                // Usuário inativo — bloquear acesso e sair
                if (!profileData.ativo) {
                    await supabase.auth.signOut();
                    setUser(null);
                    setSession(null);
                    setProfile(null);
                    setPermissions({});
                    setError(new Error('Conta aguardando aprovação do administrador.'));
                    setLoading(false);
                    return;
                }

                // 2. Buscar Permissões Efetivas (Role + Customizações)
                const { data: permData, error: permError } = await supabase
                    .rpc('get_user_permissions_rpc', { p_user_id: userId });

                if (permError) {
                    console.error('Erro ao carregar permissões rpc:', permError);
                }

                const permMap: Record<string, boolean> = {};
                // Se o rpc falhar ou retornar vazio, usamos o role-based estático como fallback
                if (permData && permData.length > 0) {
                    permData.forEach((p: any) => {
                        permMap[p.permission] = p.has_permission;
                    });
                } else {
                    // Fallback estático baseado no arquivo permissions.ts
                    const { ROLE_PERMISSIONS } = await import('../rbac/permissions');
                    const defaultPerms = ROLE_PERMISSIONS[profileData.role as Role] || [];
                    defaultPerms.forEach(p => permMap[p] = true);
                }

                setUser(currentSession?.user || null);
                setSession(currentSession);
                setProfile(profileData as Profile);
                setPermissions(permMap);
                setError(null);
            } else {
                // Perfil não existe — conta criada no Auth mas não aprovada
                await supabase.auth.signOut();
                setUser(null);
                setSession(null);
                setProfile(null);
                setPermissions({});
                setError(new Error('Conta aguardando aprovação do administrador.'));
            }
        } catch (err) {
            // Erro de rede ou RLS — não dar acesso, mas não forcçar logout
            // (pode ser falha temporária, não recusa de conta)
            const sess = currentSession || (await supabase.auth.getSession()).data.session;
            setUser(sess?.user || null);
            setSession(sess);
            const fallbackRole: Role = 'atendente';
            setProfile({
                id: userId,
                email: sess?.user?.email || '',
                nome_completo: 'Usuário (Sem Conexão)',
                role: fallbackRole,
                ativo: false, // Bloqueado por segurança até confirmar com banco
                vendedora_nome: null,
                meta_mensal: null,
            });
            // No modo offline sem permissões no banco, bloqueamos por segurança (ativo=false)
            setPermissions({});
            setError(new Error('Falha ao carregar perfil. Verifique sua conexão.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        timeoutId = setTimeout(() => {
            setLoading(false);
        }, 10000);

        supabase.auth.getSession().then(({ data: { session: sess }, error: sessError }) => {
            if (sessError) {
                clearTimeout(timeoutId);
                setError(sessError);
                setLoading(false);
                return;
            }

            if (sess) {
                fetchProfile(sess.user.id, sess).then(() => clearTimeout(timeoutId));
            } else {
                clearTimeout(timeoutId);
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, sess) => {
                // NÃO usar async aqui - causa comportamento indefinido no Supabase
                // Usar then() em vez de await
                if (sess) {
                    fetchProfile(sess.user.id, sess).catch(() => {
                        setLoading(false);
                    });
                } else {
                    setUser(null);
                    setSession(null);
                    setProfile(null);
                    setLoading(false);
                    setError(null);
                }
            }
        );

        return () => {
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, [fetchProfile]);

    const can = useCallback((permission: Permission): boolean => {
        if (!profile) return false;
        
        // 1. ADM tem acesso irrestrito (Poder absoluto do cargo)
        if (profile.role === 'adm') return true;
        
        // 2. Tentar mapa dinâmico de permissões efetivas do banco (Role + Customizações)
        // Se a permissão estiver explicitamente no mapa (true ou false), respeitamos o banco.
        if (permissions && typeof permissions[permission] === 'boolean') {
            return permissions[permission];
        }
        
        // 3. Segurança Crítica: Se o mapa existe mas a chave não foi encontrada,
        // consideramos negado se o perfil for customizado, para evitar "vazamentos".
        // Só recorremos ao fallback estático se o mapa estiver vazio (ex: falha de carregamento ou modo offline)
        if (permissions && Object.keys(permissions).length > 0) {
            return false;
        }
        
        // 4. Fallback estático (Apenas para garantir funcionamento em falhas de conexão temporárias)
        return hasPermission(profile.role, permission);
    }, [profile, permissions]);

    const canAny = useCallback((permissionsToCheck: Permission[]): boolean => {
        if (!profile) return false;
        if (profile.role === 'adm') return true;
        return permissionsToCheck.some(p => can(p));
    }, [profile, can]);

    const hasRoleFn = useCallback((role: Role): boolean => {
        return profile?.role === role;
    }, [profile]);

    const isManager = useCallback((): boolean => {
        return profile?.role === 'gestor' || profile?.role === 'adm';
    }, [profile]);

    const isAdmin = useCallback((): boolean => {
        return profile?.role === 'adm';
    }, [profile]);

    const signOutFn = useCallback(async () => {
        await supabase.auth.signOut();
    }, []);

    const value = useMemo(() => ({
        user,
        session,
        profile,
        permissions,
        loading,
        error,
        can,
        canAny,
        hasRole: hasRoleFn,
        isManager,
        isAdmin,
        signOut: signOutFn,
    }), [user, session, profile, permissions, loading, error, can, canAny, hasRoleFn, isManager, isAdmin, signOutFn]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context || Object.keys(context).length === 0) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
