import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Estoque, EstoqueMovimentacao } from '../types/estoque';
import { toast } from 'sonner';

const ESTOQUE_KEY = ['estoque'] as const;
const MOVIMENTACOES_KEY = ['estoque-movimentacoes'] as const;

async function fetchEstoque(): Promise<Estoque[]> {
    const { data, error } = await supabase
        .from('estoque')
        .select('*')
        .order('nome_produto');

    if (error) throw error;
    return data || [];
}

async function fetchMovimentacoes(limit = 20): Promise<EstoqueMovimentacao[]> {
    const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data || [];
}

export function useEstoque() {
    return useQuery<Estoque[]>({
        queryKey: ESTOQUE_KEY,
        queryFn: fetchEstoque,
        staleTime: 1000 * 30, // 30 seconds
    });
}

export function useMovimentacoes(limit = 20) {
    return useQuery<EstoqueMovimentacao[]>({
        queryKey: [...MOVIMENTACOES_KEY, limit],
        queryFn: () => fetchMovimentacoes(limit),
        staleTime: 1000 * 30,
    });
}

export function useCadastrarProduto() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: { codigo: string; nome: string; quantidade: number; limiteAlerta: number }) => {
            const { error } = await supabase.rpc('inserir_produto', {
                p_codigo: params.codigo,
                p_nome: params.nome,
                p_quantidade: params.quantidade,
                p_limite_alerta: params.limiteAlerta,
            });

            if (error) {
                // Fallback: insert direto
                const { error: insertError } = await supabase
                    .from('estoque')
                    .insert({
                        produto: params.codigo.toUpperCase(),
                        nome_produto: params.nome,
                        quantidade_atual: params.quantidade,
                        limite_alerta: params.limiteAlerta,
                    });
                if (insertError) throw insertError;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ESTOQUE_KEY });
            queryClient.invalidateQueries({ queryKey: MOVIMENTACOES_KEY });
            toast.success('Produto cadastrado com sucesso!');
        },
        onError: (err: Error) => {
            toast.error(err.message || 'Erro ao cadastrar produto');
        },
    });
}

export function useAtualizarEstoque() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: { estoqueId: string; novaQuantidade: number; motivo: string }) => {
            const { error } = await supabase
                .from('estoque')
                .update({
                    quantidade_atual: params.novaQuantidade,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', params.estoqueId);

            if (error) throw error;

            // Registrar movimentação se a tabela existir
            await supabase
                .from('estoque_movimentacoes')
                .insert({
                    estoque_id: params.estoqueId,
                    motivo: params.motivo,
                    quantidade: params.novaQuantidade,
                    tipo: 'ajuste',
                })
                .then(() => { }); // fire and forget
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ESTOQUE_KEY });
            queryClient.invalidateQueries({ queryKey: MOVIMENTACOES_KEY });
            toast.success('Estoque atualizado!');
        },
        onError: () => {
            toast.error('Erro ao atualizar estoque');
        },
    });
}

export function useDeletarProduto() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (estoqueId: string) => {
            const { error } = await supabase
                .from('estoque')
                .delete()
                .eq('id', estoqueId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ESTOQUE_KEY });
            queryClient.invalidateQueries({ queryKey: MOVIMENTACOES_KEY });
            toast.success('Produto excluído');
        },
        onError: () => {
            toast.error('Erro ao excluir produto');
        },
    });
}
