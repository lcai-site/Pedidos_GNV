// ================================================================
// CONSTANTES DO MÓDULO LOGISTICS
// ================================================================

import { DeepSearchKeys } from '../types/logistics.types';

/**
 * Chaves para busca profunda em objetos aninhados
 * Usado pela função getDeepVal para encontrar valores em estruturas JSON complexas
 */
export const DEEP_SEARCH_KEYS: DeepSearchKeys = {
    nome: ['nome_cliente', 'cliente_nome', 'cliente', 'nome', 'full_name', 'name', 'buyer_name'],
    cpf: ['cpf', 'cliente_cpf', 'doc', 'documento', 'cpf_cliente', 'tax_id', 'vat_number'],
    phone: ['telefone', 'cliente_telefone', 'phone', 'celular', 'whatsapp', 'phone_number', 'mobile'],
    email: ['email_cliente', 'email', 'cliente_email', 'contact_email', 'buyer_email', 'user_email', 'mail'],
    zip: ['cep', 'zip', 'zipcode', 'zip_code', 'postal_code'],
    street: ['rua', 'logradouro', 'street', 'street_name', 'address_line_1', 'endereco_rua', 'thoroughfare'],
    number: ['numero', 'number', 'street_number', 'num', 'endereco_numero', 'house_number', 'nr', 'n'],
    comp: ['complemento', 'comp', 'complement', 'address_line_2', 'endereco_complemento', 'extra'],
    neighborhood: ['bairro', 'neighborhood', 'district', 'endereco_bairro', 'suburb'],
    city: ['cidade', 'city', 'municipio', 'endereco_cidade', 'town'],
    state: ['estado', 'uf', 'state', 'state_code', 'endereco_estado', 'region'],
    fullAddress: ['endereco', 'endereco_completo', 'full_address', 'cliente_endereco', 'address', 'formatted_address']
};

/**
 * Colunas JSON que devem ser atualizadas com deep patch
 */
export const JSON_COLUMNS = ['dados_entrega', 'endereco_json', 'shipping', 'customer', 'metadata'];

/**
 * Tamanhos de página disponíveis para paginação
 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * Produtos disponíveis para geração de etiquetas
 */
export const PRODUCT_TYPES = {
    DP: 'Desejo Proibido',
    BF: 'Bela Forma',
    BL: 'Bela Lumi'
} as const;
