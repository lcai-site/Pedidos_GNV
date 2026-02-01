// ================================================================
// ORDER VALIDATION SERVICE
// ================================================================
// Serviço para validação de campos de pedidos

import { ValidationErrors } from '../types/logistics.types';

/**
 * Valida todos os campos de um pedido
 * 
 * @param order - Dados do pedido para validar
 * @returns Objeto com erros de validação (vazio se tudo OK)
 * 
 * @example
 * const errors = validateOrder(order);
 * if (Object.keys(errors).length > 0) {
 *   console.error('Pedido inválido:', errors);
 * }
 */
export const validateOrder = (order: any): ValidationErrors => {
    const errors: ValidationErrors = {};

    // Validar CPF
    const cpfLimpo = order.cpf?.replace(/\D/g, '') || '';
    if (!cpfLimpo || cpfLimpo.length !== 11) {
        errors.cpf = 'CPF deve ter 11 dígitos';
    }

    // Validar Nome
    if (!order.nome_cliente || order.nome_cliente.trim().length < 3) {
        errors.nome = 'Nome deve ter pelo menos 3 caracteres';
    }

    // Validar CEP
    const cepLimpo = order.cep?.replace(/\D/g, '') || '';
    if (!cepLimpo || cepLimpo.length !== 8) {
        errors.cep = 'CEP deve ter 8 dígitos (formato: 00000-000)';
    }

    // Validar Endereço
    if (!order.logradouro || order.logradouro.trim().length < 3) {
        errors.logradouro = 'Logradouro é obrigatório';
    }

    if (!order.numero) {
        errors.numero = 'Número é obrigatório';
    }

    if (!order.bairro || order.bairro.trim().length < 2) {
        errors.bairro = 'Bairro é obrigatório';
    }

    if (!order.cidade || order.cidade.trim().length < 2) {
        errors.cidade = 'Cidade é obrigatória';
    }

    if (!order.estado || order.estado.length !== 2) {
        errors.estado = 'Estado deve ser UF com 2 letras (ex: SP)';
    }

    return errors;
};

/**
 * Valida um campo específico
 * 
 * @param fieldName - Nome do campo
 * @param value - Valor do campo
 * @returns Mensagem de erro ou null se válido
 */
export const validateField = (fieldName: string, value: any): string | null => {
    switch (fieldName) {
        case 'cpf': {
            const cpfLimpo = String(value || '').replace(/\D/g, '');
            if (!cpfLimpo || cpfLimpo.length !== 11) {
                return 'CPF deve ter 11 dígitos';
            }
            break;
        }

        case 'nome':
        case 'nome_cliente':
            if (!value || String(value).trim().length < 3) {
                return 'Nome deve ter pelo menos 3 caracteres';
            }
            break;

        case 'cep': {
            const cepLimpo = String(value || '').replace(/\D/g, '');
            if (!cepLimpo || cepLimpo.length !== 8) {
                return 'CEP deve ter 8 dígitos';
            }
            break;
        }

        case 'logradouro':
            if (!value || String(value).trim().length < 3) {
                return 'Logradouro é obrigatório';
            }
            break;

        case 'numero':
            if (!value) {
                return 'Número é obrigatório';
            }
            break;

        case 'bairro':
            if (!value || String(value).trim().length < 2) {
                return 'Bairro é obrigatório';
            }
            break;

        case 'cidade':
            if (!value || String(value).trim().length < 2) {
                return 'Cidade é obrigatória';
            }
            break;

        case 'estado':
            if (!value || String(value).length !== 2) {
                return 'Estado deve ser UF com 2 letras (ex: SP)';
            }
            break;
    }

    return null;
};

/**
 * Verifica se há erros de validação
 * 
 * @param errors - Objeto de erros
 * @returns true se houver erros
 */
export const hasValidationErrors = (errors: ValidationErrors): boolean => {
    return Object.keys(errors).length > 0;
};
