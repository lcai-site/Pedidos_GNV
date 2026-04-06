import React, { useState } from 'react';
import { Plus, Tag, Search, Filter, Edit2 } from 'lucide-react';
import { EcommercePageHeader } from '../../components/ecommerce/layout/EcommercePageHeader';
import { EcommerceEmptyState } from '../../components/ecommerce/ui/EcommerceEmptyState';
import { EcommerceStatusBadge } from '../../components/ecommerce/ui/EcommerceStatusBadge';
import { useEcommerceOffers } from '../../lib/hooks/useEcommerceMisc';
import { EcommerceOfferModal } from '../../components/ecommerce/modals/EcommerceOfferModal';
import type { EcommerceOffer } from '../../types/ecommerce';

export const EcommerceOffers: React.FC = () => {
  const { data: offers = [], isLoading } = useEcommerceOffers();
  const hasOffers = offers.length > 0;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [offerToEdit, setOfferToEdit] = useState<EcommerceOffer | null>(null);

  const handleOpenNew = () => {
    setOfferToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (offer: EcommerceOffer) => {
    setOfferToEdit(offer);
    setIsModalOpen(true);
  };
  
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(dateStr));
  };

  return (
    <div className="space-y-6">
      <EcommercePageHeader
        title="Ofertas"
        description="Gerencie promoções, descontos e ofertas especiais."
        actionLabel="Nova oferta"
        actionIcon={Plus}
        onAction={handleOpenNew}
      />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar ofertas..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#a3e635]/40 focus:ring-1 focus:ring-[#a3e635]/20 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {['Todas', 'Ativas', 'Agendadas', 'Expiradas'].map((tab) => (
            <button
              key={tab}
              className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-colors ${
                tab === 'Todas'
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
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono flex-1">Nome</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-24 text-center">Desconto</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-24 text-center">Status</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-28 text-center">Início</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-28 text-center">Fim</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-20 text-center">Usos</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-10 text-right"></div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Carregando ofertas...</div>
        ) : hasOffers ? (
          <div className="divide-y divide-slate-800/50">
            {offers.map(offer => (
              <div key={offer.id} className="px-4 py-3 flex items-center gap-4 hover:bg-white/5 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200">{offer.nome}</div>
                  {offer.descricao && <div className="text-xs text-slate-500 truncate">{offer.descricao}</div>}
                </div>
                
                <div className="w-24 text-sm font-medium text-center text-pink-400">
                  {offer.tipo_desconto === 'frete_gratis' ? 'Frete Grátis' : 
                   offer.tipo_desconto === 'percentual' ? `${offer.valor_desconto}%` : 
                   `R$ ${offer.valor_desconto}`}
                </div>
                
                <div className="w-24 flex justify-center">
                  <EcommerceStatusBadge status={offer.status as any} />
                </div>
                
                <div className="w-28 text-xs text-slate-400 text-center font-mono">
                  {formatDate(offer.data_inicio)}
                </div>
                
                <div className="w-28 text-xs text-slate-400 text-center font-mono">
                  {formatDate(offer.data_fim)}
                </div>
                
                <div className="w-20 text-sm text-slate-300 text-center">
                  {offer.usos} {offer.limite_usos ? `/ ${offer.limite_usos}` : ''}
                </div>

                <div className="w-10 shrink-0 flex justify-end">
                  <button
                    onClick={() => handleOpenEdit(offer)}
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
            icon={Tag}
            title="Nenhuma oferta criada"
            description="Crie ofertas para atrair clientes com descontos e promoções especiais."
            actionLabel="Nova oferta"
            onAction={handleOpenNew}
          />
        )}
      </div>

      <EcommerceOfferModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        offerToEdit={offerToEdit}
      />
    </div>
  );
};
