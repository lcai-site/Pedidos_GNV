/**
 * Componente de Status de Conexão Supabase
 * Exibe informações de debug sobre a conexão e autenticação
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Wifi, WifiOff, User, Database, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface ConnectionStatus {
    isConnected: boolean;
    isAuthenticated: boolean;
    userEmail?: string;
    userRole?: string;
    tableCounts: Record<string, number | 'error'>;
    lastCheck: Date;
    errors: string[];
}

export const SupabaseStatus: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
    const [status, setStatus] = useState<ConnectionStatus>({
        isConnected: false,
        isAuthenticated: false,
        tableCounts: {},
        lastCheck: new Date(),
        errors: []
    });
    const [checking, setChecking] = useState(false);

    const checkStatus = async () => {
        setChecking(true);
        const errors: string[] = [];
        const tableCounts: Record<string, number | 'error'> = {};

        try {
            // 1. Verificar sessão/autenticação
            const { data: { session }, error: authError } = await supabase.auth.getSession();

            if (authError) {
                errors.push(`Auth: ${authError.message}`);
            }

            const isAuthenticated = !!session?.user;
            const userEmail = session?.user?.email;

            // 2. Buscar role do usuário
            let userRole = 'Desconhecido';
            if (isAuthenticated && session?.user?.id) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();

                userRole = profile?.role || 'sem perfil';
            }

            // 3. Testar acesso às tabelas principais
            const tables = ['pedidos', 'pedidos_unificados', 'pedidos_consolidados_v3', 'estoque'];

            for (const table of tables) {
                try {
                    const { count, error } = await supabase
                        .from(table)
                        .select('*', { count: 'exact', head: true });

                    if (error) {
                        tableCounts[table] = 'error';
                        errors.push(`${table}: ${error.message}`);
                    } else {
                        tableCounts[table] = count || 0;
                    }
                } catch (e: any) {
                    tableCounts[table] = 'error';
                    errors.push(`${table}: ${e.message}`);
                }
            }

            setStatus({
                isConnected: true,
                isAuthenticated,
                userEmail,
                userRole,
                tableCounts,
                lastCheck: new Date(),
                errors
            });

        } catch (e: any) {
            setStatus(prev => ({
                ...prev,
                isConnected: false,
                errors: [`Conexão falhou: ${e.message}`],
                lastCheck: new Date()
            }));
        } finally {
            setChecking(false);
        }
    };

    useEffect(() => {
        checkStatus();

        // Re-check a cada 30s
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    if (compact) {
        // Versão compacta para o header
        return (
            <div className="flex items-center gap-2">
                {status.isConnected ? (
                    <Wifi className="w-4 h-4 text-green-500" />
                ) : (
                    <WifiOff className="w-4 h-4 text-red-500" />
                )}
                {status.isAuthenticated ? (
                    <User className="w-4 h-4 text-blue-500" />
                ) : (
                    <User className="w-4 h-4 text-slate-400" />
                )}
                {status.errors.length > 0 && (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                )}
            </div>
        );
    }

    // Versão completa (painel de debug)
    return (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Status Supabase
                </h3>
                <button
                    onClick={checkStatus}
                    disabled={checking}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Conexão */}
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                    {status.isConnected ? (
                        <>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-green-600 dark:text-green-400">Conectado</span>
                        </>
                    ) : (
                        <>
                            <WifiOff className="w-4 h-4 text-red-500" />
                            <span className="text-red-600 dark:text-red-400">Desconectado</span>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {status.isAuthenticated ? (
                        <>
                            <User className="w-4 h-4 text-blue-500" />
                            <span className="text-blue-600 dark:text-blue-400 truncate" title={status.userEmail}>
                                {status.userRole} ({status.userEmail?.split('@')[0]})
                            </span>
                        </>
                    ) : (
                        <>
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-500">Não autenticado</span>
                        </>
                    )}
                </div>
            </div>

            {/* Contagem de Tabelas */}
            <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase">Tabelas</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(status.tableCounts).map(([table, count]) => (
                        <div key={table} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 px-2 py-1.5 rounded">
                            <span className="text-slate-600 dark:text-slate-400">{table}</span>
                            {count === 'error' ? (
                                <span className="text-red-500 font-medium">ERRO</span>
                            ) : (
                                <span className="text-slate-900 dark:text-slate-100 font-medium">{count}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Erros */}
            {status.errors.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs font-medium text-red-500 uppercase flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Erros ({status.errors.length})
                    </p>
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2 max-h-32 overflow-auto">
                        {status.errors.map((err, i) => (
                            <p key={i} className="text-xs text-red-600 dark:text-red-400">{err}</p>
                        ))}
                    </div>
                </div>
            )}

            <p className="text-[10px] text-slate-400">
                Última verificação: {status.lastCheck.toLocaleTimeString()}
            </p>
        </div>
    );
};
