import React from 'react';
import { Users, Search, Download } from 'lucide-react';
import { EcommercePageHeader } from '../../components/ecommerce/layout/EcommercePageHeader';
import { EcommerceEmptyState } from '../../components/ecommerce/ui/EcommerceEmptyState';
import { useEcommerceCustomers } from '../../lib/hooks/useEcommerceCustomers';

export const EcommerceCustomers: React.FC = () => {
  const { data: customers = [], isLoading } = useEcommerceCustomers();
  const hasCustomers = customers.length > 0;
  
  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(dateStr));
  };

  return (
    <div className="space-y-6">
      <EcommercePageHeader
        title="Clientes"
        description="Base de clientes da sua loja online."
        actionLabel="Exportar"
        actionIcon={Download}
        onAction={() => {}}
      />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#a3e635]/40 focus:ring-1 focus:ring-[#a3e635]/20 transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden flex flex-col">
        <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-4">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono flex-1">Nome</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-48">E-mail</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-20 text-center">Pedidos</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-28 text-right">Total Gasto</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-32 text-center">Último Acesso</div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Carregando clientes...</div>
        ) : hasCustomers ? (
          <div className="divide-y divide-slate-800/50">
             {customers.map((customer: any) => (
              <div key={customer.id} className="px-4 py-3 flex items-center gap-4 hover:bg-white/5 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200 truncate">{customer.nome || 'Sem Nome'}</div>
                  <div className="text-xs text-slate-500 truncate">{customer.telefone}</div>
                </div>
                
                <div className="w-48 text-sm text-slate-300 truncate">
                  {customer.email}
                </div>
                
                <div className="w-20 text-sm font-medium text-slate-300 text-center">
                  {customer.total_pedidos || 0}
                </div>
                
                <div className="w-28 text-sm font-bold text-right text-emerald-400">
                  R$ {(customer.total_gasto || 0).toFixed(2)}
                </div>
                
                <div className="w-32 text-xs text-slate-400 text-center font-mono">
                  {customer.ultimo_acesso ? formatDate(customer.ultimo_acesso) : '—'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EcommerceEmptyState
            icon={Users}
            title="Nenhum cliente registrado"
            description="Os dados dos clientes serão exibidos aqui conforme começam a realizar compras."
          />
        )}
      </div>
    </div>
  );
};
