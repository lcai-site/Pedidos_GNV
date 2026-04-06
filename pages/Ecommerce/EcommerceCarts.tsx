import React from 'react';
import { ShoppingBag, Search, Mail } from 'lucide-react';
import { EcommercePageHeader } from '../../components/ecommerce/layout/EcommercePageHeader';
import { EcommerceEmptyState } from '../../components/ecommerce/ui/EcommerceEmptyState';
import { EcommerceStatCard } from '../../components/ecommerce/ui/EcommerceStatCard';

export const EcommerceCarts: React.FC = () => {
  const hasCarts = false;

  return (
    <div className="space-y-6">
      <EcommercePageHeader
        title="Carrinhos Abandonados"
        description="Monitore e recupere carrinhos abandonados pelos clientes."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <EcommerceStatCard
          label="Carrinhos Abandonados"
          value="0"
          icon={ShoppingBag}
          color="rose"
        />
        <EcommerceStatCard
          label="Valor Total Perdido"
          value="R$ 0,00"
          icon={ShoppingBag}
          color="amber"
        />
        <EcommerceStatCard
          label="Taxa de Recuperação"
          value="0%"
          icon={Mail}
          color="emerald"
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por cliente, e-mail..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#a3e635]/40 focus:ring-1 focus:ring-[#a3e635]/20 transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-4">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono flex-1">Cliente</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-48">E-mail</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-16 text-center">Itens</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-24 text-right">Valor</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-24 text-center">Status</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-28 text-center">Abandonado há</div>
        </div>

        {hasCarts ? (
          <div>{/* rows */}</div>
        ) : (
          <EcommerceEmptyState
            icon={ShoppingBag}
            title="Nenhum carrinho abandonado"
            description="Carrinhos abandonados serão exibidos aqui para acompanhamento e recuperação."
          />
        )}
      </div>
    </div>
  );
};
