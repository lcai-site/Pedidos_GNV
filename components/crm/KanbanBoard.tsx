import React, { useMemo, useCallback } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DroppableProvided,
  DraggableProvided,
  DraggableStateSnapshot,
  DroppableStateSnapshot
} from '@hello-pangea/dnd';
import {
  Plus,
  MoreHorizontal,
  Filter,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  Clock,
  AlertCircle,
  User,
  Tag,
  DollarSign,
  GripVertical,
  TrendingUp,
  Users
} from 'lucide-react';
import { Lead, Etapa, Pipeline } from '../../lib/hooks/useCRMKanban';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface KanbanBoardProps {
  pipeline: Pipeline;
  etapas: Etapa[];
  leads: Lead[];
  onMoveLead: (leadId: string, etapaId: string) => void;
  onLeadClick: (lead: Lead) => void;
  onAddLead: (etapaId: string) => void;
  loading?: boolean;
}

const PRIORIDADE_CONFIG = {
  1: { label: 'Baixa', color: 'bg-slate-400', textColor: 'text-slate-400', borderColor: 'border-slate-400' },
  2: { label: 'Normal', color: 'bg-blue-400', textColor: 'text-blue-400', borderColor: 'border-blue-400' },
  3: { label: 'Alta', color: 'bg-amber-400', textColor: 'text-amber-400', borderColor: 'border-amber-400' },
  4: { label: 'Urgente', color: 'bg-rose-500', textColor: 'text-rose-500', borderColor: 'border-rose-500' }
};

const ORIGEM_ICONS: Record<string, React.ReactNode> = {
  recovery: <TrendingUp className="w-3 h-3" />,
  site: <Globe className="w-3 h-3" />,
  facebook: <Facebook className="w-3 h-3" />,
  instagram: <Instagram className="w-3 h-3" />,
  indicacao: <Users className="w-3 h-3" />,
  manual: <User className="w-3 h-3" />
};

// Importar ícones adicionais dinamicamente
import { Globe, Facebook, Instagram } from 'lucide-react';

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  pipeline,
  etapas,
  leads,
  onMoveLead,
  onLeadClick,
  onAddLead,
  loading
}) => {
  // Agrupar leads por etapa
  const leadsPorEtapa = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    etapas.forEach(etapa => {
      grouped[etapa.id] = leads.filter(lead => lead.etapa_id === etapa.id);
    });
    return grouped;
  }, [etapas, leads]);

  // Calcular totais por etapa
  const totaisPorEtapa = useMemo(() => {
    const totais: Record<string, { count: number; value: number }> = {};
    etapas.forEach(etapa => {
      const etapaLeads = leadsPorEtapa[etapa.id] || [];
      totais[etapa.id] = {
        count: etapaLeads.length,
        value: etapaLeads.reduce((sum, lead) => sum + (lead.valor || 0), 0)
      };
    });
    return totais;
  }, [etapas, leadsPorEtapa]);

  // Handler de drag end
  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    
    const { draggableId, destination } = result;
    
    // Só move se mudou de etapa
    if (result.source.droppableId !== destination.droppableId) {
      onMoveLead(draggableId, destination.droppableId);
    }
  }, [onMoveLead]);

  const formatCurrency = (value?: number) => {
    if (!value) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getSLAStatus = (lead: Lead, slaHoras?: number) => {
    if (!slaHoras || !lead.data_entrada_etapa) return null;
    
    const entrada = new Date(lead.data_entrada_etapa);
    const agora = new Date();
    const horasNaEtapa = (agora.getTime() - entrada.getTime()) / (1000 * 60 * 60);
    
    if (horasNaEtapa > slaHoras) return 'overdue';
    if (horasNaEtapa > slaHoras * 0.8) return 'warning';
    return 'ok';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-500 text-sm">Carregando Kanban...</span>
        </div>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px] px-1">
        {etapas.map((etapa) => {
          const etapaLeads = leadsPorEtapa[etapa.id] || [];
          const total = totaisPorEtapa[etapa.id];
          
          return (
            <div key={etapa.id} className="flex-shrink-0 w-80">
              {/* Header da Coluna - Estilo Pipedrive */}
              <div 
                className="rounded-t-xl p-3 border-t-4"
                style={{ borderColor: etapa.cor }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-200 truncate">{etapa.nome}</h3>
                    <span className="flex-shrink-0 px-2 py-0.5 bg-slate-800 text-xs text-slate-400 rounded-full font-medium">
                      {total.count}
                    </span>
                  </div>
                  <button 
                    onClick={() => onAddLead(etapa.id)}
                    className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Adicionar lead"
                  >
                    <Plus className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
                
                {/* Barra de progresso e valor */}
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-3">
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${etapa.probabilidade}%`,
                          backgroundColor: etapa.cor
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-emerald-400">
                      {formatCurrency(total.value)}
                    </div>
                    {etapa.probabilidade > 0 && (
                      <div className="text-[10px] text-slate-500">
                        {etapa.probabilidade}% prob.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Área de Drop - Estilo Bitrix24 */}
              <Droppable droppableId={etapa.id}>
                {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`bg-slate-900/40 border-x border-b border-slate-800 rounded-b-xl p-2 min-h-[400px] transition-all ${
                      snapshot.isDraggingOver ? 'bg-slate-800/60 border-slate-600' : ''
                    }`}
                  >
                    {etapaLeads.map((lead, index) => {
                      const slaStatus = getSLAStatus(lead, etapa.sla_horas);
                      const prioridade = PRIORIDADE_CONFIG[lead.prioridade];
                      
                      return (
                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                          {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => onLeadClick(lead)}
                              className={`mb-3 p-3 rounded-xl border cursor-pointer transition-all group ${
                                snapshot.isDragging 
                                  ? 'shadow-2xl rotate-2 scale-105 border-blue-500 bg-slate-800' 
                                  : 'hover:border-slate-600 hover:shadow-lg hover:-translate-y-0.5 bg-slate-800/60 border-slate-700'
                              } ${slaStatus === 'overdue' ? 'border-l-4 border-l-rose-500' : ''} ${
                                slaStatus === 'warning' ? 'border-l-4 border-l-amber-500' : ''
                              }`}
                              style={provided.draggableProps.style}
                            >
                              {/* Header do Card */}
                              <div className="flex items-start gap-2 mb-2">
                                <div className={`w-1 h-8 rounded-full ${prioridade.color}`} />
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm text-slate-200 truncate leading-tight">
                                    {lead.titulo || lead.nome}
                                  </h4>
                                  <p className="text-xs text-slate-500 truncate">
                                    {lead.nome}
                                  </p>
                                </div>
                                {/* Menu de ações */}
                                <button 
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition-all"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Abrir menu de ações
                                  }}
                                >
                                  <MoreHorizontal className="w-4 h-4 text-slate-400" />
                                </button>
                              </div>

                              {/* Valor */}
                              {lead.valor && lead.valor > 0 && (
                                <div className="flex items-center gap-1.5 mb-2">
                                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-sm font-bold text-emerald-400">
                                    {formatCurrency(lead.valor)}
                                  </span>
                                </div>
                              )}

                              {/* Contato */}
                              <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                                <Phone className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{lead.telefone}</span>
                              </div>

                              {/* Tags */}
                              {lead.tags && lead.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {lead.tags.slice(0, 3).map((tag: any) => (
                                    <span 
                                      key={tag.id}
                                      className="px-1.5 py-0.5 text-[10px] rounded-md font-medium"
                                      style={{ 
                                        backgroundColor: `${tag.cor}20`, 
                                        color: tag.cor,
                                        border: `1px solid ${tag.cor}40`
                                      }}
                                    >
                                      {tag.nome}
                                    </span>
                                  ))}
                                  {lead.tags.length > 3 && (
                                    <span className="px-1.5 py-0.5 text-[10px] text-slate-500 bg-slate-800 rounded-md">
                                      +{lead.tags.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Footer com infos */}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                                <div className="flex items-center gap-2">
                                  {/* Ícone de origem */}
                                  <span className="text-slate-500" title={`Origem: ${lead.origem}`}>
                                    {ORIGEM_ICONS[lead.origem] || <User className="w-3 h-3" />}
                                  </span>
                                  
                                  {/* Badge de cliente */}
                                  {lead.historico_compras?.e_cliente && (
                                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                      <TrendingUp className="w-3 h-3" />
                                      Cliente
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Data do último contato */}
                                  {lead.data_ultimo_contato && (
                                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                      <MessageSquare className="w-3 h-3" />
                                      {formatDistanceToNow(new Date(lead.data_ultimo_contato), { 
                                        locale: ptBR,
                                        addSuffix: true 
                                      })}
                                    </span>
                                  )}
                                  
                                  {/* Avatar do responsável */}
                                  {lead.responsavel ? (
                                    lead.responsavel.avatar_url ? (
                                      <img 
                                        src={lead.responsavel.avatar_url}
                                        alt={lead.responsavel.nome_completo || lead.responsavel.email}
                                        className="w-6 h-6 rounded-full border border-slate-600"
                                        title={lead.responsavel.nome_completo || lead.responsavel.email}
                                      />
                                    ) : (
                                      <div 
                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                                          getAvatarColor(lead.responsavel.nome_completo || lead.responsavel.email)
                                        }`}
                                        title={lead.responsavel.nome_completo || lead.responsavel.email}
                                      >
                                        {getInitials(lead.responsavel.nome_completo || lead.responsavel.email)}
                                      </div>
                                    )
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                                      <User className="w-3 h-3 text-slate-500" />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Alerta SLA */}
                              {slaStatus === 'overdue' && (
                                <div className="mt-2 flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 px-2 py-1 rounded">
                                  <AlertCircle className="w-3 h-3" />
                                  SLA estourado
                                </div>
                              )}
                              {slaStatus === 'warning' && (
                                <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                                  <Clock className="w-3 h-3" />
                                  SLA próximo
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                    
                    {/* Botão adicionar no final da coluna */}
                    <button
                      onClick={() => onAddLead(etapa.id)}
                      className="w-full py-2 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 text-sm hover:border-slate-600 hover:text-slate-400 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar negócio
                    </button>
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
};

export default KanbanBoard;
