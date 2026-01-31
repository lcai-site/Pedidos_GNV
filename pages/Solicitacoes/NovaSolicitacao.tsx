import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { solicitacoesService } from '../../lib/services/solicitacoesService';
import type { TipoSolicitacao, CriarSolicitacaoInput, DadosSolicitacao } from '../../lib/types/solicitacoes';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

export const NovaSolicitacaoPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Dados básicos
    const [pedidoId, setPedidoId] = useState('');
    const [clienteNome, setClienteNome] = useState('');
    const [clienteEmail, setClienteEmail] = useState('');
    const [clienteTelefone, setClienteTelefone] = useState('');
    const [tipo, setTipo] = useState<TipoSolicitacao>('reembolso');
    const [observacoes, setObservacoes] = useState('');

    // Dados específicos de reembolso
    const [motivoReembolso, setMotivoReembolso] = useState('');
    const [valorSolicitado, setValorSolicitado] = useState('');
    const [formaDevolucao, setFormaDevolucao] = useState<'pix' | 'credito' | 'estorno_cartao'>('pix');
    const [chavePix, setChavePix] = useState('');

    // Dados de mudança de endereço
    const [motivoEndereco, setMotivoEndereco] = useState('');
    const [cepNovo, setCepNovo] = useState('');
    const [ruaNova, setRuaNova] = useState('');
    const [numeroNovo, setNumeroNovo] = useState('');
    const [bairroNovo, setBairroNovo] = useState('');
    const [cidadeNova, setCidadeNova] = useState('');
    const [estadoNovo, setEstadoNovo] = useState('');

    // Dados de mudança de produto
    const [motivoProduto, setMotivoProduto] = useState('');
    const [produtoAtual, setProdutoAtual] = useState('');
    const [produtoDesejado, setProdutoDesejado] = useState('');

    // Dados de cancelamento
    const [motivoCancelamento, setMotivoCancelamento] = useState('');
    const [motivoDetalhadoCancelamento, setMotivoDetalhadoCancelamento] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            let dadosSolicitacao: DadosSolicitacao;

            switch (tipo) {
                case 'reembolso':
                    dadosSolicitacao = {
                        motivo: motivoReembolso,
                        valor_solicitado: parseFloat(valorSolicitado),
                        forma_devolucao: formaDevolucao,
                        chave_pix: formaDevolucao === 'pix' ? chavePix : undefined,
                    };
                    break;

                case 'mudanca_endereco':
                    dadosSolicitacao = {
                        motivo: motivoEndereco,
                        endereco_atual: {
                            cep: '',
                            rua: '',
                            numero: '',
                            bairro: '',
                            cidade: '',
                            estado: '',
                        },
                        endereco_novo: {
                            cep: cepNovo,
                            rua: ruaNova,
                            numero: numeroNovo,
                            bairro: bairroNovo,
                            cidade: cidadeNova,
                            estado: estadoNovo,
                        },
                    };
                    break;

                case 'mudanca_produto':
                    dadosSolicitacao = {
                        motivo: motivoProduto,
                        produto_atual: produtoAtual,
                        produto_desejado: produtoDesejado,
                    };
                    break;

                case 'cancelamento':
                    dadosSolicitacao = {
                        motivo: motivoCancelamento,
                        motivo_detalhado: motivoDetalhadoCancelamento,
                    };
                    break;
            }

            const input: CriarSolicitacaoInput = {
                pedido_id: pedidoId,
                cliente_nome: clienteNome,
                cliente_email: clienteEmail || undefined,
                cliente_telefone: clienteTelefone || undefined,
                tipo,
                dados_solicitacao: dadosSolicitacao,
                observacoes: observacoes || undefined,
            };

            const { data, error } = await solicitacoesService.criar(input);

            if (error) throw error;

            navigate('/solicitacoes');
        } catch (err: any) {
            setError(err.message || 'Erro ao criar solicitação');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={() => navigate('/solicitacoes')}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar
                </button>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Nova Solicitação
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                    Preencha os dados para criar uma nova solicitação de pós-vendas
                </p>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Dados Básicos */}
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                        Dados do Pedido
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                ID do Pedido *
                            </label>
                            <input
                                type="text"
                                required
                                value={pedidoId}
                                onChange={(e) => setPedidoId(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                placeholder="Ex: PED-12345"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Nome do Cliente *
                            </label>
                            <input
                                type="text"
                                required
                                value={clienteNome}
                                onChange={(e) => setClienteNome(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                value={clienteEmail}
                                onChange={(e) => setClienteEmail(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Telefone
                            </label>
                            <input
                                type="tel"
                                value={clienteTelefone}
                                onChange={(e) => setClienteTelefone(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Tipo de Solicitação *
                            </label>
                            <select
                                required
                                value={tipo}
                                onChange={(e) => setTipo(e.target.value as TipoSolicitacao)}
                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            >
                                <option value="reembolso">Reembolso</option>
                                <option value="mudanca_endereco">Mudança de Endereço</option>
                                <option value="mudanca_produto">Mudança de Produto</option>
                                <option value="cancelamento">Cancelamento</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Dados Específicos por Tipo */}
                {tipo === 'reembolso' && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                            Dados do Reembolso
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Motivo *
                                </label>
                                <textarea
                                    required
                                    value={motivoReembolso}
                                    onChange={(e) => setMotivoReembolso(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Valor Solicitado *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={valorSolicitado}
                                        onChange={(e) => setValorSolicitado(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Forma de Devolução *
                                    </label>
                                    <select
                                        required
                                        value={formaDevolucao}
                                        onChange={(e) => setFormaDevolucao(e.target.value as any)}
                                        className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                    >
                                        <option value="pix">PIX</option>
                                        <option value="credito">Crédito</option>
                                        <option value="estorno_cartao">Estorno no Cartão</option>
                                    </select>
                                </div>
                            </div>

                            {formaDevolucao === 'pix' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Chave PIX *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={chavePix}
                                        onChange={(e) => setChavePix(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tipo === 'cancelamento' && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                            Dados do Cancelamento
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Motivo *
                                </label>
                                <select
                                    required
                                    value={motivoCancelamento}
                                    onChange={(e) => setMotivoCancelamento(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                >
                                    <option value="">Selecione...</option>
                                    <option value="arrependimento">Arrependimento</option>
                                    <option value="produto_errado">Produto Errado</option>
                                    <option value="demora_entrega">Demora na Entrega</option>
                                    <option value="outro">Outro</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Detalhes
                                </label>
                                <textarea
                                    value={motivoDetalhadoCancelamento}
                                    onChange={(e) => setMotivoDetalhadoCancelamento(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Observações */}
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Observações
                    </label>
                    <textarea
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        placeholder="Informações adicionais..."
                    />
                </div>

                {/* Botões */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/solicitacoes')}
                        className="px-6 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Criando...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Criar Solicitação
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};
