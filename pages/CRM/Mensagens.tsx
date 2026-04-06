import React, { useState, useMemo } from 'react';
import {
  useWhatsAppTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useToggleTemplate,
  CATEGORIAS_TEMPLATE,
  VARIAVEIS_DISPONIVEIS,
  GATILHOS_AUTOMATICOS,
  renderTemplate,
  WhatsAppTemplate,
} from '../../lib/hooks/useWhatsAppTemplates';
import { SectionHeader } from '../../components/ui/SectionHeader';
import {
  MessageSquare, Plus, X, Save, Edit2, Trash2, Power, Eye, EyeOff,
  Copy, Search, Filter, Zap, ChevronDown, Info, Smartphone
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// PREVIEW DE MENSAGEM (WhatsApp-like)
// ============================================
const WhatsAppPreview: React.FC<{ conteudo: string }> = ({ conteudo }) => {
  // Dados de exemplo para preview
  const dadosExemplo: Record<string, string> = {
    nome: 'João Silva',
    primeiro_nome: 'João',
    pedido_id: '#12345',
    produto: 'Kit Detox Premium',
    rastreio: 'BR123456789BR',
    status_entrega: 'Em trânsito',
    link_rastreio: 'https://rastreio.com/BR123',
    valor: 'R$ 197,00',
    data_compra: '25/03/2026',
    data_previsao: '02/04/2026',
    transportadora: 'Correios',
    cupom: 'VOLTA10',
  };

  const previewText = renderTemplate(conteudo, dadosExemplo);

  return (
    <div className="bg-[#0b141a] rounded-xl p-4 max-w-sm">
      {/* Header do "chat" */}
      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-800">
        <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
          <Smartphone className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-200">João Silva</p>
          <p className="text-[10px] text-slate-500">+55 11 99999-9999</p>
        </div>
      </div>

      {/* Balão de mensagem */}
      <div className="bg-[#005c4b] rounded-lg rounded-tr-none p-3 ml-6 relative">
        <p className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
          {previewText || 'Digite algo para ver o preview...'}
        </p>
        <span className="text-[10px] text-slate-300/60 float-right mt-1">19:45 ✓✓</span>
      </div>
    </div>
  );
};

// ============================================
// COMPONENTE DE VARIÁVEIS CLICÁVEIS
// ============================================
const VariaveisPicker: React.FC<{
  onInsert: (variavel: string) => void;
}> = ({ onInsert }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-800/30 rounded-lg border border-slate-700/50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" />
          Variáveis disponíveis
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-1.5">
          {VARIAVEIS_DISPONIVEIS.map(v => (
            <button
              key={v.chave}
              type="button"
              onClick={() => onInsert(v.chave)}
              className="flex flex-col items-start px-2 py-1.5 bg-slate-900 hover:bg-slate-800 rounded text-left transition-colors group"
            >
              <code className="text-[11px] text-emerald-400 group-hover:text-emerald-300 font-mono">
                {v.chave}
              </code>
              <span className="text-[10px] text-slate-500">{v.descricao}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// PÁGINA PRINCIPAL
// ============================================
export const CRMMensagens: React.FC = () => {
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    categoria: 'geral',
    conteudo: '',
    gatilho_automatico: '',
  });

  // Hooks
  const { data: templates, isLoading } = useWhatsAppTemplates(categoriaAtiva || undefined);
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const toggleTemplate = useToggleTemplate();

  // Filtro local por busca
  const templatesFiltrados = useMemo(() => {
    if (!searchTerm) return templates;
    const term = searchTerm.toLowerCase();
    return templates?.filter(t =>
      t.nome.toLowerCase().includes(term) ||
      t.conteudo.toLowerCase().includes(term)
    );
  }, [templates, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const all = templates || [];
    return {
      total: all.length,
      ativos: all.filter(t => t.ativo).length,
      comGatilho: all.filter(t => t.gatilho_automatico).length,
    };
  }, [templates]);

  const handleOpenModal = (template?: WhatsAppTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        nome: template.nome,
        categoria: template.categoria,
        conteudo: template.conteudo,
        gatilho_automatico: template.gatilho_automatico || '',
      });
    } else {
      setEditingTemplate(null);
      setFormData({ nome: '', categoria: 'geral', conteudo: '', gatilho_automatico: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast.error('Nome do template é obrigatório');
      return;
    }
    if (!formData.conteudo.trim()) {
      toast.error('Conteúdo da mensagem é obrigatório');
      return;
    }

    try {
      const payload = {
        nome: formData.nome.trim(),
        categoria: formData.categoria,
        conteudo: formData.conteudo.trim(),
        gatilho_automatico: formData.gatilho_automatico || null,
      };

      if (editingTemplate) {
        await updateTemplate.mutateAsync({ id: editingTemplate.id, ...payload });
      } else {
        await createTemplate.mutateAsync(payload);
      }

      setShowModal(false);
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const handleDelete = async (template: WhatsAppTemplate) => {
    if (!confirm(`Excluir template "${template.nome}"?`)) return;
    try {
      await deleteTemplate.mutateAsync(template.id);
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const handleToggle = async (template: WhatsAppTemplate) => {
    await toggleTemplate.mutateAsync({ id: template.id, ativo: !template.ativo });
    toast.success(template.ativo ? 'Template desativado' : 'Template ativado');
  };

  const handleCopy = (conteudo: string) => {
    navigator.clipboard.writeText(conteudo);
    toast.success('Conteúdo copiado!');
  };

  const insertVariavel = (variavel: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setFormData(prev => ({ ...prev, conteudo: prev.conteudo + variavel }));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.conteudo;
    const newText = text.substring(0, start) + variavel + text.substring(end);

    setFormData(prev => ({ ...prev, conteudo: newText }));

    // Reposicionar cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variavel.length, start + variavel.length);
    }, 0);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Templates de Mensagens"
        subtitle="Crie e gerencie modelos de mensagens para WhatsApp"
        icon={MessageSquare}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-slate-200">{stats.total}</div>
          <div className="text-sm text-slate-500">Total Templates</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-emerald-400">{stats.ativos}</div>
          <div className="text-sm text-slate-500">Ativos</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-amber-400">{stats.comGatilho}</div>
          <div className="text-sm text-slate-500">Com Gatilho Automático</div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl p-4 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Template
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
        {/* Categorias */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategoriaAtiva('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !categoriaAtiva ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos
          </button>
          {CATEGORIAS_TEMPLATE.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategoriaAtiva(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                categoriaAtiva === cat.value ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200"
          />
        </div>
      </div>

      {/* Lista de Templates */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Carregando...</div>
      ) : templatesFiltrados?.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/30 border border-slate-800 rounded-xl">
          <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-400">Nenhum template encontrado</h3>
          <p className="text-slate-500 text-sm mt-1">Clique em "Novo Template" para criar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {templatesFiltrados?.map(template => {
            const categoria = CATEGORIAS_TEMPLATE.find(c => c.value === template.categoria);
            const gatilho = GATILHOS_AUTOMATICOS.find(g => g.value === template.gatilho_automatico);

            return (
              <div
                key={template.id}
                className={`bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden transition-all hover:border-slate-700 ${
                  !template.ativo ? 'opacity-50' : ''
                }`}
              >
                {/* Header */}
                <div className="p-4 border-b border-slate-800/50 flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-200 truncate">{template.nome}</h4>
                      {!template.ativo && (
                        <span className="px-1.5 py-0.5 bg-slate-700 text-slate-400 text-[10px] rounded">Inativo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-xs rounded">
                        {categoria?.label || template.categoria}
                      </span>
                      {gatilho && gatilho.value && (
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-xs rounded flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {gatilho.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-3">
                    <button
                      onClick={() => handleToggle(template)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        template.ativo ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 bg-slate-800'
                      }`}
                      title={template.ativo ? 'Desativar' : 'Ativar'}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleCopy(template.conteudo)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Copiar"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenModal(template)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(template)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Conteúdo */}
                <div className="p-4">
                  <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-32 overflow-auto custom-scrollbar">
                    {template.conteudo}
                  </pre>
                </div>

                {/* Variáveis usadas */}
                {template.variaveis && template.variaveis.length > 0 && (
                  <div className="px-4 pb-3 flex flex-wrap gap-1">
                    {template.variaveis.map(v => (
                      <code key={v} className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">
                        {`{{${v}}}`}
                      </code>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL: CRIAR / EDITAR TEMPLATE */}
      {/* ============================================ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-[5vh] overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-200">
                  {editingTemplate ? 'Editar Template' : 'Novo Template de Mensagem'}
                </h3>
                <p className="text-sm text-slate-500">
                  Configure a mensagem com variáveis dinâmicas
                </p>
              </div>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-200" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Coluna esquerda — Formulário */}
                <div className="space-y-4">
                  {/* Nome */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Nome do Template *
                    </label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: Pedido Postado"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                      required
                    />
                  </div>

                  {/* Categoria + Gatilho */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">
                        Categoria
                      </label>
                      <select
                        value={formData.categoria}
                        onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm"
                      >
                        {CATEGORIAS_TEMPLATE.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">
                        Gatilho Automático
                      </label>
                      <select
                        value={formData.gatilho_automatico}
                        onChange={(e) => setFormData({ ...formData, gatilho_automatico: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm"
                      >
                        {GATILHOS_AUTOMATICOS.map(g => (
                          <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Info sobre gatilho */}
                  {formData.gatilho_automatico && (
                    <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                      <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-300/80">
                        Este template será enviado automaticamente quando o evento
                        <strong className="text-amber-300"> "{GATILHOS_AUTOMATICOS.find(g => g.value === formData.gatilho_automatico)?.label}"</strong> ocorrer.
                        Requer integração Z-API ativa (Sugestão 6).
                      </p>
                    </div>
                  )}

                  {/* Variáveis clicáveis */}
                  <VariaveisPicker onInsert={insertVariavel} />

                  {/* Conteúdo */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Conteúdo da Mensagem *
                    </label>
                    <textarea
                      ref={textareaRef}
                      value={formData.conteudo}
                      onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                      placeholder="Digite sua mensagem aqui... Use {{variavel}} para campos dinâmicos"
                      rows={10}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-200 font-mono text-sm resize-y focus:border-emerald-500 focus:outline-none"
                      required
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      {formData.conteudo.length} caracteres • Clique nas variáveis acima para inserir
                    </p>
                  </div>
                </div>

                {/* Coluna direita — Preview */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-400">
                      Preview da Mensagem
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPreview(!showPreview)}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
                    >
                      {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showPreview ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>

                  {showPreview && (
                    <WhatsAppPreview conteudo={formData.conteudo} />
                  )}

                  {/* Dicas */}
                  <div className="p-4 bg-slate-800/30 rounded-lg space-y-2">
                    <h5 className="text-sm font-medium text-slate-300">💡 Dicas</h5>
                    <ul className="text-xs text-slate-500 space-y-1">
                      <li>• Use *texto* para <strong>negrito</strong> no WhatsApp</li>
                      <li>• Use _texto_ para <em>itálico</em></li>
                      <li>• Emojis tornam a mensagem mais humanizada 🎉</li>
                      <li>• Mensagens curtas têm melhor taxa de leitura</li>
                      <li>• Evite links encurtados (risco de ban)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-slate-400 hover:text-slate-200 transition-colors rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createTemplate.isPending || updateTemplate.isPending}
                  className="flex-1 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {(createTemplate.isPending || updateTemplate.isPending) ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingTemplate ? 'Salvar Alterações' : 'Criar Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMMensagens;
