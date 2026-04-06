/**
 * Funções puras de parsing/transformação do webhook Ticto.
 * Extraídas da Edge Function para permitir testes unitários.
 * 
 * Usado por: supabase/functions/webhook-ticto/index.ts (deployed as quick-action)
 * Testado por: tests/unit/webhookTicto.test.ts
 */

export const STATUS_MAP: Record<string, string> = {
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

export function normalizeStatus(raw: string): string {
    const lower = (raw || "").toLowerCase().trim();
    return STATUS_MAP[lower] || raw;
}

export function centavosToReais(centavos: number | null | undefined): number {
    if (!centavos && centavos !== 0) return 0;
    return Number((centavos / 100).toFixed(2));
}

export function buildPhone(phone: Record<string, string> | null | undefined): string {
    if (!phone) return "";
    const ddd = phone.ddd || "";
    const num = phone.number || "";
    return `${ddd}${num}`.replace(/\D/g, "");
}

export function parseDate(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    if (dateStr.includes("T")) return dateStr;
    return dateStr.replace(" ", "T") + "-03:00";
}

export function safeString(val: unknown): string | null {
    if (val === null || val === undefined) return null;
    return String(val);
}

export function extractTransactionHash(body: Record<string, unknown>): string | null {
    const order = body.order as Record<string, unknown> | undefined;
    const transaction = body.transaction as Record<string, unknown> | undefined;

    if (order?.transaction_hash) return String(order.transaction_hash);
    if (transaction?.hash) return String(transaction.hash);
    if (order?.hash) return String(order.hash);
    return null;
}

/**
 * Mapeia payload do webhook Ticto para row da tabela ticto_pedidos.
 */
export function mapPayloadToRow(body: Record<string, unknown>) {
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
        transaction_hash: txHash,
        order_id: order.id ? Number(order.id) : null,
        order_hash: safeString(order.hash),
        status: normalizeStatus(String(body.status || "unknown")),
        status_date: parseDate(safeString(body.status_date)),
        commission_type: safeString(body.commission_type),
        payment_method: safeString(body.payment_method),
        paid_amount: centavosToReais(order.paid_amount as number),
        installments: order.installments ? Number(order.installments) : 1,
        shipping_amount: centavosToReais(shipping.amount as number),
        shipping_type: safeString(shipping.type),
        shipping_method: safeString(shipping.method),
        shipping_delivery_days: shipping.delivery_days ? Number(shipping.delivery_days) : null,
        marketplace_commission: centavosToReais(body.marketplace_commission as number),
        product_name: safeString(item.product_name),
        product_id: item.product_id ? Number(item.product_id) : null,
        offer_name: safeString(offer.name || item.offer_name),
        offer_id: offer.id ? Number(offer.id) : (item.offer_id ? Number(item.offer_id) : null),
        offer_code: safeString(offer.code || item.offer_code),
        offer_price: offer.price ? centavosToReais(offer.price as number) : null,
        is_subscription: Boolean(offer.is_subscription),
        offer_interval: safeString(offer.interval),
        offer_trial_days: offer.trial_days ? Number(offer.trial_days) : null,
        offer_first_charge_price: offer.first_charge_price ? centavosToReais(offer.first_charge_price as number) : null,
        item_quantity: item.quantity ? Number(item.quantity) : 1,
        item_amount: centavosToReais(item.amount as number),
        coupon_id: safeString(item.coupon_id),
        coupon_name: safeString(item.coupon_name),
        coupon_value: safeString(item.coupon_value),
        refund_deadline: item.refund_deadline ? Number(item.refund_deadline) : null,
        customer_name: safeString(customer.name),
        customer_email: safeString(customer.email),
        customer_cpf: safeString(customer.cpf),
        customer_cnpj: safeString(customer.cnpj),
        customer_code: safeString(customer.code),
        customer_phone: buildPhone(phone as Record<string, string>),
        customer_type: safeString(customer.type) || "person",
        customer_is_foreign: Boolean(customer.is_foreign),
        customer_language: safeString(customer.language) || "pt-BR",
        address_street: safeString(address.street),
        address_number: safeString(address.street_number),
        address_complement: safeString(address.complement),
        address_neighborhood: safeString(address.neighborhood),
        address_city: safeString(address.city),
        address_state: safeString(address.state),
        address_zip_code: safeString(address.zip_code),
        address_country: safeString(address.country) || "Brasil",
        producer: body.producer || null,
        affiliates: body.affiliates || [],
        coproducers: body.coproducers || [],
        owner_commissions: body.owner_commissions || [],
        utm_source: tracking.utm_source && tracking.utm_source !== "Não Informado" ? String(tracking.utm_source) : null,
        utm_medium: tracking.utm_medium && tracking.utm_medium !== "Não Informado" ? String(tracking.utm_medium) : null,
        utm_campaign: tracking.utm_campaign && tracking.utm_campaign !== "Não Informado" ? String(tracking.utm_campaign) : null,
        utm_content: tracking.utm_content && tracking.utm_content !== "Não Informado" ? String(tracking.utm_content) : null,
        utm_term: tracking.utm_term && tracking.utm_term !== "Não Informado" ? String(tracking.utm_term) : null,
        src: tracking.src && tracking.src !== "Não Informado" ? String(tracking.src) : null,
        sck: tracking.sck && tracking.sck !== "Não Informado" ? String(tracking.sck) : null,
        checkout_url: safeString(body.checkout_url),
        webhook_version: safeString(body.version) || "2.0",
        token: safeString(body.token),
        query_params: queryParams,
        tracking: Object.keys(tracking).length > 0 ? tracking : null,
        transaction_pix_qr_code: safeString(transaction.pix_qr_code),
        transaction_pix_url: safeString(transaction.pix_url),
        transaction_bank_slip_code: safeString(transaction.bank_slip_code),
        transaction_bank_slip_url: safeString(transaction.bank_slip_url),
        order_date: parseDate(safeString(order.order_date)),
        payload_completo: body,
        plataforma: "ticto",
    };
}
