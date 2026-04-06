import React from 'react';
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  Package,
  FolderTree,
  Layers,
  Tag,
  Ticket,
  ShoppingBag,
  Settings,
  LayoutDashboard,
  Clock,
  ArrowUpRight,
  Network
} from 'lucide-react';
import { EcommerceStatCard } from '../../components/ecommerce/ui/EcommerceStatCard';
import { EcommerceQuickAction } from '../../components/ecommerce/ui/EcommerceQuickAction';
import { EcommercePageHeader } from '../../components/ecommerce/layout/EcommercePageHeader';

export const EcommerceOverview: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <EcommercePageHeader
        title="E-commerce"
        description="Visão geral da sua loja online. Gerencie produtos, pedidos e clientes."
      />

      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <EcommerceStatCard
          label="Receita Total"
          value="R$ 0,00"
          trend={0}
          trendLabel="vs mês anterior"
          icon={DollarSign}
          color="emerald"
        />
        <EcommerceStatCard
          label="Pedidos"
          value="0"
          trend={0}
          trendLabel="vs mês anterior"
          icon={ShoppingCart}
          color="blue"
        />
        <EcommerceStatCard
          label="Clientes"
          value="0"
          trend={0}
          trendLabel="novos este mês"
          icon={Users}
          color="cyan"
        />
        <EcommerceStatCard
          label="Tax. Conversão"
          value="0%"
          trend={0}
          trendLabel="vs mês anterior"
          icon={TrendingUp}
          color="amber"
        />
      </div>

      {/* Quick Actions Grid */}
      <div>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 font-mono">
          Acesso Rápido
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <EcommerceQuickAction
            to="/ecommerce/dashboard"
            icon={LayoutDashboard}
            title="Dashboard"
            description="KPIs, gráficos e relatórios"
          />
          <EcommerceQuickAction
            to="/ecommerce/products"
            icon={Package}
            title="Produtos"
            description="Catálogo completo da loja"
            count={0}
          />
          <EcommerceQuickAction
            to="/ecommerce/categories"
            icon={FolderTree}
            title="Categorias"
            description="Organização do catálogo"
          />
          <EcommerceQuickAction
            to="/ecommerce/collections"
            icon={Layers}
            title="Coleções"
            description="Agrupamentos de produtos"
          />
          <EcommerceQuickAction
            to="/ecommerce/offers"
            icon={Tag}
            title="Ofertas"
            description="Promoções e descontos ativos"
          />
          <EcommerceQuickAction
            to="/ecommerce/orders"
            icon={ShoppingCart}
            title="Pedidos"
            description="Acompanhamento de vendas"
            count={0}
          />
          <EcommerceQuickAction
            to="/ecommerce/customers"
            icon={Users}
            title="Clientes"
            description="Base de clientes da loja"
          />
          <EcommerceQuickAction
            to="/ecommerce/coupons"
            icon={Ticket}
            title="Cupons"
            description="Códigos de desconto"
          />
          <EcommerceQuickAction
            to="/ecommerce/carts"
            icon={ShoppingBag}
            title="Carrinhos"
            description="Carrinhos abandonados"
          />
          <EcommerceQuickAction
            to="/ecommerce/affiliates"
            icon={Network}
            title="Afiliados"
            description="Rede de gerentes e afiliados"
          />
          <EcommerceQuickAction
            to="/ecommerce/settings"
            icon={Settings}
            title="Configurações"
            description="Loja, pagamentos, frete"
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 font-mono">
          Atividade Recente
        </h3>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/80 text-slate-500 mb-4">
              <Clock className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-slate-300 mb-1">Nenhuma atividade ainda</p>
            <p className="text-xs text-slate-500 text-center max-w-xs">
              Quando você começar a receber pedidos e gerenciar sua loja, a atividade recente aparecerá aqui.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
