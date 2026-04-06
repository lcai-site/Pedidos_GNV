import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const CORREIOS_BASIC_AUTH = Deno.env.get('CORREIOS_BASIC_AUTH') || '';
const MELHOR_ENVIO_TOKEN = Deno.env.get('MELHOR_ENVIO_TOKEN') || '';
const MELHOR_ENVIO_USER_AGENT = Deno.env.get('MELHOR_ENVIO_USER_AGENT') || 'GnutraVita/1.0 (camila@gnutravita.com.br)';

// Mapeamento Correios (SRO)
const CORREIOS_STATUS_MAP: Record<string, string> = {
    'FC': 'Etiqueta emitida',
    'PO': 'Postado',
    'RO': 'Em trânsito',
    'DO': 'Em trânsito',
    'OEC': 'Saiu para entrega',
    'BDE': 'Entregue',
    'BDI': 'Tentativa de entrega',
    'EAR': 'Devolvido ao remetente',
    'RBO': 'Devolvido ao remetente',
    'LDI': 'Em distribuição',
};

// Mapeamento Melhor Envio
const ME_STATUS_MAP: Record<string, string> = {
    'pending': 'Pendente',
    'released': 'Etiqueta emitida',
    'posted': 'Postado',
    'delivered': 'Entregue',
    'canceled': 'Cancelado',
    'undelivered': 'Não entregue',
    'draft': 'Rascunho',
    'dispatched': 'Em trânsito',
    'picked_up': 'Coletado',
};

serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // 1. Buscar todos os pedidos para rastrear (Correios Nativo ou Melhor Envio)
        const { data: pedidos, error: dbError } = await supabase
            .from('pedidos_consolidados_v3')
            .select('id, codigo_rastreio, status_rastreio, data_postagem, logistica_provider, melhor_envio_id')
            .not('codigo_rastreio', 'is', null)
            .not('codigo_rastreio', 'like', 'CORREIOS-%') // Exclui fallbacks
            .not('status_rastreio', 'in', '("Entregue","Devolvido ao remetente","Cancelado")')
            .in('logistica_provider', ['Correios Nativo', 'Melhor Envio']);

        if (dbError) throw new Error(`Erro DB: ${dbError.message}`);
        if (!pedidos || pedidos.length === 0) {
            return new Response(JSON.stringify({ success: true, message: 'Nada para rastrear.', total: 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
            });
        }

        const pedidosCorreios = pedidos.filter(p => p.logistica_provider === 'Correios Nativo');
        const pedidosME = pedidos.filter(p => p.logistica_provider === 'Melhor Envio');

        let atualizadosTotal = 0;
        let postadosAutoTotal = 0;

        // --- PARTE A: CORREIOS NATIVO ---
        if (pedidosCorreios.length > 0) {
            console.log(`[sync] Rastreiando ${pedidosCorreios.length} Correios Nativo...`);
            try {
                const tokenResp = await fetch('https://api.correios.com.br/token/v1/autentica/cartaopostagem', {
                    method: 'POST',
                    headers: { 'Authorization': `Basic ${CORREIOS_BASIC_AUTH}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ numero: '0079253997' })
                });
                const tokenData = await tokenResp.json();
                const bearerToken = tokenData.token;

                if (bearerToken) {
                    for (let i = 0; i < pedidosCorreios.length; i += 50) {
                        const lote = pedidosCorreios.slice(i, i + 50);
                        const sroResp = await fetch('https://api.correios.com.br/sro/v1/objetos', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${bearerToken}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ codigosObjetos: lote.map(p => p.codigo_rastreio) })
                        });
                        const sroData = await sroResp.json();
                        for (const obj of (sroData.objetos || [])) {
                            const eventos = obj.eventos || [];
                            if (eventos.length === 0) continue;
                            const u = eventos[0];
                            const pedido = lote.find(p => p.codigo_rastreio === obj.codObjeto);
                            if (!pedido) continue;

                            const statusLegivel = CORREIOS_STATUS_MAP[u.codigo] || u.descricao;
                            const update: any = {
                                status_rastreio: statusLegivel,
                                ultimo_evento_correios: u.descricao,
                                data_ultimo_evento: u.dtHrCriado
                            };
                            if (u.codigo === 'PO' && !pedido.data_postagem) { update.data_postagem = u.dtHrCriado; postadosAutoTotal++; }
                            if (u.codigo === 'BDE') update.data_entrega = u.dtHrCriado;

                            await supabase.from('pedidos_consolidados_v3').update(update).eq('id', pedido.id);
                            atualizadosTotal++;
                        }
                    }
                }
            } catch (e) { console.error('[sync] Erro Correios:', e.message); }
        }

        // --- PARTE B: MELHOR ENVIO ---
        if (pedidosME.length > 0) {
            console.log(`[sync] Rastreiando ${pedidosME.length} Melhor Envio...`);
            try {
                // Melhor Envio Tracking V2 aceita até 20 ordens por vez
                for (let i = 0; i < pedidosME.length; i += 20) {
                    const lote = pedidosME.slice(i, i + 20);
                    const orders = lote.map(p => p.melhor_envio_id).filter(Boolean);

                    const meResp = await fetch('https://www.melhorenvio.com.br/api/v2/me/shipment/tracking', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${MELHOR_ENVIO_TOKEN}`,
                            'User-Agent': MELHOR_ENVIO_USER_AGENT
                        },
                        body: JSON.stringify({ orders })
                    });

                    if (meResp.ok) {
                        const trackingData = await meResp.json(); // Objeto onde chaves são IDs das etiquetas
                        for (const labelId in trackingData) {
                            const info = trackingData[labelId];
                            const pedido = lote.find(p => p.melhor_envio_id === labelId);
                            if (!pedido) continue;

                            // Status do Melhor Envio
                            const statusME = info.status; // pending, released, posted, delivered, canceled, undelivered
                            const statusLegivel = ME_STATUS_MAP[statusME] || statusME;

                            const update: any = {
                                status_rastreio: statusLegivel,
                                ultimo_evento_correios: info.tracking || statusLegivel, // Usamos como genérico
                                data_ultimo_evento: info.posted_at || info.delivered_at || new Date().toISOString()
                            };

                            // Auto-postagem ME
                            if ((statusME === 'posted' || statusME === 'dispatched') && !pedido.data_postagem) {
                                update.data_postagem = info.posted_at || new Date().toISOString();
                                postadosAutoTotal++;
                            }
                            if (statusME === 'delivered') update.data_entrega = info.delivered_at;

                            await supabase.from('pedidos_consolidados_v3').update(update).eq('id', pedido.id);
                            atualizadosTotal++;
                        }
                    } else {
                        console.error(`[sync] ME Lote falhou: HTTP ${meResp.status}`);
                    }
                }
            } catch (e) { console.error('[sync] Erro ME:', e.message); }
        }

        return new Response(JSON.stringify({
            success: true,
            atualizados: atualizadosTotal,
            postados_auto: postadosAutoTotal
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
        });
    }
});
