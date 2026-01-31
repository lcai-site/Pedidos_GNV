// Utilitário para calcular dimensões do pacote baseado na descrição

import type { Dimensoes } from '../types/labels';

/**
 * Calcula dimensões do pacote baseado na descrição
 * Regras baseadas no fluxo N8N
 */
export function calcularDimensoes(descricaoPacote: string): Dimensoes {
    const descricao = descricaoPacote.toUpperCase();

    // Regra 1: "1 FRASCO" ou similar
    if (descricao.includes('1 FRASCO') || descricao.match(/\b1\s*F\b/)) {
        return {
            height: 6,
            width: 15,
            length: 13,
            weight: 0.3
        };
    }

    // Regra 2: "2 FRASCOS" ou "COMPRE 1 LEVE 2" ou similar
    if (
        descricao.includes('2 FRASCOS') ||
        descricao.includes('COMPRE 1 LEVE 2') ||
        descricao.match(/\b2\s*F\b/)
    ) {
        return {
            height: 10,
            width: 12,
            length: 16,
            weight: 0.3
        };
    }

    // Regra padrão (para casos não mapeados)
    return {
        height: 10,
        width: 10,
        length: 12,
        weight: 0.3
    };
}
