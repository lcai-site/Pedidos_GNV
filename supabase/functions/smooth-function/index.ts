import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Status map: Ticto raw → Normalizado para o sistema
const STATUS_MAP: Record<string, string> = {
    authorized: "Aprovado",
    approved: "Aprovado",
    paid: "Aprovado",
    completed: "Aprovado",
    refunded: "Reembolsado",
    chargeback: "Chargeback",
    canceled: "Cancelado",
    cancelled: "Cancelado",
    waiting_payment: "Pendente",
    pending: "Pendente",
    expired: "Expirado",
    refused: "Recusado",
    denied: "Recusado",
    failed: "Recusado",
};

function normalizeStatus(raw: string): string {
    const lower = (raw || "").toLowerCase().trim();
    return STATUS_MAP[lower] || raw;
}

function centavosToReais(centavos: number | null | undefined): number {
    if (!centavos && centavos !== 0) return 0;
    return Number((centavos / 100).toFixed(2));
}

function buildPhone(phone: Record<string, string> | null | undefined): string {
    if (!phone) return "";
    const ddd = phone.ddd || "";
    const num = phone.number || "";
    return `${ddd}${num}`.replace(/\D/g, "");
}

function parseDate(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    // Ticto format: "2026-02-03 11:09:46"
    if (dateStr.includes("T")) return dateStr; // Already ISO
    return dateStr.replace(" ", "T") + "-03:00";
}

function safeString(val: unknown): string | null {
    if (val === null || val === undefined) return null;
    return String(val);
}

/**
 * Extract transaction_hash from multiple possible locations in the payload.
 * Priority: order.transaction_hash > transaction.hash > order.hash
 */
function extractTransactionHash(body: Record<string, unknown>): string | null {
    const order = body.order as Record<string, unknown> | undefined;
    const transaction = body.transaction as Record<string, unknown> | undefined;

    if (order?.transaction_hash) return String(order.transaction_hash);
    if (transaction?.hash) return String(transaction.hash);
    if (order?.hash) return String(order.hash);
    return null;
}

/**
 * Maps any Ticto webhook payload to the ticto_pedidos table row.
 * Handles both production (full) and test (minimal) payloads gracefully.
 */
function mapPayloadToRow(body: Record<string, unknown>) {
    const order = (body.order || {}) as Record<string, unknown>;
    const item = (body.item || {}) as Record<string, unknown>;
    const offer = (body.offer || {}) as Record<string, unknown>;
    const shipping = (body.shipping || {}) as Record<string, unknown>;
    const customer = (body.customer || {}) as Record<string, unknown>;
    const address = (customer.address || {}) as Record<string, unknown>;
    const phone = (customer.phone || {}) as Record<string, unknown>;
    const tracking = (body.tracking || {}) as Record<string, unknown>;
    const transaction = (body.transaction || {}) as Record<string, unknown>;
    const queryParams = body.query_params ||
        (body.url_params as Record<string, unknown>)?.query_params || null;

    const txHash = extractTransactionHash(body);

    return {
        // Identification
        transaction_hash: txHash,
        order_id: order.id ? Number(order.id) : null,
        order_hash: safeString(order.hash),

        // Status
        status: normalizeStatus(String(body.status || "unknown")),
        status_date: parseDate(safeString(body.status_date)),
        commission_type: safeString(body.commission_type),

        // Payment
        payment_method: safeString(body.payment_method),
        paid_amount: centavosToReais(order.paid_amount as number),
        installments: order.installments ? Number(order.installments) : 1,
        shipping_amount: centavosToReais(shipping.amount as number),
        shipping_type: safeString(shipping.type),
        shipping_method: safeString(shipping.method),
        shipping_delivery_days: shipping.delivery_days
            ? Number(shipping.delivery_days)
            : null,
        marketplace_commission: centavosToReais(
            body.marketplace_commission as number,
        ),

        // Product / Offer (merge item + offer — test payloads only have item)
        product_name: safeString(item.product_name),
        product_id: item.product_id ? Number(item.product_id) : null,
        offer_name: safeString(offer.name || item.offer_name),
        offer_id: offer.id ? Number(offer.id) : (item.offer_id ? Number(item.offer_id) : null),
        offer_code: safeString(offer.code || item.offer_code),
        offer_price: offer.price ? centavosToReais(offer.price as number) : null,
        is_subscription: Boolean(offer.is_subscription),
        offer_interval: safeString(offer.interval),
        offer_trial_days: offer.trial_days ? Number(offer.trial_days) : null,
        offer_first_charge_price: offer.first_charge_price
            ? centavosToReais(offer.first_charge_price as number)
            : null,
        item_quantity: item.quantity ? Number(item.quantity) : 1,
        item_amount: centavosToReais(item.amount as number),
        coupon_id: safeString(item.coupon_id),
        coupon_name: safeString(item.coupon_name),
        coupon_value: safeString(item.coupon_value),
        refund_deadline: item.refund_deadline
            ? Number(item.refund_deadline)
            : null,

        // Customer
        customer_name: safeString(customer.name),
        customer_email: safeString(customer.email),
        customer_cpf: safeString(customer.cpf),
        customer_cnpj: safeString(customer.cnpj),
        customer_code: safeString(customer.code),
        customer_phone: buildPhone(phone as Record<string, string>),
        customer_type: safeString(customer.type) || "person",
        customer_is_foreign: Boolean(customer.is_foreign),
        customer_language: safeString(customer.language) || "pt-BR",

        // Address
        address_street: safeString(address.street),
        address_number: safeString(address.street_number),
        address_complement: safeString(address.complement),
        address_neighborhood: safeString(address.neighborhood),
        address_city: safeString(address.city),
        address_state: safeString(address.state),
        address_zip_code: safeString(address.zip_code),
        address_country: safeString(address.country) || "Brasil",

        // Commissions (JSONB)
        producer: body.producer || null,
        affiliates: body.affiliates || [],
        coproducers: body.coproducers || [],
        owner_commissions: body.owner_commissions || [],

        // Tracking / UTM (handle "Não Informado" as null)
        utm_source: tracking.utm_source && tracking.utm_source !== "Não Informado"
            ? String(tracking.utm_source)
            : null,
        utm_medium: tracking.utm_medium && tracking.utm_medium !== "Não Informado"
            ? String(tracking.utm_medium)
            : null,
        utm_campaign: tracking.utm_campaign &&
            tracking.utm_campaign !== "Não Informado"
            ? String(tracking.utm_campaign)
            : null,
        utm_content: tracking.utm_content &&
            tracking.utm_content !== "Não Informado"
            ? String(tracking.utm_content)
            : null,
        utm_term: tracking.utm_term && tracking.utm_term !== "Não Informado"
            ? String(tracking.utm_term)
            : null,
        src: tracking.src && tracking.src !== "Não Informado"
            ? String(tracking.src)
            : null,
        sck: tracking.sck && tracking.sck !== "Não Informado"
            ? String(tracking.sck)
            : null,
        checkout_url: safeString(body.checkout_url),

        // Meta
        webhook_version: safeString(body.version) || "2.0",
        token: safeString(body.token),
        query_params: queryParams,
        tracking: Object.keys(tracking).length > 0 ? tracking : null,
        transaction_pix_qr_code: safeString(transaction.pix_qr_code),
        transaction_pix_url: safeString(transaction.pix_url),
        transaction_bank_slip_code: safeString(transaction.bank_slip_code),
        transaction_bank_slip_url: safeString(transaction.bank_slip_url),

        // Dates
        order_date: parseDate(safeString(order.order_date)),

        // Full backup
        payload_completo: body,

        // Platform identifier
        plataforma: "ticto",
    };
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    let body: Record<string, unknown>;

    try {
        const rawBody = await req.json();

        // Handle multiple payload formats:
        // 1. n8n wrapper: [{headers: {...}, body: {...}}]
        // 2. n8n wrapper (single): {headers: {...}, body: {...}}
        // 3. Direct Ticto payload: {status: "authorized", order: {...}, ...}
        if (Array.isArray(rawBody) && rawBody.length > 0 && rawBody[0].body) {
            body = rawBody[0].body as Record<string, unknown>;
        } else if (
            rawBody.body && rawBody.headers && typeof rawBody.body === "object"
        ) {
            body = rawBody.body as Record<string, unknown>;
        } else {
            body = rawBody as Record<string, unknown>;
        }

        // Validate: must have at least status and some order identifier
        if (!body.status) {
            throw new Error("Missing 'status' field in payload");
        }

        const txHash = extractTransactionHash(body);
        if (!txHash) {
            // Abandono de carrinho e outros eventos sem pedido completo não possuem
            // transaction_hash. Retornamos 200 para que a Ticto pare de reenviar.
            return new Response(
                JSON.stringify({
                    success: true,
                    message: "Event acknowledged (no transaction hash — likely cart abandonment)",
                    status: body.status,
                }),
                {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                },
            );
        }
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Invalid JSON";

        // Log error (ignore failures)
        try {
            await supabase.from("ticto_logs").insert({
                evento: "webhook_parse_error",
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
        // Map payload to database row
        const row = mapPayloadToRow(body);

        // UPSERT: insert or update if (transaction_hash + offer_code) already exists
        // Chave composta permite PAI e OB da mesma transação coexistirem
        const { data, error } = await supabase
            .from("ticto_pedidos")
            .upsert(row, {
                onConflict: "transaction_hash,offer_code",
                ignoreDuplicates: false,
            })
            .select("id, transaction_hash, status")
            .single();

        if (error) {
            throw new Error(`DB upsert failed: ${error.message}`);
        }

        const duration = Date.now() - startTime;

        // Log success (ignore failures)
        try {
            await supabase.from("ticto_logs").insert({
                evento: `webhook_${body.status}`,
                tipo: "webhook",
                payload: {
                    transaction_hash: row.transaction_hash,
                    order_hash: row.order_hash,
                    status: row.status,
                    product_name: row.product_name,
                    customer_email: row.customer_email,
                    paid_amount: row.paid_amount,
                },
                sucesso: true,
                duracao_ms: duration,
            });
        } catch (_) { /* ignore */ }

        return new Response(
            JSON.stringify({
                success: true,
                id: data.id,
                transaction_hash: data.transaction_hash,
                status: data.status,
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

        // Log error (ignore failures)
        try {
            await supabase.from("ticto_logs").insert({
                evento: `webhook_error_${body.status}`,
                tipo: "error",
                payload: {
                    transaction_hash: extractTransactionHash(body),
                    status: body.status,
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
