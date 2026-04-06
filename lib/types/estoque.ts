/**
 * Tipos para o Sistema de Controle de Estoque
 */

export interface Estoque {
    id: string;
    produto: string;
    nome_produto: string;
    quantidade_atual: number;
    limite_alerta: number;
    created_at: string;
    updated_at: string;
}

export interface EstoqueMovimentacao {
    id: string;
    estoque_id: string;
    tipo: 'entrada' | 'saida';
    quantidade: number;
    quantidade_anterior: number;
    quantidade_nova: number;
    motivo?: string;
    usuario_id?: string;
    pedido_id?: string;
    created_at: string;
}

export type ProdutoCode = 'DP' | 'BF' | 'BL';

export const PRODUTOS_INFO: Record<ProdutoCode, { nome: string; cor: string }> = {
    DP: { nome: 'Desejo Proibido', cor: 'rose' },
    BF: { nome: 'Bela Forma', cor: 'emerald' },
    BL: { nome: 'Bela Lumi', cor: 'amber' },
};
