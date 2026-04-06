import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Status map: ViralMart raw → Normalizado
const STATUS_MAP: Record<string, string> = {
    approved: "Aprovado",
    authorized: "Aprovado",
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

function safeString(val: unknown): string | null {
    if (val === null || val === undefined) return null;
    return String(val);
}

function parseDate(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    if (dateStr.includes("T")) return dateStr;
    // ViralMart format: "2026-03-17 21:34:27.946341+00:00"
    return dateStr.replace(" ", "T");
}

/**
 * Maps the ViralMart/Velora webhook payload to ticto_pedidos table row.
 *
 * ViralMart payloads are FLAT (not nested like Ticto).
 * Key differences:
 * - tid → transaction_hash (UUID format)
 * - order → order_hash (string code like "BP82415")
 * - Prices are already in REAIS (not centavos)
 * - Phone is a single string (not ddd+number)
 * - document → customer_cpf (already a flat string)
 * - address is a sub-object with different field names
 * - order_bump field indicates if this IS an order bump
 */
function mapViralMartPayloadToRow(body: Record<string, unknown>) {
    const address = (body.address || {}) as Record<string, unknown>;
    const queryParams = body.queryparams_checkout || null;

    // Detect if this is an Order Bump
    const isOrderBump = String(body.order_bump || "").toLowerCase() === "sim";

    // Build offer_name: prefix with "Order Bump - " if it IS a bump
    let offerName = safeString(body.product_name);
    if (isOrderBump && offerName) {
        offerName = "Order Bump - " + offerName;
    }

    return {
        // Identification
        transaction_hash: safeString(body.tid),
        order_id: null, // ViralMart uses string order codes, not numeric IDs
        order_hash: safeString(body.order), // "BP82415"

        // Status
        status: normalizeStatus(String(body.status || "unknown")),
        status_date: parseDate(safeString(body.paid_at)),
        commission_type: null,

        // Payment — ViralMart prices are already in REAIS
        payment_method: safeString(body.payment_method),
        paid_amount: body.product_price ? Number(body.product_price) : 0,
        installments: address.installments ? Number(address.installments) : 1,
        shipping_amount: 0,
        shipping_type: safeString(body.payment_type),
        shipping_method: null,
        shipping_delivery_days: null,
        marketplace_commission: 0,

        // Product / Offer
        product_name: safeString(body.product_name),
        product_id: body.product_id ? Number(body.product_id) : null,
        offer_name: offerName,
        offer_id: body.offer_id ? Number(body.offer_id) : null,
        offer_code: safeString(body.offer_code),
        offer_price: body.offer_price ? Number(body.offer_price) : null,
        is_subscription: String(body.charge_type) !== "unique",
        offer_interval: safeString(body.periodicity),
        offer_trial_days: null,
        offer_first_charge_price: null,
        item_quantity: body.product_amount ? Number(body.product_amount) : 1,
        item_amount: body.full_price ? Number(body.full_price) : null,
        coupon_id: null,
        coupon_name: null,
        coupon_value: null,
        refund_deadline: null,

        // Customer — ViralMart has flat fields
        customer_name: safeString(body.name),
        customer_email: safeString(body.email),
        customer_cpf: safeString(body.document),
        customer_cnpj: null,
        customer_code: null,
        customer_phone: safeString(body.phone),
        customer_type: safeString(body.doc_type) === "cnpj" ? "company" : "person",
        customer_is_foreign: String(body.country) !== "BR",
        customer_language: "pt-BR",

        // Address
        address_street: safeString(address.address),
        address_number: safeString(address.number),
        address_complement: safeString(address.complement),
        address_neighborhood: safeString(address.neighborhood),
        address_city: safeString(address.city),
        address_state: safeString(address.state),
        address_zip_code: safeString(address.zipcode),
        address_country: safeString(address.country) || "Brasil",

        // Commissions (not available from ViralMart)
        producer: null,
        affiliates: [],
        coproducers: [],
        owner_commissions: [],

        // Tracking / UTM
        utm_source: body.utm_source ? String(body.utm_source) : null,
        utm_medium: body.utm_medium ? String(body.utm_medium) : null,
        utm_campaign: body.utm_campaign ? String(body.utm_campaign) : null,
        utm_content: body.utm_content ? String(body.utm_content) : null,
        utm_term: null,
        src: null,
        sck: body.sck ? String(body.sck) : null,
        checkout_url: null,

        // Meta
        webhook_version: "viralmart-1.0",
        token: null,
        query_params: queryParams,
        tracking: null,
        transaction_pix_qr_code: null,
        transaction_pix_url: null,
        transaction_bank_slip_code: null,
        transaction_bank_slip_url: null,

        // Dates
        order_date: parseDate(safeString(body.created_at)),

        // Full payload backup
        payload_completo: body,

        // ✅ PLATAFORMA
        plataforma: "viralmart",
    };
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

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

        // Handle n8n wrapper formats:
        // 1. [{headers: {...}, body: {...}}]
        // 2. {headers: {...}, body: {...}}
        // 3. Direct payload: {tid: "...", status: "...", ...}
        if (Array.isArray(rawBody) && rawBody.length > 0 && rawBody[0].body) {
            body = rawBody[0].body as Record<string, unknown>;
        } else if (
            rawBody.body && rawBody.headers && typeof rawBody.body === "object"
        ) {
            body = rawBody.body as Record<string, unknown>;
        } else {
            body = rawBody as Record<string, unknown>;
        }

        // Validate: must have tid and status
        if (!body.tid) {
            throw new Error("Missing 'tid' field in ViralMart payload");
        }
        if (!body.status) {
            throw new Error("Missing 'status' field in ViralMart payload");
        }
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Invalid JSON";

        try {
            await supabase.from("ticto_logs").insert({
                evento: "viralmart_webhook_parse_error",
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
        const row = mapViralMartPayloadToRow(body);

        // UPSERT: (transaction_hash, offer_code) composite key
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

        // Log success
        try {
            await supabase.from("ticto_logs").insert({
                evento: `viralmart_${body.status}`,
                tipo: "webhook",
                payload: {
                    tid: row.transaction_hash,
                    order: row.order_hash,
                    status: row.status,
                    product_name: row.product_name,
                    customer_email: row.customer_email,
                    paid_amount: row.paid_amount,
                    plataforma: "viralmart",
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
                plataforma: "viralmart",
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

        try {
            await supabase.from("ticto_logs").insert({
                evento: `viralmart_error_${body.status}`,
                tipo: "error",
                payload: {
                    tid: body.tid,
                    status: body.status,
                    error: errorMsg,
                    plataforma: "viralmart",
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
