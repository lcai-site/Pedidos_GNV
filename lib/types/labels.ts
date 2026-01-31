// Tipos para o sistema de etiquetas e Melhor Envio

export interface Dimensoes {
    height: number;  // altura
    width: number;   // largura
    length: number;  // comprimento
    weight: number;  // peso (compatível com packageDimensions)
}

export interface PedidoParaEtiqueta {
    id: string;
    nome_cliente: string;
    cpf: string;
    telefone: string;
    email: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
    descricao_pacote?: string;
    dimensoes?: Dimensoes;
}

export interface Cotacao {
    id: number;
    name: string;
    price: string;
    custom_price: string;
    discount: string;
    currency: string;
    delivery_time: number;
    delivery_range: {
        min: number;
        max: number;
    };
    packages: Array<{
        price: string;
        discount: string;
        format: string;
        weight: string;
        insurance_value: string;
        products: unknown[];
        dimensions: {
            height: number;
            width: number;
            length: number;
        };
    }>;
    company: {
        id: number;
        name: string;
        picture: string;
    };
}

export interface ErroEtiqueta {
    pedido_id?: string;  // Opcional para compatibilidade com aiAnalysisService
    cpf?: string;
    nome?: string;      // usado em aiAnalysisService
    endereco?: string;  // usado em aiAnalysisService
    erro: string;
    detalhes?: unknown;
}

export interface ResultadoEtiqueta {
    pedido_id: string;
    status: 'sucesso' | 'erro';
    etiqueta_url?: string;
    rastreio?: string;
    erro?: string;
    // Campos extras usados em labelGenerationService
    cpf?: string;
    nome?: string;
    mensagem?: string;
    sugestao_ia?: string;
}

export interface JobStatus {
    id: string;
    produto: 'DP' | 'BF' | 'BL';
    status: 'processando' | 'concluido' | 'erro';
    total: number;
    processados: number;
    sucesso: number;
    erros: number;
    detalhes: ResultadoEtiqueta[];
    created_at: Date;
    updated_at: Date;
}
