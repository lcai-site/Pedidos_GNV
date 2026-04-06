import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Tratamento do preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Para iniciar uma GitHub Action de forma segura, usamos um Personal Access Token (PAT)
        const GITHUB_TOKEN = Deno.env.get('GITHUB_PAT')
        if (!GITHUB_TOKEN) {
            throw new Error("Chave GITHUB_PAT ausente nos secrets do Supabase.")
        }

        // Dispara o arquivo workflow ".github/workflows/sync-staging.yml"
        const response = await fetch('https://api.github.com/repos/lcai-site/Pedidos_GNV/actions/workflows/sync-staging.yml/dispatches', {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ref: 'main',
                inputs: {
                    reason: 'Disparado manualmente via botão na UI de Configurações (Staging)'
                }
            })
        })

        if (!response.ok) {
            const text = await response.text();
            console.error("Github Api Error:", text);
            throw new Error(`Erro na API do GitHub: ${response.status} - ${text}`)
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'A sincronização com a Produção foi iniciada em segundo plano! Demora cerca de 1 minuto.'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error("Sync Error:", error.message);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    }
})
