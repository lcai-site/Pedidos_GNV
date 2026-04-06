import React, { useState } from 'react';
import { X, Truck, Clock, DollarSign, Package, Check } from 'lucide-react';
import { CotacaoFrete, formatarMoeda } from '../../lib/hooks/useFrete';

interface SelecaoFreteModalProps {
  isOpen: boolean;
  pedidoId: string;
  nomeCliente: string;
  cep: string;
  cotacoes: CotacaoFrete[];
  onClose: () => void;
  onConfirm: (tipoEnvio: string, valor: number) => void;
  isLoading?: boolean;
}

const getIconByTipo = (tipo: string) => {
  switch (tipo) {
    case 'MINI_ENVIOS':
      return <Package className="w-6 h-6 text-purple-400" />;
    case 'PAC':
      return <Truck className="w-6 h-6 text-blue-400" />;
    case 'SEDEX':
      return <Truck className="w-6 h-6 text-amber-400" />;
    default:
      return <Truck className="w-6 h-6 text-slate-400" />;
  }
};

const getColorByTipo = (tipo: string) => {
  switch (tipo) {
    case 'MINI_ENVIOS':
      return 'border-purple-500/30 bg-purple-500/10 text-purple-400';
    case 'PAC':
      return 'border-blue-500/30 bg-blue-500/10 text-blue-400';
    case 'SEDEX':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
    default:
      return 'border-slate-500/30 bg-slate-500/10 text-slate-400';
  }
};

export const SelecaoFreteModal: React.FC<SelecaoFreteModalProps> = ({
  isOpen,
  pedidoId,
  nomeCliente,
  cep,
  cotacoes,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  const [tipoSelecionado, setTipoSelecionado] = useState<string | null>(null);

  if (!isOpen) return null;

  const cotacaoSelecionada = cotacoes.find(c => c.tipo === tipoSelecionado);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-slate-200">
              Selecionar Modalidade de Envio
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {nomeCliente} • CEP: {cep}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-400">
            Escolha a modalidade de envio para este pedido:
          </p>

          <div className="grid gap-3">
            {cotacoes
              .filter(c => c.disponivel)
              .sort((a, b) => a.valor - b.valor)
              .map((cotacao) => (
                <button
                  key={cotacao.tipo}
                  onClick={() => setTipoSelecionado(cotacao.tipo)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                    tipoSelecionado === cotacao.tipo
                      ? getColorByTipo(cotacao.tipo)
                      : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    tipoSelecionado === cotacao.tipo ? 'bg-white/10' : 'bg-slate-900'
                  }`}>
                    {getIconByTipo(cotacao.tipo)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${
                        tipoSelecionado === cotacao.tipo ? 'text-current' : 'text-slate-300'
                      }`}>
                        {cotacao.nome}
                      </span>
                      {tipoSelecionado === cotacao.tipo && (
                        <Check className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1 text-sm">
                        <Clock className="w-3 h-3" />
                        {cotacao.prazo} dias úteis
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-xl font-bold ${
                      tipoSelecionado === cotacao.tipo ? 'text-current' : 'text-emerald-400'
                    }`}>
                      {formatarMoeda(cotacao.valor)}
                    </span>
                  </div>
                </button>
              ))}
          </div>

          {cotacoes.filter(c => c.disponivel).length === 0 && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
              <p className="text-red-400">
                Nenhuma modalidade disponível para este CEP.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 flex justify-between items-center">
          <div className="text-sm text-slate-500">
            {cotacaoSelecionada && (
              <span>
                Total: <span className="text-emerald-400 font-bold">{formatarMoeda(cotacaoSelecionada.valor)}</span>
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (cotacaoSelecionada) {
                  onConfirm(cotacaoSelecionada.tipo, cotacaoSelecionada.valor);
                }
              }}
              disabled={!tipoSelecionado || isLoading}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-b-2 border-white" />
                  Gerando...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  Gerar Etiqueta
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelecaoFreteModal;
