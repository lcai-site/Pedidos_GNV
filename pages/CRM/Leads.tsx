import React, { useState, useMemo } from 'react';
import { usePipelines, useEtapas, useLeads, useMoverLeadEtapa, useCreateLead, Lead } from '../../lib/hooks/useCRMKanban';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { 
  Users, Plus, Search, Filter, LayoutGrid, List, 
  Phone, Mail, DollarSign, MoreVertical, Trash2, Archive,
  X, ChevronDown, TrendingUp, Calendar, Tag, User
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../lib/contexts/AuthContext';

// ============================================
// COMPONENTES
// ============================================

const PRIORIDADE_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: 'bg-slate-500', text: 'text-slate-400', label: 'Baixa' },
  2: { bg: 'bg-blue-500', text: 'text-blue-400', label: 'Normal' },
  3: { bg: 'bg-amber-500', text: 'text-amber-400', label: 'Alta' },
  4: { bg: 'bg-rose-500', text: 'text-rose-400', label: 'Urgente' }
};

// Card de Lead
const LeadCard: React.FC<{
  lead: Lead;
  etapaSla?: number;
  onClick: () => void;
}> = ({ lead, etapaSla, onClick }) => {
  const prioridade = PRIORIDADE_COLORS[lead.prioridade];
  
  // Calcular SLA
  const slaStatus = useMemo(() => {
    if (!etapaSla || !lead.data_entrada_etapa) return null;
    const horas = (new Date().getTime() - new Date(lead.data_entrada_etapa).getTime()) / (1000 * 60 * 60);
    if (horas > etapaSla) return 'overdue';
    if (horas > etapaSla * 0.8) return 'warning';
    return 'ok';
  }, [lead.data_entrada_etapa, etapaSla]);

  return (
    <div
      onClick={onClick}
      className={`bg-slate-800 rounded-lg p-3 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 border ${
        slaStatus === 'overdue' ? 'border-l-4 border-l-rose-500 border-slate-700' :
        slaStatus === 'warning' ? 'border-l-4 border-l-amber-500 border-slate-700' :
        'border-slate-700'
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <div className={`w-1 h-8 rounded-full ${prioridade.bg}`} />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-slate-200 text-sm truncate">{lead.titulo || lead.nome}</h4>
          <p className="text-xs text-slate-500 truncate">{lead.nome}</p>
        </div>
      </div>

      {/* Valor */}
      {lead.valor && lead.valor > 0 && (
        <div className="mb-2">
          <span className="text-sm font-bold text-emerald-400">
            {lead.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
      )}

      {/* Telefone */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <Phone className="w-3 h-3" />
        <span className="truncate">{lead.telefone}</span>
      </div>

      {/* Tags */}
      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {lead.tags.slice(0, 2).map((tag: any) => (
            <span 
              key={tag.id}
              className="px-1.5 py-0.5 text-[10px] rounded"
              style={{ backgroundColor: `${tag.cor}30`, color: tag.cor }}
            >
              {tag.nome}
            </span>
          ))}
          {lead.tags.length > 2 && (
            <span className="text-[10px] text-slate-500">+{lead.tags.length - 2}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
        <div className="flex items-center gap-2">
          {lead.historico_compras?.e_cliente && (
            <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              Cliente
            </span>
          )}
        </div>
        {lead.responsavel && (
          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold" title={lead.responsavel.email}>
            {(lead.responsavel.nome_completo || lead.responsavel.email).charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
};

// Coluna do Kanban
const KanbanColumn: React.FC<{
  etapa: any;
  leads: Lead[];
  onDrop: (leadId: string) => void;
  onLeadClick: (lead: Lead) => void;
  onAddLead: () => void;
}> = ({ etapa, leads, onDrop, onLeadClick, onAddLead }) => {
  const { can } = useAuth();
  const [isDragOver, setIsDragOver] = useState(false);
  const totalValor = leads.reduce((sum, l) => sum + (l.valor || 0), 0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const leadId = e.dataTransfer.getData('leadId');
    if (leadId) onDrop(leadId);
  };

  return (
    <div className="flex-shrink-0 w-80">
      {/* Header */}
      <div 
        className="rounded-t-lg p-3 border-t-2"
        style={{ borderColor: etapa.cor, backgroundColor: `${etapa.cor}15` }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-200">{etapa.nome}</h3>
          <span className="px-2 py-0.5 bg-slate-800 text-xs text-slate-400 rounded-full">
            {leads.length}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs">
          <span className="text-slate-500">
            {totalValor > 0 ? totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}
          </span>
          {etapa.probabilidade > 0 && (
            <span className="text-slate-500">{etapa.probabilidade}%</span>
          )}
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`bg-slate-900/50 border-x border-b border-slate-800 rounded-b-lg p-2 min-h-[300px] transition-colors ${
          isDragOver ? 'bg-slate-800/50 border-blue-500/50' : ''
        }`}
      >
        {leads.map(lead => (
          <div
            key={lead.id}
            draggable={can('crm:edit')}
            onDragStart={(e) => {
              if (!can('crm:edit')) return;
              e.dataTransfer.setData('leadId', lead.id);
            }}
            className="mb-2"
          >
            <LeadCard 
              lead={lead} 
              etapaSla={etapa.sla_horas}
              onClick={() => onLeadClick(lead)}
            />
          </div>
        ))}

        {/* Botão adicionar */}
        {can('crm:edit') && (
          <button
            onClick={onAddLead}
            className="w-full py-2 border-2 border-dashed border-slate-700 rounded-lg text-slate-500 text-sm hover:border-slate-600 hover:text-slate-400 transition-colors"
          >
            + Adicionar negócio
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================
// PÁGINA PRINCIPAL
// ============================================

export const CRMLeads: React.FC = () => {
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewLead, setShowNewLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const { can } = useAuth();

  // Hooks
  const { data: pipelines } = usePipelines();
  const { data: etapas } = useEtapas(selectedPipeline);
  const { data: leads } = useLeads({ 
    pipeline_id: selectedPipeline,
    search: searchTerm || undefined
  });
  const moverLead = useMoverLeadEtapa();
  const createLead = useCreateLead();

  // Selecionar primeiro pipeline
  React.useEffect(() => {
    if (pipelines?.length && !selectedPipeline) {
      setSelectedPipeline(pipelines[0].id);
    }
  }, [pipelines, selectedPipeline]);

  // Agrupar leads por etapa
  const leadsPorEtapa = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    etapas?.forEach(etapa => {
      grouped[etapa.id] = leads?.filter(lead => lead.etapa_id === etapa.id) || [];
    });
    return grouped;
  }, [etapas, leads]);

  const handleMoveLead = (leadId: string, etapaId: string) => {
    moverLead.mutate({ leadId, etapaId, pipelineId: selectedPipeline });
  };

  const handleCreateLead = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      await createLead.mutateAsync({
        nome: formData.get('nome') as string,
        telefone: formData.get('telefone') as string,
        email: formData.get('email') as string || undefined,
        titulo: formData.get('titulo') as string || undefined,
        valor: formData.get('valor') ? Number(formData.get('valor')) : undefined,
        pipeline_id: selectedPipeline,
        etapa_id: etapas?.[0]?.id,
        origem: 'manual',
        prioridade: 2
      });
      setShowNewLead(false);
      toast.success('Lead criado!');
    } catch (error) {
      toast.error('Erro ao criar lead');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="CRM - Pipeline de Vendas"
        subtitle="Gerencie seus leads e oportunidades"
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="text-blue-400 text-xs uppercase mb-1">Total Leads</div>
          <div className="text-2xl font-bold text-slate-200">{leads?.length || 0}</div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <div className="text-emerald-400 text-xs uppercase mb-1">Valor em Aberto</div>
          <div className="text-2xl font-bold text-slate-200">
            {(leads?.reduce((sum, l) => sum + (l.valor || 0), 0) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <div className="text-amber-400 text-xs uppercase mb-1">Ticket Médio</div>
          <div className="text-2xl font-bold text-slate-200">
            {leads?.length ? (leads.reduce((sum, l) => sum + (l.valor || 0), 0) / leads.length).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}
          </div>
        </div>
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
          <div className="text-violet-400 text-xs uppercase mb-1">Conversão</div>
          <div className="text-2xl font-bold text-slate-200">0%</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
        {/* Pipeline Selector */}
        <select
          value={selectedPipeline}
          onChange={(e) => setSelectedPipeline(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
        >
          <option value="">Selecione...</option>
          {pipelines?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>

        {/* View Toggle */}
        <div className="flex bg-slate-800/50 rounded-lg p-1">
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'kanban' ? 'bg-slate-700 text-white' : 'text-slate-400'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Kanban
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Lista
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200"
          />
        </div>

        {/* Add Button */}
        {can('crm:edit') && (
          <button
            onClick={() => setShowNewLead(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Lead
          </button>
        )}
      </div>

      {/* Content */}
      {!selectedPipeline ? (
        <div className="text-center py-20 text-slate-500">
          <LayoutGrid className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-slate-400">Selecione um pipeline</h3>
          <p className="text-sm mt-1">Escolha um pipeline para visualizar os leads</p>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {etapas?.map(etapa => (
            <KanbanColumn
              key={etapa.id}
              etapa={etapa}
              leads={leadsPorEtapa[etapa.id] || []}
              onDrop={(leadId) => handleMoveLead(leadId, etapa.id)}
              onLeadClick={setSelectedLead}
              onAddLead={() => setShowNewLead(true)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50 text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Lead</th>
                <th className="px-4 py-3 text-left">Contato</th>
                <th className="px-4 py-3 text-left">Valor</th>
                <th className="px-4 py-3 text-left">Etapa</th>
                <th className="px-4 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {leads?.map(lead => {
                const etapa = etapas?.find(e => e.id === lead.etapa_id);
                return (
                  <tr key={lead.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{lead.titulo || lead.nome}</div>
                      <div className="text-xs text-slate-500">{lead.nome}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{lead.telefone}</td>
                    <td className="px-4 py-3 text-emerald-400">
                      {(lead.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3">
                      {etapa && (
                        <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: `${etapa.cor}20`, color: etapa.cor }}>
                          {etapa.nome}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelectedLead(lead)} className="p-1 hover:bg-slate-700 rounded">
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Novo Lead */}
      {showNewLead && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateLead} className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-200">Novo Lead</h3>
              <button type="button" onClick={() => setShowNewLead(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Título do Negócio</label>
                <input name="titulo" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200" placeholder="Ex: Venda DP - João" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nome *</label>
                <input name="nome" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Telefone *</label>
                  <input name="telefone" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Email</label>
                  <input name="email" type="email" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Valor</label>
                <input name="valor" type="number" step="0.01" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200" />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button type="button" onClick={() => setShowNewLead(false)} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg">Cancelar</button>
              <button type="submit" disabled={createLead.isPending} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50">
                {createLead.isPending ? 'Criando...' : 'Criar Lead'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Detalhes Lead */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-200">{selectedLead.titulo || selectedLead.nome}</h3>
                <p className="text-slate-500">{selectedLead.nome}</p>
              </div>
              <button onClick={() => setSelectedLead(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="text-sm text-slate-500 mb-1">Valor</div>
                <div className="text-xl font-bold text-emerald-400">
                  {(selectedLead.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="text-sm text-slate-500 mb-1">Telefone</div>
                <div className="text-lg text-slate-200">{selectedLead.telefone}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <a href={`https://wa.me/${selectedLead.telefone?.replace(/\D/g, '')}`} target="_blank" className="flex-1 py-2 bg-green-600 text-white rounded-lg text-center hover:bg-green-500 transition-colors">
                WhatsApp
              </a>
              <button onClick={() => setSelectedLead(null)} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMLeads;
