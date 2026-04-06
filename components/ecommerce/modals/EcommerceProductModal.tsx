import React, { useState, useEffect } from 'react';
import { X, Package, Save } from 'lucide-react';
import { useCreateEcommerceProduct, useUpdateEcommerceProduct } from '../../../lib/hooks/useEcommerceProducts';
import type { EcommerceProduct } from '../../../types/ecommerce';

interface EcommerceProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: EcommerceProduct | null;
}

export const EcommerceProductModal: React.FC<EcommerceProductModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
}) => {
  const { mutateAsync: createProduct, isPending: isCreating } = useCreateEcommerceProduct();
  const { mutateAsync: updateProduct, isPending: isUpdating } = useUpdateEcommerceProduct();
  
  const isPending = isCreating || isUpdating;
  const isEditMode = !!productToEdit;

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    sku: '',
    preco: 0,
    preco_comparacao: 0,
    estoque: 0,
    status: 'ativo',
    peso_gramas: 0,
    imagem_url: '',
    categoria_id: null as string | null,
  });

  useEffect(() => {
    if (isOpen && productToEdit) {
      setFormData({
        nome: productToEdit.nome || '',
        descricao: productToEdit.descricao || '',
        sku: productToEdit.sku || '',
        preco: productToEdit.preco || 0,
        preco_comparacao: productToEdit.preco_comparacao || 0,
        estoque: productToEdit.estoque || 0,
        status: productToEdit.status || 'ativo',
        peso_gramas: productToEdit.peso_gramas || 0,
        imagem_url: productToEdit.imagem_url || '',
        categoria_id: productToEdit.categoria_id || null,
      });
    } else if (isOpen && !productToEdit) {
      setFormData({
        nome: '',
        descricao: '',
        sku: '',
        preco: 0,
        preco_comparacao: 0,
        estoque: 0,
        status: 'ativo',
        peso_gramas: 0,
        imagem_url: '',
        categoria_id: null,
      });
    }
  }, [isOpen, productToEdit]);

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
    try {
      if (isEditMode) {
        await updateProduct({ id: productToEdit.id, updates: formData });
      } else {
        await createProduct(formData);
      }
      onClose();
    } catch (err) {
      // toast already handled in hook
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#a3e635]/10 text-[#a3e635]">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEditMode ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <p className="text-xs text-slate-400">
                Preencha os dados do produto abaixo.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6">
          <form id="productForm" onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div className="col-span-2 sm:col-span-1 border-r border-slate-800 pr-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nome do Produto *</label>
                    <input required type="text" name="nome" value={formData.nome} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#a3e635]/50 focus:ring-1 focus:ring-[#a3e635]/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">SKU *</label>
                    <input required type="text" name="sku" value={formData.sku} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#a3e635]/50 focus:ring-1 focus:ring-[#a3e635]/20" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Preço (R$) *</label>
                      <input required type="number" step="0.01" min="0" name="preco" value={formData.preco} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#a3e635]/50 focus:ring-1 focus:ring-[#a3e635]/20" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Preço Original</label>
                      <input type="number" step="0.01" min="0" name="preco_comparacao" value={formData.preco_comparacao} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#a3e635]/50 focus:ring-1 focus:ring-[#a3e635]/20" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="col-span-2 sm:col-span-1 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Estoque</label>
                    <input type="number" min="0" name="estoque" value={formData.estoque} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#a3e635]/50 focus:ring-1 focus:ring-[#a3e635]/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Peso (g)</label>
                    <input type="number" min="0" name="peso_gramas" value={formData.peso_gramas} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#a3e635]/50 focus:ring-1 focus:ring-[#a3e635]/20" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
                  <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#a3e635]/50 focus:ring-1 focus:ring-[#a3e635]/20">
                    <option value="ativo">Ativo</option>
                    <option value="rascunho">Rascunho</option>
                    <option value="arquivado">Arquivado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">URL da Imagem</label>
                  <input type="url" name="imagem_url" value={formData.imagem_url} onChange={handleChange} placeholder="https://..." className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#a3e635]/50 focus:ring-1 focus:ring-[#a3e635]/20" />
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Descrição</label>
                <textarea rows={3} name="descricao" value={formData.descricao} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#a3e635]/50 focus:ring-1 focus:ring-[#a3e635]/20"></textarea>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="productForm"
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-[#a3e635] text-lime-950 font-bold rounded-lg hover:bg-[#b4f04a] transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <div className="w-4 h-4 border-2 border-lime-900/30 border-t-lime-950 rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEditMode ? 'Salvar Alterações' : 'Criar Produto'}
          </button>
        </div>
      </div>
    </div>
  );
};
