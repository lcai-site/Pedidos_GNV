import React from 'react';
import { X, AlertTriangle, Package } from 'lucide-react';

interface ConfirmResetEtiquetaModalProps {
  isOpen: boolean;
  pedidoId: string;
  codigoRastreio: string;
  nomeCliente: string;
  onClose: () => void;
  onConfirm: (pedidoId: string) => void;
  isLoading?: boolean;
}

export const ConfirmResetEtiquetaModal: React.FC<ConfirmResetEtiquetaModalProps> = ({
  isOpen,
  pedidoId,
  codigoRastreio,
  nomeCliente,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-red-500/30 rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-200">
              Cancelar Etiqueta
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Essa ação não pode ser desfeita
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warning Message */}
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-sm text-red-400">
              <strong>Atenção:</strong> Essa ação cancelará a etiqueta atual e
              <strong> invalidará</strong> o código de rastreio. O código não poderá ser usado novamente.
            </p>
          </div>

          {/* Pedido Info */}
          <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-sm text-slate-400">Cliente</p>
                <p className="text-sm font-medium text-slate-200">{nomeCliente}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 flex items-center justify-center">
                <span className="text-slate-400 text-xs">#</span>
              </div>
              <div>
                <p className="text-sm text-slate-400">Código de Rastreio</p>
                <p className="text-sm font-mono font-medium text-emerald-400">{codigoRastreio}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-2 text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(pedidoId)}
            disabled={isLoading}
            className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin h-4 w-4 border-b-2 border-white" />
                Processando...
              </>
            ) : (
              'Confirmar Remoção'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmResetEtiquetaModal;
