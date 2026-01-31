import * as Sentry from '@sentry/react';

/**
 * Inicializa o Sentry para monitoramento de erros
 * 
 * Configuração:
 * - Apenas ativo em produção
 * - Taxa de amostragem de traces: 10%
 * - Integração com React Error Boundaries
 */
export function initSentry() {
    const dsn = import.meta.env.VITE_SENTRY_DSN;

    // Só inicializa se tiver DSN configurado
    if (!dsn) {
        console.warn('⚠️ Sentry DSN não configurado. Monitoramento desativado.');
        return;
    }

    Sentry.init({
        dsn,
        environment: import.meta.env.MODE, // 'development' ou 'production'

        // Performance Monitoring
        tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

        // Session Replay (opcional - consome cota)
        replaysSessionSampleRate: 0.01,
        replaysOnErrorSampleRate: 0.1,

        // Integrations
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration(),
        ],

        // Filter errors
        beforeSend(event) {
            // Ignora erros de rede comuns
            if (event.exception?.values?.[0]?.type === 'TypeError' &&
                event.exception?.values?.[0]?.value?.includes('fetch')) {
                return null;
            }
            return event;
        },
    });

    console.log('✅ Sentry inicializado');
}

/**
 * Captura erro customizado com contexto adicional
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
    Sentry.captureException(error, {
        extra: context,
    });
}

/**
 * Define contexto do usuário para erros
 */
export function setUserContext(user: { id: string; email: string; name?: string }) {
    Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.name,
    });
}

/**
 * Limpa contexto do usuário (logout)
 */
export function clearUserContext() {
    Sentry.setUser(null);
}

// Re-exporta componentes úteis do Sentry
export { Sentry };
