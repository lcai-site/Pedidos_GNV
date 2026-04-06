import React, { useState, useEffect } from 'react';
import { X, Network, Save } from 'lucide-react';
import { useCreateEcommerceAffiliado, useUpdateEcommerceAffiliado, useEcommerceAffiliates } from '../../../lib/hooks/useEcommerceAffiliates';
import type { EcommerceAffiliate } from '../../../lib/hooks/useEcommerceAffiliates';

interface EcommerceAffiliateModalProps {
  isOpen: boolean;
  onClose: () => void;
  affiliateToEdit?: EcommerceAffiliate | null;
}

export const EcommerceAffiliateModal: React.FC<EcommerceAffiliateModalProps> = ({
  isOpen,
  onClose,
  affiliateToEdit,
}) => {
  const { data: allMembers = [] } = useEcommerceAffiliates();
  const gerentesDisponiveis = allMembers.filter(m => m.tipo === 'gerente' && m.id !== affiliateToEdit?.id);

  const { mutateAsync: createAffiliate, isPending: isCreating } = useCreateEcommerceAffiliado();
  const { mutateAsync: updateAffiliate, isPending: isUpdating } = useUpdateEcommerceAffiliado();
  const isPending = isCreating || isUpdating;
  const isEditMode = !!affiliateToEdit;

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    tipo: 'afiliado' as 'gerente' | 'afiliado',
    gerente_id: null as string | null,
    codigo_rastreio: '',
    taxa_comissao: 0,
    status: 'ativo' as 'ativo' | 'inativo' | 'pendente',
  });

  useEffect(() => {
    if (isOpen && affiliateToEdit) {
      setFormData({
        nome: affiliateToEdit.nome || '',
        email: affiliateToEdit.email || '',
        telefone: affiliateToEdit.telefone || '',
        tipo: affiliateToEdit.tipo || 'afiliado',
        gerente_id: affiliateToEdit.gerente_id || null,
        codigo_rastreio: affiliateToEdit.codigo_rastreio || '',
        taxa_comissao: affiliateToEdit.taxa_comissao || 0,
        status: affiliateToEdit.status || 'ativo',
      });
    } else if (isOpen) {
      setFormData({
        nome: '',
        email: '',
        telefone: '',
        tipo: 'afiliado',
        gerente_id: null,
        codigo_rastreio: '',
        taxa_comissao: 0,
        status: 'ativo',
      });
    }
  }, [isOpen, affiliateToEdit]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: Number(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const novoTipo = e.target.value as 'gerente' | 'afiliado';
    setFormData(prev => ({
      ...prev,
      tipo: novoTipo,
      // Resetar gerente_id se mudar pra gerente, pois gerente não costuma ter gerente
      gerente_id: novoTipo === 'gerente' ? null : prev.gerente_id,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        nome: formData.nome,
        email: formData.email || null,
        telefone: formData.telefone || null,
        tipo: formData.tipo,
        gerente_id: formData.tipo === 'afiliado' && formData.gerente_id ? formData.gerente_id : null,
        codigo_rastreio: formData.codigo_rastreio.replace(/\s+/g, '-').toUpperCase(),
        taxa_comissao: formData.taxa_comissao,
        status: formData.status,
      };

      if (isEditMode) {
        await updateAffiliate({ id: affiliateToEdit.id, updates: payload });
      } else {
        await createAffiliate(payload);
      }
      onClose();
    } catch (err) {
      // Toast genérico já lidou lá no hook onSuccess/onError
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEditMode ? 'Editar Membro da Equipe' : 'Novo Membro na Equipe'}
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <form id="affiliateForm" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Nome *</label>
              <input required type="text" name="nome" value={formData.nome} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">E-mail</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Telefone</label>
                <input type="tel" name="telefone" value={formData.telefone} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Tipo de Papel *</label>
                  <select required name="tipo" value={formData.tipo} onChange={handleTipoChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20">
                    <option value="afiliado">Afiliado</option>
                    <option value="gerente">Gerente de Afiliados</option>
                  </select>
                </div>
                {formData.tipo === 'afiliado' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Gerente Superior</label>
                    <select name="gerente_id" value={formData.gerente_id || ''} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20">
                      <option value="">Sem Gerente</option>
                      {gerentesDisponiveis.map(g => (
                        <option key={g.id} value={g.id}>{g.nome}</option>
                      ))}
                    </select>
                  </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Código de Rastreio (Cupom/UTM) *</label>
                  <input required type="text" name="codigo_rastreio" value={formData.codigo_rastreio} onChange={handleChange} placeholder="EX: AFILIADO2026" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 uppercase font-mono" />
              </div>
              <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Comissão (%) *</label>
                  <input required type="number" min="0" max="100" step="0.5" name="taxa_comissao" value={formData.taxa_comissao} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20">
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="pendente">Pendente de Aprovação</option>
              </select>
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/50">
          <button type="button" onClick={onClose} disabled={isPending} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">Cancelar</button>
          <button type="submit" form="affiliateForm" disabled={isPending} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white font-bold rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50">
            {isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditMode ? 'Salvar' : 'Concluir Cadastro'}
          </button>
        </div>
      </div>
    </div>
  );
};
