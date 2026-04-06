// E-commerce Module — Domain Types
// Prepared for future Supabase integration

// ── Status Unions ──────────────────────────────────

export type ProductStatus = 'ativo' | 'rascunho' | 'arquivado';
export type OrderStatus = 'pendente' | 'confirmado' | 'processando' | 'enviado' | 'entregue' | 'cancelado' | 'reembolsado';
export type CouponType = 'percentual' | 'valor_fixo' | 'frete_gratis';
export type OfferStatus = 'ativa' | 'agendada' | 'expirada' | 'rascunho';
export type CartStatus = 'abandonado' | 'recuperado' | 'convertido';
export type CollectionType = 'manual' | 'automatica';

// ── Core Entities ──────────────────────────────────

export interface EcommerceProduct {
  id: string;
  nome: string;
  descricao: string;
  sku: string;
  preco: number;
  preco_comparacao: number | null;
  estoque: number;
  status: ProductStatus;
  categoria_id: string | null;
  imagem_url: string | null;
  peso_gramas: number;
  created_at: string;
  updated_at: string;
}

export interface EcommerceCategory {
  id: string;
  nome: string;
  descricao: string;
  slug: string;
  parent_id: string | null;
  posicao: number;
  produtos_count: number;
  created_at: string;
}

export interface EcommerceCollection {
  id: string;
  nome: string;
  descricao: string;
  tipo: CollectionType;
  imagem_url: string | null;
  produtos_count: number;
  publicada: boolean;
  created_at: string;
  updated_at: string;
}

export interface EcommerceOffer {
  id: string;
  nome: string;
  descricao: string;
  tipo_desconto: CouponType;
  valor_desconto: number;
  data_inicio: string;
  data_fim: string;
  status: OfferStatus;
  produtos_aplicaveis: string[];
  usos: number;
  limite_usos: number | null;
  created_at: string;
}

export interface EcommerceOrder {
  id: string;
  numero: string;
  cliente_nome: string;
  cliente_email: string;
  valor_total: number;
  valor_desconto: number;
  valor_frete: number;
  status: OrderStatus;
  itens_count: number;
  metodo_pagamento: string;
  codigo_rastreio: string | null;
  created_at: string;
  updated_at: string;
}

export interface EcommerceCustomer {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  total_pedidos: number;
  total_gasto: number;
  ultimo_pedido_em: string | null;
  created_at: string;
}

export interface EcommerceCoupon {
  id: string;
  codigo: string;
  tipo: CouponType;
  valor: number;
  uso_atual: number;
  limite_uso: number | null;
  valor_minimo_pedido: number | null;
  validade: string | null;
  ativo: boolean;
  created_at: string;
}

export interface EcommerceCart {
  id: string;
  cliente_nome: string | null;
  cliente_email: string | null;
  itens_count: number;
  valor_total: number;
  status: CartStatus;
  abandonado_em: string;
  recuperado_em: string | null;
  created_at: string;
}

export interface EcommerceStoreSettings {
  nome_loja: string;
  moeda: string;
  timezone: string;
  email_contato: string;
  telefone_contato: string;
}

export interface EcommercePaymentSettings {
  gateway: string;
  ambiente: 'sandbox' | 'producao';
  pix_habilitado: boolean;
  cartao_habilitado: boolean;
  boleto_habilitado: boolean;
}

export interface EcommerceShippingSettings {
  correios_habilitado: boolean;
  frete_gratis_acima: number | null;
  prazo_despacho_dias: number;
  cep_origem: string;
}

export interface EcommerceNotificationSettings {
  email_novo_pedido: boolean;
  email_envio: boolean;
  whatsapp_novo_pedido: boolean;
  whatsapp_envio: boolean;
}

// ── Stats ──────────────────────────────────────────

export interface EcommerceStats {
  receita_total: number;
  total_pedidos: number;
  total_clientes: number;
  taxa_conversao: number;
  ticket_medio: number;
  pedidos_hoje: number;
}

// ── Table Column Config (for structured placeholders) ──

export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
}
