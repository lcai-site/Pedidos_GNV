import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { solicitacoesService } from '../../lib/services/solicitacoesService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/hooks/useAuth';
import { CanAccess } from '../../components/RBAC/CanAccess';
import type { Solicitacao } from '../../lib/types/solicitacoes';
import { STATUS_LABELS, TIPO_LABELS } from '../../lib/types/solicitacoes';
import { ArrowLeft, CheckCircle, XCircle, Loader2, FileText, UserCheck, ShieldX, RefreshCw, Package, ExternalLink } from 'lucide-react';

export const DetalhesSolicitacaoPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { can } = useAuth();
    const [solicitacao, setSolicitacao] = useState<Solicitacao | null>(null);
    const [loading, setLoading] = useState(true);
    const [processando, setProcessando] = useState(false);
    const [observacoesInternas, setObservacoesInternas] = useState('');
    // 👤 Nome do responsável pela aprovação/rejeição
    const [aprovadorNome, setAprovadorNome] = useState<string | null>(null);
    // 🔁 Reenvio
    const [responsavelReenvioNome, setResponsavelReenvioNome] = useState<string | null>(null);
    const [emitindoReenvio, setEmitindoReenvio] = useState(false);
    const [reenvioEmitido, setReenvioEmitido] = useState(false);
    const [reenvioNovoId, setReenvioNovoId] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            carregarSolicitacao();
        }
    }, [id]);

    async function carregarSolicitacao() {
        if (!id) return;

        setLoading(true);
        const { data } = await solicitacoesService.buscarPorId(id);
        if (data) {
            setSolicitacao(data);
            setObservacoesInternas(data.observacoes_internas || '');

            // Buscar nome do aprovador se houver
            if (data.aprovado_por) {
                const { data: prof } = await supabase
                    .from('profiles')
                    .select('nome_completo, email')
                    .eq('id', data.aprovado_por)
                    .single();
                setAprovadorNome(prof?.nome_completo || prof?.email || 'Usuário desconhecido');
            } else {
                setAprovadorNome(null);
            }
            // Buscar nome do responsável pelo reenvio
            if (data.responsavel_reenvio_id) {
                const { data: resp } = await supabase
                    .from('profiles')
                    .select('nome_completo, email')
                    .eq('id', data.responsavel_reenvio_id)
                    .single();
                setResponsavelReenvioNome(resp?.nome_completo || resp?.email || 'Usuário desconhecido');
            } else {
                setResponsavelReenvioNome(null);
            }
            // Verifica se já existe reenvio emitido
            if (data.pedido_reenvio_id) {
                setReenvioEmitido(true);
                setReenvioNovoId(data.pedido_reenvio_id);
            }
        }
        setLoading(false);
    }

    async function handleAprovar() {
        if (!id) return;

        setProcessando(true);
        const { error } = await solicitacoesService.aprovar(id, observacoesInternas);
        if (!error) {
            await carregarSolicitacao();
        }
        setProcessando(false);
    }

    async function handleRecusar() {
        if (!id || !observacoesInternas) {
            alert('Por favor, adicione uma justificativa para recusar.');
            return;
        }

        setProcessando(true);
        const { error } = await solicitacoesService.recusar(id, observacoesInternas);
        if (!error) {
            await carregarSolicitacao();
        }
        setProcessando(false);
    }

    async function handleEmitirReenvio() {
        if (!id || !solicitacao?.pedido_reenvio_id) return;
        setEmitindoReenvio(true);
        const { data: novoId, error } = await solicitacoesService.emitirReenvio(
            solicitacao.pedido_reenvio_id,
            id,
            solicitacao.observacoes_reenvio || undefined
        );
        if (!error && novoId) {
            setReenvioEmitido(true);
            setReenvioNovoId(novoId);
            await carregarSolicitacao();
        }
        setEmitindoReenvio(false);
    }

    if (loading) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                    <p className="text-slate-500 mt-4">Carregando solicitação...</p>
                </div>
            </div>
        );
    }

    if (!solicitacao) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-500">Solicitação não encontrada</p>
                </div>
            </div>
        );
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
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            Solicitação #{solicitacao.pedido_id}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                            {TIPO_LABELS[solicitacao.tipo]} • {STATUS_LABELS[solicitacao.status]}
                        </p>
                    </div>
                </div>
            </div>

            {/* Informações do Cliente */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    Informações do Cliente
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm text-slate-500 dark:text-slate-400">Nome</label>
                        <p className="text-slate-900 dark:text-slate-100 font-medium">{solicitacao.cliente_nome}</p>
                    </div>
                    {solicitacao.cliente_email && (
                        <div>
                            <label className="text-sm text-slate-500 dark:text-slate-400">Email</label>
                            <p className="text-slate-900 dark:text-slate-100">{solicitacao.cliente_email}</p>
                        </div>
                    )}
                    {solicitacao.cliente_telefone && (
                        <div>
                            <label className="text-sm text-slate-500 dark:text-slate-400">Telefone</label>
                            <p className="text-slate-900 dark:text-slate-100">{solicitacao.cliente_telefone}</p>
                        </div>
                    )}
                    <div>
                        <label className="text-sm text-slate-500 dark:text-slate-400">Data da Solicitação</label>
                        <p className="text-slate-900 dark:text-slate-100">
                            {new Date(solicitacao.created_at).toLocaleString('pt-BR')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Dados da Solicitação */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    Detalhes da Solicitação
                </h2>
                <pre className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg text-sm overflow-auto">
                    {JSON.stringify(solicitacao.dados_solicitacao, null, 2)}
                </pre>
            </div>

            {/* Observações */}
            {solicitacao.observacoes && (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                        Observações do Cliente
                    </h2>
                    <p className="text-slate-700 dark:text-slate-300">{solicitacao.observacoes}</p>
                </div>
            )}

            {/* Ações de Gestores/ADM */}
            <CanAccess permission="solicitacoes:approve">
                {solicitacao.status === 'pendente' && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                            Análise da Solicitação
                        </h2>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Observações Internas
                            </label>
                            <textarea
                                value={observacoesInternas}
                                onChange={(e) => setObservacoesInternas(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                placeholder="Adicione observações internas (visível apenas para gestores/ADM)..."
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleAprovar}
                                disabled={processando}
                                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                {processando ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <CheckCircle className="w-4 h-4" />
                                )}
                                Aprovar
                            </button>

                            <button
                                onClick={handleRecusar}
                                disabled={processando}
                                className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                {processando ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <XCircle className="w-4 h-4" />
                                )}
                                Recusar
                            </button>
                        </div>
                    </div>
                )}

                {/* Card de Auditoria: Quem aprovou/recusou */}
                {solicitacao.aprovado_por && aprovadorNome && (
                    <div className={`rounded-lg border p-4 mb-6 flex items-center gap-3 ${
                        solicitacao.status === 'aprovada'
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    }`}>
                        {solicitacao.status === 'aprovada'
                            ? <UserCheck className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                            : <ShieldX className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />}
                        <div>
                            <p className={`text-sm font-semibold ${
                                solicitacao.status === 'aprovada'
                                    ? 'text-green-800 dark:text-green-200'
                                    : 'text-red-800 dark:text-red-200'
                            }`}>
                                {solicitacao.status === 'aprovada' ? 'Aprovada' : 'Recusada'} por <span className="font-bold">{aprovadorNome}</span>
                            </p>
                            {solicitacao.aprovado_em && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {new Date(solicitacao.aprovado_em).toLocaleString('pt-BR')}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Card de Reenvio */}
                {solicitacao.necessita_reenvio && (
                    <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10 p-5 mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <RefreshCw className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            <h3 className="font-semibold text-orange-900 dark:text-orange-100">Reenvio Solicitado</h3>
                        </div>
                        <div className="space-y-2 text-sm">
                            {responsavelReenvioNome && (
                                <p className="text-slate-700 dark:text-slate-300">
                                    <span className="font-medium">Responsável:</span> {responsavelReenvioNome}
                                </p>
                            )}
                            {solicitacao.observacoes_reenvio && (
                                <p className="text-slate-700 dark:text-slate-300">
                                    <span className="font-medium">Observações:</span> {solicitacao.observacoes_reenvio}
                                </p>
                            )}
                        </div>

                        {/* Botão Emitir Reenvio — visivel apenas para ADM/Gestor com pedido original vinculado */}
                        <CanAccess permission="solicitacoes:approve">
                            {solicitacao.pedido_reenvio_id && !reenvioEmitido && (
                                <button
                                    onClick={handleEmitirReenvio}
                                    disabled={emitindoReenvio}
                                    className="mt-4 flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
                                >
                                    {emitindoReenvio
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <RefreshCw className="w-4 h-4" />}
                                    Emitir Pedido de Reenvio
                                </button>
                            )}
                            {reenvioEmitido && reenvioNovoId && (
                                <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg">
                                    <Package className="w-4 h-4 text-green-600" />
                                    <span className="text-sm text-green-800 dark:text-green-200 font-medium">Reenvio emitido com sucesso!</span>
                                    <a
                                        href={`/logistics`}
                                        className="ml-auto flex items-center gap-1 text-xs text-green-700 dark:text-green-300 hover:underline"
                                    >
                                        Ver na Logiística <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            )}
                        </CanAccess>
                    </div>
                )}

                {solicitacao.observacoes_internas && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 p-6">
                        <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-4">
                            Observações Internas
                        </h2>
                        <p className="text-yellow-800 dark:text-yellow-200">{solicitacao.observacoes_internas}</p>
                    </div>
                )}
            </CanAccess>
        </div>
    );
};
