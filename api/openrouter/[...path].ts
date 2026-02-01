// Vercel Serverless Function - Proxy para API OpenRouter (IA)
// Isso resolve o problema de CORS em produção

export const config = {
    runtime: 'edge',
};

const OPENROUTER_API = 'https://openrouter.ai/api/v1';

export default async function handler(request: Request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }

    // Pegar o path da URL
    const url = new URL(request.url);
    const pathname = url.pathname.replace('/api/openrouter', '');

    // Headers para a API OpenRouter
    const headers: HeadersInit = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
        'HTTP-Referer': 'https://pedidos-gnv.vercel.app',
        'X-Title': 'GNV Pedidos',
    };

    try {
        // Construir URL de destino
        const targetUrl = `${OPENROUTER_API}${pathname}${url.search}`;

        // Fazer a requisição
        const response = await fetch(targetUrl, {
            method: request.method,
            headers,
            body: request.method !== 'GET' ? await request.text() : undefined,
        });

        // Retornar resposta
        const data = await response.text();

        return new Response(data, {
            status: response.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });

    } catch (error: any) {
        console.error('Proxy error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            }
        );
    }
}
