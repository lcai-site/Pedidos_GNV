// Utilitário para calcular dimensões do pacote baseado na descrição

import type { Dimensoes } from '../types/labels';

/**
 * Calcula dimensões do pacote baseado na descrição
 * Regras baseadas no fluxo N8N
 */
export function calcularDimensoes(descricaoPacote: string): Dimensoes {
    const descricao = descricaoPacote.toUpperCase();

    // BELA FORMA (BF)
    // Caixa Real: 13.5cm (L) x 11.5cm (C) x 5cm (A)
    // Regra API (mínimo exigido 15x10x1): Vamos arredondar o comprimento (C) para 16cm pro sistema aceitar.
    // Atencão: Altura de 5cm NÃO passa no Mini Envios (máx 4cm), então para BF só teremos PAC/Sedex!
    if (descricao.includes('BF -') || descricao.includes('BELA FORMA')) {
        return {
            height: 5,
            width: 14,
            length: 16,
            weight: 0.25
        };
    }

    // BELA LUMI (BL)
    // Caixa Real: 11cm (L) x 18.5cm (C) x 4cm (A)
    // Passa no Mini Envios!
    if (descricao.includes('BL -') || descricao.includes('BELA LUMI')) {
        return {
            height: 4,
            width: 11,
            length: 19, // Arredondado 18.5 pra cima
            weight: 0.25
        };
    }

    // DESEJO PROIBIDO (DP)
    // Caixa Real: 10cm (L) x 12.5cm (C) x 4cm (A)
    // Regra API (mínimo exigido 15x10x1): Enviar 12.5 de comprimento é barrado na hora! Arredondado para 16cm.
    // Passa no Mini Envios perfeitamente!
    if (descricao.includes('DP -') || descricao.includes('DESEJO PROIBIDO')) {
        return {
            height: 4,
            width: 11,
            length: 16,
            weight: 0.25
        };
    }

    // Padrão de segurança cravado para forçar aprovação no Mini Envios caso o nome não bata
    return {
        height: 4,
        width: 11,
        length: 16,
        weight: 0.25
    };
}
