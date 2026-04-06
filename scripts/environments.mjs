/**
 * Configuração centralizada dos ambientes Supabase.
 * Usado por todos os scripts de deploy, migrate e promote.
 */

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

export const ENVIRONMENTS = {
    staging: {
        name: 'Staging',
        supabaseUrl: 'https://vkeshyusimduiwjaijjv.supabase.co',
        serviceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZXNoeXVzaW1kdWl3amFpamp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzU0NDk3NywiZXhwIjoyMDgzMTIwOTc3fQ.5HGMlM2WMTp9BYxSfPfo0YQQV5oy3ZPTWj0ZNHpZT8c',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZXNoeXVzaW1kdWl3amFpamp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NDQ5NzcsImV4cCI6MjA4MzEyMDk3N30.54dikLQBkzT2dBJzuupaVcK3_vlchWVI08TQ2cxCgJw',
        projectRef: 'vkeshyusimduiwjaijjv',
        managementToken: process.env.SUPABASE_ACCESS_TOKEN || '',
    },
    production: {
        name: 'Produção',
        supabaseUrl: 'https://cgyxinpejaoadsqrxbhy.supabase.co',
        serviceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA',
        projectRef: 'cgyxinpejaoadsqrxbhy',
        managementToken: process.env.SUPABASE_ACCESS_TOKEN || '',
    },
};

export function getEnv(name) {
    const env = ENVIRONMENTS[name];
    if (!env) {
        console.error(`❌ Ambiente inválido: "${name}". Use "staging" ou "production".`);
        process.exit(1);
    }
    return env;
}
