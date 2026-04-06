import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import { logger } from '../utils/logger';

// ============================================
// TIPOS
// ============================================

export interface Pipeline {
  id: string;
  created_at: string;
  nome: string;
  descricao?: string;
  cor: string;
  ativo: boolean;
  ordem: number;
}

export interface Etapa {
  id: string;
  created_at: string;
  pipeline_id: string;
  nome: string;
  descricao?: string;
  cor: string;
  ordem: number;
  ativo: boolean;
  tipo: 'manual' | 'automatico' | 'finalizacao' | 'descarte';
  sla_horas?: number;
  alerta_sla: boolean;
  probabilidade: number;
  regras_entrada?: any[];
}

export interface Tag {
  id: string;
  created_at: string;
  nome: string;
  cor: string;
  icone?: string;
  categoria: string;
  ativo: boolean;
}

export interface Lead {
  id: string;
  created_at: string;
  nome: string;
  email?: string;
  telefone: string;
  pipeline_id?: string;
  etapa_atual_id?: string;
  etapa_id?: string; // compatibilidade
  titulo?: string;
  valor?: number;
  valor_real?: number;
  prioridade: 1 | 2 | 3 | 4;
  origem: string;
  origem_detalhe?: string;
  fonte?: string;
  status_compra?: string;
  anotacoes?: string;
  cpf?: string;
  endereco?: {
    rua?: string;
    logradouro?: string; // compatibilidade
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
  };
  data_prevista_fechamento?: string;
  data_fechamento?: string;
  responsavel_id?: string;
  responsavel?: {
    id: string;
    email: string;
    nome_completo?: string;
    avatar_url?: string;
  };
  ativo: boolean;
  arquivado: boolean;
  tags?: Tag[];
  data_entrada_etapa?: string;
  data_ultimo_contato?: string;
  historico_compras?: {
    e_cliente: boolean;
    total_compras: number;
    valor_total: number;
    ticket_medio?: number;
    ultima_compra?: string;
  };
}

// ============================================
// PIPELINES
// ============================================

export function usePipelines() {
  const { data, ...rest } = useQuery({
    queryKey: ['crm-pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_pipelines')
        .select('*')
        .eq('ativo', true)
        .order('ordem');

      if (error) throw error;
      return (data || []) as Pipeline[];
    }
  });

  return {
    data: data || [],
    ...rest
  };
}

export function useCreatePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pipeline: Partial<Pipeline>) => {
      const { data, error } = await supabase
        .from('crm_pipelines')
        .insert(pipeline)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipelines'] });
      toast.success('Pipeline criado!');
    }
  });
}

// ============================================
// ETAPAS - CORRIGIDO
// ============================================

export function useEtapas(pipelineId: string | undefined) {
  const { data, ...rest } = useQuery({
    queryKey: ['crm-etapas', pipelineId],
    queryFn: async () => {
      if (!pipelineId) {
        logger.debug('Sem pipelineId, retornando vazio', { hook: 'useEtapas' });
        return [] as Etapa[];
      }

      logger.debug('Buscando etapas para pipeline', { hook: 'useEtapas', pipelineId });

      const { data, error } = await supabase
        .from('crm_etapas')
        .select('*')
        .eq('ativo', true)
        .eq('pipeline_id', pipelineId)
        .order('ordem', { ascending: true });

      if (error) {
        logger.error('Erro ao buscar etapas', error, { hook: 'useEtapas', pipelineId });
        throw error;
      }

      return (data || []) as Etapa[];
    },
    enabled: !!pipelineId,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  return {
    data: data || [],
    ...rest
  };
}

export function useCreateEtapa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (etapa: Partial<Etapa>) => {
      const { data, error } = await supabase
        .from('crm_etapas')
        .insert(etapa)
        .select()
        .single();

      if (error) {
        logger.error('Erro ao criar etapa', error, { hook: 'useCreateEtapa', etapa });
        throw error;
      }

      return data as Etapa;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crm-etapas', variables.pipeline_id] });
      queryClient.refetchQueries({ queryKey: ['crm-etapas', variables.pipeline_id] });
      toast.success('Etapa criada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar etapa: ' + error.message);
    }
  });
}

// ============================================
// TAGS
// ============================================

export function useTags() {
  const { data, ...rest } = useQuery({
    queryKey: ['crm-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_tags')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return (data || []) as Tag[];
    }
  });

  return {
    data: data || [],
    ...rest
  };
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tag: Partial<Tag>) => {
      const { data, error } = await supabase
        .from('crm_tags')
        .insert(tag)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tags'] });
      toast.success('Tag criada!');
    }
  });
}

// ============================================
// LEADS
// ============================================

export function useLeads(filters?: { pipeline_id?: string; search?: string }) {
  const { data, ...rest } = useQuery({
    queryKey: ['crm-leads', filters],
    queryFn: async () => {
      let query = supabase
        .from('crm_leads')
        .select('*')
        .eq('ativo', true)
        .eq('arquivado', false)
        .order('created_at', { ascending: false });

      if (filters?.pipeline_id) {
        query = query.eq('pipeline_id', filters.pipeline_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Lead[];
    }
  });

  return {
    data: data || [],
    ...rest
  };
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lead: Partial<Lead>) => {
      const { data, error } = await supabase
        .from('crm_leads')
        .insert(lead)
        .select()
        .single();
      if (error) throw error;
      return data as Lead;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      toast.success('Lead criado!');

      try {
        const { executarRegrasLeadCriado } = await import('../services/automacaoService');
        await executarRegrasLeadCriado(data.id, {
          status: data.status_compra,
          fonte: data.fonte
        });
      } catch (e) {
        logger.error('Erro ao executar regras de automação', e, { hook: 'useCreateLead', leadId: data?.id });
      }
    }
  });
}

export function useMoverLeadEtapa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, etapaId, pipelineId }: { leadId: string; etapaId: string; pipelineId?: string }) => {
      // Buscar etapa atual para comparação
      const { data: lead } = await supabase.from('crm_leads').select('etapa_atual_id, pipeline_id').eq('id', leadId).single();

      const updates: any = {
        etapa_atual_id: etapaId,
        updated_at: new Date().toISOString()
      };

      // Se pipelineId foi informado, atualiza também
      if (pipelineId) {
        updates.pipeline_id = pipelineId;
      }

      const { error } = await supabase
        .from('crm_leads')
        .update(updates)
        .eq('id', leadId);
      if (error) throw error;
      return { leadId, etapaId, etapaAnteriorId: lead?.etapa_atual_id, pipelineId };
    },
    onSuccess: async ({ leadId, etapaId, etapaAnteriorId }) => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });

      if (etapaId !== etapaAnteriorId) {
        try {
          const { executarRegrasEtapaAlterada } = await import('../services/automacaoService');
          await executarRegrasEtapaAlterada(leadId, etapaAnteriorId, etapaId);
        } catch (e) {
          logger.error('Erro ao executar regras de automação', e, {
            hook: 'useMoverLeadEtapa',
            leadId,
            etapaAnteriorId,
            etapaId
          });
        }
      }
    }
  });
}

// ============================================
// EXPORTS ADICIONAIS (para compatibilidade)
// ============================================

export interface HistoricoItem {
  id: string;
  created_at: string;
  lead_id: string;
  tipo: string;
  titulo: string;
  descricao?: string;
  metadata?: any;
  etapa_origem_id?: string;
  etapa_destino_id?: string;
  usuario?: {
    id: string;
    nome: string;
    nome_completo?: string; // compatibilidade
    email: string;
  };
}

export interface Tarefa {
  id: string;
  created_at: string;
  lead_id: string;
  titulo: string;
  descricao?: string;
  status: string;
  data_vencimento: string;
  prioridade?: 'baixa' | 'media' | 'alta' | 'urgente';
  tipo?: string;
}

// Hooks stub para compatibilidade
export function useHistorico(leadId: string) {
  const { data, ...rest } = useQuery({
    queryKey: ['crm-historico', leadId],
    queryFn: async () => {
      const { data } = await supabase.from('crm_historico').select('*').eq('lead_id', leadId);
      return (data || []) as HistoricoItem[];
    },
    enabled: !!leadId
  });

  return {
    data: data || [],
    ...rest
  };
}

export function useAdicionarHistorico() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<HistoricoItem>) => {
      const { data, error } = await supabase.from('crm_historico').insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['crm-historico', vars.lead_id] });
    }
  });
}

export function useTarefas(leadId?: string) {
  const { data, ...rest } = useQuery({
    queryKey: ['crm-tarefas', leadId],
    queryFn: async () => {
      let query = supabase.from('crm_tarefas').select('*');
      if (leadId) query = query.eq('lead_id', leadId);
      const { data } = await query;
      return (data || []) as Tarefa[];
    }
  });

  return {
    data: data || [],
    ...rest
  };
}

export function useCriarTarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tarefa: Partial<Tarefa>) => {
      const { data, error } = await supabase.from('crm_tarefas').insert(tarefa).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tarefas'] });
      toast.success('Tarefa criada!');
    }
  });
}

export function useConcluirTarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_tarefas').update({ status: 'concluida' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tarefas'] });
    }
  });
}

export function useAdicionarTagLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, tagId }: { leadId: string; tagId: string }) => {
      const { error } = await supabase.from('crm_lead_tags').insert({ lead_id: leadId, tag_id: tagId });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      toast.success('Tag adicionada!');
    }
  });
}

export function useRemoverTagLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, tagId }: { leadId: string; tagId: string }) => {
      const { error } = await supabase.from('crm_lead_tags').delete().eq('lead_id', leadId).eq('tag_id', tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      toast.success('Tag removida!');
    }
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lead> & { id: string }) => {
      // Buscar lead atual para comparar mudanças
      const { data: leadAnterior } = await supabase.from('crm_leads').select('*').eq('id', id).single();

      const { data, error } = await supabase.from('crm_leads').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return { data, leadAnterior };
    },
    onSuccess: async ({ data, leadAnterior }) => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });

      if (data.status_compra !== leadAnterior?.status_compra) {
        try {
          const { executarRegrasStatusAlterado } = await import('../services/automacaoService');
          await executarRegrasStatusAlterado(
            data.id,
            leadAnterior?.status_compra,
            data.status_compra
          );
        } catch (e) {
          logger.error('Erro ao executar regras de automação', e, {
            hook: 'useUpdateLead',
            leadId: data.id,
            statusAnterior: leadAnterior?.status_compra,
            statusNovo: data.status_compra
          });
        }
      }
    }
  });
}

// Re-export automações
export * from './useCRMAutomacao';
