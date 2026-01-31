import { createClient } from '@supabase/supabase-js';
import { ENV } from './config/environment';

// Cliente Supabase configurado via variáveis de ambiente
// Suporta múltiplos ambientes: development (staging) e production
export const supabase = createClient(
    ENV.supabase.url,
    ENV.supabase.anonKey
);

