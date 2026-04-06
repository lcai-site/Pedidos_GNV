import React from 'react';
import { ShoppingCart, Search, Filter } from 'lucide-react';
import { EcommercePageHeader } from '../../components/ecommerce/layout/EcommercePageHeader';
import { EcommerceEmptyState } from '../../components/ecommerce/ui/EcommerceEmptyState';
import { EcommerceStatusBadge } from '../../components/ecommerce/ui/EcommerceStatusBadge';
import { useEcommerceOrders, useUpdateEcommerceOrderStatus } from '../../lib/hooks/useEcommerceOrders';

export const EcommerceOrders: React.FC = () => {
  const { data: orders = [], isLoading } = useEcommerceOrders();
  const { mutate: updateStatus } = useUpdateEcommerceOrderStatus();
  const hasOrders = orders.length > 0;

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(dateStr));
  };

  return (
    <div className="space-y-6">
      <EcommercePageHeader
        title="Pedidos"
        description="Acompanhe e gerencie todos os pedidos da loja."
      />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nº do pedido, cliente..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#a3e635]/40 focus:ring-1 focus:ring-[#a3e635]/20 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {['Todos', 'Pendente', 'Confirmado', 'Enviado', 'Entregue'].map((tab) => (
            <button
              key={tab}
              className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-colors ${
                tab === 'Todos'
                  ? 'border-[#a3e635]/40 text-[#a3e635] bg-[#a3e635]/5'
                  : 'border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden flex flex-col">
        <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-4">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-24">Nº Pedido</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono flex-1">Cliente</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-24 text-right">Valor</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-20 text-center">Itens</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-40 text-center">Status</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-28 text-center">Data</div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Carregando pedidos...</div>
        ) : hasOrders ? (
          <div className="divide-y divide-slate-800/50">
             {orders.map((order: any) => (
              <div key={order.id} className="px-4 py-3 flex items-center gap-4 hover:bg-white/5 transition-colors group">
                <div className="w-24 font-mono text-sm text-slate-300">
                  #{order.numero_pedido || order.id.slice(0,6)}
                </div>
                
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-200">{order.ecommerce_clientes?.nome || 'Cliente Anônimo'}</div>
                  <div className="text-xs text-slate-500 truncate">{order.ecommerce_clientes?.email}</div>
                </div>
                
                <div className="w-24 text-sm font-bold text-right text-emerald-400">
                  R$ {order.valor_total?.toFixed(2)}
                </div>
                
                <div className="w-20 text-sm text-slate-300 text-center">
                  {order.ecommerce_pedido_itens?.length || 0}
                </div>
                
                <div className="w-40 flex justify-center">
                  <select 
                    value={order.status} 
                    onChange={(e) => updateStatus({ id: order.id, status: e.target.value as any })}
                    className="bg-transparent text-sm border-0 focus:ring-0 cursor-pointer hover:bg-slate-800 rounded px-2 py-1 text-slate-300"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="separando">Separando</option>
                    <option value="enviado">Enviado</option>
                    <option value="entregue">Entregue</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                
                <div className="w-28 text-xs text-slate-400 text-center font-mono">
                  {formatDate(order.created_at)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EcommerceEmptyState
            icon={ShoppingCart}
            title="Nenhum pedido recebido"
            description="Os pedidos aparecerão aqui assim que seus clientes começarem a comprar."
          />
        )}
      </div>
    </div>
  );
};
