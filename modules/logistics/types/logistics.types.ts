// ================================================================
// TIPOS DO MÓDULO LOGISTICS
// ================================================================

import { PedidoUnificado } from '../../../types';

// --- Tipos de Filtros ---
export interface OrderFilters {
    searchTerm: string;
    shippingRefDate: string;
    activeTab: 'ready' | 'waiting';
    page: number;
    pageSize: number;
}

// --- Tipos de Validação ---
export interface ValidationErrors {
    [key: string]: string;
}

// --- Tipos de Formulário de Edição ---
export interface EditOrderForm {
    nome: string;
    cpf: string;
    telefone: string;
    email: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    estado: string;
    observacao: string;
}

// --- Tipos de Geração de Etiquetas ---
export interface LabelProgress {
    total: number;
    processados: number;
    sucesso: number;
    erros: number;
    detalhes: any[];
    concluido: boolean;
}

export type ProductType = 'DP' | 'BF' | 'BL';

// --- Tipos de Categorização ---
export interface CategorizedOrders {
    ready: PedidoUnificado[];
    waiting: PedidoUnificado[];
}

// --- Tipos de Paginação ---
export interface PaginationState {
    page: number;
    pageSize: number;
    totalPages: number;
}

// --- Chaves para Deep Search ---
export interface DeepSearchKeys {
    nome: string[];
    cpf: string[];
    phone: string[];
    email: string[];
    zip: string[];
    street: string[];
    number: string[];
    comp: string[];
    neighborhood: string[];
    city: string[];
    state: string[];
    fullAddress: string[];
}

// Re-export do tipo principal
export type { PedidoUnificado };
