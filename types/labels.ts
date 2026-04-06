// Tipos para o sistema de geração de etiquetas

export interface Dimensoes {
    height: number;
    width: number;
    length: number;
    weight: number;
}

export interface Cotacao {
    id: number;
    name: string;
    price: string;
    company: {
        id: number;
        name: string;
    };
}

export interface PedidoParaEtiqueta {
    id: string;
    cpf: string;
    nome_cliente: string;
    telefone?: string;
    cliente_cpf?: string;
    cliente_nome?: string;
    cliente_cep?: string;
    endereco_rua?: string;
    endereco_numero?: string;
    endereco_complemento?: string;
    endereco_bairro?: string;
    endereco_cidade?: string;
    endereco_estado?: string;
    cliente_email?: string;
    nome_oferta?: string;
    cep: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    email?: string;
    endereco_completo?: string;
    descricao_pacote: string;
    peso?: number;
    dimensoes?: {
        altura: number;
        largura: number;
        comprimento: number;
    };
    observacao?: string;
    tentativas_geracao?: number;
}

export interface ResultadoEtiqueta {
    cpf: string;
    nome: string;
    status: 'sucesso' | 'erro';
    codigo_rastreio?: string;
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

export interface ErroEtiqueta {
    cpf: string;
    nome: string;
    endereco: string;
    erro: string;
}
