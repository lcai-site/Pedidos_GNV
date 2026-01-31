// ================================================================
// DEEP SEARCH UTILITIES
// ================================================================
// Funções para buscar valores em objetos JSON aninhados e complexos

import { DEEP_SEARCH_KEYS } from '../constants';

/**
 * Busca um valor em um objeto aninhado usando uma lista de chaves possíveis
 * 
 * @param obj - Objeto para buscar
 * @param keys - Lista de chaves possíveis (em ordem de prioridade)
 * @returns Valor encontrado ou string vazia
 * 
 * @example
 * const nome = getDeepVal(order, DEEP_SEARCH_KEYS.nome);
 * // Busca: nome_cliente, cliente_nome, cliente, nome, full_name, name, buyer_name
 */
export const getDeepVal = (obj: any, keys: string[]): string => {
    if (!obj) return '';

    // 1. Buscar no nível raiz do objeto
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null && typeof obj[key] !== 'object' && String(obj[key]).trim() !== '') {
            return String(obj[key]);
        }
    }

    // 2. Buscar em objetos aninhados comuns
    const targets = [
        obj.metadata,
        obj.customer,
        obj.shipping,
        obj.address,
        obj.dados_entrega,
        obj.endereco_json,
        obj.payer,
        obj.metadata?.customer,
        obj.metadata?.buyer,
        obj.metadata?.address,
        obj.customer?.address
    ];

    for (const target of targets) {
        if (target && typeof target === 'object') {
            for (const key of keys) {
                if (target[key] !== undefined && target[key] !== null && typeof target[key] !== 'object' && String(target[key]).trim() !== '') {
                    return String(target[key]);
                }
            }
        }
    }

    return '';
};

/**
 * Busca múltiplos valores de uma vez
 * 
 * @param obj - Objeto para buscar
 * @returns Objeto com todos os valores encontrados
 * 
 * @example
 * const data = getDeepValues(order);
 * console.log(data.nome, data.cpf, data.email);
 */
export const getDeepValues = (obj: any) => ({
    nome: getDeepVal(obj, DEEP_SEARCH_KEYS.nome),
    cpf: getDeepVal(obj, DEEP_SEARCH_KEYS.cpf),
    telefone: getDeepVal(obj, DEEP_SEARCH_KEYS.phone),
    email: getDeepVal(obj, DEEP_SEARCH_KEYS.email),
    cep: getDeepVal(obj, DEEP_SEARCH_KEYS.zip),
    logradouro: getDeepVal(obj, DEEP_SEARCH_KEYS.street),
    numero: getDeepVal(obj, DEEP_SEARCH_KEYS.number),
    complemento: getDeepVal(obj, DEEP_SEARCH_KEYS.comp),
    bairro: getDeepVal(obj, DEEP_SEARCH_KEYS.neighborhood),
    cidade: getDeepVal(obj, DEEP_SEARCH_KEYS.city),
    estado: getDeepVal(obj, DEEP_SEARCH_KEYS.state),
    enderecoCompleto: getDeepVal(obj, DEEP_SEARCH_KEYS.fullAddress)
});
