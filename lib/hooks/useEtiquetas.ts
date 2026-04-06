import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { toast } from 'sonner';

interface ResetEtiquetaParams {
  pedidoId: string;
  confirmacao: boolean;
}

interface ResetEtiquetaResult {
  success: boolean;
  message?: string;
  error?: string;
  codigo_rastreio_removido?: string;
}

// Hook para resetar etiqueta com confirmação
export function useResetEtiqueta() {
  const queryClient = useQueryClient();

  return useMutation<ResetEtiquetaResult, Error, ResetEtiquetaParams>({
    mutationFn: async ({ pedidoId, confirmacao }) => {
      const { data, error } = await supabase.rpc('resetar_etiqueta_pedido', {
        p_pedido_id: pedidoId,
        p_confirmacao: confirmacao,
      });

      if (error) throw error;
      return data as ResetEtiquetaResult;
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message || 'Etiqueta removida com sucesso!');
        queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      }
    },
    onError: (error) => {
      toast.error('Erro ao remover etiqueta: ' + error.message);
    },
  });
}

// Hook para verificar se um pedido pode ter etiqueta removida
export function useCanRemoveEtiqueta() {
  return async (pedidoId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('pedidos_consolidados_v3')
      .select('codigo_rastreio')
      .eq('id', pedidoId)
      .single();

    if (error || !data) return false;
    return data.codigo_rastreio !== null && data.codigo_rastreio !== '';
  };
}

// Verificar se pedido tem etiqueta
export async function verificarEtiqueta(pedidoId: string): Promise<{ 
  temEtiqueta: boolean; 
  codigoRastreio?: string;
}> {
  const { data, error } = await supabase
    .from('pedidos_consolidados_v3')
    .select('codigo_rastreio')
    .eq('id', pedidoId)
    .single();

  if (error || !data) {
    return { temEtiqueta: false };
  }

  return {
    temEtiqueta: data.codigo_rastreio !== null && data.codigo_rastreio !== '',
    codigoRastreio: data.codigo_rastreio,
  };
}

// Hook para resetar etiquetas em massa
export function useResetEtiquetasEmMassa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pedidoIds: string[]) => {
      const { data, error } = await supabase.rpc('resetar_etiquetas_em_massa', {
        p_pedido_ids: pedidoIds,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success(data.message || `${data.removidos} etiqueta(s) removida(s)!`);
    },
    onError: (error: any) => {
      toast.error('Erro ao remover etiquetas: ' + error.message);
    },
  });
}
