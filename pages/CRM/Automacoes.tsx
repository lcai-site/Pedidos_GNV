import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, 
  Plus, 
  Edit2, 
  Trash2, 
  Power, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Tag,
  GitBranch,
  ArrowRight,
  Clock,
  UserPlus,
  Bell,
  FileEdit
} from 'lucide-react';
import { 
  useAutomacaoRegras, 
  useCreateAutomacaoRegra, 
  useUpdateAutomacaoRegra, 
  useDeleteAutomacaoRegra,
  useToggleAutomacaoRegra,
  usePipelines,
  useEtapas,
  useTags,
  GATILHOS_CONFIG,
  ACOES_CONFIG,
  GatilhoTipo,
  AcaoTipo,
  AutomacaoRegra
} from '../../lib/hooks/useCRMKanban';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { toast } from 'sonner';

const GATILHO_ICONES: Record<string, React.ElementType> = {
  lead_criado: UserPlus,
  status_alterado: FileEdit,
  etapa_alterada: GitBranch,
  secao_alterada: ArrowRight,
  tempo_na_etapa: Clock,
  compra_realizada: CheckCircle2,
  compra_cancelada: XCircle
};

const ACAO_ICONES: Record<string, React.ElementType> = {
  aplicar_tag: Tag,
  remover_tag: Tag,
  mover_pipeline: GitBranch,
  criar_tarefa: Plus,
  enviar_notificacao: Bell,
  atualizar_campo: FileEdit
};

export const CRMAutomacoes: React.FC = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [editingRegra, setEditingRegra] = useState<AutomacaoRegra | null>(null);
  
  // Form states
  const [formData, setFormData] = useState<Partial<AutomacaoRegra>>({
    nome: '',
    descricao: '',
    gatilho_tipo: 'lead_criado',
    gatilho_condicoes: {},
    acao_tipo: 'aplicar_tag',
    acao_config: {},
    ativo: true
  });

  const { data: regras, isLoading } = useAutomacaoRegras();
  const { data: pipelines } = usePipelines();
  const { data: tags } = useTags();
  const createRegra = useCreateAutomacaoRegra();
  const updateRegra = useUpdateAutomacaoRegra();
  const deleteRegra = useDeleteAutomacaoRegra();
  const toggleRegra = useToggleAutomacaoRegra();

  // Buscar etapas do pipeline selecionado na ação
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const { data: etapas } = useEtapas(selectedPipelineId || undefined);

  const handleOpenModal = (regra?: AutomacaoRegra) => {
    if (regra) {
      setEditingRegra(regra);
      setFormData({ ...regra });
      if (regra.acao_tipo === 'mover_pipeline' && regra.acao_config?.pipeline_id) {
        setSelectedPipelineId(regra.acao_config.pipeline_id);
      }
    } else {
      setEditingRegra(null);
      setFormData({
        nome: '',
        descricao: '',
        gatilho_tipo: 'lead_criado',
        gatilho_condicoes: {},
        acao_tipo: 'aplicar_tag',
        acao_config: {},
        ativo: true
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome?.trim()) {
      toast.error('Nome da regra é obrigatório');
      return;
    }

    try {
      if (editingRegra) {
        await updateRegra.mutateAsync({ id: editingRegra.id, ...formData });
        toast.success('Regra atualizada!');
      } else {
        await createRegra.mutateAsync(formData);
        toast.success('Regra criada!');
      }
      setShowModal(false);
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Excluir regra "${nome}"?`)) return;
    try {
      await deleteRegra.mutateAsync(id);
      toast.success('Regra excluída!');
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const handleToggle = async (id: string, ativo: boolean) => {
    try {
      await toggleRegra.mutateAsync({ id, ativo });
      toast.success(ativo ? 'Regra ativada!' : 'Regra desativada!');
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const updateGatilhoCondicao = (campo: string, valor: any) => {
    setFormData(prev => ({
      ...prev,
      gatilho_condicoes: { ...prev.gatilho_condicoes, [campo]: valor }
    }));
  };

  const updateAcaoConfig = (campo: string, valor: any) => {
    setFormData(prev => ({
      ...prev,
      acao_config: { ...prev.acao_config, [campo]: valor }
    }));
  };

  const getGatilhoLabel = (tipo: string) => GATILHOS_CONFIG[tipo as GatilhoTipo]?.label || tipo;
  const getAcaoLabel = (tipo: string) => ACOES_CONFIG[tipo as AcaoTipo]?.label || tipo;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Regras de Automação"
        subtitle="Configure automações para etiquetas e pipelines baseadas em gatilhos"
        icon={Zap}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-slate-200">{regras?.length || 0}</div>
          <div className="text-sm text-slate-500">Total de Regras</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-emerald-400">{regras?.filter(r => r.ativo).length || 0}</div>
          <div className="text-sm text-slate-500">Regras Ativas</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-amber-400">{regras?.filter(r => !r.ativo).length || 0}</div>
          <div className="text-sm text-slate-500">Regras Inativas</div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl p-4 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Regra
        </button>
      </div>

      {/* Lista de Regras */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="font-semibold text-slate-200">Regras Configuradas</h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Carregando...</div>
        ) : regras?.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma regra de automação configurada</p>
            <p className="text-sm mt-2">Clique em "Nova Regra" para começar</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {regras?.map((regra) => {
              const GatilhoIcon = GATILHO_ICONES[regra.gatilho_tipo] || Zap;
              const AcaoIcon = ACAO_ICONES[regra.acao_tipo] || Zap;
              
              return (
                <div key={regra.id} className={`p-4 hover:bg-slate-800/30 transition-colors ${!regra.ativo ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-4">
                    {/* Status */}
                    <button
                      onClick={() => handleToggle(regra.id, !regra.ativo)}
                      className={`p-2 rounded-lg transition-colors ${
                        regra.ativo 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-slate-700 text-slate-500'
                      }`}
                      title={regra.ativo ? 'Desativar' : 'Ativar'}
                    >
                      <Power className="w-4 h-4" />
                    </button>

                    {/* Conteúdo */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-slate-200">{regra.nome}</h4>
                        {!regra.ativo && (
                          <span className="px-2 py-0.5 bg-slate-700 text-slate-400 text-xs rounded">Inativa</span>
                        )}
                      </div>
                      {regra.descricao && (
                        <p className="text-sm text-slate-500 mb-2">{regra.descricao}</p>
                      )}
                      
                      {/* Fluxo visual */}
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg">
                          <GatilhoIcon className="w-4 h-4 text-blue-400" />
                          <span className="text-sm text-slate-300">{getGatilhoLabel(regra.gatilho_tipo)}</span>
                          {regra.gatilho_condicoes?.status_atual && (
                            <span className="text-xs text-slate-500">
                              → {regra.gatilho_condicoes.status_atual}
                            </span>
                          )}
                        </div>
                        
                        <ArrowRight className="w-4 h-4 text-slate-600" />
                        
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg">
                          <AcaoIcon className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm text-slate-300">{getAcaoLabel(regra.acao_tipo)}</span>
                          {regra.acao_config?.tag_id && tags && (
                            <span className="text-xs text-slate-500">
                              → {tags.find(t => t.id === regra.acao_config.tag_id)?.nome || 'Tag'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenModal(regra)}
                        className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(regra.id, regra.nome)}
                        className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Criação/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-lg font-bold text-slate-200">
                {editingRegra ? 'Editar Regra' : 'Nova Regra de Automação'}
              </h3>
              <p className="text-sm text-slate-500">
                Configure quando e o que fazer automaticamente
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Nome e Descrição */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Nome da Regra *
                  </label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Aplicar tag 'Hot' quando comprar"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Descrição (opcional)
                  </label>
                  <textarea
                    value={formData.descricao || ''}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Descreva o objetivo desta regra..."
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200"
                  />
                </div>
              </div>

              {/* Gatilho */}
              <div className="bg-slate-800/30 rounded-xl p-4 space-y-4">
                <h4 className="font-medium text-slate-200 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Quando isso acontecer (Gatilho)
                </h4>
                
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Tipo de Gatilho
                  </label>
                  <select
                    value={formData.gatilho_tipo}
                    onChange={(e) => {
                      setFormData({ 
                        ...formData, 
                        gatilho_tipo: e.target.value as GatilhoTipo,
                        gatilho_condicoes: {}
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200"
                  >
                    {Object.entries(GATILHOS_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    {GATILHOS_CONFIG[formData.gatilho_tipo as GatilhoTipo]?.descricao}
                  </p>
                </div>

                {/* Condições específicas do gatilho */}
                {GATILHOS_CONFIG[formData.gatilho_tipo as GatilhoTipo]?.campos.includes('status_atual') && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Status Anterior (opcional)</label>
                      <select
                        value={formData.gatilho_condicoes?.status_anterior || ''}
                        onChange={(e) => updateGatilhoCondicao('status_anterior', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm"
                      >
                        <option value="">Qualquer</option>
                        <option value="novo">Novo</option>
                        <option value="interesse">Interesse</option>
                        <option value="negociacao">Negociação</option>
                        <option value="fechado">Fechado</option>
                        <option value="perdido">Perdido</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Status Novo *</label>
                      <select
                        value={formData.gatilho_condicoes?.status_atual || ''}
                        onChange={(e) => updateGatilhoCondicao('status_atual', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm"
                        required
                      >
                        <option value="">Selecione...</option>
                        <option value="novo">Novo</option>
                        <option value="interesse">Interesse</option>
                        <option value="negociacao">Negociação</option>
                        <option value="fechado">Fechado</option>
                        <option value="perdido">Perdido</option>
                      </select>
                    </div>
                  </div>
                )}

                {GATILHOS_CONFIG[formData.gatilho_tipo as GatilhoTipo]?.campos.includes('secao') && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Seção</label>
                    <select
                      value={formData.gatilho_condicoes?.secao || ''}
                      onChange={(e) => updateGatilhoCondicao('secao', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm"
                    >
                      <option value="">Selecione...</option>
                      <option value="comercial">Comercial</option>
                      <option value="pos-venda">Pós-Venda</option>
                      <option value="suporte">Suporte</option>
                      <option value="logistica">Logística</option>
                    </select>
                  </div>
                )}

                {GATILHOS_CONFIG[formData.gatilho_tipo as GatilhoTipo]?.campos.includes('etapa_id') && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Etapa do Pipeline</label>
                    <select
                      value={formData.gatilho_condicoes?.etapa_id || ''}
                      onChange={(e) => updateGatilhoCondicao('etapa_id', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm"
                    >
                      <option value="">Selecione...</option>
                      {pipelines?.map(p => (
                        <optgroup key={p.id} label={p.nome}>
                          {/* Aqui precisaríamos buscar etapas de cada pipeline */}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Ação */}
              <div className="bg-slate-800/30 rounded-xl p-4 space-y-4">
                <h4 className="font-medium text-slate-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-emerald-400" />
                  Faça isso (Ação)
                </h4>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Tipo de Ação
                  </label>
                  <select
                    value={formData.acao_tipo}
                    onChange={(e) => {
                      setFormData({ 
                        ...formData, 
                        acao_tipo: e.target.value as AcaoTipo,
                        acao_config: {}
                      });
                      setSelectedPipelineId('');
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200"
                  >
                    {Object.entries(ACOES_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>

                {/* Config específica da ação */}
                {formData.acao_tipo === 'aplicar_tag' || formData.acao_tipo === 'remover_tag' ? (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Etiqueta</label>
                    <select
                      value={formData.acao_config?.tag_id || ''}
                      onChange={(e) => updateAcaoConfig('tag_id', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm"
                      required
                    >
                      <option value="">Selecione uma etiqueta...</option>
                      {tags?.map(tag => (
                        <option key={tag.id} value={tag.id}>{tag.nome}</option>
                      ))}
                    </select>
                  </div>
                ) : formData.acao_tipo === 'mover_pipeline' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Pipeline</label>
                      <select
                        value={formData.acao_config?.pipeline_id || ''}
                        onChange={(e) => {
                          updateAcaoConfig('pipeline_id', e.target.value);
                          setSelectedPipelineId(e.target.value);
                          updateAcaoConfig('etapa_id', '');
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm"
                        required
                      >
                        <option value="">Selecione um pipeline...</option>
                        {pipelines?.map(p => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </div>
                    {selectedPipelineId && (
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Etapa</label>
                        <select
                          value={formData.acao_config?.etapa_id || ''}
                          onChange={(e) => updateAcaoConfig('etapa_id', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm"
                          required
                        >
                          <option value="">Selecione uma etapa...</option>
                          {etapas?.map(e => (
                            <option key={e.id} value={e.id}>{e.nome}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : formData.acao_tipo === 'atualizar_campo' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Campo</label>
                      <select
                        value={formData.acao_config?.campo || ''}
                        onChange={(e) => updateAcaoConfig('campo', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm"
                      >
                        <option value="">Selecione...</option>
                        <option value="prioridade">Prioridade</option>
                        <option value="temperatura">Temperatura</option>
                        <option value="fonte">Fonte</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Valor</label>
                      <input
                        type="text"
                        value={formData.acao_config?.valor || ''}
                        onChange={(e) => updateAcaoConfig('valor', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Ações do Modal */}
              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createRegra.isPending || updateRegra.isPending}
                  className="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {createRegra.isPending || updateRegra.isPending 
                    ? 'Salvando...' 
                    : editingRegra ? 'Salvar Alterações' : 'Criar Regra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMAutomacoes;
