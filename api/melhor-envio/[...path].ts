// Vercel Serverless Function - Proxy para API Melhor Envio
// Isso resolve o problema de CORS em produção

export const config = {
    runtime: 'edge',
};

const MELHOR_ENVIO_API = 'https://melhorenvio.com.br/api/v2';

export default async function handler(request: Request) {
    // Pegar o path da URL
    const url = new URL(request.url);
    const pathname = url.pathname.replace('/api/melhor-envio', '');

    // Headers para a API Melhor Envio
    const headers: HeadersInit = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
        'User-Agent': request.headers.get('User-Agent') || 'GNV-App/1.0',
    };

    try {
        // Construir URL de destino
        const targetUrl = `${MELHOR_ENVIO_API}${pathname}${url.search}`;

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
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, User-Agent',
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
