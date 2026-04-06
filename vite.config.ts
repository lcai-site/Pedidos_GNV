import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Detecta URL do Supabase para o proxy dinâmico
  const supabaseUrl = env.VITE_SUPABASE_URL || '';
  const supabaseHost = supabaseUrl.replace('https://', '').replace('http://', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        // Proxy dinâmico do Supabase — resolve CORS ao rodar dev:prod no localhost
        '/supabase-proxy': {
          target: supabaseUrl,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/supabase-proxy/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (supabaseHost) proxyReq.setHeader('Host', supabaseHost);
            });
          },
        },
        '/api/melhor-envio': {
          target: 'https://melhorenvio.com.br/api/v2',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/melhor-envio/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Accept', 'application/json');
              proxyReq.setHeader('Content-Type', 'application/json');
            });
          }
        },
        '/api/openrouter': {
          target: 'https://openrouter.ai/api/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/openrouter/, '')
        }
      }
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@core': path.resolve(__dirname, './src/core'),
        '@modules': path.resolve(__dirname, './src/modules')
      }
    }
  };
});

