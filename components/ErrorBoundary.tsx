import React, { Component, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '../lib/utils/logger';

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        logger.error('ErrorBoundary caught error', error, {
            module: 'ErrorBoundary',
            componentStack: errorInfo.componentStack,
        });
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-[400px] flex items-center justify-center p-8">
                    <div className="bg-surface border border-border rounded-xl p-8 max-w-md w-full text-center shadow-lg">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                            Algo deu errado
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                            Ocorreu um erro inesperado nesta seção. Tente recarregar ou volte mais tarde.
                        </p>
                        {this.state.error && (
                            <details className="text-left mb-6">
                                <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
                                    Detalhes técnicos
                                </summary>
                                <pre className="mt-2 text-xs text-red-400 bg-slate-900 rounded p-3 overflow-x-auto">
                                    {this.state.error.message}
                                </pre>
                            </details>
                        )}
                        <button
                            onClick={this.handleRetry}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Tentar Novamente
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
