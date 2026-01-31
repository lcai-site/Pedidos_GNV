/**
 * Configuração de Ambiente
 * 
 * Este arquivo centraliza todas as configurações de ambiente da aplicação.
 * Suporta múltiplos ambientes: development, production
 */

export const ENV = {
    // Identificação do ambiente
    isDevelopment: import.meta.env.VITE_ENVIRONMENT === 'development',
    isProduction: import.meta.env.VITE_ENVIRONMENT === 'production',
    environment: import.meta.env.VITE_ENVIRONMENT || 'development',

    // Configurações Supabase
    supabase: {
        url: import.meta.env.VITE_SUPABASE_URL || '',
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    },

    // APIs Externas
    apis: {
        melhorEnvio: {
            token: import.meta.env.VITE_MELHOR_ENVIO_TOKEN || '',
            userAgent: import.meta.env.VITE_MELHOR_ENVIO_USER_AGENT || '',
            baseUrl: import.meta.env.VITE_ENVIRONMENT === 'development'
                ? 'https://sandbox.melhorenvio.com.br/api/v2'
                : 'https://melhorenvio.com.br/api/v2',
        },
        gemini: {
            apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
        },
        openRouter: {
            apiKey: import.meta.env.VITE_OPEN_ROUTER_API_KEY || '',
            model: import.meta.env.VITE_OPEN_ROUTER_MODEL || 'nvidia/nemotron-3-nano-30b-a3b:free',
        },
    },

    // Feature Flags
    features: {
        enableDebug: import.meta.env.VITE_ENABLE_DEBUG === 'true',
        mockAPIs: import.meta.env.VITE_MOCK_APIS === 'true',
        enableAIAnalysis: import.meta.env.VITE_ENVIRONMENT === 'production',
    },
};

/**
 * Helper para logs apenas em desenvolvimento
 */
export const devLog = (...args: any[]) => {
    if (ENV.isDevelopment || ENV.features.enableDebug) {
        console.log('[DEV]', ...args);
    }
};

/**
 * Helper para logs de erro
 */
export const errorLog = (...args: any[]) => {
    console.error('[ERROR]', ...args);
};

/**
 * Validação de configuração obrigatória
 */
export function validateEnvironment(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!ENV.supabase.url) {
        errors.push('VITE_SUPABASE_URL não está configurada');
    }

    if (!ENV.supabase.anonKey) {
        errors.push('VITE_SUPABASE_ANON_KEY não está configurada');
    }

    if (!ENV.environment) {
        errors.push('VITE_ENVIRONMENT não está configurada');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Exibe informações do ambiente no console (apenas em dev)
 */
export function logEnvironmentInfo() {
    if (ENV.isDevelopment) {
        console.log('🌍 Ambiente:', ENV.environment);
        console.log('🔧 Debug:', ENV.features.enableDebug);
        console.log('🧪 Mock APIs:', ENV.features.mockAPIs);
        console.log('🔌 Supabase URL:', ENV.supabase.url);
    }
}
