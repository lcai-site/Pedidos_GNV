import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Kanban, 
  Layers, 
  Tag, 
  Zap,
  Users,
  ArrowRight,
  Plus,
  Edit2,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { usePipelines, useEtapas, useTags, useCreatePipeline, useAutomacaoRegras } from '../../lib/hooks/useCRMKanban';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { toast } from 'sonner';

export const CRMConfig: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'pipelines' | 'tags' | 'automacoes'>('pipelines');
  const [showNewPipelineModal, setShowNewPipelineModal] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newPipelineDesc, setNewPipelineDesc] = useState('');

  const { data: pipelines, isLoading: loadingPipelines } = usePipelines();
  const { data: tags, isLoading: loadingTags } = useTags();
  const { data: regras } = useAutomacaoRegras();
  const createPipeline = useCreatePipeline();

  const handleCreatePipeline = async () => {
    if (!newPipelineName.trim()) {
      toast.error('Nome do pipeline é obrigatório');
      return;
    }

    await createPipeline.mutateAsync({
      nome: newPipelineName,
      descricao: newPipelineDesc,
      cor: '#10b981'
    });

    setShowNewPipelineModal(false);
    setNewPipelineName('');
    setNewPipelineDesc('');
  };

  const configCards = [
    {
      title: 'Pipelines (Funis)',
      description: 'Gerencie os funis de vendas e etapas do seu processo comercial',
      icon: Kanban,
      count: pipelines?.length || 0,
      color: 'emerald',
      action: () => setActiveTab('pipelines'),
      path: '/crm/pipelines'
    },
    {
      title: 'Etiquetas (Tags)',
      description: 'Organize leads com tags coloridas e categorizadas',
      icon: Tag,
      count: tags?.length || 0,
      color: 'violet',
      action: () => setActiveTab('tags'),
      path: '/crm/tags'
    },
    {
      title: 'Automações',
      description: 'Configure regras automáticas para movimentação de leads',
      icon: Zap,
      count: regras?.filter(r => r.ativo).length || 0,
      color: 'amber',
      action: () => setActiveTab('automacoes'),
      path: '/crm/automacoes'
    }
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Configurações do CRM"
        subtitle="Gerencie pipelines, tags e automações do seu sistema de vendas"
        icon={Settings}
      />

      {/* Cards de Configuração */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {configCards.map((card) => (
          <div
            key={card.title}
            onClick={() => navigate(card.path)}
            className="group cursor-pointer rounded-2xl border border-slate-800 bg-slate-900/50 p-6 hover:border-slate-700 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-${card.color}-500/10`}>
                <card.icon className={`h-6 w-6 text-${card.color}-400`} />
              </div>
              <span className="text-2xl font-bold text-slate-200">{card.count}</span>
            </div>
            <h3 className="font-semibold text-slate-200 mb-2">{card.title}</h3>
            <p className="text-sm text-slate-500 mb-4">{card.description}</p>
            <div className="flex items-center text-sm text-slate-400 group-hover:text-slate-200 transition-colors">
              Configurar <ArrowRight className="ml-2 h-4 w-4" />
            </div>
          </div>
        ))}
      </div>

      {/* Lista de Pipelines */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h3 className="font-semibold text-slate-200">Pipelines Ativos</h3>
            <p className="text-sm text-slate-500">Funis de vendas configurados no sistema</p>
          </div>
          <button
            onClick={() => setShowNewPipelineModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Pipeline
          </button>
        </div>

        <div className="divide-y divide-slate-800">
          {loadingPipelines ? (
            <div className="p-6 text-center text-slate-500">Carregando...</div>
          ) : pipelines?.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              Nenhum pipeline encontrado. Crie seu primeiro funil de vendas!
            </div>
          ) : (
            pipelines?.map((pipeline) => (
              <div key={pipeline.id} className="flex items-center justify-between p-6 hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: pipeline.cor }}
                  />
                  <div>
                    <h4 className="font-medium text-slate-200">{pipeline.nome}</h4>
                    <p className="text-sm text-slate-500">{pipeline.descricao || 'Sem descrição'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate('/crm/leads')}
                    className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Ver Funil
                  </button>
                  <button 
                    onClick={() => navigate('/crm/pipelines')}
                    className="p-2 text-slate-400 hover:text-slate-200"
                    title="Gerenciar pipeline"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Novo Pipeline */}
      {showNewPipelineModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-lg font-bold text-slate-200">Novo Pipeline</h3>
              <p className="text-sm text-slate-500">Crie um novo funil de vendas</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Nome *</label>
                <input
                  type="text"
                  value={newPipelineName}
                  onChange={(e) => setNewPipelineName(e.target.value)}
                  placeholder="Ex: Vendas, Pós-Venda, Recuperação"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Descrição</label>
                <textarea
                  value={newPipelineDesc}
                  onChange={(e) => setNewPipelineDesc(e.target.value)}
                  placeholder="Descrição do pipeline..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200"
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-800">
              <button
                onClick={() => setShowNewPipelineModal(false)}
                className="flex-1 py-2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreatePipeline}
                disabled={createPipeline.isPending}
                className="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {createPipeline.isPending ? 'Criando...' : 'Criar Pipeline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMConfig;
