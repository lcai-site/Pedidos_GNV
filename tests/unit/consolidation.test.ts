import { describe, it, expect } from 'vitest';

/**
 * Testes das REGRAS DE NEGÓCIO de consolidação.
 * 
 * Estas são funções puras que validam a lógica antes de rodar no banco.
 * A procedure SQL real (consolidar_pedidos_ticto) aplica estas mesmas regras.
 * 
 * Objetivo: Garantir que a classificação de pedidos segue as regras.
 */

// ================================================================
// REGRAS EXTRAÍDAS (replicam a lógica da procedure SQL)
// ================================================================

type TictoPedido = {
    transaction_hash: string;
    order_date: string;
    customer_email: string;
    customer_cpf: string;
    product_name: string;
    offer_name: string;
    status: string;
    paid_amount: number;
};

/** Extrai a sigla do produto a partir do nome */
function extractSigla(productName: string | null): string | null {
    if (!productName) return null;
    const upper = productName.toUpperCase();
    if (upper.includes('DESEJO')) return 'DP';
    if (upper.includes('LUMI')) return 'BL';
    if (upper.includes('FORMA')) return 'BF';
    return null;
}

/** Verifica se é um Order Bump */
function isOrderBump(offerName: string): boolean {
    return offerName.toUpperCase().includes('ORDERBUMP');
}

/** Verifica se é um Upsell */
function isUpsell(offerName: string): boolean {
    return offerName.toUpperCase().includes('UPSELL');
}

/** Verifica se é uma Pós-Venda (CC) */
function isPosVenda(offerName: string): boolean {
    return offerName.toUpperCase().includes('CC');
}

/** Verifica se é um pedido "pai" (não é OB, Upsell, nem CC) */
function isPedidoPai(offerName: string): boolean {
    return !isOrderBump(offerName) && !isUpsell(offerName) && !isPosVenda(offerName);
}

/** Limpa CPF para comparação */
function cleanCPF(cpf: string): string {
    return (cpf || '').replace(/\D/g, '');
}

/** Verifica se dois pedidos são do mesmo email */
function sameEmail(a: TictoPedido, b: TictoPedido): boolean {
    return a.customer_email.toLowerCase() === b.customer_email.toLowerCase();
}

/** Verifica se dois pedidos são do mesmo CPF */
function sameCPF(a: TictoPedido, b: TictoPedido): boolean {
    const cpfA = cleanCPF(a.customer_cpf);
    const cpfB = cleanCPF(b.customer_cpf);
    return cpfA.length >= 11 && cpfA === cpfB;
}

/** Verifica se dois pedidos são do mesmo dia */
function sameDay(a: TictoPedido, b: TictoPedido): boolean {
    return a.order_date.substring(0, 10) === b.order_date.substring(0, 10);
}

/** Calcula janela de PV baseado no dia da semana da venda */
function getPVWindowDays(orderDate: string): number {
    const day = new Date(orderDate).getDay(); // 0=Dom, 4=Qui, 5=Sex
    return (day === 4 || day === 5) ? 4 : 2;
}

// ================================================================
// FIXTURES
// ================================================================

const PAI: TictoPedido = {
    transaction_hash: 'TX-PAI-001',
    order_date: '2026-02-10T14:30:00-03:00', // Terça
    customer_email: 'maria@teste.com',
    customer_cpf: '123.456.789-00',
    product_name: 'Kit Desejo Proibido',
    offer_name: 'Oferta Principal',
    status: 'Aprovado',
    paid_amount: 197.00,
};

const ORDER_BUMP: TictoPedido = {
    transaction_hash: 'TX-OB-001',
    order_date: '2026-02-10T14:31:00-03:00', // Mesmo dia
    customer_email: 'maria@teste.com',
    customer_cpf: '123.456.789-00',
    product_name: 'Sérum Extra',
    offer_name: 'OrderBump Sérum',
    status: 'Aprovado',
    paid_amount: 49.90,
};

const UPSELL: TictoPedido = {
    transaction_hash: 'TX-UP-001',
    order_date: '2026-02-11T09:00:00-03:00', // D+1
    customer_email: 'maria@teste.com',
    customer_cpf: '123.456.789-00',
    product_name: 'Kit Bela Forma',
    offer_name: 'Upsell BF',
    status: 'Aprovado',
    paid_amount: 147.00,
};

const POS_VENDA: TictoPedido = {
    transaction_hash: 'TX-PV-001',
    order_date: '2026-02-12T10:00:00-03:00', // D+2
    customer_email: 'maria@teste.com',
    customer_cpf: '123.456.789-00',
    product_name: 'Kit Bela Lumi',
    offer_name: 'CC Bela Lumi',
    status: 'Aprovado',
    paid_amount: 127.00,
};

const DOIS_CARTOES: TictoPedido = {
    transaction_hash: 'TX-2C-001',
    order_date: '2026-02-10T14:30:05-03:00', // Mesmo minuto
    customer_email: 'maria@teste.com',
    customer_cpf: '123.456.789-00',
    product_name: 'Kit Desejo Proibido',
    offer_name: 'Oferta Principal', // Mesma oferta
    status: 'Aprovado',
    paid_amount: 197.00,
};

const OUTRO_CLIENTE: TictoPedido = {
    transaction_hash: 'TX-OUTRO-001',
    order_date: '2026-02-10T15:00:00-03:00',
    customer_email: 'joao@outro.com',
    customer_cpf: '987.654.321-00',
    product_name: 'Kit Desejo Proibido',
    offer_name: 'Oferta Principal',
    status: 'Aprovado',
    paid_amount: 197.00,
};

// ================================================================
// TESTES
// ================================================================

describe('Consolidation Rules', () => {

    describe('extractSigla', () => {
        it('should extract DP for Desejo Proibido', () => {
            expect(extractSigla('Kit Desejo Proibido')).toBe('DP');
            expect(extractSigla('desejo proibido')).toBe('DP');
        });

        it('should extract BL for Bela Lumi', () => {
            expect(extractSigla('Kit Bela Lumi')).toBe('BL');
        });

        it('should extract BF for Bela Forma', () => {
            expect(extractSigla('Kit Bela Forma')).toBe('BF');
        });

        it('should return null for unknown products', () => {
            expect(extractSigla('Produto Desconhecido')).toBeNull();
            expect(extractSigla(null)).toBeNull();
        });
    });

    describe('Order Type Classification', () => {
        it('should identify Order Bumps', () => {
            expect(isOrderBump('OrderBump Sérum')).toBe(true);
            expect(isOrderBump('ORDERBUMP extra')).toBe(true);
            expect(isOrderBump('Oferta Principal')).toBe(false);
        });

        it('should identify Upsells', () => {
            expect(isUpsell('Upsell BF')).toBe(true);
            expect(isUpsell('UPSELL Lumi')).toBe(true);
            expect(isUpsell('Oferta Principal')).toBe(false);
        });

        it('should identify Pós-Venda (CC)', () => {
            expect(isPosVenda('CC Bela Lumi')).toBe(true);
            expect(isPosVenda('cc extra')).toBe(true);
            expect(isPosVenda('Oferta Principal')).toBe(false);
        });

        it('should identify Pedido Pai', () => {
            expect(isPedidoPai('Oferta Principal')).toBe(true);
            expect(isPedidoPai('OrderBump Sérum')).toBe(false);
            expect(isPedidoPai('Upsell BF')).toBe(false);
            expect(isPedidoPai('CC Bela Lumi')).toBe(false);
        });
    });

    describe('Order Bump Matching', () => {
        it('should match OB with same email + same day', () => {
            expect(sameEmail(PAI, ORDER_BUMP)).toBe(true);
            expect(sameDay(PAI, ORDER_BUMP)).toBe(true);
            expect(isOrderBump(ORDER_BUMP.offer_name)).toBe(true);
        });

        it('should NOT match OB from different client', () => {
            expect(sameEmail(PAI, OUTRO_CLIENTE)).toBe(false);
        });
    });

    describe('Upsell Matching', () => {
        it('should match Upsell with same CPF within D+1', () => {
            expect(sameCPF(PAI, UPSELL)).toBe(true);
            expect(isUpsell(UPSELL.offer_name)).toBe(true);

            const paiDate = new Date(PAI.order_date).getTime();
            const upsellDate = new Date(UPSELL.order_date).getTime();
            const diffDays = (upsellDate - paiDate) / (1000 * 60 * 60 * 24);
            expect(diffDays).toBeLessThanOrEqual(1);
        });
    });

    describe('Pós-Venda (CC) Window', () => {
        it('should use 2-day window for Mon-Wed orders', () => {
            // PAI é Terça (dia 10/02/2026)
            expect(getPVWindowDays(PAI.order_date)).toBe(2);
        });

        it('should use 4-day window for Thu-Fri orders', () => {
            const thuOrder = '2026-02-12T14:30:00-03:00'; // Quinta
            expect(getPVWindowDays(thuOrder)).toBe(4);

            const friOrder = '2026-02-13T14:30:00-03:00'; // Sexta
            expect(getPVWindowDays(friOrder)).toBe(4);
        });

        it('should match PV within window', () => {
            expect(sameCPF(PAI, POS_VENDA)).toBe(true);
            expect(isPosVenda(POS_VENDA.offer_name)).toBe(true);

            const paiDate = new Date(PAI.order_date.substring(0, 10)).getTime();
            const pvDate = new Date(POS_VENDA.order_date.substring(0, 10)).getTime();
            const diffDays = (pvDate - paiDate) / (1000 * 60 * 60 * 24);
            const window = getPVWindowDays(PAI.order_date);

            expect(diffDays).toBeGreaterThan(0);
            expect(diffDays).toBeLessThanOrEqual(window);
        });
    });

    describe('2 Cartões Detection', () => {
        it('should detect same email + same offer + same day', () => {
            expect(sameEmail(PAI, DOIS_CARTOES)).toBe(true);
            expect(sameDay(PAI, DOIS_CARTOES)).toBe(true);
            expect(PAI.offer_name).toBe(DOIS_CARTOES.offer_name);
            expect(PAI.transaction_hash).not.toBe(DOIS_CARTOES.transaction_hash);
        });

        it('should NOT detect 2 cartões for different offers', () => {
            expect(PAI.offer_name).not.toBe(ORDER_BUMP.offer_name);
        });
    });

    describe('CPF Cleaning', () => {
        it('should strip formatting', () => {
            expect(cleanCPF('123.456.789-00')).toBe('12345678900');
            expect(cleanCPF('12345678900')).toBe('12345678900');
        });

        it('should handle empty/null', () => {
            expect(cleanCPF('')).toBe('');
            expect(cleanCPF(null as any)).toBe('');
        });
    });

    describe('Package Description Builder', () => {
        it('should build correct description with extras', () => {
            const sigla = extractSigla(PAI.product_name);
            let desc = `${sigla} - ${PAI.offer_name}`;

            const obs = [ORDER_BUMP]; // 1 OB
            const ups = [UPSELL]; // 1 UP
            const pvs = [POS_VENDA]; // 1 PV

            if (obs.length > 0) desc += ` + ${obs.length} OB`;
            if (ups.length > 0) desc += ` + ${ups.length} UP`;
            if (pvs.length > 0) desc += ` + ${pvs.length} PV`;

            expect(desc).toBe('DP - Oferta Principal + 1 OB + 1 UP + 1 PV');
        });

        it('should build simple description without extras', () => {
            const sigla = extractSigla(PAI.product_name);
            const desc = `${sigla} - ${PAI.offer_name}`;
            expect(desc).toBe('DP - Oferta Principal');
        });
    });
});
