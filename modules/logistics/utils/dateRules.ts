// ================================================================
// DATE RULES UTILITIES
// ================================================================
// Regras de cálculo de datas de envio (janela de pós-venda)

import { addDays, getDay } from 'date-fns';

/**
 * Calcula a data segura de envio baseado nas regras de janela de pós-venda
 * 
 * Regras:
 * - Quinta-feira: +4 dias (Segunda encerra janela)
 * - Sexta-feira: +4 dias (Terça encerra janela)
 * - Outros dias: +2 dias
 * 
 * @param orderDateStr - Data da venda (ISO string)
 * @returns Data segura de envio
 * 
 * @example
 * getSafeShipDate("2026-01-29") // Quinta → +4 dias = 2026-02-02 (Segunda)
 * getSafeShipDate("2026-01-27") // Terça → +2 dias = 2026-01-29 (Quinta)
 */
export const getSafeShipDate = (orderDateStr: string): Date => {
    const d = new Date(orderDateStr);
    const dayOfWeek = getDay(d); // 0 = Domingo, 4 = Quinta, 5 = Sexta

    // Quinta (4) → +4 dias (Segunda encerra janela)
    if (dayOfWeek === 4) {
        return addDays(d, 4);
    }

    // Sexta (5) → +4 dias (Terça encerra janela)
    if (dayOfWeek === 5) {
        return addDays(d, 4);
    }

    // Dias normais → +2 dias
    return addDays(d, 2);
};

/**
 * Verifica se uma data está dentro da janela de pós-venda
 * 
 * @param orderDate - Data da venda
 * @param referenceDate - Data de referência (hoje)
 * @returns true se ainda está na janela de pós-venda
 */
export const isWithinPostSaleWindow = (orderDate: Date, referenceDate: Date): boolean => {
    const safeShipDate = getSafeShipDate(orderDate.toISOString());
    return referenceDate < safeShipDate;
};
