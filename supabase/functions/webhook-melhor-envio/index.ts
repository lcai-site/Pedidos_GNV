import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-ME-Signature",
};

// Mapeamento: evento Melhor Envio → status_envio no banco
const STATUS_MAP: Record<string, string> = {
    "order.created": "Processando",
    "order.pending": "Pendente",
    "order.released": "Pago",
    "order.generated": "Etiqueta Gerada",
    "order.posted": "Postado",
    "order.delivered": "Entregue",
    "order.cancelled": "Cancelado",
    "order.undelivered": "Não Entregue",
    "order.paused": "Pausado",
    "order.suspended": "Suspenso",
    "order.received": "Recebido Pegaki",
};

/**
 * Verifica a assinatura HMAC-SHA256 do webhook da Melhor Envio
 * usando Web Crypto API nativa (sem dependências externas).
 */
async function verifySignature(
    body: string,
    signature: string | null,
    secret: string | null,
): Promise<boolean> {
    if (!signature || !secret) return false;
    try {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
        );
        const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
        const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
        return computed === signature;
    } catch {
        return false;
    }
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Only accept POST
    if (req.method !== "POST") {
        return new Response(
            JSON.stringify({ error: "Method not allowed. Use POST." }),
            {
                status: 405,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    }

    const startTime = Date.now();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const meWebhookSecret = Deno.env.get("MELHOR_ENVIO_WEBHOOK_SECRET");

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    let rawBody: string;
    let body: Record<string, unknown>;

    try {
        rawBody = await req.text();
        body = JSON.parse(rawBody);

        // Verificar assinatura (opcional se secret não configurado)
        const signature = req.headers.get("x-me-signature");
        if (meWebhookSecret && !(await verifySignature(rawBody, signature, meWebhookSecret))) {
            throw new Error("Invalid webhook signature");
        }

        // Validar payload
        if (!body.event || !body.data) {
            throw new Error("Missing 'event' or 'data' fields");
        }
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Invalid payload";

        // Log error
        try {
            await supabase.from("ticto_logs").insert({
                evento: "webhook_me_parse_error",
                tipo: "error",
                payload: { raw_error: errorMsg },
                sucesso: false,
                erro: errorMsg,
                duracao_ms: Date.now() - startTime,
            });
        } catch (_) { /* ignore */ }

        return new Response(
            JSON.stringify({ error: errorMsg }),
            {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    }

    try {
        const event = String(body.event);
        const data = body.data as Record<string, unknown>;
        const orderId = String(data.id); // UUID da etiqueta na Melhor Envio
        const tracking = data.tracking ? String(data.tracking) : null;
        const trackingUrl = data.tracking_url ? String(data.tracking_url) : null;
        const newStatus = STATUS_MAP[event] || null;

        if (!newStatus) {
            // Evento desconhecido - log e retorna OK
            await supabase.from("ticto_logs").insert({
                evento: `webhook_me_unknown_${event}`,
                tipo: "webhook",
                payload: data,
                sucesso: true,
                duracao_ms: Date.now() - startTime,
            });

            return new Response(
                JSON.stringify({ success: true, message: "Unknown event, logged" }),
                {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                },
            );
        }

        // Buscar pedido: primeiro por melhor_envio_id, depois por codigo_rastreio
        let pedido = null;
        let matchField = "";

        // Busca 1: melhor_envio_id (já foi processado antes)
        const { data: byMeId } = await supabase
            .from("pedidos_consolidados_v3")
            .select("id, codigo_rastreio, melhor_envio_id, status_envio")
            .eq("melhor_envio_id", orderId)
            .limit(1)
            .maybeSingle();

        if (byMeId) {
            pedido = byMeId;
            matchField = "melhor_envio_id";
        } else {
            // Busca 2: codigo_rastreio (UUID do carrinho, primeira vez)
            const { data: byTracking } = await supabase
                .from("pedidos_consolidados_v3")
                .select("id, codigo_rastreio, melhor_envio_id, status_envio")
                .eq("codigo_rastreio", orderId)
                .limit(1)
                .maybeSingle();

            if (byTracking) {
                pedido = byTracking;
                matchField = "codigo_rastreio";
            }
        }

        if (!pedido) {
            // Pedido não encontrado - log e retorna OK (não é um erro)
            await supabase.from("ticto_logs").insert({
                evento: `webhook_me_no_match_${event}`,
                tipo: "webhook",
                payload: { order_id: orderId, tracking, event },
                sucesso: true,
                erro: "Pedido não encontrado no banco",
                duracao_ms: Date.now() - startTime,
            });

            return new Response(
                JSON.stringify({ success: true, message: "Order not found, logged" }),
                {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                },
            );
        }

        // Montar update
        const updateData: Record<string, unknown> = {
            status_envio: newStatus,
            melhor_envio_id: orderId,
            updated_at: new Date().toISOString(),
        };

        // Se tem tracking real, salvar como codigo_rastreio
        if (tracking) {
            updateData.codigo_rastreio = tracking;
        }

        // Salvar tracking_url
        if (trackingUrl) {
            updateData.tracking_url = trackingUrl;
        }

        // Datas específicas por evento
        if (event === "order.delivered" && data.delivered_at) {
            updateData.data_entrega = String(data.delivered_at);
            updateData.data_envio = String(data.delivered_at);
        }

        if (event === "order.posted" && data.posted_at) {
            updateData.data_envio = String(data.posted_at);
        }

        if (event === "order.cancelled") {
            updateData.codigo_rastreio = null;
            updateData.melhor_envio_id = orderId;
            updateData.tracking_url = null;
        }

        // Atualizar pedido
        const { error: updateError } = await supabase
            .from("pedidos_consolidados_v3")
            .update(updateData)
            .eq("id", pedido.id);

        if (updateError) {
            throw new Error(`DB update failed: ${updateError.message}`);
        }

        const duration = Date.now() - startTime;

        // Log sucesso
        try {
            await supabase.from("ticto_logs").insert({
                evento: `webhook_me_${event}`,
                tipo: "webhook",
                payload: {
                    order_id: orderId,
                    pedido_id: pedido.id,
                    tracking,
                    tracking_url: trackingUrl,
                    status: newStatus,
                    match_field: matchField,
                },
                sucesso: true,
                duracao_ms: duration,
            });
        } catch (_) { /* ignore */ }

        return new Response(
            JSON.stringify({
                success: true,
                pedido_id: pedido.id,
                event,
                status: newStatus,
                tracking: tracking || "pending",
                duration_ms: duration,
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        const duration = Date.now() - startTime;

        // Log error
        try {
            await supabase.from("ticto_logs").insert({
                evento: `webhook_me_error`,
                tipo: "error",
                payload: {
                    event: body.event,
                    order_id: (body.data as Record<string, unknown>)?.id,
                    error: errorMsg,
                },
                sucesso: false,
                erro: errorMsg,
                duracao_ms: duration,
            });
        } catch (_) { /* ignore */ }

        return new Response(
            JSON.stringify({ error: errorMsg }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    }
});
