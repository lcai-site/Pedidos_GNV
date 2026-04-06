import React from 'react';
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  Package,
  BarChart3,
  ArrowUpRight,
} from 'lucide-react';
import { EcommerceStatCard } from '../../components/ecommerce/ui/EcommerceStatCard';
import { EcommercePageHeader } from '../../components/ecommerce/layout/EcommercePageHeader';

// Placeholder chart component
const ChartPlaceholder: React.FC<{ title: string; height?: string }> = ({ title, height = 'h-64' }) => (
  <div className={`rounded-xl border border-slate-800 bg-slate-900/50 p-5 ${height}`}>
    <div className="flex items-center justify-between mb-4">
      <h4 className="text-sm font-bold text-slate-300">{title}</h4>
      <div className="flex gap-2">
        {['7D', '30D', '90D'].map((period) => (
          <button
            key={period}
            className="px-2 py-1 text-[10px] font-bold font-mono text-slate-500 border border-slate-700 rounded hover:text-slate-300 hover:border-slate-600 transition-colors"
          >
            {period}
          </button>
        ))}
      </div>
    </div>
    <div className="flex items-center justify-center h-[calc(100%-3rem)]">
      <div className="text-center">
        <BarChart3 className="h-10 w-10 text-slate-700 mx-auto mb-2" />
        <p className="text-xs text-slate-500">Dados serão exibidos aqui</p>
      </div>
    </div>
  </div>
);

export const EcommerceDashboard: React.FC = () => {
  return (
    <div className="space-y-8">
      <EcommercePageHeader
        title="Dashboard"
        description="Métricas e indicadores de performance da loja."
      />

      {/* KPIs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <EcommerceStatCard label="Receita Hoje" value="R$ 0,00" icon={DollarSign} color="emerald" />
        <EcommerceStatCard label="Pedidos Hoje" value="0" icon={ShoppingCart} color="blue" />
        <EcommerceStatCard label="Ticket Médio" value="R$ 0,00" icon={TrendingUp} color="amber" />
        <EcommerceStatCard label="Clientes Ativos" value="0" icon={Users} color="cyan" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartPlaceholder title="Receita ao longo do tempo" />
        <ChartPlaceholder title="Pedidos por dia" />
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h4 className="text-sm font-bold text-slate-300 mb-4">Top Produtos</h4>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <span className="text-xs font-bold text-slate-600 w-5 font-mono">#{i}</span>
                <div className="w-8 h-8 rounded bg-slate-800 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-3 w-32 bg-slate-800 rounded" />
                  <div className="h-2 w-16 bg-slate-800/50 rounded mt-1.5" />
                </div>
                <div className="h-3 w-16 bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h4 className="text-sm font-bold text-slate-300 mb-4">Atividade Recente</h4>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="w-8 h-8 rounded-full bg-slate-800 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-3 w-40 bg-slate-800 rounded" />
                  <div className="h-2 w-20 bg-slate-800/50 rounded mt-1.5" />
                </div>
                <div className="h-2 w-12 bg-slate-800/50 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
