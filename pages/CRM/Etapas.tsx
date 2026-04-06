import React, { useState } from 'react';
import { usePipelines, useEtapas, useCreateEtapa } from '../../lib/hooks/useCRMKanban';
import { SectionHeader } from '../../components/ui/SectionHeader';
import {
  Loader2,
  Plus,
  Clock,
  Target,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Filter,
  Settings
} from 'lucide-react';
import type { Etapa } from '../../lib/hooks/useCRMKanban';

// Utility para classes condicionais
function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// Modal simples local
const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

const TIPOS_ETAPA = [
  { value: 'manual', label: 'Manual', desc: 'Movimentação manual entre etapas' },
  { value: 'automatico', label: 'Automático', desc: 'Movimentação automática por regras' },
  { value: 'finalizacao', label: 'Finalização', desc: 'Etapa de conclusão positiva (ganho)' },
  { value: 'descarte', label: 'Descarte', desc: 'Etapa de perda/arquivamento' },
] as const;

const CORES_PADRAO = [
  '#64748b', '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef'
];

export const CRMEtapas: React.FC = () => {
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [novaEtapa, setNovaEtapa] = useState({
    nome: '',
    descricao: '',
    cor: '#3b82f6',
    tipo: 'manual' as 'manual' | 'automatico' | 'finalizacao' | 'descarte',
    sla_horas: 24,
    probabilidade: 50
  });

  const { data: pipelines, isLoading: loadingPipelines } = usePipelines();
  const { data: etapas, isLoading: loadingEtapas } = useEtapas(selectedPipeline);
  const createEtapa = useCreateEtapa();

  const handleCreate = async () => {
    if (!novaEtapa.nome || !selectedPipeline) return;

    await createEtapa.mutateAsync({
      ...novaEtapa,
      pipeline_id: selectedPipeline,
      alerta_sla: true
    });

    setNovaEtapa({
      nome: '',
      descricao: '',
      cor: '#3b82f6',
      tipo: 'manual',
      sla_horas: 24,
      probabilidade: 50
    });
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Etapas do Kanban"
        subtitle="Configure as colunas e estágios de cada pipeline"
      />

      {/* Pipeline Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Pipeline
            </label>
            <select
              value={selectedPipeline}
              onChange={(e) => setSelectedPipeline(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione um pipeline...</option>
              {pipelines?.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          
          {selectedPipeline && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Nova Etapa
            </button>
          )}
        </div>
      </div>

      {/* Etapas List */}
      {loadingEtapas ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : !selectedPipeline ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Settings className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Selecione um Pipeline</h3>
          <p className="text-slate-500 mt-1">Escolha um pipeline para gerenciar suas etapas</p>
        </div>
      ) : etapas?.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Plus className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Nenhuma Etapa</h3>
          <p className="text-slate-500 mt-1 mb-4">Crie a primeira etapa para este pipeline</p>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Plus className="w-4 h-4" />
            Criar Etapa
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {etapas?.map((etapa, index) => (
            <EtapaCard key={etapa.id} etapa={etapa} index={index} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nova Etapa"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
            <input
              type="text"
              value={novaEtapa.nome}
              onChange={(e) => setNovaEtapa({ ...novaEtapa, nome: e.target.value })}
              placeholder="Ex: Proposta Enviada"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
            <input
              type="text"
              value={novaEtapa.descricao}
              onChange={(e) => setNovaEtapa({ ...novaEtapa, descricao: e.target.value })}
              placeholder="Descrição opcional"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Cor</label>
            <div className="flex flex-wrap gap-2">
              {CORES_PADRAO.map(c => (
                <button
                  key={c}
                  onClick={() => setNovaEtapa({ ...novaEtapa, cor: c })}
                  className={cn(
                    "w-8 h-8 rounded-lg border-2 transition-all",
                    novaEtapa.cor === c ? "border-slate-900 scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_ETAPA.map(t => (
                <button
                  key={t.value}
                  onClick={() => setNovaEtapa({ ...novaEtapa, tipo: t.value })}
                  className={cn(
                    "p-3 rounded-lg border-2 text-left transition-all",
                    novaEtapa.tipo === t.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="font-medium text-sm">{t.label}</div>
                  <div className="text-xs text-slate-500">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                <Clock className="w-4 h-4 inline mr-1" />
                SLA (horas)
              </label>
              <input
                type="number"
                value={novaEtapa.sla_horas}
                onChange={(e) => setNovaEtapa({ ...novaEtapa, sla_horas: parseInt(e.target.value) || 24 })}
                min="1"
                max="720"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                <Target className="w-4 h-4 inline mr-1" />
                Probabilidade (%)
              </label>
              <input
                type="number"
                value={novaEtapa.probabilidade}
                onChange={(e) => setNovaEtapa({ ...novaEtapa, probabilidade: parseInt(e.target.value) || 0 })}
                min="0"
                max="100"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button 
              onClick={() => setShowModal(false)}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={!novaEtapa.nome || createEtapa.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {createEtapa.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Criar Etapa
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// Componente para cada card de etapa
const EtapaCard: React.FC<{ etapa: Etapa; index: number }> = ({ etapa, index }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getTipoBadge = (tipo: string) => {
    const colors = {
      manual: 'bg-slate-100 text-slate-700',
      automatico: 'bg-blue-100 text-blue-700',
      finalizacao: 'bg-green-100 text-green-700',
      descarte: 'bg-red-100 text-red-700'
    };
    const labels = {
      manual: 'Manual',
      automatico: 'Automático',
      finalizacao: 'Finalização',
      descarte: 'Descarte'
    };
    return (
      <span className={cn("px-2 py-1 rounded-full text-xs font-medium", colors[tipo as keyof typeof colors])}>
        {labels[tipo as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div
        className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div
          className="w-4 h-12 rounded"
          style={{ backgroundColor: etapa.cor }}
        />
        
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">#{index + 1}</span>
            <h3 className="font-medium text-slate-900">{etapa.nome}</h3>
          </div>
          {etapa.descricao && (
            <p className="text-sm text-slate-500">{etapa.descricao}</p>
          )}
        </div>

        <div className="flex items-center gap-4">
          {getTipoBadge(etapa.tipo)}
          
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Clock className="w-4 h-4" />
            {etapa.sla_horas}h
          </div>
          
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Target className="w-4 h-4" />
            {etapa.probabilidade}%
          </div>

          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-100">
          <div className="pt-4 grid grid-cols-3 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">SLA Alerta</div>
              <div className="font-medium">
                {etapa.alerta_sla ? (
                  <span className="text-green-600">Ativo</span>
                ) : (
                  <span className="text-slate-400">Inativo</span>
                )}
              </div>
            </div>
            
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Regras de Entrada</div>
              <div className="font-medium text-slate-700">
                {etapa.regras_entrada?.length || 0} regras
              </div>
            </div>
            
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">Automatizações</div>
              <div className="font-medium text-slate-700">
                Em breve
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
              <Settings className="w-4 h-4" />
              Configurar Regras
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
              <Filter className="w-4 h-4" />
              Automações
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMEtapas;
