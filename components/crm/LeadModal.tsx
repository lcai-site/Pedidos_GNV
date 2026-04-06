import React, { useState } from 'react';
import {
  X,
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  Clock,
  Tag,
  DollarSign,
  User,
  MapPin,
  ShoppingCart,
  History,
  CheckSquare,
  FileText,
  MoreVertical,
  Edit2,
  Trash2,
  Archive,
  Send,
  Plus,
  AlertCircle,
  TrendingUp,
  Mail as MailIcon,
  PhoneCall,
  UserPlus
} from 'lucide-react';
import { Lead, Etapa, Tag as TagType, HistoricoItem, Tarefa } from '../../lib/hooks/useCRMKanban';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useHistorico, useAdicionarHistorico, useTarefas, useCriarTarefa, useConcluirTarefa, useTags, useAdicionarTagLead, useRemoverTagLead, useUpdateLead } from '../../lib/hooks/useCRMKanban';

interface LeadModalProps {
  lead: Lead;
  etapas: Etapa[];
  onClose: () => void;
  onEdit?: (lead: Lead) => void;
  onArquivar?: (id: string) => void;
  onDeletar?: (id: string) => void;
}

type TabType = 'detalhes' | 'historico' | 'tarefas' | 'anotacoes';

const PRIORIDADE_CONFIG = {
  1: { label: 'Baixa', color: 'bg-slate-400', textColor: 'text-slate-400' },
  2: { label: 'Normal', color: 'bg-blue-400', textColor: 'text-blue-400' },
  3: { label: 'Alta', color: 'bg-amber-400', textColor: 'text-amber-400' },
  4: { label: 'Urgente', color: 'bg-rose-500', textColor: 'text-rose-500' }
};

const TIPO_HISTORICO_ICONS: Record<string, React.ReactNode> = {
  movimentacao: <TrendingUp className="w-4 h-4" />,
  anotacao: <FileText className="w-4 h-4" />,
  ligacao: <PhoneCall className="w-4 h-4" />,
  whatsapp: <MessageCircle className="w-4 h-4" />,
  email: <MailIcon className="w-4 h-4" />,
  reuniao: <User className="w-4 h-4" />,
  tarefa: <CheckSquare className="w-4 h-4" />
};

const TIPO_HISTORICO_COLORS: Record<string, string> = {
  movimentacao: 'bg-blue-500/20 text-blue-400',
  anotacao: 'bg-slate-500/20 text-slate-400',
  ligacao: 'bg-emerald-500/20 text-emerald-400',
  whatsapp: 'bg-green-500/20 text-green-400',
  email: 'bg-amber-500/20 text-amber-400',
  reuniao: 'bg-violet-500/20 text-violet-400',
  tarefa: 'bg-cyan-500/20 text-cyan-400'
};

export const LeadModal: React.FC<LeadModalProps> = ({
  lead,
  etapas,
  onClose,
  onEdit,
  onArquivar,
  onDeletar
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('detalhes');
  const [novaAnotacao, setNovaAnotacao] = useState('');
  const [showNovaTarefa, setShowNovaTarefa] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState({
    titulo: '',
    data_vencimento: '',
    prioridade: 'media' as const
  });
  const [showAddTag, setShowAddTag] = useState(false);

  // Hooks
  const { data: historico, isLoading: loadingHistorico } = useHistorico(lead.id);
  const { data: tarefas, isLoading: loadingTarefas } = useTarefas(lead.id);
  const { data: todasTags } = useTags();
  const adicionarHistorico = useAdicionarHistorico();
  const criarTarefa = useCriarTarefa();
  const concluirTarefa = useConcluirTarefa();
  const adicionarTag = useAdicionarTagLead();
  const removerTag = useRemoverTagLead();
  const updateLead = useUpdateLead();

  const etapaAtual = etapas.find(e => e.id === lead.etapa_id);
  const prioridade = PRIORIDADE_CONFIG[lead.prioridade];

  const formatCurrency = (value?: number) => {
    if (!value) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSalvarAnotacao = async () => {
    if (!novaAnotacao.trim()) return;
    
    await updateLead.mutateAsync({
      id: lead.id,
      anotacoes: lead.anotacoes ? `${lead.anotacoes}\n\n${novaAnotacao}` : novaAnotacao
    });
    
    await adicionarHistorico.mutateAsync({
      lead_id: lead.id,
      tipo: 'anotacao',
      titulo: 'Anotação adicionada',
      descricao: novaAnotacao
    });
    
    setNovaAnotacao('');
  };

  const handleCriarTarefa = async () => {
    if (!novaTarefa.titulo || !novaTarefa.data_vencimento) return;
    
    await criarTarefa.mutateAsync({
      lead_id: lead.id,
      titulo: novaTarefa.titulo,
      data_vencimento: new Date(novaTarefa.data_vencimento).toISOString(),
      prioridade: novaTarefa.prioridade,
      tipo: 'followup'
    });
    
    setShowNovaTarefa(false);
    setNovaTarefa({ titulo: '', data_vencimento: '', prioridade: 'media' });
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'detalhes', label: 'Detalhes', icon: <FileText className="w-4 h-4" /> },
    { id: 'historico', label: 'Histórico', icon: <History className="w-4 h-4" />, count: historico?.length },
    { id: 'tarefas', label: 'Tarefas', icon: <CheckSquare className="w-4 h-4" />, count: tarefas?.filter(t => t.status !== 'concluida').length },
    { id: 'anotacoes', label: 'Anotações', icon: <FileText className="w-4 h-4" /> }
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className={`w-1 h-12 rounded-full ${prioridade.color}`} />
            <div>
              <h2 className="text-xl font-bold text-slate-100">
                {lead.titulo || lead.nome}
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${prioridade.color} bg-opacity-20 ${prioridade.textColor}`}>
                  {prioridade.label}
                </span>
                {etapaAtual && (
                  <span 
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${etapaAtual.cor}20`, color: etapaAtual.cor }}
                  >
                    {etapaAtual.nome}
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  Criado {formatDistanceToNow(new Date(lead.created_at), { locale: ptBR, addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onEdit?.(lead)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
              title="Editar"
            >
              <Edit2 className="w-5 h-5" />
            </button>
            <button 
              onClick={() => onArquivar?.(lead.id)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
              title="Arquivar"
            >
              <Archive className="w-5 h-5" />
            </button>
            <button 
              onClick={() => onDeletar?.(lead.id)}
              className="p-2 hover:bg-rose-500/20 rounded-lg transition-colors text-slate-400 hover:text-rose-400"
              title="Excluir"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Esquerda - Info Principal */}
          <div className="w-80 border-r border-slate-800 p-6 overflow-y-auto">
            {/* Valor */}
            <div className="mb-6">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Valor do Negócio</label>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {formatCurrency(lead.valor)}
              </div>
              {lead.valor_real && lead.valor_real > 0 && (
                <div className="text-sm text-slate-500 mt-1">
                  Fechado: {formatCurrency(lead.valor_real)}
                </div>
              )}
            </div>

            {/* Contato */}
            <div className="mb-6">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Contato</label>
              <div className="mt-2 space-y-2">
                <a 
                  href={`tel:${lead.telefone}`}
                  className="flex items-center gap-2 text-slate-300 hover:text-emerald-400 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {lead.telefone}
                </a>
                {lead.email && (
                  <a 
                    href={`mailto:${lead.email}`}
                    className="flex items-center gap-2 text-slate-300 hover:text-emerald-400 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    {lead.email}
                  </a>
                )}
              </div>
            </div>

            {/* Responsável */}
            <div className="mb-6">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Responsável</label>
              <div className="flex items-center gap-3 mt-2">
                {lead.responsavel?.avatar_url ? (
                  <img 
                    src={lead.responsavel.avatar_url}
                    alt=""
                    className="w-10 h-10 rounded-full border border-slate-600"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                    {getInitials(lead.responsavel?.nome_completo || lead.responsavel?.email || 'N/A')}
                  </div>
                )}
                <div>
                  <div className="text-sm text-slate-200">
                    {lead.responsavel?.nome_completo || lead.responsavel?.email?.split('@')[0] || 'Não atribuído'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {lead.responsavel?.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Tags</label>
                <button 
                  onClick={() => setShowAddTag(!showAddTag)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  + Adicionar
                </button>
              </div>
              
              {showAddTag && (
                <div className="mt-2 p-2 bg-slate-800 rounded-lg">
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {todasTags?.filter(t => !lead.tags?.find(lt => lt.id === t.id)).map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => {
                          adicionarTag.mutate({ leadId: lead.id, tagId: tag.id });
                          setShowAddTag(false);
                        }}
                        className="px-2 py-1 text-xs rounded-md transition-colors hover:opacity-80"
                        style={{ backgroundColor: tag.cor, color: '#fff' }}
                      >
                        {tag.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex flex-wrap gap-1 mt-2">
                {lead.tags?.map(tag => (
                  <span 
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md"
                    style={{ backgroundColor: `${tag.cor}20`, color: tag.cor, border: `1px solid ${tag.cor}40` }}
                  >
                    {tag.nome}
                    <button 
                      onClick={() => removerTag.mutate({ leadId: lead.id, tagId: tag.id })}
                      className="hover:opacity-70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Origem */}
            <div className="mb-6">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Origem</label>
              <div className="mt-1 text-sm text-slate-300 capitalize">
                {lead.origem}
                {lead.origem_detalhe && (
                  <span className="text-slate-500"> - {lead.origem_detalhe}</span>
                )}
              </div>
            </div>

            {/* Histórico de Compras */}
            {lead.historico_compras?.e_cliente && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <ShoppingCart className="w-4 h-4" />
                  <span className="font-medium">Já é Cliente!</span>
                </div>
                <div className="text-sm text-slate-300 space-y-1">
                  <div>Compras: {lead.historico_compras.total_compras}</div>
                  <div>Total: {formatCurrency(lead.historico_compras.valor_total)}</div>
                  <div>Ticket Médio: {formatCurrency(lead.historico_compras.ticket_medio)}</div>
                  {lead.historico_compras.ultima_compra && (
                    <div className="text-xs text-slate-500">
                      Última: {format(new Date(lead.historico_compras.ultima_compra), 'dd/MM/yyyy')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ações Rápidas */}
            <div className="mt-6 space-y-2">
              <a 
                href={`https://wa.me/${lead.telefone?.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Abrir WhatsApp
              </a>
              <button className="flex items-center justify-center gap-2 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors">
                <PhoneCall className="w-4 h-4" />
                Registrar Ligação
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Tabs */}
            <div className="flex border-b border-slate-800">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab.id 
                      ? 'text-blue-400 border-blue-400 bg-slate-800/50' 
                      : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="px-1.5 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'detalhes' && (
                <div className="space-y-6">
                  {/* Informações Pessoais */}
                  <section>
                    <h3 className="text-lg font-semibold text-slate-200 mb-4">Informações Pessoais</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-800/50 rounded-xl">
                        <label className="text-xs text-slate-500">Nome Completo</label>
                        <div className="text-slate-200 mt-1">{lead.nome}</div>
                      </div>
                      {lead.cpf && (
                        <div className="p-4 bg-slate-800/50 rounded-xl">
                          <label className="text-xs text-slate-500">CPF</label>
                          <div className="text-slate-200 mt-1">{lead.cpf}</div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Endereço */}
                  {lead.endereco && Object.values(lead.endereco).some(v => v) && (
                    <section>
                      <h3 className="text-lg font-semibold text-slate-200 mb-4">Endereço</h3>
                      <div className="p-4 bg-slate-800/50 rounded-xl">
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-slate-500 mt-0.5" />
                          <div className="text-slate-200">
                            {lead.endereco.logradouro && <div>{lead.endereco.logradouro}{lead.endereco.numero && `, ${lead.endereco.numero}`}</div>}
                            {lead.endereco.complemento && <div className="text-slate-500">{lead.endereco.complemento}</div>}
                            {lead.endereco.bairro && <div>{lead.endereco.bairro}</div>}
                            {(lead.endereco.cidade || lead.endereco.estado) && (
                              <div>{lead.endereco.cidade}{lead.endereco.estado && ` - ${lead.endereco.estado}`}</div>
                            )}
                            {lead.endereco.cep && <div className="text-slate-500">{lead.endereco.cep}</div>}
                          </div>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Datas Importantes */}
                  <section>
                    <h3 className="text-lg font-semibold text-slate-200 mb-4">Datas Importantes</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {lead.data_entrada_etapa && (
                        <div className="p-4 bg-slate-800/50 rounded-xl">
                          <label className="text-xs text-slate-500">Entrada na Etapa</label>
                          <div className="text-slate-200 mt-1">
                            {format(new Date(lead.data_entrada_etapa), 'dd/MM/yyyy HH:mm')}
                          </div>
                        </div>
                      )}
                      {lead.data_ultimo_contato && (
                        <div className="p-4 bg-slate-800/50 rounded-xl">
                          <label className="text-xs text-slate-500">Último Contato</label>
                          <div className="text-slate-200 mt-1">
                            {format(new Date(lead.data_ultimo_contato), 'dd/MM/yyyy HH:mm')}
                          </div>
                        </div>
                      )}
                      {lead.data_prevista_fechamento && (
                        <div className="p-4 bg-slate-800/50 rounded-xl">
                          <label className="text-xs text-slate-500">Previsão de Fechamento</label>
                          <div className="text-slate-200 mt-1">
                            {format(new Date(lead.data_prevista_fechamento), 'dd/MM/yyyy')}
                          </div>
                        </div>
                      )}
                      {lead.data_fechamento && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                          <label className="text-xs text-emerald-400">Data de Fechamento</label>
                          <div className="text-emerald-200 mt-1">
                            {format(new Date(lead.data_fechamento), 'dd/MM/yyyy')}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'historico' && (
                <div className="space-y-4">
                  {/* Adicionar entrada rápida */}
                  <div className="flex gap-2 mb-6">
                    <button 
                      onClick={() => {
                        const descricao = prompt('Descrição da ligação:');
                        if (descricao) {
                          adicionarHistorico.mutate({
                            lead_id: lead.id,
                            tipo: 'ligacao',
                            titulo: 'Ligação realizada',
                            descricao
                          });
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
                    >
                      <PhoneCall className="w-4 h-4" />
                      Ligação
                    </button>
                    <button 
                      onClick={() => {
                        const descricao = prompt('Mensagem do WhatsApp:');
                        if (descricao) {
                          adicionarHistorico.mutate({
                            lead_id: lead.id,
                            tipo: 'whatsapp',
                            titulo: 'Mensagem WhatsApp',
                            descricao
                          });
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      WhatsApp
                    </button>
                    <button 
                      onClick={() => {
                        const descricao = prompt('Assunto do email:');
                        if (descricao) {
                          adicionarHistorico.mutate({
                            lead_id: lead.id,
                            tipo: 'email',
                            titulo: 'Email enviado',
                            descricao
                          });
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      Email
                    </button>
                  </div>

                  {/* Timeline */}
                  {loadingHistorico ? (
                    <div className="text-center py-8 text-slate-500">Carregando...</div>
                  ) : historico?.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      Nenhum histórico registrado
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {historico?.map((item, index) => (
                        <div key={item.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${TIPO_HISTORICO_COLORS[item.tipo] || 'bg-slate-700 text-slate-400'}`}>
                              {TIPO_HISTORICO_ICONS[item.tipo] || <FileText className="w-4 h-4" />}
                            </div>
                            {index < historico.length - 1 && (
                              <div className="w-0.5 flex-1 bg-slate-800 my-2" />
                            )}
                          </div>
                          <div className="flex-1 pb-6">
                            <div className="p-4 bg-slate-800/50 rounded-xl">
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-medium text-slate-200">{item.titulo}</h4>
                                <span className="text-xs text-slate-500">
                                  {formatDistanceToNow(new Date(item.created_at), { locale: ptBR, addSuffix: true })}
                                </span>
                              </div>
                              {item.descricao && (
                                <p className="text-sm text-slate-400">{item.descricao}</p>
                              )}
                              {item.etapa_origem_id && item.etapa_destino_id && (
                                <div className="mt-2 text-sm text-slate-500">
                                  {item.metadata?.etapa_origem_nome} → {item.metadata?.etapa_destino_nome}
                                </div>
                              )}
                              {item.usuario && (
                                <div className="mt-2 text-xs text-slate-600">
                                  Por: {item.usuario.nome_completo || item.usuario.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'tarefas' && (
                <div className="space-y-4">
                  {/* Nova Tarefa */}
                  {!showNovaTarefa ? (
                    <button
                      onClick={() => setShowNovaTarefa(true)}
                      className="flex items-center gap-2 w-full py-3 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 hover:border-slate-600 hover:text-slate-400 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      Adicionar Tarefa
                    </button>
                  ) : (
                    <div className="p-4 bg-slate-800 rounded-xl space-y-3">
                      <input
                        type="text"
                        placeholder="Título da tarefa"
                        value={novaTarefa.titulo}
                        onChange={(e) => setNovaTarefa({ ...novaTarefa, titulo: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                      />
                      <div className="flex gap-2">
                        <input
                          type="datetime-local"
                          value={novaTarefa.data_vencimento}
                          onChange={(e) => setNovaTarefa({ ...novaTarefa, data_vencimento: e.target.value })}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                        />
                        <select
                          value={novaTarefa.prioridade}
                          onChange={(e) => setNovaTarefa({ ...novaTarefa, prioridade: e.target.value as any })}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                        >
                          <option value="baixa">Baixa</option>
                          <option value="normal">Normal</option>
                          <option value="alta">Alta</option>
                          <option value="urgente">Urgente</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCriarTarefa}
                          className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                        >
                          Criar
                        </button>
                        <button
                          onClick={() => setShowNovaTarefa(false)}
                          className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Lista de Tarefas */}
                  {loadingTarefas ? (
                    <div className="text-center py-8 text-slate-500">Carregando...</div>
                  ) : tarefas?.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      Nenhuma tarefa
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tarefas?.map(tarefa => (
                        <div 
                          key={tarefa.id}
                          className={`p-4 rounded-xl border ${
                            tarefa.status === 'concluida' 
                              ? 'bg-slate-800/30 border-slate-800 opacity-60' 
                              : 'bg-slate-800 border-slate-700'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => concluirTarefa.mutate(tarefa.id)}
                              className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                tarefa.status === 'concluida'
                                  ? 'bg-emerald-500 border-emerald-500'
                                  : 'border-slate-600 hover:border-emerald-500'
                              }`}
                            >
                              {tarefa.status === 'concluida' && <CheckSquare className="w-3 h-3 text-white" />}
                            </button>
                            <div className="flex-1">
                              <h4 className={`font-medium ${tarefa.status === 'concluida' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                {tarefa.titulo}
                              </h4>
                              {tarefa.descricao && (
                                <p className="text-sm text-slate-500 mt-1">{tarefa.descricao}</p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-xs">
                                <span className={`flex items-center gap-1 ${
                                  new Date(tarefa.data_vencimento) < new Date() && tarefa.status !== 'concluida'
                                    ? 'text-rose-400'
                                    : 'text-slate-500'
                                }`}>
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(tarefa.data_vencimento), 'dd/MM/yyyy HH:mm')}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full ${
                                  tarefa.prioridade === 'urgente' ? 'bg-rose-500/20 text-rose-400' :
                                  tarefa.prioridade === 'alta' ? 'bg-amber-500/20 text-amber-400' :
                                  tarefa.prioridade === 'media' ? 'bg-blue-500/20 text-blue-400' :
                                  'bg-slate-500/20 text-slate-400'
                                }`}>
                                  {tarefa.prioridade}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'anotacoes' && (
                <div className="space-y-4">
                  {/* Nova Anotação */}
                  <div className="space-y-2">
                    <textarea
                      value={novaAnotacao}
                      onChange={(e) => setNovaAnotacao(e.target.value)}
                      placeholder="Adicionar anotação..."
                      rows={4}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 resize-none"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleSalvarAnotacao}
                        disabled={!novaAnotacao.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        Salvar Anotação
                      </button>
                    </div>
                  </div>

                  {/* Anotações existentes */}
                  {lead.anotacoes && (
                    <div className="p-4 bg-slate-800/50 rounded-xl">
                      <h4 className="text-sm font-medium text-slate-400 mb-2">Anotações Anteriores</h4>
                      <div className="text-slate-300 whitespace-pre-wrap">{lead.anotacoes}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadModal;
