import React, { useState, useEffect } from 'react';
import { X, Ticket, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { EcommerceCoupon } from '../../../types/ecommerce';

interface EcommerceCouponModalProps {
  isOpen: boolean;
  onClose: () => void;
  couponToEdit?: EcommerceCoupon | null;
}

export const EcommerceCouponModal: React.FC<EcommerceCouponModalProps> = ({
  isOpen,
  onClose,
  couponToEdit,
}) => {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const isEditMode = !!couponToEdit;

  const [formData, setFormData] = useState({
    codigo: '',
    tipo: 'percentual' as 'percentual' | 'valor_fixo' | 'frete_gratis',
    valor: 0,
    limite_uso: null as number | null,
    valor_minimo_pedido: null as number | null,
    validade: null as string | null,
    ativo: true,
  });

  useEffect(() => {
    if (isOpen && couponToEdit) {
      setFormData({
        codigo: couponToEdit.codigo || '',
        tipo: (couponToEdit.tipo as any) || 'percentual',
        valor: couponToEdit.valor || 0,
        limite_uso: couponToEdit.limite_uso || null,
        valor_minimo_pedido: couponToEdit.valor_minimo_pedido || null,
        validade: couponToEdit.validade ? new Date(couponToEdit.validade).toISOString().slice(0, 16) : null,
        ativo: !!couponToEdit.ativo,
      });
    } else if (isOpen) {
      setFormData({
        codigo: '',
        tipo: 'percentual',
        valor: 0,
        limite_uso: null,
        valor_minimo_pedido: null,
        validade: null,
        ativo: true,
      });
    }
  }, [isOpen, couponToEdit]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? null : Number(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);

    const payload = {
      ...formData,
      codigo: formData.codigo.toUpperCase(),
      validade: formData.validade ? new Date(formData.validade).toISOString() : null,
    };

    try {
      if (isEditMode) {
        const { error } = await supabase.from('ecommerce_cupons').update(payload).eq('id', couponToEdit.id);
        if (error) throw error;
        toast.success('Cupom atualizado!');
      } else {
        const { error } = await supabase.from('ecommerce_cupons').insert([payload]);
        if (error) throw error;
        toast.success('Cupom criado!');
      }
      queryClient.invalidateQueries({ queryKey: ['ecommerce-cupons'] });
      onClose();
    } catch (err: any) {
      toast.error('Erro ao salvar cupom: ' + err.message);
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
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-500/10 text-orange-400">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEditMode ? 'Editar Cupom' : 'Novo Cupom'}
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <form id="couponForm" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Código do Cupom *</label>
              <input required type="text" name="codigo" value={formData.codigo} onChange={handleChange} placeholder="EX: VERAO20" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 uppercase focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Tipo de Desconto</label>
                  <select name="tipo" value={formData.tipo} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20">
                    <option value="percentual">Percentual (%)</option>
                    <option value="valor_fixo">Valor Fixo (R$)</option>
                    <option value="frete_gratis">Frete Grátis</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Valor</label>
                  <input required={formData.tipo !== 'frete_gratis'} disabled={formData.tipo === 'frete_gratis'} type="number" step="0.01" min="0" name="valor" value={formData.valor} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 disabled:opacity-50" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Limite de Uso</label>
                  <input type="number" min="1" name="limite_uso" value={formData.limite_uso || ''} onChange={handleChange} placeholder="Ilimitado" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20" />
               </div>
               <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Valor Mínimo do Pedido</label>
                  <input type="number" step="0.01" min="0" name="valor_minimo_pedido" value={formData.valor_minimo_pedido || ''} onChange={handleChange} placeholder="Nenhum" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20" />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Validade</label>
                  <input type="datetime-local" name="validade" value={formData.validade || ''} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20" />
               </div>
               <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="ativo" checked={formData.ativo} onChange={handleChange} className="rounded border-slate-700 bg-slate-950 text-orange-500 focus:ring-orange-500/20 w-4 h-4" />
                    <span className="text-sm font-medium text-slate-200">Cupom Ativo</span>
                  </label>
               </div>
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/50">
          <button type="button" onClick={onClose} disabled={isPending} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">Cancelar</button>
          <button type="submit" form="couponForm" disabled={isPending} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50">
            {isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditMode ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
};
