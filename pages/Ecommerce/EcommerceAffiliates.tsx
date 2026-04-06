import React, { useState } from 'react';
import { Network, Plus, Search, Users, ExternalLink, Activity, DollarSign, Edit } from 'lucide-react';
import { EcommercePageHeader } from '../../components/ecommerce/layout/EcommercePageHeader';
import { EcommerceEmptyState } from '../../components/ecommerce/ui/EcommerceEmptyState';
import { EcommerceAffiliateModal } from '../../components/ecommerce/modals/EcommerceAffiliateModal';
import { useEcommerceAffiliates, useEcommerceAffiliateMetrics } from '../../lib/hooks/useEcommerceAffiliates';
import type { EcommerceAffiliate } from '../../lib/hooks/useEcommerceAffiliates';

type AffiliateTab = 'gerentes' | 'afiliados';

export const EcommerceAffiliates: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AffiliateTab>('gerentes');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [affiliateToEdit, setAffiliateToEdit] = useState<EcommerceAffiliate | null>(null);

  const { data: allMembers = [], isLoading } = useEcommerceAffiliates();
  const { data: metrics } = useEcommerceAffiliateMetrics();

  const membersFiltered = allMembers.filter(m => m.tipo === (activeTab === 'gerentes' ? 'gerente' : 'afiliado'));
  const hasMembers = membersFiltered.length > 0;

  const handleCreate = () => {
    setAffiliateToEdit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (affiliate: EcommerceAffiliate) => {
    setAffiliateToEdit(affiliate);
    setIsModalOpen(true);
  };

  const getMetrics = (id: string, tipo: string) => {
    if (tipo === 'afiliado') {
      return metrics?.afiliadosMetrics?.find((m: any) => m.afiliado_id === id) || { total_vendas: 0, receita_gerada: 0, comissoes_ganhas: 0 };
    }
    return metrics?.gerentesMetrics?.find((m: any) => m.gerente_id === id) || { total_vendas_equipe: 0, receita_gerada_equipe: 0, comissoes_ganhas: 0 };
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'ativo':
        return <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">Ativo</span>;
      case 'pendente':
        return <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">Pendente</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 border border-slate-500/20 text-[10px] font-bold uppercase tracking-wider">Inativo</span>;
    }
  };

  return (
    <div className="space-y-6">
      <EcommercePageHeader
        title="Rede de Afiliados"
        description="Gerencie gerentes e afiliados, acompanhe as vendas e visualize métricas de comissionamento."
        actionLabel="Adicionar Membro"
        actionIcon={Plus}
        onAction={handleCreate}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3 mb-2 text-indigo-400">
            <Users className="w-5 h-5" />
            <h4 className="text-sm font-bold text-slate-300">Total na Rede</h4>
          </div>
          <p className="text-2xl font-black text-white">{allMembers.length}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3 mb-2 text-emerald-400">
            <DollarSign className="w-5 h-5" />
            <h4 className="text-sm font-bold text-slate-300">Receita Indireta</h4>
          </div>
          <p className="text-2xl font-black text-emerald-400">
            R$ {((metrics?.afiliadosMetrics || []).reduce((acc: number, curr: any) => acc + Number(curr.receita_gerada || 0), 0)).toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-3 mb-2 text-amber-400">
            <Activity className="w-5 h-5" />
            <h4 className="text-sm font-bold text-slate-300">Total Vendas (Afiliados)</h4>
          </div>
          <p className="text-2xl font-black text-white">
            {((metrics?.afiliadosMetrics || []).reduce((acc: number, curr: any) => acc + Number(curr.total_vendas || 0), 0))}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Pesquisar por nome ou código..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {['gerentes', 'afiliados'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as AffiliateTab)}
              className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-colors ${
                activeTab === tab
                  ? 'border-indigo-500/40 text-indigo-400 bg-indigo-500/5'
                  : 'border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              {tab === 'gerentes' ? 'Gerentes' : 'Afiliados'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden flex flex-col">
        <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-4">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono flex-1">Membro</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-32 border-l border-slate-800 pl-4">{activeTab === 'gerentes' ? 'Equipe (Afiliados)' : 'Superior'}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-28 text-center">{activeTab === 'gerentes' ? 'Vendas da Equipe' : 'Vendas Individuais'}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-28 text-right">Receita Gerada</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-28 text-right">Comissões</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-24 text-center">Código</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-16 text-center">Status</div>
          <div className="w-8"></div>
        </div>

        {isLoading ? (
           <div className="p-8 text-center text-slate-500 text-sm">Carregando dados da rede...</div>
        ) : hasMembers ? (
          <div className="divide-y divide-slate-800/50">
            {membersFiltered.map((m) => {
              const memMetrics = getMetrics(m.id, m.tipo);
              const totalVendas = m.tipo === 'gerente' ? memMetrics.total_vendas_equipe : memMetrics.total_vendas;
              const receita = m.tipo === 'gerente' ? memMetrics.receita_gerada_equipe : memMetrics.receita_gerada;
              const eqSize = m.tipo === 'gerente' ? allMembers.filter(a => a.gerente_id === m.id).length : 0;

              return (
                <div key={m.id} className="px-4 py-3 flex items-center gap-4 hover:bg-white/5 transition-colors group">
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-200">{m.nome}</div>
                    <div className="text-xs text-slate-500">{m.email}</div>
                  </div>
                  
                  <div className="w-32 border-l border-slate-800 pl-4">
                    {m.tipo === 'gerente' ? (
                      <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">{eqSize} afiliados</span>
                    ) : (
                      <span className="text-xs text-slate-400 truncate block w-full">{m.gerente?.nome || '—'}</span>
                    )}
                  </div>
                  
                  <div className="w-28 text-sm font-bold text-slate-300 text-center">
                    {Number(totalVendas || 0)}
                  </div>
                  
                  <div className="w-28 text-sm font-bold text-emerald-400 text-right">
                    R$ {Number(receita || 0).toFixed(2)}
                  </div>

                  <div className="w-28 text-sm font-bold text-indigo-400 text-right">
                    R$ {Number(memMetrics.comissoes_ganhas || 0).toFixed(2)}
                  </div>
                  
                  <div className="w-24 text-xs font-mono text-slate-400 text-center bg-slate-950 rounded py-1 border border-slate-800">
                    {m.codigo_rastreio}
                  </div>
                  
                  <div className="w-16 flex justify-center">
                    <StatusBadge status={m.status} />
                  </div>
                  
                  <div className="w-8 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(m)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EcommerceEmptyState
            icon={Network}
            title={activeTab === 'gerentes' ? 'Nenhum gerente cadastrado' : 'Nenhum afiliado cadastrado'}
            description="Use o botão acima para montar sua rede."
          />
        )}
      </div>

      <EcommerceAffiliateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        affiliateToEdit={affiliateToEdit}
      />
    </div>
  );
};
