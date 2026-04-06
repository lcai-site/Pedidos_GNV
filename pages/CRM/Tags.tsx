import React, { useState } from 'react';
import { useTags, useCreateTag, Tag } from '../../lib/hooks/useCRMKanban';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Plus, X, Edit2, Trash2, Tag as TagIcon, Palette, Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

const CORES_PRESET = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#d946ef', '#ec4899', '#f43f5e', '#64748b', '#94a3b8'
];

const CATEGORIAS = [
  { value: 'prioridade', label: 'Prioridade' },
  { value: 'comportamento', label: 'Comportamento' },
  { value: 'origem', label: 'Origem' },
  { value: 'produto', label: 'Produto' },
  { value: 'status', label: 'Status' },
  { value: 'geral', label: 'Geral' }
];

export const CRMTags: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: tags, isLoading } = useTags();
  const createTag = useCreateTag();
  
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    cor: '#3b82f6',
    categoria: 'geral',
    icone: 'tag'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.nome.trim()) newErrors.nome = 'Nome é obrigatório';
    if (formData.nome.length < 2) newErrors.nome = 'Mínimo 2 caracteres';
    
    // Verificar duplicata
    const existe = tags?.find(t => t.nome.toLowerCase() === formData.nome.toLowerCase() && t.id !== editingTag?.id);
    if (existe) newErrors.nome = 'Tag com este nome já existe';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await createTag.mutateAsync({
        nome: formData.nome.trim(),
        cor: formData.cor,
        categoria: formData.categoria,
        icone: formData.icone,
        ativo: true
      });
      
      setFormData({ nome: '', cor: '#3b82f6', categoria: 'geral', icone: 'tag' });
      setShowForm(false);
      toast.success('Tag criada com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar tag');
    }
  };

  const handleDelete = async (tag: Tag) => {
    if (!confirm(`Tem certeza que deseja excluir a tag "${tag.nome}"?`)) return;
    
    try {
      const { error } = await supabase.from('crm_tags').update({ ativo: false }).eq('id', tag.id);
      if (error) throw error;
      toast.success('Tag excluída!');
      queryClient.invalidateQueries({ queryKey: ['crm-tags'] });
    } catch (error: any) {
      toast.error('Erro ao excluir tag');
    }
  };

  const groupedTags = tags?.reduce((acc, tag) => {
    if (!acc[tag.categoria]) acc[tag.categoria] = [];
    acc[tag.categoria].push(tag);
    return acc;
  }, {} as Record<string, Tag[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tags do CRM"
        subtitle="Gerencie etiquetas para categorizar seus leads"
      />

      {/* Botão Nova Tag */}
      <div className="flex justify-between items-center">
        <div className="text-slate-400 text-sm">
          Total: <span className="text-slate-200 font-medium">{tags?.length || 0}</span> tags
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancelar' : 'Nova Tag'}
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Nome *</label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-blue-500 focus:outline-none"
                placeholder="Ex: Cliente VIP"
              />
              {errors.nome && <p className="text-rose-500 text-xs mt-1">{errors.nome}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Categoria</label>
              <select
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-blue-500 focus:outline-none"
              >
                {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Cor</label>
            <div className="flex flex-wrap gap-2">
              {CORES_PRESET.map(cor => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => setFormData({ ...formData, cor })}
                  className={`w-8 h-8 rounded-lg transition-all ${formData.cor === cor ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: cor }}
                />
              ))}
              <input
                type="color"
                value={formData.cor}
                onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                className="w-8 h-8 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
            <span className="text-sm text-slate-500">Preview:</span>
            <span 
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: `${formData.cor}20`, color: formData.cor, border: `1px solid ${formData.cor}40` }}
            >
              {formData.nome || 'Nome da Tag'}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createTag.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-lg transition-colors"
            >
              {createTag.isPending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar Tag
            </button>
          </div>
        </form>
      )}

      {/* Lista de Tags Agrupadas */}
      <div className="space-y-6">
        {CATEGORIAS.map(cat => {
          const catTags = groupedTags?.[cat.value] || [];
          if (catTags.length === 0) return null;
          
          return (
            <div key={cat.value} className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-800">
                <h3 className="font-medium text-slate-200">{cat.label}</h3>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {catTags.map(tag => (
                    <div 
                      key={tag.id}
                      className="group flex items-center gap-2 px-3 py-2 rounded-lg border transition-all hover:shadow-md"
                      style={{ 
                        backgroundColor: `${tag.cor}15`, 
                        borderColor: `${tag.cor}30`,
                      }}
                    >
                      <TagIcon className="w-3.5 h-3.5" style={{ color: tag.cor }} />
                      <span className="text-sm font-medium" style={{ color: tag.cor }}>
                        {tag.nome}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleDelete(tag)}
                          className="p-1 hover:bg-rose-500/20 rounded transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {tags?.length === 0 && (
        <div className="text-center py-12 bg-slate-900/30 border border-slate-800 rounded-xl">
          <TagIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-400">Nenhuma tag criada</h3>
          <p className="text-slate-500 text-sm mt-1">Clique em "Nova Tag" para começar</p>
        </div>
      )}
    </div>
  );
};

export default CRMTags;
