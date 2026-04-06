import React, { useState, useEffect } from 'react';
import { X, Layers, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { ECOMMERCE_COLLECTIONS_KEY } from '../../../lib/hooks/useEcommerceMisc';
import type { EcommerceCollection } from '../../../types/ecommerce';
import { toast } from 'sonner';

interface EcommerceCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionToEdit?: EcommerceCollection | null;
}

export const EcommerceCollectionModal: React.FC<EcommerceCollectionModalProps> = ({
  isOpen,
  onClose,
  collectionToEdit,
}) => {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const isEditMode = !!collectionToEdit;

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tipo: 'manual' as 'manual' | 'automatica',
    imagem_url: '',
    publicada: false,
  });

  useEffect(() => {
    if (isOpen && collectionToEdit) {
      setFormData({
        nome: collectionToEdit.nome || '',
        descricao: collectionToEdit.descricao || '',
        tipo: (collectionToEdit.tipo as any) || 'manual',
        imagem_url: collectionToEdit.imagem_url || '',
        publicada: !!collectionToEdit.publicada,
      });
    } else if (isOpen) {
      setFormData({
        nome: '',
        descricao: '',
        tipo: 'manual',
        imagem_url: '',
        publicada: false,
      });
    }
  }, [isOpen, collectionToEdit]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      if (isEditMode) {
        const { error } = await supabase
          .from('ecommerce_colecoes')
          .update(formData)
          .eq('id', collectionToEdit.id);
        if (error) throw error;
        toast.success('Coleção atualizada!');
      } else {
        const { error } = await supabase
          .from('ecommerce_colecoes')
          .insert([formData]);
        if (error) throw error;
        toast.success('Coleção criada!');
      }
      queryClient.invalidateQueries({ queryKey: ECOMMERCE_COLLECTIONS_KEY });
      onClose();
    } catch (err: any) {
      toast.error('Erro ao salvar coleção: ' + err.message);
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
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-500/10 text-teal-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEditMode ? 'Editar Coleção' : 'Nova Coleção'}
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <form id="collectionForm" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Nome *</label>
              <input required type="text" name="nome" value={formData.nome} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tipo</label>
                <select name="tipo" value={formData.tipo} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20">
                  <option value="manual">Manual</option>
                  <option value="automatica">Automática</option>
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="publicada" checked={formData.publicada} onChange={handleChange} className="rounded border-slate-700 bg-slate-950 text-teal-500 focus:ring-teal-500/20 w-4 h-4" />
                  <span className="text-sm font-medium text-slate-200">Publicada na loja</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Imagem URL</label>
              <input type="url" name="imagem_url" value={formData.imagem_url} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Descrição</label>
              <textarea rows={3} name="descricao" value={formData.descricao} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20"></textarea>
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/50">
          <button type="button" onClick={onClose} disabled={isPending} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">Cancelar</button>
          <button type="submit" form="collectionForm" disabled={isPending} className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50">
            {isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditMode ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
};
