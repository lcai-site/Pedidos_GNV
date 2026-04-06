import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { solicitacoesService } from '../../lib/services/solicitacoesService';
import { supabase } from '../../lib/supabase';
import type { TipoSolicitacao, CriarSolicitacaoInput, DadosSolicitacao } from '../../lib/types/solicitacoes';
import { ArrowLeft, Save, Loader2, Search, User, Mail, Package, RefreshCw, ChevronDown } from 'lucide-react';

// ─── Tipo de resultado de busca de pedido ───────────────────────────────────
interface PedidoSugestao {
  id: string;
  nome_cliente: string | null;
  email: string | null;
  telefone: string | null;
  descricao_pacote: string | null;
  codigos_agrupados: any;
}

export const NovaSolicitacaoPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Dados básicos
    const [pedidoId, setPedidoId] = useState('');      // código de transação (exibição)
    const [pedidoUuid, setPedidoUuid] = useState('');   // UUID real do pedido (FK no banco)
    const [clienteNome, setClienteNome] = useState('');
    const [clienteEmail, setClienteEmail] = useState('');
    const [clienteTelefone, setClienteTelefone] = useState('');
    const [tipo, setTipo] = useState<TipoSolicitacao>('reembolso');
    const [observacoes, setObservacoes] = useState('');

    // ─── Estado do Autocomplete ──────────────────────────────────────────────
    const [suggestions, setSuggestions] = useState<PedidoSugestao[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [activeField, setActiveField] = useState<'id' | 'nome' | 'email' | null>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fecha dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setSuggestions([]);
                setActiveField(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ─── Busca com debounce ──────────────────────────────────────────────────
    const searchPedidos = useCallback(async (term: string, field: 'id' | 'nome' | 'email') => {
        if (term.length < 2) { setSuggestions([]); return; }

        setIsSearching(true);
        try {
            let query = supabase
                .from('pedidos_consolidados_v3')
                .select('id, nome_cliente, email, telefone, descricao_pacote, codigos_agrupados')
                .limit(8);

            if (field === 'id') {
                // Busca por código de transação agrupado ou UUID
                query = query.or(`id.ilike.%${term}%,codigos_agrupados.cs.{"${term}"}`);
            } else if (field === 'nome') {
                query = query.ilike('nome_cliente', `%${term}%`);
            } else {
                query = query.ilike('email', `%${term}%`);
            }

            const { data, error } = await query;
            if (!error && data) setSuggestions(data as PedidoSugestao[]);
        } catch (_) {
            setSuggestions([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    const handleSearch = (term: string, field: 'id' | 'nome' | 'email') => {
        setActiveField(field);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => searchPedidos(term, field), 300);
    };

    // ─── Seleciona uma sugestão e preenche o formulário ──────────────────────
    const handleSelectSugestao = (pedido: PedidoSugestao) => {
        // Extrair primeiro código agrupado como referência do ID
        let refId = pedido.id;
        if (pedido.codigos_agrupados) {
            const arr = Array.isArray(pedido.codigos_agrupados)
                ? pedido.codigos_agrupados
                : typeof pedido.codigos_agrupados === 'string'
                    ? JSON.parse(pedido.codigos_agrupados)
                    : [];
            if (arr.length > 0) refId = arr[0];
        }

        setPedidoId(refId);           // código legível para exibir no campo
        setPedidoUuid(pedido.id);      // UUID real — usado como FK em reenvio e outras relações
        setClienteNome(pedido.nome_cliente || '');
        setClienteEmail(pedido.email || '');
        setClienteTelefone(pedido.telefone || '');
        setSuggestions([]);
        setActiveField(null);
    };

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

    // Dados de reclamação (antigo mudanca_produto — renomeado)
    const [motivoReclamacao, setMotivoReclamacao] = useState('');
    const [descricaoReclamacao, setDescricaoReclamacao] = useState('');

    // ─── Estado do Reenvio (dentro de Reclamação) ────────────────────────────
    const [necessitaReenvio, setNecessitaReenvio] = useState(false);
    const [pedidoReenvioId, setPedidoReenvioId] = useState('');        // UUID do pedido original
    const [pedidoReenvioLabel, setPedidoReenvioLabel] = useState(''); // display label
    const [reenvioQuery, setReenvioQuery] = useState('');              // texto digitado na busca
    const [reenvioSuggestions, setReenvioSuggestions] = useState<PedidoSugestao[]>([]);
    const [reenvioSearching, setReenvioSearching] = useState(false);
    const reenvioDropdownRef = useRef<HTMLDivElement>(null);
    const reenvioDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const [responsavelReenvioId, setResponsavelReenvioId] = useState('');
    const [observacoesReenvio, setObservacoesReenvio] = useState('');
    const [profiles, setProfiles] = useState<{ id: string; nome_completo: string | null; email: string }[]>([]);

    // Carrega profiles para o selector de responsável
    useEffect(() => {
        supabase
            .from('profiles')
            .select('id, nome_completo, email')
            .eq('ativo', true)
            .order('nome_completo')
            .then(({ data }) => { if (data) setProfiles(data as any); });
    }, []);

    // Busca de pedido para reenvio (com debounce)
    const searchReenvioPedidos = useCallback(async (term: string) => {
        if (term.length < 2) { setReenvioSuggestions([]); return; }
        setReenvioSearching(true);
        try {
            const { data } = await supabase
                .from('pedidos_consolidados_v3')
                .select('id, nome_cliente, email, telefone, descricao_pacote, codigos_agrupados')
                .or(`nome_cliente.ilike.%${term}%,email.ilike.%${term}%`)
                .eq('is_reenvio', false)  // apenas pedidos originais
                .limit(6);
            if (data) setReenvioSuggestions(data as PedidoSugestao[]);
        } catch { setReenvioSuggestions([]); }
        finally { setReenvioSearching(false); }
    }, []);

    const handleReenvioSearch = (term: string) => {
        setReenvioQuery(term);
        if (reenvioDebounceRef.current) clearTimeout(reenvioDebounceRef.current);
        reenvioDebounceRef.current = setTimeout(() => searchReenvioPedidos(term), 300);
    };

    const handleSelectReenvioPedido = (p: PedidoSugestao) => {
        setPedidoReenvioId(p.id);
        setPedidoReenvioLabel(`${p.nome_cliente || ''} — ${p.email || ''}`);
        setReenvioQuery(`${p.nome_cliente || ''} — ${p.email || ''}`);
        setReenvioSuggestions([]);
    };

    // Fecha dropdown de reenvio ao clicar fora
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (reenvioDropdownRef.current && !reenvioDropdownRef.current.contains(e.target as Node)) {
                setReenvioSuggestions([]);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

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

                case 'reclamacao':
                    dadosSolicitacao = {
                        motivo: motivoReclamacao,
                        produto_atual: descricaoReclamacao, // reusa o campo para detalhar a reclamação
                        produto_desejado: '',
                    } as any;
                    break;

                case 'cancelamento':
                    dadosSolicitacao = {
                        motivo: motivoCancelamento,
                        motivo_detalhado: motivoDetalhadoCancelamento,
                    };
                    break;

                default:
                    dadosSolicitacao = { motivo: '' } as any;
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
                // Reenvio: apenas para Reclamações — pedidoUuid é o UUID real do pedido já selecionado
                necessita_reenvio: tipo === 'reclamacao' ? necessitaReenvio : false,
                pedido_reenvio_id: (tipo === 'reclamacao' && necessitaReenvio && pedidoUuid) ? pedidoUuid : undefined,
                responsavel_reenvio_id: (tipo === 'reclamacao' && necessitaReenvio && responsavelReenvioId) ? responsavelReenvioId : undefined,
                observacoes_reenvio: undefined,
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

                    {/* ─── Wrapper do Autocomplete (fecha ao clicar fora) ─────────── */}
                    <div ref={dropdownRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* ── ID do Pedido com autocomplete ── */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                ID do Pedido *
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    required
                                    value={pedidoId}
                                    onChange={(e) => { setPedidoId(e.target.value); handleSearch(e.target.value, 'id'); }}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-none"
                                    placeholder="Digite o código ou ID..."
                                    autoComplete="off"
                                />
                                {isSearching && activeField === 'id' && (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                                )}
                            </div>
                            {activeField === 'id' && suggestions.length > 0 && (
                                <SuggestionsDropdown suggestions={suggestions} onSelect={handleSelectSugestao} />
                            )}
                        </div>

                        {/* ── Nome do Cliente com autocomplete ── */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Nome do Cliente *
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    required
                                    value={clienteNome}
                                    onChange={(e) => { setClienteNome(e.target.value); handleSearch(e.target.value, 'nome'); }}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-none"
                                    autoComplete="off"
                                />
                                {isSearching && activeField === 'nome' && (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                                )}
                            </div>
                            {activeField === 'nome' && suggestions.length > 0 && (
                                <SuggestionsDropdown suggestions={suggestions} onSelect={handleSelectSugestao} />
                            )}
                        </div>

                        {/* ── Email com autocomplete ── */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={clienteEmail}
                                    onChange={(e) => { setClienteEmail(e.target.value); handleSearch(e.target.value, 'email'); }}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-none"
                                    autoComplete="off"
                                />
                                {isSearching && activeField === 'email' && (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                                )}
                            </div>
                            {activeField === 'email' && suggestions.length > 0 && (
                                <SuggestionsDropdown suggestions={suggestions} onSelect={handleSelectSugestao} />
                            )}
                        </div>

                        {/* ── Telefone (preenchido automaticamente) ── */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Telefone
                            </label>
                            <input
                                type="tel"
                                value={clienteTelefone}
                                onChange={(e) => setClienteTelefone(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                placeholder="Preenchido automaticamente"
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
                                <option value="reclamacao">Reclamação</option>
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

                {/* Seção: Reclamação */}
                {tipo === 'reclamacao' && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                            Dados da Reclamação
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Motivo da Reclamação *
                                </label>
                                <select
                                    required
                                    value={motivoReclamacao}
                                    onChange={(e) => setMotivoReclamacao(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                >
                                    <option value="">Selecione...</option>
                                    <option value="produto_danificado">Produto Danificado</option>
                                    <option value="produto_errado">Produto Errado</option>
                                    <option value="produto_incompleto">Produto Incompleto</option>
                                    <option value="qualidade">Qualidade Insatisfatória</option>
                                    <option value="demora_entrega">Demora na Entrega</option>
                                    <option value="outro">Outro</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Descrição Detalhada *
                                </label>
                                <textarea
                                    required
                                    value={descricaoReclamacao}
                                    onChange={(e) => setDescricaoReclamacao(e.target.value)}
                                    rows={4}
                                    placeholder="Descreva o problema com o maior número de detalhes possível..."
                                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                />
                            </div>

                            {/* ─── Toggle Necessita Reenvio ─────────────────────────────── */}
                            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                                <label className="flex items-center gap-3 cursor-pointer select-none group">
                                    <div
                                        onClick={() => setNecessitaReenvio(v => !v)}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${
                                            necessitaReenvio ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-600'
                                        }`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                            necessitaReenvio ? 'translate-x-6' : 'translate-x-0'
                                        }`} />
                                    </div>
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <RefreshCw className="w-4 h-4 text-orange-500" />
                                        Necessita Reenvio?
                                    </span>
                                </label>

                                {/* Seletor de responsável — exibido somente quando toggle está ON */}
                                {necessitaReenvio && (
                                    <div className="mt-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Responsável pelo Reenvio
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={responsavelReenvioId}
                                                onChange={(e) => setResponsavelReenvioId(e.target.value)}
                                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 appearance-none"
                                            >
                                                <option value="">Selecione o responsável...</option>
                                                {profiles.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.nome_completo || p.email}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                )}

                            </div>
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

// ─── Componente auxiliar: Dropdown de sugestões ──────────────────────────────
const SuggestionsDropdown: React.FC<{
    suggestions: PedidoSugestao[];
    onSelect: (pedido: PedidoSugestao) => void;
}> = ({ suggestions, onSelect }) => (
    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl overflow-hidden">
        {suggestions.map((p) => (
            <button
                key={p.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSelect(p); }}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 group"
            >
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-md bg-blue-100 dark:bg-blue-500/10 group-hover:bg-blue-200 dark:group-hover:bg-blue-500/20 transition-colors">
                        <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                            {p.nome_cliente || 'Cliente sem nome'}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                            {p.email && (
                                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                                    <Mail className="w-3 h-3" /> {p.email}
                                </span>
                            )}
                            {p.descricao_pacote && (
                                <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 truncate">
                                    <Package className="w-3 h-3" /> {p.descricao_pacote}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </button>
        ))}
    </div>
);
