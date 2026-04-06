import React, { useState } from 'react';
import { Plus, Ticket, Search, Edit2 } from 'lucide-react';
import { EcommercePageHeader } from '../../components/ecommerce/layout/EcommercePageHeader';
import { EcommerceEmptyState } from '../../components/ecommerce/ui/EcommerceEmptyState';
import { useEcommerceCoupons } from '../../lib/hooks/useEcommerceMisc';
import { EcommerceCouponModal } from '../../components/ecommerce/modals/EcommerceCouponModal';
import type { EcommerceCoupon } from '../../types/ecommerce';

export const EcommerceCoupons: React.FC = () => {
  const { data: coupons = [], isLoading } = useEcommerceCoupons();
  const hasCoupons = coupons.length > 0;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [couponToEdit, setCouponToEdit] = useState<EcommerceCoupon | null>(null);

  const handleOpenNew = () => {
    setCouponToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (coupon: EcommerceCoupon) => {
    setCouponToEdit(coupon);
    setIsModalOpen(true);
  };
  
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(dateStr));
  };

  return (
    <div className="space-y-6">
      <EcommercePageHeader
        title="Cupons"
        description="Crie e gerencie códigos de desconto para seus clientes."
        actionLabel="Novo cupom"
        actionIcon={Plus}
        onAction={handleOpenNew}
      />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por código..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#a3e635]/40 focus:ring-1 focus:ring-[#a3e635]/20 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {['Todos', 'Ativos', 'Expirados'].map((tab) => (
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
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-4">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-32">Código</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono flex-1">Tipo</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-24 text-right">Desconto</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-20 text-center">Uso</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-28 text-center">Validade</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-20 text-center">Status</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-10 text-right"></div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Carregando cupons...</div>
        ) : hasCoupons ? (
          <div className="divide-y divide-slate-800/50">
             {coupons.map(coupon => (
              <div key={coupon.id} className="px-4 py-3 flex items-center gap-4 hover:bg-white/5 transition-colors group">
                <div className="w-32">
                  <div className="inline-block px-2 py-1 bg-slate-800 rounded font-mono text-xs font-bold text-slate-200 uppercase tracking-wider">
                    {coupon.codigo}
                  </div>
                </div>
                
                <div className="flex-1 text-sm text-slate-400 capitalize">
                  {coupon.tipo.replace('_', ' ')}
                </div>
                
                <div className="w-24 text-sm font-bold text-right text-orange-400">
                  {coupon.tipo === 'frete_gratis' ? 'Grátis' : 
                   coupon.tipo === 'percentual' ? `${coupon.valor}%` : 
                   `R$ ${coupon.valor}`}
                </div>
                
                <div className="w-20 text-sm text-slate-300 text-center">
                  {coupon.uso_atual || 0} {coupon.limite_uso ? `/ ${coupon.limite_uso}` : ''}
                </div>
                
                <div className="w-28 text-xs text-slate-400 text-center font-mono">
                  {formatDate(coupon.validade)}
                </div>
                
                <div className="w-20 flex justify-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${coupon.ativo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                    {coupon.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className="w-10 shrink-0 flex justify-end">
                  <button
                    onClick={() => handleOpenEdit(coupon)}
                    className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EcommerceEmptyState
            icon={Ticket}
            title="Nenhum cupom criado"
            description="Crie cupons de desconto para incentivar compras e fidelizar clientes."
            actionLabel="Novo cupom"
            onAction={handleOpenNew}
          />
        )}
      </div>

      <EcommerceCouponModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        couponToEdit={couponToEdit}
      />
    </div>
  );
};
