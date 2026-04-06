import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const MEUSCORREIOS_TOKEN = Deno.env.get('MEUSCORREIOS_TOKEN') || 'Dp4GDpoF03LVIkuIWOJ4Tl4prxeCbArIZ/+Tf60D4Ho=';

serve(async (req) => {
    const origin = req.headers.get('Origin') || '*';
    const corsHeaders = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'OPTIONS, POST',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const { codigoRastreio } = await req.json();

        if (!codigoRastreio || typeof codigoRastreio !== 'string') {
            throw new Error('codigoRastreio é obrigatório.');
        }

        // Códigos que começam com "CORREIOS-" são fallbacks locais — nada a cancelar nos Correios
        if (codigoRastreio.startsWith('CORREIOS-')) {
            return new Response(JSON.stringify({
                success: true,
                message: 'Código local (fallback) — nenhum cancelamento necessário nos Correios.',
                skipped: true
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        console.log(`[correios-cancel] Cancelando pré-postagem: ${codigoRastreio}`);

        // Endpoint de cancelamento do MeusCorreios
        const cancelPayload = {
            parmIn: {
                Token: MEUSCORREIOS_TOKEN,
                prepos: [
                    { etqCod: codigoRastreio }
                ]
            }
        };

        const cancelResp = await fetch('http://meuscorreios.app/rest/apimcccancelaprepos', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Authorization': MEUSCORREIOS_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cancelPayload),
            signal: AbortSignal.timeout(7000)
        });

        const cancelText = await cancelResp.text();
        console.log(`[correios-cancel] HTTP ${cancelResp.status} | Response: ${cancelText.substring(0, 300)}`);

        let cancelData: any = {};
        try { cancelData = JSON.parse(cancelText); } catch (_) { /* texto puro */ }

        // Verifica erro explícito do MeusCorreios
        if (cancelData?.parmOut?.erro && cancelData.parmOut.erro !== '') {
            throw new Error(`MeusCorreios recusou o cancelamento: ${cancelData.parmOut.erro}`);
        }

        if (!cancelResp.ok && cancelResp.status >= 500) {
            throw new Error(`Erro no servidor MeusCorreios: HTTP ${cancelResp.status}`);
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Pré-postagem ${codigoRastreio} cancelada com sucesso.`,
            raw: cancelData
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

    } catch (err: any) {
        console.error('[correios-cancel] Erro:', err.message);
        return new Response(JSON.stringify({
            success: false,
            error: err.message
        }), { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, status: 200 });
    }
});
