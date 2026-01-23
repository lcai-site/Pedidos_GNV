export type StatusType = 'Aprovado' | 'Enviado' | 'Pendente' | 'Waiting Payment' | 'Cancelado' | 'Reembolsado' | 'Chargeback' | 'Ativa' | 'Atrasada';

export interface Profile {
  id: string;
  email: string;
  role: 'usuario' | 'gestor' | string;
  created_at: string;
}

export interface PedidoUnificado {
  id: string;
  created_at: string;
  descricao_pacote: string;
  status_envio: string; // 'Pendente', 'Enviado', etc.
  codigos_agrupados: string | string[]; // Pode vir como array do JSONB ou string
  codigo_rastreio: string | null;
  observacao?: string; // Campo novo para notas internas
  foi_editado?: boolean; // Campo novo para marcar edição manual
  
  // Flexible fields to handle potential column naming differences in Supabase
  cliente?: string;
  cliente_nome?: string;
  nome_cliente?: string; 
  cpf?: string;
  cliente_cpf?: string;
  endereco?: string;
  cliente_endereco?: string;
  telefone?: string;
  cliente_telefone?: string;
  email?: string;
  cliente_email?: string;
  
  // Allow for any other dynamic fields from the DB
  [key: string]: any; 
}

export interface Pedido {
  id: string;
  created_at: string;
  status: string;
  valor_total: number;
  cliente: string;
  cpf: string;
  email?: string; // Adicionado email como opcional
  metodo_pagamento?: string; // pix, boleto, credit_card
  [key: string]: any; // Flexibilidade para outros campos
}

export interface Assinatura {
  id: string;
  created_at: string;
  status: string; // 'Ativa', 'Atrasada', 'Cancelada'
  plano: string;
  proxima_cobranca: string;
}

export interface CarrinhoAbandonado {
  id: string;
  created_at: string;
  nome_produto: string;
  telefone_cliente: string;
  link_checkout: string;
}

export interface DashboardMetrics {
  faturamentoAprovado: number;
  countAprovado: number; // Novo

  faturamentoPendente: number;
  countPendente: number; // Novo

  faturamentoExpirado: number;
  countExpirado: number; // Novo

  faturamentoRecusado: number;
  countRecusado: number; // Novo

  faturamentoReembolsado: number;
  countReembolsado: number; // Novo

  detalhePendente: {
    pix: number;
    boleto: number;
  };
  aguardandoEnvio: number;
  assinaturasAtrasadas: number;
  carrinhosHoje: number;
}