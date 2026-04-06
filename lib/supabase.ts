import { createClient } from '@supabase/supabase-js';
import { ENV } from './config/environment';

// Quando rodando localmente (dev server do Vite), usa proxy para evitar CORS.
// Em produção (build), usa a URL direta do Supabase normalmente.
const isLocalDev = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const supabaseUrl = isLocalDev
    ? `${window.location.protocol}//${window.location.host}/supabase-proxy`
    : ENV.supabase.url;

export const supabase = createClient(supabaseUrl, ENV.supabase.anonKey);
