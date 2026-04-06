import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type TipoAfiliado = 'vendedora' | 'influencer' | 'coprodutor' | 'nao_classificado';

export interface VendedoraPerformance {
    affiliate_id: number;
    affiliate_name: string;
    affiliate_email: string;
    affiliate_phone: string;
    affiliate_pid: string;
    affiliate_tipo: TipoAfiliado;
    is_coprodutor: boolean;
    is_afiliado: boolean;
    total_vendas: number;
    vendas_aprovadas: number;
    vendas_pendentes: number;
    vendas_recusadas: number;
    valor_total_aprovado: number;
    valor_total_pendente: number;
    comissao_total: number;
    ticket_medio: number;
    taxa_conversao: number;
    primeira_venda: string;
    ultima_venda: string;
}

export interface MetricasPosVenda {
    total_vendedoras: number;
    total_vendas_pv: number;
    total_vendas_aprovadas: number;
    faturamento_pv: number;
    faturamento_pendente_pv: number;
    comissao_total: number;
    ticket_medio_geral: number;
    taxa_conversao_geral: number;
    meta_valor: number;
    meta_atingida_pct: number;
    faturamento_periodo_anterior: number;
}

export interface Afiliado {
    id: string;
    affiliate_id: number;
    nome: string;
    email: string;
    telefone: string;
    pid: string;
    documento: string;
    tipo: TipoAfiliado;
    status_afiliacao: string;
    is_coprodutor: boolean;
    is_afiliado: boolean;
    ativo: boolean;
    created_at: string;
    updated_at: string;
}

async function fetchDesempenhoVendedoras(
    startDate: Date,
    endDate: Date,
    tipo: TipoAfiliado | null,
): Promise<VendedoraPerformance[]> {
    const { data, error } = await supabase.rpc('rpc_desempenho_vendedoras', {
        p_data_inicio: startDate.toISOString(),
        p_data_fim: endDate.toISOString(),
        p_tipo: tipo,
    });

    if (error) throw new Error(`Erro ao buscar desempenho: ${error.message}`);
    return (data || []) as VendedoraPerformance[];
}

async function fetchMetricasPosVenda(
    startDate: Date,
    endDate: Date,
    tipo: TipoAfiliado | null,
): Promise<MetricasPosVenda | null> {
    const { data, error } = await supabase.rpc('rpc_metricas_pos_venda', {
        p_data_inicio: startDate.toISOString(),
        p_data_fim: endDate.toISOString(),
        p_tipo: tipo,
    });

    if (error) throw new Error(`Erro ao buscar métricas PV: ${error.message}`);
    if (!data || data.length === 0) return null;
    return data[0] as MetricasPosVenda;
}

export function useDesempenhoVendedoras(
    startDate: Date,
    endDate: Date,
    tipo: TipoAfiliado | null = null,
) {
    const vendedoras = useQuery({
        queryKey: ['desempenho-vendedoras', startDate.toISOString(), endDate.toISOString(), tipo],
        queryFn: () => fetchDesempenhoVendedoras(startDate, endDate, tipo),
        staleTime: 5 * 60 * 1000,
    });

    const metricas = useQuery({
        queryKey: ['metricas-pos-venda', startDate.toISOString(), endDate.toISOString(), tipo],
        queryFn: () => fetchMetricasPosVenda(startDate, endDate, tipo),
        staleTime: 5 * 60 * 1000,
    });

    return {
        vendedoras: vendedoras.data || [],
        metricas: metricas.data || null,
        isLoading: vendedoras.isLoading || metricas.isLoading,
        error: vendedoras.error || metricas.error,
    };
}

export function useClassificarAfiliado() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ affiliateId, tipo }: { affiliateId: number; tipo: TipoAfiliado }) => {
            const { error } = await supabase
                .from('afiliados')
                .update({ tipo })
                .eq('affiliate_id', affiliateId);

            if (error) throw new Error(`Erro ao classificar: ${error.message}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['desempenho-vendedoras'] });
            queryClient.invalidateQueries({ queryKey: ['metricas-pos-venda'] });
        },
    });
}
