import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Plus, X, Trash2, ChevronRight, Edit2, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Pipeline {
  id: string;
  nome: string;
  descricao?: string;
  cor: string;
}

interface Etapa {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  probabilidade: number;
  sla_horas?: number;
}

export const CRMPipelines: React.FC = () => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form Pipeline
  const [showPipelineForm, setShowPipelineForm] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novaCor, setNovaCor] = useState('#3b82f6');
  
  // Editar Pipeline
  const [editingPipeline, setEditingPipeline] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCor, setEditCor] = useState('');
  
  // Form Etapa
  const [showEtapaForm, setShowEtapaForm] = useState(false);
  const [nomeEtapa, setNomeEtapa] = useState('');
  const [corEtapa, setCorEtapa] = useState('#3b82f6');
  const [probEtapa, setProbEtapa] = useState(10);
  const [slaEtapa, setSlaEtapa] = useState(24);
  
  // Editar Etapa
  const [editingEtapa, setEditingEtapa] = useState<string | null>(null);
  const [editNomeEtapa, setEditNomeEtapa] = useState('');
  const [editCorEtapa, setEditCorEtapa] = useState('');
  const [editProbEtapa, setEditProbEtapa] = useState(10);
  const [editSlaEtapa, setEditSlaEtapa] = useState(24);

  const cores = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#a855f7', '#ec4899'];

  useEffect(() => { fetchPipelines(); }, []);
  useEffect(() => { if (selectedPipelineId) fetchEtapas(selectedPipelineId); }, [selectedPipelineId]);

  const fetchPipelines = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('crm_pipelines').select('id, nome, descricao, cor').eq('ativo', true).order('ordem');
    if (error) toast.error('Erro ao carregar pipelines');
    else {
      setPipelines(data || []);
      if (data && data.length > 0 && !selectedPipelineId) setSelectedPipelineId(data[0].id);
    }
    setLoading(false);
  };

  const fetchEtapas = async (pipelineId: string) => {
    console.log('[fetchEtapas] Buscando para pipeline:', pipelineId);
    const { data, error } = await supabase.from('crm_etapas').select('*').eq('ativo', true).eq('pipeline_id', pipelineId).order('ordem');
    if (error) {
      console.error('[fetchEtapas] Erro:', error);
      toast.error('Erro ao carregar etapas');
    } else {
      console.log('[fetchEtapas] Encontradas:', data?.length);
      setEtapas(data || []);
    }
  };

  const criarPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) return;
    const { error } = await supabase.from('crm_pipelines').insert({ nome: novoNome.trim(), cor: novaCor, ativo: true, ordem: pipelines.length + 1 });
    if (error) toast.error('Erro: ' + error.message);
    else {
      toast.success('Pipeline criado!');
      setNovoNome(''); setShowPipelineForm(false);
      fetchPipelines();
    }
  };

  const atualizarPipeline = async (id: string) => {
    if (!editNome.trim()) return;
    const { error } = await supabase.from('crm_pipelines').update({ nome: editNome.trim(), cor: editCor }).eq('id', id);
    if (error) toast.error('Erro ao atualizar: ' + error.message);
    else {
      toast.success('Pipeline atualizado!');
      setEditingPipeline(null);
      fetchPipelines();
    }
  };

  const excluirPipeline = async (id: string, nome: string) => {
    if (!confirm(`Excluir "${nome}"?`)) return;
    const { error } = await supabase.from('crm_pipelines').update({ ativo: false }).eq('id', id);
    if (error) toast.error('Erro ao excluir');
    else {
      toast.success('Excluído!');
      if (selectedPipelineId === id) { setSelectedPipelineId(null); setEtapas([]); }
      fetchPipelines();
    }
  };

  const criarEtapa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeEtapa.trim() || !selectedPipelineId) {
      toast.error('Preencha o nome da etapa');
      return;
    }

    console.log('[criarEtapa] Criando etapa:', { pipeline_id: selectedPipelineId, nome: nomeEtapa });

    const tipo = probEtapa === 100 ? 'finalizacao' : probEtapa === 0 ? 'descarte' : 'manual';
    const novaOrdem = etapas.length + 1;

    const { data, error } = await supabase.from('crm_etapas').insert({
      pipeline_id: selectedPipelineId,
      nome: nomeEtapa.trim(),
      cor: corEtapa,
      probabilidade: probEtapa,
      sla_horas: slaEtapa || null,
      ordem: novaOrdem,
      tipo: tipo,
      ativo: true
    }).select();

    if (error) {
      console.error('[criarEtapa] Erro:', error);
      toast.error('Erro ao criar etapa: ' + error.message);
    } else {
      console.log('[criarEtapa] Sucesso:', data);
      toast.success('Etapa criada!');
      setNomeEtapa(''); setCorEtapa('#3b82f6'); setProbEtapa(10); setSlaEtapa(24);
      setShowEtapaForm(false);
      fetchEtapas(selectedPipelineId);
    }
  };

  const atualizarEtapa = async (id: string) => {
    if (!editNomeEtapa.trim()) return;
    const tipo = editProbEtapa === 100 ? 'finalizacao' : editProbEtapa === 0 ? 'descarte' : 'manual';
    const { error } = await supabase.from('crm_etapas').update({
      nome: editNomeEtapa.trim(),
      cor: editCorEtapa,
      probabilidade: editProbEtapa,
      sla_horas: editSlaEtapa || null,
      tipo: tipo
    }).eq('id', id);
    if (error) toast.error('Erro ao atualizar: ' + error.message);
    else {
      toast.success('Etapa atualizada!');
      setEditingEtapa(null);
      if (selectedPipelineId) fetchEtapas(selectedPipelineId);
    }
  };

  const excluirEtapa = async (id: string, nome: string) => {
    if (!confirm(`Excluir etapa "${nome}"?`)) return;
    const { error } = await supabase.from('crm_etapas').update({ ativo: false }).eq('id', id);
    if (error) toast.error('Erro ao excluir');
    else {
      toast.success('Etapa excluída!');
      if (selectedPipelineId) fetchEtapas(selectedPipelineId);
    }
  };

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-b-2 border-blue-500"></div></div>;

  return (
    <div className="space-y-6">
      <SectionHeader title="Gestão de Pipelines" subtitle="Configure funis de vendas e etapas" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipelines */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex justify-between items-center p-4 border-b border-slate-800">
            <h3 className="font-medium text-slate-200">Pipelines ({pipelines.length})</h3>
            <button onClick={() => setShowPipelineForm(!showPipelineForm)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
              {showPipelineForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>
          </div>

          {showPipelineForm && (
            <form onSubmit={criarPipeline} className="p-4 border-b border-slate-800 space-y-3">
              <input type="text" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Nome do pipeline" className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm" required />
              <div className="flex gap-2 flex-wrap">{cores.map(c => <button key={c} type="button" onClick={() => setNovaCor(c)} className={`w-8 h-8 rounded ${novaCor === c ? 'ring-2 ring-white' : ''}`} style={{ backgroundColor: c }} />)}</div>
              <button type="submit" className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm">Criar Pipeline</button>
            </form>
          )}

          <div className="divide-y divide-slate-800 max-h-[400px] overflow-y-auto">
            {pipelines.map(p => (
              <div key={p.id} onClick={() => setSelectedPipelineId(p.id)} className={`flex items-center gap-3 p-4 cursor-pointer ${selectedPipelineId === p.id ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}>
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.cor }} />
                
                {editingPipeline === p.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input type="text" value={editNome} onChange={(e) => setEditNome(e.target.value)} className="flex-1 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-sm" autoFocus />
                    <div className="flex gap-1">{cores.map(c => <button key={c} onClick={() => setEditCor(c)} className={`w-5 h-5 rounded ${editCor === c ? 'ring-1 ring-white' : ''}`} style={{ backgroundColor: c }} />)}</div>
                    <button onClick={(e) => { e.stopPropagation(); atualizarPipeline(p.id); }} className="p-1 text-emerald-400"><Check className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setEditingPipeline(null); }} className="p-1 text-slate-400"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-slate-200">{p.nome}</span>
                    <button onClick={(e) => { e.stopPropagation(); setEditingPipeline(p.id); setEditNome(p.nome); setEditCor(p.cor); }} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); excluirPipeline(p.id, p.nome); }} className="p-2 hover:bg-rose-500/20 rounded-lg"><Trash2 className="w-4 h-4 text-rose-400" /></button>
                    <ChevronRight className={`w-5 h-5 text-slate-600 ${selectedPipelineId === p.id ? 'rotate-90 text-blue-400' : ''}`} />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Etapas */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl">
          {selectedPipeline ? (
            <>
              <div className="flex justify-between items-center p-4 border-b border-slate-800">
                <div>
                  <h3 className="font-medium text-slate-200">{selectedPipeline.nome}</h3>
                  <p className="text-sm text-slate-500">{etapas.length} etapas</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => selectedPipelineId && fetchEtapas(selectedPipelineId)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400" title="Atualizar"><RefreshCw className="w-4 h-4" /></button>
                  <button onClick={() => setShowEtapaForm(!showEtapaForm)} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm">
                    {showEtapaForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}Nova Etapa
                  </button>
                </div>
              </div>

              {showEtapaForm && (
                <form onSubmit={criarEtapa} className="p-4 border-b border-slate-800 bg-slate-800/30 space-y-3">
                  <input type="text" value={nomeEtapa} onChange={(e) => setNomeEtapa(e.target.value)} placeholder="Nome da etapa" className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm" required />
                  <div className="grid grid-cols-2 gap-3">
                    <select value={probEtapa} onChange={(e) => setProbEtapa(Number(e.target.value))} className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm">
                      <option value={0}>0% - Perdido</option><option value={10}>10% - Novo</option><option value={30}>30% - Qualificado</option>
                      <option value={50}>50% - Proposta</option><option value={70}>70% - Negociação</option><option value={90}>90% - Quase</option><option value={100}>100% - Fechado</option>
                    </select>
                    <input type="number" value={slaEtapa} onChange={(e) => setSlaEtapa(Number(e.target.value))} placeholder="SLA (horas)" className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm" />
                  </div>
                  <div className="flex gap-2 flex-wrap">{cores.map(c => <button key={c} type="button" onClick={() => setCorEtapa(c)} className={`w-6 h-6 rounded ${corEtapa === c ? 'ring-2 ring-white' : ''}`} style={{ backgroundColor: c }} />)}</div>
                  <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">Criar Etapa</button>
                </form>
              )}

              <div className="divide-y divide-slate-800 max-h-[400px] overflow-y-auto">
                {etapas.length === 0 ? (
                  <div className="p-8 text-center text-slate-500"><p>Nenhuma etapa</p><p className="text-xs mt-1">Clique em "Nova Etapa" para criar</p></div>
                ) : (
                  etapas.map((e, i) => (
                    <div key={e.id} className="flex items-center gap-3 p-4 hover:bg-slate-800/30">
                      {editingEtapa === e.id ? (
                        <div className="flex-1 flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <input type="text" value={editNomeEtapa} onChange={(e) => setEditNomeEtapa(e.target.value)} className="flex-1 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-sm" autoFocus />
                            <button onClick={() => atualizarEtapa(e.id)} className="p-1 text-emerald-400"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingEtapa(null)} className="p-1 text-slate-400"><X className="w-4 h-4" /></button>
                          </div>
                          <div className="flex items-center gap-2">
                            <select value={editProbEtapa} onChange={(e) => setEditProbEtapa(Number(e.target.value))} className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs">
                              <option value={0}>0%</option><option value={10}>10%</option><option value={30}>30%</option>
                              <option value={50}>50%</option><option value={70}>70%</option><option value={90}>90%</option><option value={100}>100%</option>
                            </select>
                            <input type="number" value={editSlaEtapa} onChange={(e) => setEditSlaEtapa(Number(e.target.value))} placeholder="SLA" className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs" />
                            <div className="flex gap-1">{cores.map(c => <button key={c} onClick={() => setEditCorEtapa(c)} className={`w-4 h-4 rounded ${editCorEtapa === c ? 'ring-1 ring-white' : ''}`} style={{ backgroundColor: c }} />)}</div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="w-6 h-6 flex items-center justify-center bg-slate-800 rounded text-slate-400 text-sm">{i + 1}</span>
                          <div className="w-1 h-8 rounded-full" style={{ backgroundColor: e.cor }} />
                          <span className="flex-1 text-slate-200">{e.nome}</span>
                          <span className="text-xs text-slate-500">{e.probabilidade}%</span>
                          {e.sla_horas && <span className="text-xs text-slate-500">SLA: {e.sla_horas}h</span>}
                          <button onClick={() => { setEditingEtapa(e.id); setEditNomeEtapa(e.nome); setEditCorEtapa(e.cor); setEditProbEtapa(e.probabilidade); setEditSlaEtapa(e.sla_horas || 24); }} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => excluirEtapa(e.id, e.nome)} className="p-2 hover:bg-rose-500/20 rounded-lg"><Trash2 className="w-4 h-4 text-rose-400" /></button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500"><p>Selecione um pipeline</p></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CRMPipelines;
