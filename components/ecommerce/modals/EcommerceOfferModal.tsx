import React, { useState, useEffect } from 'react';
import { X, Tag, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { ECOMMERCE_OFFERS_KEY } from '../../../lib/hooks/useEcommerceMisc';
import type { EcommerceOffer } from '../../../types/ecommerce';
import { toast } from 'sonner';

interface EcommerceOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  offerToEdit?: EcommerceOffer | null;
}

export const EcommerceOfferModal: React.FC<EcommerceOfferModalProps> = ({
  isOpen,
  onClose,
  offerToEdit,
}) => {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const isEditMode = !!offerToEdit;

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tipo_desconto: 'percentual' as 'percentual' | 'valor_fixo' | 'frete_gratis',
    valor_desconto: 0,
    status: 'ativa' as 'ativa' | 'agendada' | 'expirada' | 'rascunho',
    limite_usos: null as number | null,
    data_inicio: null as string | null,
    data_fim: null as string | null,
  });

  useEffect(() => {
    if (isOpen && offerToEdit) {
      setFormData({
        nome: offerToEdit.nome || '',
        descricao: offerToEdit.descricao || '',
        tipo_desconto: (offerToEdit.tipo_desconto as any) || 'percentual',
        valor_desconto: offerToEdit.valor_desconto || 0,
        status: (offerToEdit.status as any) || 'ativa',
        limite_usos: offerToEdit.limite_usos || null,
        data_inicio: offerToEdit.data_inicio ? new Date(offerToEdit.data_inicio).toISOString().slice(0, 16) : null,
        data_fim: offerToEdit.data_fim ? new Date(offerToEdit.data_fim).toISOString().slice(0, 16) : null,
      });
    } else if (isOpen) {
      setFormData({
        nome: '',
        descricao: '',
        tipo_desconto: 'percentual',
        valor_desconto: 0,
        status: 'ativa',
        limite_usos: null,
        data_inicio: null,
        data_fim: null,
      });
    }
  }, [isOpen, offerToEdit]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? null : Number(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    
    // Prepare for submission by transforming dates back if needed
    const payload = {
      ...formData,
      data_inicio: formData.data_inicio ? new Date(formData.data_inicio).toISOString() : null,
      data_fim: formData.data_fim ? new Date(formData.data_fim).toISOString() : null,
    };

    try {
      if (isEditMode) {
        const { error } = await supabase
          .from('ecommerce_ofertas')
          .update(payload)
          .eq('id', offerToEdit.id);
        if (error) throw error;
        toast.success('Oferta atualizada!');
      } else {
        const { error } = await supabase
          .from('ecommerce_ofertas')
          .insert([payload]);
        if (error) throw error;
        toast.success('Oferta criada!');
      }
      queryClient.invalidateQueries({ queryKey: ECOMMERCE_OFFERS_KEY });
      onClose();
    } catch (err: any) {
      toast.error('Erro ao salvar oferta: ' + err.message);
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
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-pink-500/10 text-pink-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEditMode ? 'Editar Oferta' : 'Nova Oferta'}
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <form id="offerForm" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Nome da Oferta *</label>
              <input required type="text" name="nome" value={formData.nome} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tipo de Desconto</label>
                <select name="tipo_desconto" value={formData.tipo_desconto} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20">
                  <option value="percentual">Percentual (%)</option>
                  <option value="valor_fixo">Valor Fixo (R$)</option>
                  <option value="frete_gratis">Frete Grátis</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Valor do Desconto</label>
                <input required={formData.tipo_desconto !== 'frete_gratis'} disabled={formData.tipo_desconto === 'frete_gratis'} type="number" step="0.01" min="0" name="valor_desconto" value={formData.valor_desconto} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 disabled:opacity-50" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Início (Opcional)</label>
                <input type="datetime-local" name="data_inicio" value={formData.data_inicio || ''} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Fim (Opcional)</label>
                <input type="datetime-local" name="data_fim" value={formData.data_fim || ''} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20">
                  <option value="ativa">Ativa</option>
                  <option value="agendada">Agendada</option>
                  <option value="rascunho">Rascunho</option>
                  <option value="expirada">Expirada</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Limite de usos totais</label>
                <input type="number" min="1" name="limite_usos" value={formData.limite_usos || ''} onChange={handleChange} placeholder="Ilimitado" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Descrição interna</label>
              <textarea rows={2} name="descricao" value={formData.descricao} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20"></textarea>
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/50">
          <button type="button" onClick={onClose} disabled={isPending} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">Cancelar</button>
          <button type="submit" form="offerForm" disabled={isPending} className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white font-bold rounded-lg hover:bg-pink-600 transition-colors disabled:opacity-50">
            {isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditMode ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
};
