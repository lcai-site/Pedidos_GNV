import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { toast } from 'sonner';

export const ECOMMERCE_AFFILIATES_KEY = ['ecommerce-afiliados'];
export const ECOMMERCE_AFFILIATE_METRICS_KEY = ['ecommerce-afiliados-metrics'];

export interface EcommerceAffiliate {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  tipo: 'gerente' | 'afiliado';
  gerente_id: string | null;
  codigo_rastreio: string;
  taxa_comissao: number;
  status: 'ativo' | 'inativo' | 'pendente';
  created_at: string;
  
  // Relations mapped by Supabase via left join
  gerente?: {
    nome: string;
  };
}

export function useEcommerceAffiliates() {
  return useQuery<EcommerceAffiliate[]>({
    queryKey: ECOMMERCE_AFFILIATES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecommerce_afiliados')
        .select(`
          *,
          gerente:gerente_id ( nome )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateEcommerceAffiliado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newAfiliado: Omit<EcommerceAffiliate, 'id' | 'created_at' | 'gerente'>) => {
      // Ensure unique tracking code doesn't exist already
      const { data: existing } = await supabase
        .from('ecommerce_afiliados')
        .select('id')
        .eq('codigo_rastreio', newAfiliado.codigo_rastreio)
        .single();
        
      if (existing) throw new Error('Código de rastreio já está em uso.');

      const { data, error } = await supabase
        .from('ecommerce_afiliados')
        .insert([newAfiliado])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Membro da equipe criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ECOMMERCE_AFFILIATES_KEY });
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar membro: ' + error.message);
    },
  });
}

export function useUpdateEcommerceAffiliado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EcommerceAffiliate> }) => {
      const { data, error } = await supabase
        .from('ecommerce_afiliados')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Membro da equipe atualizado!');
      queryClient.invalidateQueries({ queryKey: ECOMMERCE_AFFILIATES_KEY });
      queryClient.invalidateQueries({ queryKey: ECOMMERCE_AFFILIATE_METRICS_KEY });
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar membro: ' + error.message);
    },
  });
}

export function useEcommerceAffiliateMetrics() {
  return useQuery({
    queryKey: ECOMMERCE_AFFILIATE_METRICS_KEY,
    queryFn: async () => {
      const [afiliadosRes, gerentesRes] = await Promise.all([
        supabase.from('vw_ecommerce_afiliados_metricas').select('*'),
        supabase.from('vw_ecommerce_gerentes_metricas').select('*')
      ]);

      if (afiliadosRes.error) throw afiliadosRes.error;
      if (gerentesRes.error) throw gerentesRes.error;

      return {
        afiliadosMetrics: afiliadosRes.data,
        gerentesMetrics: gerentesRes.data
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}
