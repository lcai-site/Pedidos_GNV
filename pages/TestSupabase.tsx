import React, { useEffect } from 'react';
import { useAuth } from '../lib/hooks/useAuth';

export const TestSupabasePage: React.FC = () => {
    const auth = useAuth();

    useEffect(() => {
        console.log('🔍 Auth Debug:', {
            user: auth.user,
            session: auth.session,
            profile: auth.profile,
            loading: auth.loading,
            error: auth.error
        });
    }, [auth]);

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">🔍 Debug de Autenticação</h1>

            <div className="space-y-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
                    <h2 className="font-semibold mb-2">Status de Loading:</h2>
                    <p className={auth.loading ? 'text-yellow-600' : 'text-green-600'}>
                        {auth.loading ? '⏳ Carregando...' : '✅ Carregado'}
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
                    <h2 className="font-semibold mb-2">Usuário:</h2>
                    <pre className="text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded overflow-auto">
                        {JSON.stringify(auth.user, null, 2)}
                    </pre>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
                    <h2 className="font-semibold mb-2">Perfil:</h2>
                    <pre className="text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded overflow-auto">
                        {JSON.stringify(auth.profile, null, 2)}
                    </pre>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
                    <h2 className="font-semibold mb-2">Permissões:</h2>
                    <div className="space-y-2">
                        <p>✅ solicitacoes:create: {auth.can('solicitacoes:create') ? 'SIM' : 'NÃO'}</p>
                        <p>✅ solicitacoes:approve: {auth.can('solicitacoes:approve') ? 'SIM' : 'NÃO'}</p>
                        <p>✅ dashboard:view: {auth.can('dashboard:view') ? 'SIM' : 'NÃO'}</p>
                    </div>
                </div>

                {auth.error && (
                    <div className="bg-red-100 dark:bg-red-900/20 p-4 rounded-lg border border-red-500">
                        <h2 className="font-semibold mb-2 text-red-700 dark:text-red-400">Erro:</h2>
                        <pre className="text-xs text-red-600 dark:text-red-300">
                            {JSON.stringify(auth.error, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
};
