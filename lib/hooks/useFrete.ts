import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import { logger } from '../utils/logger';

export interface CotacaoFrete {
  tipo: string;
  nome: string;
  codigo: string;
  valor: number;
  prazo: number;
  disponivel: boolean;
}

export interface CotacaoResponse {
  success: boolean;
  cotacoes: CotacaoFrete[];
  melhor_opcao?: CotacaoFrete;
  error?: string;
}

// Hook para consultar cotação de frete
export function useConsultarFrete() {
  return useMutation({
    mutationFn: async ({
      cep,
      peso,
      pedidoId,
    }: {
      cep: string;
      peso?: number;
      pedidoId?: string;
    }): Promise<CotacaoResponse> => {
      const { data, error } = await supabase.functions.invoke('correios-cotacao', {
        body: {
          cep,
          peso: peso || 300,
          comprimento: 20,
          largura: 16,
          altura: 4,
          pedido_id: pedidoId,
        },
      });

      if (error) throw error;
      return data as CotacaoResponse;
    },
    onError: (error: any) => {
      toast.error('Erro ao consultar frete: ' + error.message);
    },
  });
}

// Hook para gerar etiqueta com tipo de envio escolhido
export function useGerarEtiquetaComFrete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pedidoId,
      tipoEnvio,
      valorFrete,
    }: {
      pedidoId: string;
      tipoEnvio: 'MINI_ENVIOS' | 'PAC' | 'SEDEX';
      valorFrete: number;
    }) => {
      // 1. Salvar o tipo de envio e valor escolhidos
      const { error: updateError } = await supabase.rpc('atualizar_valor_frete', {
        p_pedido_id: pedidoId,
        p_valor_frete: valorFrete,
        p_tipo_envio: tipoEnvio,
      });

      if (updateError) throw updateError;

      // 2. Gerar a etiqueta (aqui você chama sua função existente)
      // A função correios-labels precisa ser atualizada para usar o tipo de envio

      return { success: true, pedidoId, tipoEnvio, valorFrete };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success('Etiqueta gerada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao gerar etiqueta: ' + error.message);
    },
  });
}

// Hook para marcar pedido como postado
export function useMarcarPostado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pedidoId: string) => {
      const { data, error } = await supabase.rpc('marcar_pedido_postado', {
        p_pedido_id: pedidoId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      // Removido toast individual - será usado em massa
    },
    onError: (error: any) => {
      toast.error('Erro: ' + error.message);
    },
  });
}

// Hook para marcar múltiplos pedidos como postado (EM MASSA)
export function useMarcarPostadoEmMassa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pedidoIds: string[]) => {
      const { data, error } = await supabase.rpc('marcar_pedidos_postados_em_massa', {
        p_pedido_ids: pedidoIds,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      // Apenas UMA notificação com o total
      toast.success(`${data.atualizados} pedido(s) marcado(s) como postado!`);
    },
    onError: (error: any) => {
      toast.error('Erro ao marcar pedidos: ' + error.message);
    },
  });
}

// Hook para voltar pedidos de ENVIADOS para ENVIOS
export function useVoltarParaEnvios() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pedidoIds: string[]) => {
      const { data, error } = await supabase.rpc('voltar_pedidos_para_envios', {
        p_pedido_ids: pedidoIds,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast.success(`${data.atualizados} pedido(s) voltaram para ENVIOS!`);
    },
    onError: (error: any) => {
      toast.error('Erro ao voltar pedidos: ' + error.message);
    },
  });
}

// Hook para buscar totalização de frete
// filtroStatus: 'etiquetados' (sem data_postagem) | 'enviados' (com data_postagem) | undefined (todos)
export function useTotalizacaoFrete(dataInicio?: string, dataFim?: string, filtroStatus?: 'etiquetados' | 'enviados') {
  return useQuery({
    queryKey: ['totalizacao-frete', dataInicio, dataFim, filtroStatus],
    queryFn: async () => {
      logger.debug('Buscando totalização de frete', {
        hook: 'useTotalizacaoFrete',
        dataInicio,
        dataFim,
        filtroStatus
      });

      let query = supabase
        .from('pedidos_consolidados_v3')
        .select('tipo_envio, valor_frete, logistica_servico, logistica_valor, status_envio, codigo_rastreio, data_postagem')
        .not('codigo_rastreio', 'is', null);

      if (filtroStatus === 'etiquetados') {
        query = query.is('data_postagem', null);
      } else if (filtroStatus === 'enviados') {
        query = query.not('data_postagem', 'is', null);
      }

      if (dataInicio) {
        query = query.gte('data_venda', dataInicio);
      }
      if (dataFim) {
        query = query.lte('data_venda', dataFim);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Erro ao buscar totalização de frete', error, { hook: 'useTotalizacaoFrete' });
        throw error;
      }

      // Calcular totalizações
      const totalizacao = {
        mini_envios: { count: 0, valor: 0 },
        pac: { count: 0, valor: 0 },
        sedex: { count: 0, valor: 0 },
        total: { count: 0, valor: 0 },
      };

      data?.forEach((pedido: any) => {
        const tipo = pedido.tipo_envio || pedido.logistica_servico;
        const valor = pedido.valor_frete !== undefined && pedido.valor_frete !== null
          ? pedido.valor_frete
          : pedido.logistica_valor;

        if (valor && tipo) {
          const tipoUpper = tipo.toUpperCase();
          const valorNum = Number(valor);

          if (tipoUpper.includes('MINI')) {
            totalizacao.mini_envios.count++;
            totalizacao.mini_envios.valor += valorNum;
          } else if (tipoUpper === 'PAC') {
            totalizacao.pac.count++;
            totalizacao.pac.valor += valorNum;
          } else if (tipoUpper === 'SEDEX') {
            totalizacao.sedex.count++;
            totalizacao.sedex.valor += valorNum;
          }
          totalizacao.total.count++;
          totalizacao.total.valor += valorNum;
        }
      });

      logger.debug('Totalização de frete', { hook: 'useTotalizacaoFrete', totalizacao });
      return totalizacao;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Formatar valor em moeda
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}
