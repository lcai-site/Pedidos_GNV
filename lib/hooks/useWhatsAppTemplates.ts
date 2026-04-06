import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { toast } from 'sonner';

// ============================================
// TIPOS
// ============================================

export interface WhatsAppTemplate {
  id: string;
  nome: string;
  categoria: string;
  conteudo: string;
  variaveis: string[];
  ativo: boolean;
  gatilho_automatico: string | null;
  created_at: string;
  updated_at: string;
}

export const CATEGORIAS_TEMPLATE = [
  { value: 'rastreio', label: '📦 Rastreio', descricao: 'Atualizações de entrega' },
  { value: 'boas_vindas', label: '👋 Boas-vindas', descricao: 'Mensagens de boas-vindas ao cliente' },
  { value: 'recuperacao', label: '🛒 Recuperação', descricao: 'Carrinho abandonado e reengajamento' },
  { value: 'cancelamento', label: '❌ Cancelamento', descricao: 'Notificação de cancelamento' },
  { value: 'pos_venda', label: '⭐ Pós-venda', descricao: 'Acompanhamento pós-compra' },
  { value: 'cobranca', label: '💰 Cobrança', descricao: 'Avisos de pagamento' },
  { value: 'geral', label: '💬 Geral', descricao: 'Mensagens de uso geral' },
];

export const VARIAVEIS_DISPONIVEIS = [
  { chave: '{{nome}}', descricao: 'Nome do cliente', exemplo: 'João Silva' },
  { chave: '{{primeiro_nome}}', descricao: 'Primeiro nome', exemplo: 'João' },
  { chave: '{{pedido_id}}', descricao: 'ID do pedido', exemplo: '#12345' },
  { chave: '{{produto}}', descricao: 'Nome do produto', exemplo: 'Kit Detox Premium' },
  { chave: '{{rastreio}}', descricao: 'Código de rastreio', exemplo: 'BR123456789BR' },
  { chave: '{{status_entrega}}', descricao: 'Status da entrega', exemplo: 'Em trânsito' },
  { chave: '{{link_rastreio}}', descricao: 'Link de rastreamento', exemplo: 'https://rastreio.com/BR123' },
  { chave: '{{valor}}', descricao: 'Valor da compra', exemplo: 'R$ 197,00' },
  { chave: '{{data_compra}}', descricao: 'Data da compra', exemplo: '25/03/2026' },
  { chave: '{{data_previsao}}', descricao: 'Previsão de entrega', exemplo: '02/04/2026' },
  { chave: '{{transportadora}}', descricao: 'Nome da transportadora', exemplo: 'Correios' },
  { chave: '{{cupom}}', descricao: 'Código do cupom', exemplo: 'VOLTA10' },
];

export const GATILHOS_AUTOMATICOS = [
  { value: '', label: 'Manual (sem gatilho)' },
  { value: 'pedido_postado', label: '📦 Pedido Postado' },
  { value: 'em_transito', label: '🚚 Em Trânsito' },
  { value: 'saiu_para_entrega', label: '🏠 Saiu para Entrega' },
  { value: 'entregue', label: '✅ Entregue' },
  { value: 'tentativa_entrega', label: '🔄 Tentativa de Entrega' },
  { value: 'devolvido', label: '↩️ Devolvido' },
  { value: 'compra_aprovada', label: '💳 Compra Aprovada' },
  { value: 'carrinho_abandonado', label: '🛒 Carrinho Abandonado' },
  { value: 'compra_cancelada', label: '❌ Compra Cancelada' },
];

// ============================================
// HOOKS
// ============================================

export function useWhatsAppTemplates(categoria?: string) {
  return useQuery({
    queryKey: ['whatsapp-templates', categoria],
    queryFn: async () => {
      let query = supabase
        .from('whatsapp_templates')
        .select('*')
        .order('categoria')
        .order('nome');

      if (categoria) {
        query = query.eq('categoria', categoria);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as WhatsAppTemplate[];
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Partial<WhatsAppTemplate>) => {
      // Extrair variáveis do conteúdo
      const variaveis = extrairVariaveis(template.conteudo || '');

      const { data, error } = await supabase
        .from('whatsapp_templates')
        .insert({
          ...template,
          variaveis,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast.success('Template criado!');
    },
    onError: (error: any) => {
      toast.error('Erro: ' + error.message);
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WhatsAppTemplate> & { id: string }) => {
      // Extrair variáveis se conteúdo mudou
      if (updates.conteudo) {
        updates.variaveis = extrairVariaveis(updates.conteudo);
      }

      const { data, error } = await supabase
        .from('whatsapp_templates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast.success('Template atualizado!');
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast.success('Template excluído!');
    },
  });
}

export function useToggleTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('whatsapp_templates')
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
    },
  });
}

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

/**
 * Extrai variáveis {{var}} de um texto
 */
export function extrairVariaveis(texto: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(texto)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

/**
 * Renderiza um template substituindo variáveis por valores reais
 */
export function renderTemplate(
  conteudo: string,
  dados: Record<string, string | number | null | undefined>
): string {
  let resultado = conteudo;

  for (const [chave, valor] of Object.entries(dados)) {
    const regex = new RegExp(`\\{\\{${chave}\\}\\}`, 'g');
    resultado = resultado.replace(regex, String(valor ?? ''));
  }

  // Remover variáveis não preenchidas
  resultado = resultado.replace(/\{\{\w+\}\}/g, '');

  return resultado.trim();
}
