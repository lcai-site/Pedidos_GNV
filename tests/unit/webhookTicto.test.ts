import { describe, it, expect } from 'vitest';
import {
    normalizeStatus,
    centavosToReais,
    buildPhone,
    parseDate,
    safeString,
    extractTransactionHash,
    mapPayloadToRow,
} from '../../lib/services/tictoWebhookParser';

// ================================================================
// FIXTURES: Payloads reais (anonimizados) da Ticto
// ================================================================

const FULL_PAYLOAD = {
    status: "authorized",
    status_date: "2026-02-10 14:30:00",
    payment_method: "credit_card",
    commission_type: "default",
    order: {
        id: 12345,
        hash: "ORD-HASH-001",
        transaction_hash: "TX-HASH-001",
        paid_amount: 19700,
        installments: 3,
        order_date: "2026-02-10 14:30:00",
    },
    item: {
        product_name: "Kit Desejo Proibido",
        product_id: 101,
        offer_name: "Oferta Principal",
        offer_id: 201,
        offer_code: "DP-MAIN",
        quantity: 1,
        amount: 19700,
    },
    offer: {
        name: "Oferta Principal",
        id: 201,
        code: "DP-MAIN",
        price: 19700,
        is_subscription: false,
    },
    customer: {
        name: "Maria Teste",
        email: "maria@teste.com",
        cpf: "123.456.789-00",
        phone: { ddd: "19", number: "999887766" },
        type: "person",
        address: {
            street: "Rua das Flores",
            street_number: "123",
            complement: "Apto 4",
            neighborhood: "Centro",
            city: "Indaiatuba",
            state: "SP",
            zip_code: "13330-000",
            country: "Brasil",
        },
    },
    tracking: {
        utm_source: "instagram",
        utm_medium: "cpc",
        utm_campaign: "fev2026",
        utm_content: "Não Informado",
        src: "ig-ads",
    },
    shipping: {
        amount: 1590,
        type: "pac",
        method: "correios",
        delivery_days: 5,
    },
    version: "2.0",
    token: "test-token-123",
};

const MINIMAL_PAYLOAD = {
    status: "authorized",
    order: {
        transaction_hash: "TX-MINIMAL-001",
        paid_amount: 9900,
        order_date: "2026-02-11 09:00:00",
    },
    item: {
        product_name: "Kit Bela Forma",
    },
    customer: {
        name: "João Mínimo",
        email: "joao@min.com",
    },
};

const N8N_WRAPPER_PAYLOAD = [
    {
        headers: { "content-type": "application/json" },
        body: {
            status: "approved",
            order: {
                transaction_hash: "TX-N8N-001",
                paid_amount: 29700,
                order_date: "2026-02-12 16:00:00",
            },
            item: {
                product_name: "Kit Bela Lumi",
            },
            customer: {
                name: "Ana N8N",
                email: "ana@n8n.com",
            },
        },
    },
];

// ================================================================
// TESTES: Funções Puras
// ================================================================

describe('tictoWebhookParser', () => {

    describe('normalizeStatus', () => {
        it('should map known statuses correctly', () => {
            expect(normalizeStatus('authorized')).toBe('Aprovado');
            expect(normalizeStatus('approved')).toBe('Aprovado');
            expect(normalizeStatus('paid')).toBe('Aprovado');
            expect(normalizeStatus('refunded')).toBe('Reembolsado');
            expect(normalizeStatus('chargeback')).toBe('Chargeback');
            expect(normalizeStatus('canceled')).toBe('Cancelado');
            expect(normalizeStatus('cancelled')).toBe('Cancelado');
            expect(normalizeStatus('waiting_payment')).toBe('Pendente');
            expect(normalizeStatus('pending')).toBe('Pendente');
            expect(normalizeStatus('expired')).toBe('Expirado');
            expect(normalizeStatus('refused')).toBe('Recusado');
            expect(normalizeStatus('denied')).toBe('Recusado');
            expect(normalizeStatus('failed')).toBe('Recusado');
        });

        it('should handle case insensitivity', () => {
            expect(normalizeStatus('AUTHORIZED')).toBe('Aprovado');
            expect(normalizeStatus('Paid')).toBe('Aprovado');
            expect(normalizeStatus('  pending  ')).toBe('Pendente');
        });

        it('should return raw value for unknown statuses', () => {
            expect(normalizeStatus('cart_abandoned')).toBe('cart_abandoned');
            expect(normalizeStatus('unknown_status')).toBe('unknown_status');
        });

        it('should handle empty string input', () => {
            expect(normalizeStatus('')).toBe('');
        });
    });

    describe('centavosToReais', () => {
        it('should convert centavos to reais', () => {
            expect(centavosToReais(19700)).toBe(197.00);
            expect(centavosToReais(100)).toBe(1.00);
            expect(centavosToReais(1)).toBe(0.01);
            expect(centavosToReais(9999)).toBe(99.99);
        });

        it('should handle zero', () => {
            expect(centavosToReais(0)).toBe(0);
        });

        it('should handle null/undefined', () => {
            expect(centavosToReais(null)).toBe(0);
            expect(centavosToReais(undefined)).toBe(0);
        });
    });

    describe('buildPhone', () => {
        it('should concatenate DDD + number', () => {
            expect(buildPhone({ ddd: '19', number: '999887766' })).toBe('19999887766');
        });

        it('should strip non-numeric chars', () => {
            expect(buildPhone({ ddd: '(19)', number: '99988-7766' })).toBe('19999887766');
        });

        it('should handle partial data', () => {
            expect(buildPhone({ ddd: '11', number: '' })).toBe('11');
            expect(buildPhone({ ddd: '', number: '999887766' })).toBe('999887766');
        });

        it('should handle null/undefined', () => {
            expect(buildPhone(null)).toBe('');
            expect(buildPhone(undefined)).toBe('');
        });
    });

    describe('parseDate', () => {
        it('should convert Ticto date format to ISO with timezone', () => {
            expect(parseDate('2026-02-10 14:30:00')).toBe('2026-02-10T14:30:00-03:00');
        });

        it('should keep ISO dates unchanged', () => {
            expect(parseDate('2026-02-10T14:30:00Z')).toBe('2026-02-10T14:30:00Z');
            expect(parseDate('2026-02-10T14:30:00-03:00')).toBe('2026-02-10T14:30:00-03:00');
        });

        it('should return null for empty/null input', () => {
            expect(parseDate(null)).toBeNull();
            expect(parseDate(undefined)).toBeNull();
            expect(parseDate('')).toBeNull();
        });
    });

    describe('safeString', () => {
        it('should convert values to strings', () => {
            expect(safeString('hello')).toBe('hello');
            expect(safeString(123)).toBe('123');
            expect(safeString(true)).toBe('true');
        });

        it('should return null for null/undefined', () => {
            expect(safeString(null)).toBeNull();
            expect(safeString(undefined)).toBeNull();
        });
    });

    describe('extractTransactionHash', () => {
        it('should prioritize order.transaction_hash', () => {
            expect(extractTransactionHash({
                order: { transaction_hash: 'TX-1', hash: 'ORD-1' },
                transaction: { hash: 'TR-1' },
            })).toBe('TX-1');
        });

        it('should fallback to transaction.hash', () => {
            expect(extractTransactionHash({
                order: { hash: 'ORD-1' },
                transaction: { hash: 'TR-1' },
            })).toBe('TR-1');
        });

        it('should fallback to order.hash', () => {
            expect(extractTransactionHash({
                order: { hash: 'ORD-1' },
            })).toBe('ORD-1');
        });

        it('should return null if nothing found', () => {
            expect(extractTransactionHash({})).toBeNull();
            expect(extractTransactionHash({ order: {} })).toBeNull();
        });
    });

    // ================================================================
    // TESTES: mapPayloadToRow (Integração das funções puras)
    // ================================================================

    describe('mapPayloadToRow', () => {
        it('should map a full Ticto payload correctly', () => {
            const row = mapPayloadToRow(FULL_PAYLOAD);

            // Identificação
            expect(row.transaction_hash).toBe('TX-HASH-001');
            expect(row.order_id).toBe(12345);
            expect(row.order_hash).toBe('ORD-HASH-001');

            // Status
            expect(row.status).toBe('Aprovado');

            // Pagamento
            expect(row.paid_amount).toBe(197.00);
            expect(row.installments).toBe(3);
            expect(row.payment_method).toBe('credit_card');

            // Produto
            expect(row.product_name).toBe('Kit Desejo Proibido');
            expect(row.offer_name).toBe('Oferta Principal');
            expect(row.offer_code).toBe('DP-MAIN');

            // Cliente
            expect(row.customer_name).toBe('Maria Teste');
            expect(row.customer_email).toBe('maria@teste.com');
            expect(row.customer_cpf).toBe('123.456.789-00');
            expect(row.customer_phone).toBe('19999887766');

            // Endereço
            expect(row.address_street).toBe('Rua das Flores');
            expect(row.address_number).toBe('123');
            expect(row.address_city).toBe('Indaiatuba');
            expect(row.address_state).toBe('SP');
            expect(row.address_zip_code).toBe('13330-000');

            // UTM (filtra "Não Informado")
            expect(row.utm_source).toBe('instagram');
            expect(row.utm_medium).toBe('cpc');
            expect(row.utm_campaign).toBe('fev2026');
            expect(row.utm_content).toBeNull(); // Era "Não Informado"
            expect(row.src).toBe('ig-ads');

            // Frete
            expect(row.shipping_amount).toBe(15.90);
            expect(row.shipping_type).toBe('pac');

            // Data
            expect(row.order_date).toBe('2026-02-10T14:30:00-03:00');

            // Backup
            expect(row.payload_completo).toBe(FULL_PAYLOAD);
        });

        it('should handle minimal payload gracefully', () => {
            const row = mapPayloadToRow(MINIMAL_PAYLOAD);

            expect(row.transaction_hash).toBe('TX-MINIMAL-001');
            expect(row.status).toBe('Aprovado');
            expect(row.paid_amount).toBe(99.00);
            expect(row.product_name).toBe('Kit Bela Forma');
            expect(row.customer_name).toBe('João Mínimo');
            expect(row.customer_email).toBe('joao@min.com');

            // Campos ausentes devem ser null ou defaults
            expect(row.customer_phone).toBe('');
            expect(row.address_street).toBeNull();
            expect(row.utm_source).toBeNull();
            expect(row.shipping_amount).toBe(0);
            expect(row.installments).toBe(1);
        });

        it('should handle empty payload without crashing', () => {
            const row = mapPayloadToRow({ status: 'unknown' });

            expect(row.transaction_hash).toBeNull();
            expect(row.status).toBe('unknown');
            expect(row.paid_amount).toBe(0);
            expect(row.product_name).toBeNull();
            expect(row.customer_name).toBeNull();
        });
    });
});
