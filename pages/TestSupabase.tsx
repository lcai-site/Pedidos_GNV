/**
 * Página de Diagnóstico de Conexão Supabase
 * Use esta página para verificar se a conexão está funcionando
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ENV } from '../lib/config/environment';
import { CheckCircle, XCircle, AlertTriangle, Database, User, Wifi, RefreshCw, Table } from 'lucide-react';

interface DiagnosticResult {
    test: string;
    status: 'success' | 'error' | 'warning';
    message: string;
    details?: any;
}

export const TestSupabaseConnection: React.FC = () => {
    const [results, setResults] = useState<DiagnosticResult[]>([]);
    const [loading, setLoading] = useState(false);

    const runDiagnostics = async () => {
        setLoading(true);
        setResults([]);
        const newResults: DiagnosticResult[] = [];

        // 1. Verificar variáveis de ambiente
        newResults.push({
            test: '1. Variáveis de Ambiente',
            status: ENV.supabase.url && ENV.supabase.anonKey ? 'success' : 'error',
            message: ENV.supabase.url && ENV.supabase.anonKey
                ? `URL: ${ENV.supabase.url.substring(0, 30)}...`
                : 'VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configuradas!',
            details: {
                url: ENV.supabase.url ? '✅ Configurada' : '❌ Faltando',
                anonKey: ENV.supabase.anonKey ? '✅ Configurada' : '❌ Faltando',
                environment: ENV.environment
            }
        });

        // 2. Verificar sessão de autenticação
        try {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                newResults.push({
                    test: '2. Autenticação',
                    status: 'error',
                    message: `Erro ao verificar sessão: ${error.message}`,
                });
            } else if (session?.user) {
                newResults.push({
                    test: '2. Autenticação',
                    status: 'success',
                    message: `Logado como: ${session.user.email}`,
                    details: {
                        userId: session.user.id,
                        email: session.user.email,
                        role: session.user.role
                    }
                });
            } else {
                newResults.push({
                    test: '2. Autenticação',
                    status: 'warning',
                    message: 'Usuário NÃO está logado. RLS pode bloquear dados.',
                });
            }
        } catch (e: any) {
            newResults.push({
                test: '2. Autenticação',
                status: 'error',
                message: `Exceção: ${e.message}`,
            });
        }

        // 3. Testar conexão básica com tabela pedidos
        try {
            console.log('[Diagnóstico] Testando conexão com tabela pedidos...');
            const { data, error, count } = await supabase
                .from('pedidos')
                .select('id', { count: 'exact' })
                .limit(1);

            if (error) {
                newResults.push({
                    test: '3. Tabela "pedidos"',
                    status: 'error',
                    message: `Erro: ${error.message} (Código: ${error.code})`,
                    details: error
                });
            } else {
                newResults.push({
                    test: '3. Tabela "pedidos"',
                    status: 'success',
                    message: `Conexão OK. Total de registros: ${count ?? 'N/A'}`,
                    details: { primeiroRegistro: data?.[0] }
                });
            }
        } catch (e: any) {
            newResults.push({
                test: '3. Tabela "pedidos"',
                status: 'error',
                message: `Exceção: ${e.message}`,
            });
        }

        // 4. Testar tabela pedidos_unificados
        try {
            console.log('[Diagnóstico] Testando conexão com tabela pedidos_unificados...');
            const { data, error, count } = await supabase
                .from('pedidos_unificados')
                .select('id', { count: 'exact' })
                .limit(1);

            if (error) {
                newResults.push({
                    test: '4. Tabela "pedidos_unificados"',
                    status: 'error',
                    message: `Erro: ${error.message} (Código: ${error.code})`,
                    details: error
                });
            } else {
                newResults.push({
                    test: '4. Tabela "pedidos_unificados"',
                    status: 'success',
                    message: `Conexão OK. Total de registros: ${count ?? 'N/A'}`,
                    details: { primeiroRegistro: data?.[0] }
                });
            }
        } catch (e: any) {
            newResults.push({
                test: '4. Tabela "pedidos_unificados"',
                status: 'error',
                message: `Exceção: ${e.message}`,
            });
        }

        // 5. Testar tabela pedidos_unificados (2)
        try {
            console.log('[Diagnóstico] Testando tabela pedidos_unificados...');
            const { data, error, count } = await supabase
                .from('pedidos_unificados')
                .select('id', { count: 'exact' })
                .limit(1);

            if (error) {
                newResults.push({
                    test: '5. Tabela "pedidos_unificados"',
                    status: 'error',
                    message: `Erro: ${error.message} (Código: ${error.code})`,
                    details: error
                });
            } else {
                newResults.push({
                    test: '5. Tabela "pedidos_unificados"',
                    status: 'success',
                    message: `Conexão OK. Total de registros: ${count ?? 'N/A'}`,
                    details: { primeiroRegistro: data?.[0] }
                });
            }
        } catch (e: any) {
            newResults.push({
                test: '5. Tabela "pedidos_unificados"',
                status: 'error',
                message: `Exceção: ${e.message}`,
            });
        }

        // 6. Testar tabela estoque
        try {
            console.log('[Diagnóstico] Testando conexão com tabela estoque...');
            const { data, error, count } = await supabase
                .from('estoque')
                .select('id', { count: 'exact' })
                .limit(1);

            if (error) {
                newResults.push({
                    test: '6. Tabela "estoque"',
                    status: 'error',
                    message: `Erro: ${error.message} (Código: ${error.code})`,
                    details: error
                });
            } else {
                newResults.push({
                    test: '6. Tabela "estoque"',
                    status: 'success',
                    message: `Conexão OK. Total de registros: ${count ?? 'N/A'}`,
                    details: { primeiroRegistro: data?.[0] }
                });
            }
        } catch (e: any) {
            newResults.push({
                test: '6. Tabela "estoque"',
                status: 'error',
                message: `Exceção: ${e.message}`,
            });
        }

        // 7. Buscar dados reais da tabela pedidos
        try {
            console.log('[Diagnóstico] Buscando 5 pedidos para verificar dados...');
            const { data, error } = await supabase
                .from('pedidos')
                .select('id, codigo_transacao, status, nome_cliente, data_venda')
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) {
                newResults.push({
                    test: '7. Amostra de Pedidos',
                    status: 'error',
                    message: `Erro: ${error.message}`,
                });
            } else if (data && data.length > 0) {
                newResults.push({
                    test: '7. Amostra de Pedidos',
                    status: 'success',
                    message: `${data.length} pedidos encontrados`,
                    details: data
                });
            } else {
                newResults.push({
                    test: '7. Amostra de Pedidos',
                    status: 'warning',
                    message: 'Nenhum pedido retornado (tabela vazia ou RLS bloqueando)',
                });
            }
        } catch (e: any) {
            newResults.push({
                test: '7. Amostra de Pedidos',
                status: 'error',
                message: `Exceção: ${e.message}`,
            });
        }

        setResults(newResults);
        setLoading(false);
    };

    useEffect(() => {
        runDiagnostics();
    }, []);

    const getStatusIcon = (status: DiagnosticResult['status']) => {
        switch (status) {
            case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
            case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
        }
    };

    const getStatusColor = (status: DiagnosticResult['status']) => {
        switch (status) {
            case 'success': return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
            case 'error': return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
            case 'warning': return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
                        <Database className="w-7 h-7 text-blue-500" />
                        Diagnóstico de Conexão Supabase
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Use esta página para verificar se a conexão com o banco de dados está funcionando corretamente.
                    </p>
                </div>
                <button
                    onClick={runDiagnostics}
                    disabled={loading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Testando...' : 'Executar Testes'}
                </button>
            </div>

            <div className="space-y-4">
                {results.map((result, index) => (
                    <div
                        key={index}
                        className={`border rounded-xl p-4 ${getStatusColor(result.status)}`}
                    >
                        <div className="flex items-start gap-3">
                            {getStatusIcon(result.status)}
                            <div className="flex-1">
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                                    {result.test}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                    {result.message}
                                </p>
                                {result.details && (
                                    <details className="mt-3">
                                        <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                                            Ver detalhes
                                        </summary>
                                        <pre className="mt-2 text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded-lg overflow-auto max-h-48">
                                            {JSON.stringify(result.details, null, 2)}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {results.length > 0 && (
                <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                        📋 Resumo
                    </h3>
                    <div className="flex gap-4 text-sm">
                        <span className="text-green-600">
                            ✅ {results.filter(r => r.status === 'success').length} sucesso
                        </span>
                        <span className="text-yellow-600">
                            ⚠️ {results.filter(r => r.status === 'warning').length} alertas
                        </span>
                        <span className="text-red-600">
                            ❌ {results.filter(r => r.status === 'error').length} erros
                        </span>
                    </div>

                    {results.some(r => r.status === 'error') && (
                        <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                            <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                                ⚠️ Possíveis causas dos erros:
                            </p>
                            <ul className="text-xs text-red-600 dark:text-red-400 mt-2 space-y-1 list-disc list-inside">
                                <li>Variáveis de ambiente (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) não configuradas</li>
                                <li>Usuário não está logado e RLS está ativo</li>
                                <li>Tabelas/Views não existem no banco de dados</li>
                                <li>Políticas de RLS bloqueando o acesso anônimo</li>
                            </ul>
                        </div>
                    )}

                    {results.some(r => r.status === 'warning' && r.test.includes('Autenticação')) && (
                        <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                            <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                                ⚠️ Você não está logado!
                            </p>
                            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                O sistema usa RLS (Row Level Security) que bloqueia dados para usuários não autenticados.
                                Faça login para ver os dados.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Alias para compatibilidade com App.tsx
export const TestSupabasePage = TestSupabaseConnection;
