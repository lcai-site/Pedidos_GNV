import { useEffect, useState } from 'react';
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

interface AuthState {
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    loading: boolean;
    error: Error | null;
}

export function useAuth() {
    const [state, setState] = useState<AuthState>({
        user: null,
        session: null,
        profile: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        // Safety timeout: force loading to false after 5 seconds
        timeoutId = setTimeout(() => {
            console.warn('⚠️ Auth loading timeout - forcing completion');
            setState(prev => ({ ...prev, loading: false }));
        }, 5000);

        // Buscar sessão inicial
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
                console.error('❌ Error getting session:', error);
                clearTimeout(timeoutId);
                setState(prev => ({ ...prev, error, loading: false }));
                return;
            }

            if (session) {
                console.log('✅ Session found, fetching profile...');
                fetchProfile(session.user.id).finally(() => {
                    clearTimeout(timeoutId);
                });
            } else {
                console.log('ℹ️ No active session');
                clearTimeout(timeoutId);
                setState(prev => ({ ...prev, loading: false }));
            }
        });

        // Listener de mudanças de autenticação
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                console.log('🔄 Auth state changed:', _event);
                if (session) {
                    await fetchProfile(session.user.id);
                } else {
                    setState({
                        user: null,
                        session: null,
                        profile: null,
                        loading: false,
                        error: null,
                    });
                }
            }
        );

        return () => {
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, []);

    async function fetchProfile(userId: string) {
        console.log('🔍 Fetching profile for user:', userId);

        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('❌ Error fetching profile:', error);

                // Se o perfil não existe, criar um perfil padrão temporário
                if (error.code === 'PGRST116') {
                    console.warn('⚠️ Profile not found, using fallback');
                    const { data: { session } } = await supabase.auth.getSession();

                    setState({
                        user: session?.user || null,
                        session: session,
                        profile: {
                            id: userId,
                            email: session?.user?.email || '',
                            nome_completo: null,
                            role: 'usuario' as Role,
                            ativo: true,
                            vendedora_nome: null,
                            meta_mensal: null,
                        },
                        loading: false,
                        error: null,
                    });
                    return;
                }

                throw error;
            }

            console.log('✅ Profile loaded:', profile);

            const { data: { session } } = await supabase.auth.getSession();

            setState({
                user: session?.user || null,
                session: session,
                profile: profile as Profile,
                loading: false,
                error: null,
            });
        } catch (error) {
            console.error('❌ fetchProfile error:', error);

            // SEMPRE setar loading como false, mesmo em erro
            setState(prev => ({
                ...prev,
                error: error as Error,
                loading: false,
            }));
        }
    }

    /**
     * Verifica se o usuário tem uma permissão específica
     */
    function can(permission: Permission): boolean {
        if (!state.profile) return false;
        return hasPermission(state.profile.role, permission);
    }

    /**
     * Verifica se o usuário tem pelo menos uma das permissões
     */
    function canAny(permissions: Permission[]): boolean {
        if (!state.profile) return false;
        return hasAnyPermission(state.profile.role, permissions);
    }

    /**
     * Verifica se o usuário tem uma role específica
     */
    function hasRole(role: Role): boolean {
        return state.profile?.role === role;
    }

    /**
     * Verifica se o usuário é gestor ou ADM
     */
    function isManager(): boolean {
        return state.profile?.role === 'gestor' || state.profile?.role === 'adm';
    }

    /**
     * Verifica se o usuário é ADM
     */
    function isAdmin(): boolean {
        return state.profile?.role === 'adm';
    }

    /**
     * Faz logout
     */
    async function signOut() {
        await supabase.auth.signOut();
    }

    return {
        ...state,
        can,
        canAny,
        hasRole,
        isManager,
        isAdmin,
        signOut,
    };
}
