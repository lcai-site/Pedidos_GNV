/**
 * Logger - Sistema de Logging Centralizado
 *
 * Sistema de logging com níveis, formatação e controle por ambiente.
 * - Em desenvolvimento: logs completos no console
 * - Em produção: apenas erros, com envio para Sentry
 *
 * @example
 * logger.debug('Detalhe', { data })
 * logger.info('Mensagem informativa')
 * logger.warn('Aviso importante')
 * logger.error('Erro crítico', error)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
    module?: string;      // Ex: 'CRM', 'Logistics', 'Auth'
    service?: string;     // Ex: 'melhorEnvioService', 'useCRM'
    action?: string;      // Ex: 'fetchLeads', 'calculateShipping'
    [key: string]: unknown;
}

class Logger {
    private enabled: boolean;
    private minLevel: LogLevel;
    private readonly levelPriority: Record<LogLevel, number>;

    constructor() {
        this.enabled = import.meta.env.VITE_ENABLE_DEBUG === 'true' || 
                      import.meta.env.VITE_ENVIRONMENT === 'development';
        
        this.minLevel = this.enabled ? 'debug' : 'warn';
        
        this.levelPriority = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
        };
    }

    private shouldLog(level: LogLevel): boolean {
        return this.levelPriority[level] >= this.levelPriority[this.minLevel];
    }

    private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
    }

    private sendToSentry(error: unknown, context?: LogContext) {
        // Integração com Sentry (se disponível)
        if (typeof window !== 'undefined' && (window as any).Sentry) {
            const sentry = (window as any).Sentry;
            
            if (error instanceof Error) {
                sentry.captureException(error, {
                    tags: {
                        level: 'error',
                        module: context?.module,
                        service: context?.service,
                        action: context?.action,
                    },
                });
            } else {
                sentry.captureMessage(String(error), {
                    level: 'error',
                    tags: {
                        module: context?.module,
                        service: context?.service,
                        action: context?.action,
                    },
                });
            }
        }
    }

    debug(message: string, context?: LogContext | unknown) {
        if (!this.shouldLog('debug')) return;
        
        const ctx = typeof context === 'object' ? context as LogContext : { extra: context };
        console.debug(this.formatMessage('debug', message, ctx));
    }

    info(message: string, context?: LogContext | unknown) {
        if (!this.shouldLog('info')) return;
        
        const ctx = typeof context === 'object' ? context as LogContext : { extra: context };
        console.info(this.formatMessage('info', message, ctx));
    }

    warn(message: string, context?: LogContext | unknown) {
        if (!this.shouldLog('warn')) return;
        
        const ctx = typeof context === 'object' ? context as LogContext : { extra: context };
        console.warn(this.formatMessage('warn', message, ctx));
    }

    error(message: string, error?: unknown, context?: LogContext) {
        const ctx = typeof context === 'object' ? context as LogContext : { extra: context };
        const fullMessage = this.formatMessage('error', message, ctx);
        
        // Sempre loga erros no console
        console.error(fullMessage, error || '');
        
        // Em produção, envia para Sentry
        if (!this.enabled) {
            this.sendToSentry(error || message, ctx);
        }
    }

    /**
     * Log de erro de API com tratamento especial
     */
    apiError(service: string, action: string, error: unknown, context?: Record<string, unknown>) {
        this.error(`[API Error] ${service}.${action}`, error, {
            module: 'API',
            service,
            action,
            ...context,
        });
    }

    /**
     * Log de fluxo de negócio (apenas em dev)
     */
    flow(service: string, action: string, data?: unknown) {
        if (!this.enabled) return;
        
        this.debug(`[Flow] ${service}.${action}`, {
            service,
            action,
            data,
        });
    }
}

// Instância singleton
export const logger = new Logger();

/**
 * Helpers para migração rápida (DEPRECATED - usar logger diretamente)
 * Mantidos temporariamente para facilitar migração
 */
export const devLog = (...args: any[]) => {
    if (import.meta.env.VITE_ENVIRONMENT === 'development' || import.meta.env.VITE_ENABLE_DEBUG === 'true') {
        logger.info(args.join(' '), { legacy: true });
    }
};

export const errorLog = (...args: any[]) => {
    logger.error(args.join(' '), { legacy: true });
};
