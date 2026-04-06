import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, AlertTriangle, Package, User, Mail, Phone, MapPin, Calendar, CheckCircle, XCircle } from 'lucide-react';

interface PedidoSimilar {
  pedido_id: string;
  codigo_transacao: string;
  nome_cliente: string;
  cpf_cliente: string;
  email_cliente: string;
  data_venda: string;
  endereco_completo: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  produto_principal: string;
  descricao_pacote: string;
}

interface ModalUnificarEnderecoProps {
  isOpen: boolean;
  onClose: () => void;
  pedidoId: string;
  onUnify: () => void;
}

export const ModalUnificarEndereco: React.FC<ModalUnificarEnderecoProps> = ({
  isOpen,
  onClose,
  pedidoId,
  onUnify
}) => {
  const [loading, setLoading] = useState(false);
  const [unifying, setUnifying] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoSimilar[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && pedidoId) {
      loadPedidos();
    }
  }, [isOpen, pedidoId]);

  const loadPedidos = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc('encontrar_pedidos_mesmo_endereco', {
        p_pedido_id: pedidoId
      });

      if (error) throw error;
      setPedidos(data || []);
      if (data && data.length > 0) {
        setSelected(data[0].pedido_id);
      }
    } catch (err: any) {
      console.error('Erro ao carregar pedidos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnify = async () => {
    if (!selected) return;

    setUnifying(true);
    try {
      const { data, error } = await supabase.rpc('unificar_pedidos_mesmo_endereco', {
        p_pedido_principal: pedidoId,
        p_pedido_secundario: selected
      });

      if (error) throw error;
      if (data?.status === 'error') throw new Error(data.message);

      onUnify();
    } catch (err: any) {
      console.error('Erro ao unificar:', err);
      alert(`Erro ao unificar pedidos: ${err.message}`);
    } finally {
      setUnifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-[#1e293b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Verificar: Endereço ou CPF</h2>
              <p className="text-xs text-slate-400">Pedidos com mesmo endereço ou mesmo CPF mas dados diferentes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-400 font-medium">{error}</p>
            </div>
          ) : pedidos.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <p className="text-slate-400">Nenhum outro pedido encontrado com mesmo endereço.</p>
            </div>
          ) : (
            <>
              <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-amber-400 text-sm font-medium">
                  📋 Foram encontrados <strong>{pedidos.length}</strong> pedido(s) com possível inconsistência:
                </p>
                <ul className="text-slate-300 text-xs mt-2 space-y-1 ml-4 list-disc">
                  <li>Mesmo endereço + clientes diferentes, OU</li>
                  <li>Mesmo CPF + endereços diferentes</li>
                </ul>
                <p className="text-slate-400 text-xs mt-3">
                  Selecione o pedido que deseja unificar e os dados do pedido principal serão mantidos.
                </p>
              </div>

              <div className="space-y-3">
                {pedidos.map((pedido) => (
                  <div
                    key={pedido.pedido_id}
                    onClick={() => setSelected(pedido.pedido_id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${selected === pedido.pedido_id
                      ? 'bg-amber-500/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Header do Pedido */}
                        <div className="flex items-center gap-2 mb-3">
                          <Package className="w-4 h-4 text-slate-400" />
                          <span className="font-mono text-xs text-slate-400">{pedido.codigo_transacao}</span>
                          <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${selected === pedido.pedido_id
                            ? 'bg-amber-500/30 text-amber-400'
                            : 'bg-slate-700 text-slate-400'
                            }`}>
                            {pedido.produto_principal || 'N/A'}
                          </span>
                        </div>

                        {/* Dados do Cliente */}
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <User className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Cliente</span>
                            </div>
                            <p className="text-sm font-bold text-white">{pedido.nome_cliente}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Mail className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">E-mail</span>
                            </div>
                            <p className="text-xs text-slate-300 truncate">{pedido.email_cliente}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">CPF</span>
                            </div>
                            <p className="text-xs text-emerald-400 font-mono">{pedido.cpf_cliente}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Data</span>
                            </div>
                            <p className="text-xs text-slate-300">
                              {new Date(pedido.data_venda).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>

                        {/* Endereço */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Endereço</span>
                          </div>
                          <p className="text-xs text-slate-300">{pedido.endereco_completo}</p>
                        </div>
                      </div>

                      {/* Radio Button Customizado */}
                      <div className="ml-4">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selected === pedido.pedido_id
                          ? 'border-amber-500 bg-amber-500'
                          : 'border-slate-600'
                          }`}>
                          {selected === pedido.pedido_id && (
                            <CheckCircle className="w-4 h-4 text-white" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {pedidos.length > 0 && !error && (
          <div className="px-6 py-4 border-t border-slate-700 bg-[#1e293b] flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Os dados do pedido principal serão mantidos</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUnify}
                disabled={unifying || !selected}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2"
              >
                {unifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Unificando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Sim, Unificar
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
