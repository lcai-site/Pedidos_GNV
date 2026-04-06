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
 * @param dateStr - Data de referência (confirmação do pagamento ou venda)
 * @returns Data segura de envio
 */
export const getSafeShipDate = (dateStr: string): Date => {
    const d = new Date(dateStr);
    const dayOfWeek = getDay(d); // 0 = Domingo, 4 = Quinta, 5 = Sexta

    // Quinta (4) ou Sexta (5) → +4 dias para garantir a janela de pós-venda
    if (dayOfWeek === 4 || dayOfWeek === 5) {
        return addDays(d, 4);
    }

    // Dias normais → +2 dias
    return addDays(d, 2);
};

/**
 * Calcula o dia em que o Pós-Venda deve ser realizado (próximo dia útil após a referência)
 * 
 * Regras:
 * - Sexta (5), Sábado (6) ou Domingo (0) → Segunda-feira
 * - Demais → dia seguinte
 * 
 * @param dateStr - Data de referência (confirmação do pagamento ou venda)
 * @returns Data do Pós-Venda
 */
export const getPostSaleDate = (dateStr: string): Date => {
    const d = new Date(dateStr);
    const dayOfWeek = getDay(d);

    if (dayOfWeek === 5) return addDays(d, 3); // Sexta → Segunda
    if (dayOfWeek === 6) return addDays(d, 2); // Sábado → Segunda
    if (dayOfWeek === 0) return addDays(d, 1); // Domingo → Segunda

    return addDays(d, 1); // Dias normais → dia seguinte
};

export const isWithinPostSaleWindow = (orderDate: Date, referenceDate: Date): boolean => {
    const safeShipDate = getSafeShipDate(orderDate.toISOString());
    return referenceDate < safeShipDate;
};
