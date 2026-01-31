// ================================================================
// ADDRESS PARSER UTILITIES
// ================================================================
// Funções para parsear e formatar endereços

/**
 * Parseia uma string de endereço completo em componentes individuais
 * 
 * @param fullAddr - Endereço completo como string
 * @returns Objeto com componentes do endereço
 * 
 * @example
 * parseAddressString("Av Paulista, 1000, Bela Vista, São Paulo - SP, 01310-100")
 * // { logradouro: "Av Paulista", numero: "1000", bairro: "Bela Vista", cidade: "São Paulo", estado: "SP", cep: "01310100" }
 */
export const parseAddressString = (fullAddr: string) => {
    if (!fullAddr) return {};

    const result: any = {};

    // Extrair CEP (formato: 00000-000 ou 00000000)
    const cepMatch = fullAddr.match(/\b\d{5}[-.\s]?\d{3}\b/);
    if (cepMatch) result.cep = cepMatch[0].replace(/\D/g, '');

    // Extrair UF (2 letras maiúsculas no final ou após hífen)
    const ufMatch = fullAddr.match(/\b([A-Z]{2})\b$/) || fullAddr.match(/-\s*([A-Z]{2})\b/);
    if (ufMatch) result.estado = ufMatch[1];

    // Dividir por vírgulas
    const parts = fullAddr.split(',').map(p => p.trim());

    if (parts.length >= 1) result.logradouro = parts[0];

    if (parts.length >= 2) {
        // Se a segunda parte é um número ou "s/n", é o número da rua
        if (/^(\d+|s\/n|sn)$/i.test(parts[1])) {
            result.numero = parts[1];
            if (parts.length >= 3) result.bairro = parts[2];
            if (parts.length >= 4) result.cidade = parts[3];
        } else {
            // Senão, é o bairro
            result.bairro = parts[1];
            if (parts.length >= 3) result.cidade = parts[2];
        }
    }

    return result;
};

/**
 * Formata um endereço completo a partir dos componentes
 * 
 * @param components - Componentes do endereço
 * @returns String formatada
 * 
 * @example
 * formatAddress({ logradouro: "Av Paulista", numero: "1000", bairro: "Bela Vista", cidade: "São Paulo", estado: "SP", cep: "01310100" })
 * // "Av Paulista, 1000 - Bela Vista, São Paulo - SP, 01310-100"
 */
export const formatAddress = (components: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
}): string => {
    const parts: string[] = [];

    if (components.logradouro) {
        let line1 = components.logradouro;
        if (components.numero) line1 += `, ${components.numero}`;
        if (components.complemento) line1 += ` - ${components.complemento}`;
        parts.push(line1);
    }

    if (components.bairro) parts.push(components.bairro);

    if (components.cidade) {
        let cityLine = components.cidade;
        if (components.estado) cityLine += ` - ${components.estado}`;
        parts.push(cityLine);
    }

    if (components.cep) {
        const cepFormatted = components.cep.replace(/(\d{5})(\d{3})/, '$1-$2');
        parts.push(cepFormatted);
    }

    return parts.join(', ').replace(/, ,/g, ',');
};

/**
 * Formata códigos de grupo (pode ser string ou array)
 * 
 * @param codes - Códigos como string ou array
 * @returns String formatada
 */
export const formatGroupCodes = (codes: string | string[] | null | undefined): string => {
    if (!codes) return '-';
    if (Array.isArray(codes)) return codes.join(', ');
    return String(codes);
};
