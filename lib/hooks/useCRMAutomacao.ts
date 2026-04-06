import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

// Tipos
export interface AutomacaoRegra {
  id: string;
  nome: string;
  descricao?: string;
  gatilho_tipo: GatilhoTipo;
  gatilho_condicoes: Record<string, any>;
  acao_tipo: AcaoTipo;
  acao_config: Record<string, any>;
  ativo: boolean;
  ordem: number;
  created_at: string;
}

export interface AutomacaoLog {
  id: string;
  regra_id: string;
  lead_id: string;
  gatilho_tipo: string;
  contexto: Record<string, any>;
  status: 'sucesso' | 'erro' | 'ignorado';
  resultado?: Record<string, any>;
  erro_mensagem?: string;
  created_at: string;
}

export type GatilhoTipo = 
  | 'lead_criado'
  | 'status_alterado'
  | 'etapa_alterada'
  | 'secao_alterada'
  | 'tempo_na_etapa'
  | 'compra_realizada'
  | 'compra_cancelada';

export type AcaoTipo = 
  | 'aplicar_tag'
  | 'remover_tag'
  | 'mover_pipeline'
  | 'criar_tarefa'
  | 'enviar_notificacao'
  | 'atualizar_campo';

export const GATILHOS_CONFIG: Record<GatilhoTipo, { label: string; descricao: string; campos: string[] }> = {
  lead_criado: {
    label: 'Lead Criado',
    descricao: 'Quando um novo lead entra no sistema',
    campos: []
  },
  status_alterado: {
    label: 'Status Alterado',
    descricao: 'Quando o status de compra do lead muda',
    campos: ['status_atual', 'status_anterior']
  },
  etapa_alterada: {
    label: 'Etapa Alterada',
    descricao: 'Quando o lead muda de etapa no pipeline',
    campos: ['etapa_id']
  },
  secao_alterada: {
    label: 'Seção Alterada',
    descricao: 'Quando o lead transita entre seções da aplicação',
    campos: ['secao']
  },
  tempo_na_etapa: {
    label: 'Tempo na Etapa',
    descricao: 'Quando lead está há X tempo na mesma etapa',
    campos: ['etapa_id', 'tempo_horas']
  },
  compra_realizada: {
    label: 'Compra Realizada',
    descricao: 'Quando o lead finaliza uma compra',
    campos: []
  },
  compra_cancelada: {
    label: 'Compra Cancelada',
    descricao: 'Quando o lead cancela uma compra',
    campos: []
  }
};

export const ACOES_CONFIG: Record<AcaoTipo, { label: string; descricao: string; campos: string[] }> = {
  aplicar_tag: {
    label: 'Aplicar Etiqueta',
    descricao: 'Adiciona uma etiqueta ao lead',
    campos: ['tag_id']
  },
  remover_tag: {
    label: 'Remover Etiqueta',
    descricao: 'Remove uma etiqueta do lead',
    campos: ['tag_id']
  },
  mover_pipeline: {
    label: 'Mover no Pipeline',
    descricao: 'Move o lead para outro pipeline/etapa',
    campos: ['pipeline_id', 'etapa_id']
  },
  criar_tarefa: {
    label: 'Criar Tarefa',
    descricao: 'Cria uma tarefa para o lead',
    campos: ['titulo', 'descricao', 'responsavel_id']
  },
  enviar_notificacao: {
    label: 'Enviar Notificação',
    descricao: 'Envia notificação para o usuário',
    campos: ['mensagem', 'tipo']
  },
  atualizar_campo: {
    label: 'Atualizar Campo',
    descricao: 'Atualiza um campo do lead',
    campos: ['campo', 'valor']
  }
};

// Hook principal
export function useAutomacaoRegras() {
  return useQuery({
    queryKey: ['crm-automacao-regras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_automacao_regras')
        .select('*')
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AutomacaoRegra[];
    }
  });
}

export function useCreateAutomacaoRegra() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (regra: Partial<AutomacaoRegra>) => {
      const { data, error } = await supabase
        .from('crm_automacao_regras')
        .insert(regra)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-automacao-regras'] });
    }
  });
}

export function useUpdateAutomacaoRegra() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AutomacaoRegra> & { id: string }) => {
      const { data, error } = await supabase
        .from('crm_automacao_regras')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-automacao-regras'] });
    }
  });
}

export function useDeleteAutomacaoRegra() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_automacao_regras')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-automacao-regras'] });
    }
  });
}

export function useToggleAutomacaoRegra() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { data, error } = await supabase
        .from('crm_automacao_regras')
        .update({ ativo })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-automacao-regras'] });
    }
  });
}

// Hook para executar regras manualmente
export function useExecutarRegras() {
  return useMutation({
    mutationFn: async ({ 
      leadId, 
      gatilhoTipo, 
      contexto 
    }: { 
      leadId: string; 
      gatilhoTipo: GatilhoTipo; 
      contexto?: Record<string, any>;
    }) => {
      const { data, error } = await supabase
        .rpc('executar_regras_automacao', {
          p_lead_id: leadId,
          p_gatilho_tipo: gatilhoTipo,
          p_contexto: contexto || {}
        });
      
      if (error) throw error;
      return data;
    }
  });
}

// Hook para logs
export function useAutomacaoLogs(limit = 50) {
  return useQuery({
    queryKey: ['crm-automacao-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_automacao_logs')
        .select(`
          *,
          regra:regra_id (nome)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as (AutomacaoLog & { regra?: { nome: string } })[];
    }
  });
}
