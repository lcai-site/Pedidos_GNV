import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { toast } from 'sonner';

// ==================== LEADS ====================

export interface Lead {
  id: string;
  created_at: string;
  nome: string;
  email: string;
  telefone: string;
  cpf?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  origem: string;
  origem_detalhe?: string;
  utm_source?: string;
  utm_campaign?: string;
  status: 'novo' | 'contatado' | 'interessado' | 'conversao' | 'descartado';
  temperatura: 'fria' | 'morna' | 'quente';
  produto_interesse?: string;
  valor_interesse?: number;
  ultimo_contato?: string;
  data_conversao?: string;
  observacoes?: string;
  tags?: string[];
  pedido_origem_id?: string;
  responsavel_id?: string;
  enviar_cupom?: boolean;
  cupom_enviado?: boolean;
  descartado?: boolean;
  motivo_descarte?: string;
}

export function useLeads(filters?: {
  status?: string;
  temperatura?: string;
  origem?: string;
  responsavel?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['crm-leads', filters],
    queryFn: async () => {
      let query = supabase
        .from('crm_leads')
        .select('*')
        .eq('descartado', false)
        .order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.temperatura) query = query.eq('temperatura', filters.temperatura);
      if (filters?.origem) query = query.eq('origem', filters.origem);
      if (filters?.responsavel) query = query.eq('responsavel_id', filters.responsavel);
      if (filters?.search) {
        query = query.or(`nome.ilike.%${filters.search}%,email.ilike.%${filters.search}%,telefone.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Lead[];
    },
    staleTime: 60000
  });
}

export function useLeadStats() {
  return useQuery({
    queryKey: ['crm-leads-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_leads')
        .select('status, temperatura, origem')
        .eq('descartado', false);

      if (error) throw error;

      const leads = data as Lead[];
      return {
        total: leads.length,
        novos: leads.filter(l => l.status === 'novo').length,
        contatados: leads.filter(l => l.status === 'contatado').length,
        interessados: leads.filter(l => l.status === 'interessado').length,
        conversoes: leads.filter(l => l.status === 'conversao').length,
        quentes: leads.filter(l => l.temperatura === 'quente').length,
        por_origem: {
          recovery: leads.filter(l => l.origem === 'recovery').length,
          manual: leads.filter(l => l.origem === 'manual').length,
          site: leads.filter(l => l.origem === 'site').length
        }
      };
    }
  });
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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-leads-stats'] });
      toast.success('Lead criado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar lead: ${error.message}`);
    }
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lead> & { id: string }) => {
      const { data, error } = await supabase
        .from('crm_leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      toast.success('Lead atualizado!');
    }
  });
}

// ==================== TEMPLATES ====================

export interface Template {
  id: string;
  created_at: string;
  nome: string;
  descricao?: string;
  categoria: string;
  assunto?: string;
  corpo: string;
  variaveis?: string[];
  ativo: boolean;
  is_default: boolean;
}

export function useTemplates(categoria?: string) {
  return useQuery({
    queryKey: ['crm-templates', categoria],
    queryFn: async () => {
      let query = supabase
        .from('crm_templates')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (categoria) query = query.eq('categoria', categoria);

      const { data, error } = await query;
      if (error) throw error;
      return data as Template[];
    }
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (template: Partial<Template>) => {
      const { data, error } = await supabase
        .from('crm_templates')
        .insert(template)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-templates'] });
      toast.success('Template criado!');
    }
  });
}

// ==================== CAMPANHAS ====================

export interface Campanha {
  id: string;
  created_at: string;
  nome: string;
  descricao?: string;
  filtro_status?: string[];
  filtro_origem?: string[];
  filtro_temperatura?: string[];
  filtro_tags?: string[];
  template_id?: string;
  mensagem_personalizada?: string;
  status_campanha: 'rascunho' | 'agendada' | 'executando' | 'pausada' | 'finalizada';
  data_agendamento?: string;
  data_inicio?: string;
  data_fim?: string;
  total_leads: number;
  enviados: number;
  entregues: number;
  lidos: number;
  respostas: number;
  conversoes: number;
  intervalo_segundos: number;
  horario_inicio: string;
  horario_fim: string;
  apenas_dias_uteis: boolean;
}

export function useCampanhas() {
  return useQuery({
    queryKey: ['crm-campanhas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_campanhas')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Campanha[];
    }
  });
}

export function useCreateCampanha() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (campanha: Partial<Campanha>) => {
      const { data, error } = await supabase
        .from('crm_campanhas')
        .insert(campanha)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-campanhas'] });
      toast.success('Campanha criada!');
    }
  });
}

// ==================== MENSAGENS ====================

export interface Mensagem {
  id: string;
  created_at: string;
  lead_id: string;
  campanha_id?: string;
  template_id?: string;
  tipo: 'whatsapp' | 'email' | 'sms';
  direcao: 'saida' | 'entrada';
  mensagem: string;
  mensagem_enviada?: string;
  status: 'pendente' | 'enviada' | 'entregue' | 'lida' | 'falha';
  message_id?: string;
  error_message?: string;
  midia_url?: string;
  midia_tipo?: string;
  enviado_at?: string;
  entregue_at?: string;
  lida_at?: string;
  resposta?: string;
  resposta_at?: string;
}

export function useMensagens(leadId?: string) {
  return useQuery({
    queryKey: ['crm-mensagens', leadId],
    queryFn: async () => {
      let query = supabase
        .from('crm_mensagens')
        .select('*, lead:crm_leads(nome, telefone)')
        .order('created_at', { ascending: false });

      if (leadId) query = query.eq('lead_id', leadId);

      const { data, error } = await query;
      if (error) throw error;
      return data as Mensagem[];
    },
    enabled: !!leadId
  });
}

export function useEnviarMensagem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (mensagem: Partial<Mensagem>) => {
      const { data, error } = await supabase
        .from('crm_mensagens')
        .insert(mensagem)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-mensagens'] });
    }
  });
}

// ==================== UTILIDADES ====================

export function useImportarRecuperacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      // Buscar pedidos de recuperação que ainda não são leads
      const { data: pedidos, error } = await supabase
        .from('view_recuperacao')
        .select('*')
        .eq('contatado', false)
        .limit(100);

      if (error) throw error;
      if (!pedidos || pedidos.length === 0) return { count: 0 };

      // Converter para leads
      const leads = pedidos.map((p: any) => ({
        nome: p.customer_name || 'Cliente',
        email: p.customer_email,
        telefone: p.customer_phone,
        origem: 'recovery',
        origem_detalhe: p.status_label,
        utm_source: p.utm_source,
        utm_campaign: p.utm_campaign,
        produto_interesse: p.product_name,
        valor_interesse: p.paid_amount,
        pedido_origem_id: p.id,
        tags: ['importado_recuperacao', p.status_label?.toLowerCase().replace(/\s/g, '_')]
      }));

      const { data, error: insertError } = await supabase
        .from('crm_leads')
        .insert(leads)
        .select();

      if (insertError) throw insertError;
      return { count: data?.length || 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      toast.success(`${result.count} leads importados da recuperação!`);
    },
    onError: (error: any) => {
      toast.error(`Erro ao importar: ${error.message}`);
    }
  });
}

// Processar variáveis em templates
export function processarTemplate(template: string, variaveis: Record<string, string>): string {
  let resultado = template;
  Object.entries(variaveis).forEach(([chave, valor]) => {
    resultado = resultado.replace(new RegExp(`{${chave}}`, 'g'), valor || '');
  });
  return resultado;
}
