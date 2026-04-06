import React, { useState } from 'react';
import { X, User, Mail, Phone, CreditCard, Package, AlertTriangle, CheckCircle2, GitMerge, ShoppingBag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { logger } from '../lib/utils/logger';

export interface SimilarOrderPair {
  notificationId: string;
  pedidoPai: {
    id: string;
    codigo_transacao: string;
    nome_cliente: string;
    email: string;
    telefone: string;
    cpf: string;
    descricao_pacote: string;
    data_venda: string;
    valor_total: number;
    divergencias: string[]; // quais campos divergem
  };
  pedidoFilho: {
    id: string;
    codigo_transacao: string;
    nome_cliente: string;
    email: string;
    telefone: string;
    cpf: string;
    descricao_pacote: string;
    data_venda: string;
    valor_total: number;
    divergencias: string[];
  };
}

interface SimilarOrdersModalProps {
  isOpen: boolean;
  pair: SimilarOrderPair | null;
  onClose: () => void;
  onMerged: (notificationId: string) => void;
}

const FieldRow: React.FC<{
  label: string;
  value1: string;
  value2: string;
  isDivergent: boolean;
}> = ({ label, value1, value2, isDivergent }) => (
  <tr className={isDivergent ? 'bg-amber-500/10' : ''}>
    <td className="py-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
      {label}
    </td>
    <td className={`py-2 px-3 text-sm font-mono ${isDivergent ? 'text-amber-300 font-bold' : 'text-slate-200'}`}>
      {value1 || <span className="text-slate-500 italic">—</span>}
    </td>
    <td className="py-2 px-3 text-center">
      {isDivergent
        ? <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />
        : <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
      }
    </td>
    <td className={`py-2 px-3 text-sm font-mono ${isDivergent ? 'text-amber-300 font-bold' : 'text-slate-200'}`}>
      {value2 || <span className="text-slate-500 italic">—</span>}
    </td>
  </tr>
);

export const SimilarOrdersModal: React.FC<SimilarOrdersModalProps> = ({
  isOpen,
  pair,
  onClose,
  onMerged,
}) => {
  const [merging, setMerging] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  if (!isOpen || !pair) return null;

  const { pedidoPai, pedidoFilho, notificationId } = pair;

  const formatDate = (d: string) => {
    if (!d) return '—';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).format(new Date(d));
    } catch {
      return d;
    }
  };

  const formatCurrency = (v: number) =>
    v != null ? `R$ ${Number(v).toFixed(2).replace('.', ',')}` : '—';

  const isDivergent = (field: string) =>
    pedidoPai.divergencias?.includes(field) || pedidoFilho.divergencias?.includes(field);

  const buildMergeDescricao = () => {
    const mainBase = pedidoPai.descricao_pacote || '';
    const absorbedBase = pedidoFilho.descricao_pacote || '';
    const addOB = /order\s*bump/i.test(absorbedBase) && !/order\s*bump/i.test(mainBase);
    const addUP = /upsell/i.test(absorbedBase) && !/upsell/i.test(mainBase);
    let result = mainBase;
    if (addOB) result += ' + Order Bump';
    if (addUP) result += ' + UPSELL';
    return result;
  };

  const handleMerge = async () => {
    setMerging(true);
    const mergeToast = toast.loading('Unificando pedidos...');
    try {
      const novaDescricao = buildMergeDescricao();

      const { data, error } = await supabase.rpc('unificar_pedidos', {
        p_manter_id: pedidoPai.id,
        p_absorver_id: pedidoFilho.id,
        p_nova_descricao: novaDescricao,
      });

      if (error) throw error;
      if (data?.status === 'error') throw new Error(data.message);

      // Anotar "Pedido unificado manualmente" no campo observacao
      await supabase
        .from('pedidos_consolidados_v3')
        .update({
          observacao: 'Pedido unificado manualmente — cliente com e-mails distintos identificado pelo sistema',
          foi_editado: true,
        })
        .eq('id', pedidoPai.id);

      toast.success('Pedidos unificados com sucesso! ✅', { id: mergeToast, duration: 5000 });
      onMerged(notificationId);
      onClose();
    } catch (err: any) {
      logger.error('Erro ao unificar pedidos', err, {
        module: 'SimilarOrdersModal',
        pedidoPaiId: pedidoPai.id,
        pedidoFilhoId: pedidoFilho.id
      });
      toast.error(`Erro ao unificar: ${err.message}`, { id: mergeToast, duration: 6000 });
    } finally {
      setMerging(false);
    }
  };

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      onMerged(notificationId); // remove notification
      onClose();
    } finally {
      setDismissing(false);
    }
  };

  const allDivergencias = Array.from(
    new Set([...(pedidoPai.divergencias || []), ...(pedidoFilho.divergencias || [])])
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl bg-slate-900 border border-amber-500/40 rounded-xl shadow-2xl shadow-amber-900/30 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-900/50 to-orange-900/30 border-b border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30">
              <GitMerge className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Possível Pedido Duplicado Detectado</h3>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Mesmo cliente, dados divergentes em:{' '}
                <span className="font-semibold text-amber-300">
                  {allDivergencias.join(', ')}
                </span>
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

        {/* Alert Banner */}
        <div className="mx-6 mt-5 flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200/90">
            <span className="font-bold text-amber-300">Atenção:</span> O sistema identificou dois pedidos que provavelmente pertencem ao mesmo cliente,
            pois possuem <strong>CPF e nome idênticos</strong> mas dados divergentes (ex: e-mail diferente utilizado no pós-venda).
            Verifique se deseja unificá-los.
          </div>
        </div>

        {/* Order Cards (side by side) */}
        <div className="grid grid-cols-2 gap-4 px-6 mt-5">
          {/* Pedido Pai */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingBag className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Pedido Principal</span>
            </div>
            <p className="text-sm font-bold text-white truncate">{pedidoPai.descricao_pacote}</p>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{pedidoPai.codigo_transacao}</p>
            <p className="text-xs text-slate-500 mt-1">{formatDate(pedidoPai.data_venda)}</p>
            <p className="text-sm font-bold text-emerald-400 mt-2">{formatCurrency(pedidoPai.valor_total)}</p>
          </div>

          {/* Pedido Filho */}
          <div className="bg-slate-800/60 border border-amber-600/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Pedido a Unificar</span>
            </div>
            <p className="text-sm font-bold text-white truncate">{pedidoFilho.descricao_pacote}</p>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{pedidoFilho.codigo_transacao}</p>
            <p className="text-xs text-slate-500 mt-1">{formatDate(pedidoFilho.data_venda)}</p>
            <p className="text-sm font-bold text-emerald-400 mt-2">{formatCurrency(pedidoFilho.valor_total)}</p>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="mx-6 mt-5 overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-800/80">
                <th className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Campo</th>
                <th className="py-2 px-3 text-xs font-semibold text-blue-400 uppercase tracking-wider">Principal</th>
                <th className="py-2 px-3 text-center w-10"></th>
                <th className="py-2 px-3 text-xs font-semibold text-amber-400 uppercase tracking-wider">A Unificar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <FieldRow
                label="Nome"
                value1={pedidoPai.nome_cliente}
                value2={pedidoFilho.nome_cliente}
                isDivergent={isDivergent('Nome')}
              />
              <FieldRow
                label="E-mail"
                value1={pedidoPai.email}
                value2={pedidoFilho.email}
                isDivergent={isDivergent('E-mail')}
              />
              <FieldRow
                label="CPF"
                value1={pedidoPai.cpf}
                value2={pedidoFilho.cpf}
                isDivergent={isDivergent('CPF')}
              />
              <FieldRow
                label="Telefone"
                value1={pedidoPai.telefone}
                value2={pedidoFilho.telefone}
                isDivergent={isDivergent('Telefone')}
              />
            </tbody>
          </table>
        </div>

        {/* Info about what will happen */}
        <div className="mx-6 mt-4 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-200/80">
          <strong className="text-blue-300">Ao unificar:</strong> o pedido a unificar será absorvido pelo pedido principal,
          seguindo as regras de consolidação. O pedido resultante será marcado como{' '}
          <code className="bg-blue-900/40 px-1 rounded text-blue-300">"Pedido unificado manualmente"</code> nas observações.
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-700/60 mt-4 bg-slate-900/50">
          <button
            onClick={handleDismiss}
            disabled={dismissing || merging}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-lg transition-colors disabled:opacity-50"
          >
            Não são o mesmo cliente
          </button>
          <button
            onClick={handleMerge}
            disabled={merging || dismissing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-black bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors disabled:opacity-60 shadow-lg shadow-amber-900/30"
          >
            {merging ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Unificando...
              </>
            ) : (
              <>
                <GitMerge className="w-4 h-4" />
                Sim, unificar pedidos
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
