import React, { useState, useEffect } from 'react';
import { X, FolderTree, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { ECOMMERCE_CATEGORIES_KEY } from '../../../lib/hooks/useEcommerceMisc';
import type { EcommerceCategory } from '../../../types/ecommerce';
import { toast } from 'sonner';

interface EcommerceCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryToEdit?: EcommerceCategory | null;
}

export const EcommerceCategoryModal: React.FC<EcommerceCategoryModalProps> = ({
  isOpen,
  onClose,
  categoryToEdit,
}) => {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const isEditMode = !!categoryToEdit;

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    slug: '',
    parent_id: null as string | null,
    posicao: 0,
  });

  useEffect(() => {
    if (isOpen && categoryToEdit) {
      setFormData({
        nome: categoryToEdit.nome || '',
        descricao: categoryToEdit.descricao || '',
        slug: categoryToEdit.slug || '',
        parent_id: categoryToEdit.parent_id || null,
        posicao: categoryToEdit.posicao || 0,
      });
    } else if (isOpen) {
      setFormData({
        nome: '',
        descricao: '',
        slug: '',
        parent_id: null,
        posicao: 0,
      });
    }
  }, [isOpen, categoryToEdit]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      if (isEditMode) {
        const { error } = await supabase
          .from('ecommerce_categorias')
          .update(formData)
          .eq('id', categoryToEdit.id);
        if (error) throw error;
        toast.success('Categoria atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('ecommerce_categorias')
          .insert([formData]);
        if (error) throw error;
        toast.success('Categoria criada com sucesso!');
      }
      queryClient.invalidateQueries({ queryKey: ECOMMERCE_CATEGORIES_KEY });
      onClose();
    } catch (err: any) {
      toast.error('Erro ao salvar categoria: ' + err.message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEditMode ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <p className="text-xs text-slate-400">Insira os dados da categoria</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <form id="categoryForm" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Nome *</label>
              <input required type="text" name="nome" value={formData.nome} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Slug * (URL amigável)</label>
              <input required type="text" name="slug" value={formData.slug} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Posição (ordem)</label>
              <input type="number" name="posicao" value={formData.posicao} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Descrição</label>
              <textarea rows={3} name="descricao" value={formData.descricao} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"></textarea>
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/50">
          <button type="button" onClick={onClose} disabled={isPending} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">Cancelar</button>
          <button type="submit" form="categoryForm" disabled={isPending} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white font-bold rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50">
            {isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditMode ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
};
