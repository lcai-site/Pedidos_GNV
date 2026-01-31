import React, { useEffect, useState } from 'react';
import { solicitacoesService } from '../../lib/services/solicitacoesService';
import { useAuth } from '../../lib/hooks/useAuth';
import { CanAccess } from '../../components/RBAC/CanAccess';
import type { Solicitacao, StatusSolicitacao, TipoSolicitacao } from '../../lib/types/solicitacoes';
import { STATUS_LABELS, STATUS_COLORS, TIPO_LABELS } from '../../lib/types/solicitacoes';
import { Plus, Filter, Search, FileText, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const SolicitacoesPage: React.FC = () => {
    const { profile } = useAuth();
    const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroStatus, setFiltroStatus] = useState<StatusSolicitacao | ''>('');
    const [filtroTipo, setFiltroTipo] = useState<TipoSolicitacao | ''>('');
    const [busca, setBusca] = useState('');

    useEffect(() => {
        carregarSolicitacoes();
    }, [filtroStatus, filtroTipo]);

    async function carregarSolicitacoes() {
        setLoading(true);
        const filtros: any = {};
        if (filtroStatus) filtros.status = filtroStatus;
        if (filtroTipo) filtros.tipo = filtroTipo;

        const { data } = await solicitacoesService.buscarSolicitacoes(filtros);
        if (data) {
            setSolicitacoes(data);
        }
        setLoading(false);
    }

    const solicitacoesFiltradas = solicitacoes.filter(s => {
        if (!busca) return true;
        const termo = busca.toLowerCase();
        return (
            s.pedido_id.toLowerCase().includes(termo) ||
            s.cliente_nome.toLowerCase().includes(termo)
        );
    });

    const getStatusIcon = (status: StatusSolicitacao) => {
        switch (status) {
            case 'pendente': return <Clock className="w-4 h-4" />;
            case 'em_analise': return <AlertCircle className="w-4 h-4" />;
            case 'aprovada': return <CheckCircle className="w-4 h-4" />;
            case 'recusada': return <XCircle className="w-4 h-4" />;
            case 'concluida': return <CheckCircle className="w-4 h-4" />;
            default: return <FileText className="w-4 h-4" />;
        }
    };

    const getStatusColor = (status: StatusSolicitacao) => {
        const colors: Record<string, string> = {
            yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
            blue: 'bg-blue-100 text-blue-700 border-blue-200',
            green: 'bg-green-100 text-green-700 border-green-200',
            red: 'bg-red-100 text-red-700 border-red-200',
            gray: 'bg-gray-100 text-gray-700 border-gray-200',
        };
        return colors[STATUS_COLORS[status]] || colors.gray;
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        Solicitações de Pós-Vendas
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Gerencie reembolsos, trocas e cancelamentos
                    </p>
                </div>

                <Link
                    to="/solicitacoes/nova"
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nova Solicitação
                </Link>
            </div>

            {/* Filtros */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Busca */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por pedido ou cliente..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        />
                    </div>

                    {/* Filtro Status */}
                    <select
                        value={filtroStatus}
                        onChange={(e) => setFiltroStatus(e.target.value as StatusSolicitacao)}
                        className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    >
                        <option value="">Todos os status</option>
                        <option value="pendente">Pendente</option>
                        <option value="em_analise">Em Análise</option>
                        <option value="aprovada">Aprovada</option>
                        <option value="recusada">Recusada</option>
                        <option value="concluida">Concluída</option>
                    </select>

                    {/* Filtro Tipo */}
                    <select
                        value={filtroTipo}
                        onChange={(e) => setFiltroTipo(e.target.value as TipoSolicitacao)}
                        className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    >
                        <option value="">Todos os tipos</option>
                        <option value="reembolso">Reembolso</option>
                        <option value="mudanca_endereco">Mudança de Endereço</option>
                        <option value="mudanca_produto">Mudança de Produto</option>
                        <option value="cancelamento">Cancelamento</option>
                    </select>
                </div>
            </div>

            {/* Lista de Solicitações */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 mt-4">Carregando solicitações...</p>
                </div>
            ) : solicitacoesFiltradas.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-500">Nenhuma solicitação encontrada</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {solicitacoesFiltradas.map((solicitacao) => (
                        <Link
                            key={solicitacao.id}
                            to={`/solicitacoes/${solicitacao.id}`}
                            className="block bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-blue-500 transition-colors"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                                            #{solicitacao.pedido_id}
                                        </span>
                                        <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(solicitacao.status)} flex items-center gap-1`}>
                                            {getStatusIcon(solicitacao.status)}
                                            {STATUS_LABELS[solicitacao.status]}
                                        </span>
                                        <span className="px-2 py-1 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                            {TIPO_LABELS[solicitacao.tipo]}
                                        </span>
                                    </div>
                                    <p className="text-slate-900 dark:text-slate-100 font-medium">
                                        {solicitacao.cliente_nome}
                                    </p>
                                    {solicitacao.observacoes && (
                                        <p className="text-slate-500 text-sm mt-1 line-clamp-1">
                                            {solicitacao.observacoes}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right text-sm text-slate-500">
                                    {new Date(solicitacao.created_at).toLocaleDateString('pt-BR')}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};
