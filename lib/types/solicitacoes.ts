// Tipos para o Sistema de Solicitações de Pós-Vendas

export type TipoSolicitacao = 'reembolso' | 'mudanca_endereco' | 'mudanca_produto' | 'cancelamento';

export type StatusSolicitacao =
    | 'pendente'      // Aguardando análise
    | 'em_analise'    // Sendo analisada
    | 'aprovada'      // Aprovada
    | 'recusada'      // Recusada
    | 'concluida'     // Concluída
    | 'cancelada';    // Cancelada

export type PrioridadeSolicitacao = 'baixa' | 'normal' | 'alta' | 'urgente';

// Dados específicos por tipo de solicitação

export interface DadosReembolso {
    motivo: string;
    valor_solicitado: number;
    forma_devolucao: 'pix' | 'credito' | 'estorno_cartao';
    chave_pix?: string;
    banco?: string;
    agencia?: string;
    conta?: string;
}

export interface DadosMudancaEndereco {
    motivo: string;
    endereco_atual: {
        cep: string;
        rua: string;
        numero: string;
        complemento?: string;
        bairro: string;
        cidade: string;
        estado: string;
    };
    endereco_novo: {
        cep: string;
        rua: string;
        numero: string;
        complemento?: string;
        bairro: string;
        cidade: string;
        estado: string;
    };
}

export interface DadosMudancaProduto {
    motivo: string;
    produto_atual: string;
    produto_desejado: string;
    diferenca_valor?: number;
}

export interface DadosCancelamento {
    motivo: string;
    motivo_detalhado?: string;
}

export type DadosSolicitacao =
    | DadosReembolso
    | DadosMudancaEndereco
    | DadosMudancaProduto
    | DadosCancelamento;

// Interface principal da solicitação

export interface Solicitacao {
    id: string;
    pedido_id: string;
    cliente_nome: string;
    cliente_email?: string;
    cliente_telefone?: string;

    tipo: TipoSolicitacao;
    status: StatusSolicitacao;
    prioridade: PrioridadeSolicitacao;

    dados_solicitacao: DadosSolicitacao;
    comprovantes?: string[];

    observacoes?: string;
    observacoes_internas?: string;

    criado_por?: string;
    aprovado_por?: string;

    created_at: string;
    updated_at: string;
    aprovado_em?: string;
    concluido_em?: string;
}

// Interface para criação de solicitação

export interface CriarSolicitacaoInput {
    pedido_id: string;
    cliente_nome: string;
    cliente_email?: string;
    cliente_telefone?: string;
    tipo: TipoSolicitacao;
    prioridade?: PrioridadeSolicitacao;
    dados_solicitacao: DadosSolicitacao;
    comprovantes?: string[];
    observacoes?: string;
}

// Interface para atualização de solicitação

export interface AtualizarSolicitacaoInput {
    status?: StatusSolicitacao;
    prioridade?: PrioridadeSolicitacao;
    observacoes?: string;
    observacoes_internas?: string;
    aprovado_por?: string;
}

// Interface para histórico

export interface SolicitacaoHistorico {
    id: string;
    solicitacao_id: string;
    campo_alterado: string;
    valor_anterior: string;
    valor_novo: string;
    alterado_por?: string;
    alterado_em: string;
}

// Helpers de status

export const STATUS_LABELS: Record<StatusSolicitacao, string> = {
    pendente: 'Pendente',
    em_analise: 'Em Análise',
    aprovada: 'Aprovada',
    recusada: 'Recusada',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
};

export const STATUS_COLORS: Record<StatusSolicitacao, string> = {
    pendente: 'yellow',
    em_analise: 'blue',
    aprovada: 'green',
    recusada: 'red',
    concluida: 'gray',
    cancelada: 'gray',
};

export const TIPO_LABELS: Record<TipoSolicitacao, string> = {
    reembolso: 'Reembolso',
    mudanca_endereco: 'Mudança de Endereço',
    mudanca_produto: 'Mudança de Produto',
    cancelamento: 'Cancelamento',
};

export const PRIORIDADE_LABELS: Record<PrioridadeSolicitacao, string> = {
    baixa: 'Baixa',
    normal: 'Normal',
    alta: 'Alta',
    urgente: 'Urgente',
};

export const PRIORIDADE_COLORS: Record<PrioridadeSolicitacao, string> = {
    baixa: 'gray',
    normal: 'blue',
    alta: 'orange',
    urgente: 'red',
};
