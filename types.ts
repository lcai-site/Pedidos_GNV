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
  motivo_cancelamento?: string;
  status_envio: string; // 'Pendente', 'Enviado', etc.
  codigos_agrupados: string | string[]; // Pode vir como array do JSONB ou string
  codigo_rastreio: string | null;
  observacao?: string; // Campo novo para notas internas
  foi_editado?: boolean; // Campo novo para marcar edição manual
  campos_alterados?: string[]; // Lista de campos que foram modificados (ex: ['Endereço', 'Telefone'])

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

  // Campos de endereço (presentes na tabela pedidos_consolidados_v3)
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  endereco_completo?: string;

  // Campos de data
  data_venda?: string;
  status_date?: string; // Data de confirmação do pagamento
  dia_despacho?: string;
  data_envio?: string;
  corte_pv?: string;

  // Campos diversos
  valor_total?: number;
  metodo_pagamento?: string;
  forma_pagamento?: string;
  nome_produto?: string;
  nome_oferta?: string;
  codigo_transacao?: string;
  parcelas?: number;
  status_aprovacao?: string;

  // Campos da consolidação (gerados pela stored procedure)
  produto_principal?: string;     // Sigla: 'DP', 'BF', 'BL'
  order_bumps?: string[];         // Nomes das ofertas OB vinculadas
  upsells?: string[];             // Nomes das ofertas US vinculadas
  pos_vendas?: string[];          // Nomes das ofertas PV CC vinculadas
  codigos_filhos?: string[];      // Códigos de transação dos filhos
  tem_dois_cartoes?: boolean;     // Flag pagamento em 2 cartões
  verificar_endereco?: boolean;   // Alerta: endereço compartilhado com CPF/nome diferente (janela de 5 dias)
  quantidade_pedidos?: number;    // Total de pedidos no agrupamento
  pv_realizado?: boolean;         // Flag PV marcado como realizado pela vendedora
  pv_realizado_at?: string;       // Data/hora que foi marcado

  // Campos de frete e envio (novos)
  tipo_envio?: string;            // 'Mini Envios', 'PAC', 'SEDEX'
  valor_frete?: number;           // Valor calculado do frete
  data_postagem?: string;         // Data de postagem nos Correios
  cotacao_frete?: any;            // JSON com as 3 opções de cotação
  tracking_url?: string | null;   // URL de rastreio do Melhor Envio (disponível antes do código)
  melhor_envio_id?: string;       // ID da etiqueta no Melhor Envio
  logistica_provider?: string;    // 'Melhor Envio', 'correios', etc.
  transportadora?: string;        // Nome da transportadora (ex: 'Correios', 'Jadlog')

  // Campos de frete antigos (mantidos para compatibilidade)
  logistica_servico?: string;     // Tipo de serviço (PAC, SEDEX, etc)
  logistica_valor?: number;       // Valor do frete (antigo)

  // Rastreio Correios Nativo
  status_rastreio?: string;        // Ex: 'Postado', 'Em trânsito', 'Entregue'
  ultimo_evento_correios?: string; // Descrição legível do último evento
  data_ultimo_evento?: string;     // ISO timestamp do último evento
  data_entrega?: string;           // Quando entregue (BDE)

  // JSONB fields
  metadata?: any;
  customer?: any;
  shipping?: any;
  dados_entrega?: any;
  endereco_json?: any;
  updated_at?: string;
  erro_ia?: string;

  // Plataforma de origem
  plataforma?: 'ticto' | 'viralmart' | string;

  // Divergências de Unificação (Novo)
  tem_divergencia?: boolean;
  itens_divergentes?: any[];
}

export interface Pedido {
  id: string;
  created_at: string;
  order_date?: string;
  status: string;
  paid_amount: number;
  customer_name?: string;
  customer_cpf?: string;
  customer_email?: string;
  customer_phone?: string;
  payment_method?: string;
  product_name?: string;
  offer_name?: string;
  transaction_hash?: string;
  installments?: number;
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