import React, { useState } from 'react';
import {
    Trophy, TrendingUp, Users, DollarSign, Target,
    ChevronDown, ChevronUp, Award, BarChart3, Percent,
    Phone, Mail, Search, Tag, UserCheck, Megaphone, HelpCircle
} from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';
import { format } from 'date-fns';
import { useDateFilter } from '../context/DateFilterContext';
import {
    useDesempenhoVendedoras,
    useClassificarAfiliado,
    VendedoraPerformance,
    TipoAfiliado,
} from '../lib/hooks/useDesempenhoVendedoras';

const formatCurrency = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const getRankBadge = (index: number) => {
    const badges = [
        { emoji: '🥇', bg: 'bg-amber-500/15 border-amber-500/30 text-amber-400' },
        { emoji: '🥈', bg: 'bg-slate-400/15 border-slate-400/30 text-slate-300' },
        { emoji: '🥉', bg: 'bg-orange-600/15 border-orange-600/30 text-orange-400' },
    ];
    return badges[index] || null;
};

const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0]?.substring(0, 2).toUpperCase() || '??';
};

const avatarColors = [
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-rose-500 to-pink-500',
    'from-amber-500 to-orange-500',
    'from-indigo-500 to-violet-500',
    'from-fuchsia-500 to-pink-500',
    'from-teal-500 to-green-500',
    'from-red-500 to-orange-500',
];

const TIPO_CONFIG: Record<TipoAfiliado, { label: string; icon: React.ElementType; color: string }> = {
    vendedora: { label: 'Vendedora', icon: UserCheck, color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    influencer: { label: 'Influencer', icon: Megaphone, color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    coprodutor: { label: 'Coprodutor(a)', icon: Users, color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    nao_classificado: { label: 'Não classificado', icon: HelpCircle, color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
};

const TipoBadge = ({ tipo }: { tipo: TipoAfiliado }) => {
    const config = TIPO_CONFIG[tipo] || TIPO_CONFIG.nao_classificado;
    const Icon = config.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
            <Icon className="w-3 h-3" />
            {config.label}
        </span>
    );
};

const ClassificadorDropdown = ({ affiliateId, currentTipo, onClassify }: {
    affiliateId: number; currentTipo: TipoAfiliado; onClassify: (id: number, tipo: TipoAfiliado) => void;
}) => {
    const [open, setOpen] = useState(false);
    const tipos: TipoAfiliado[] = ['vendedora', 'influencer', 'coprodutor', 'nao_classificado'];

    return (
        <div className="relative">
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-800 border border-border rounded-lg hover:border-blue-500/50 text-slate-400 hover:text-slate-200 transition-colors"
            >
                <Tag className="w-3 h-3" />
                Classificar
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-slate-800 border border-border rounded-lg shadow-xl overflow-hidden min-w-[160px]">
                        {tipos.map(t => {
                            const config = TIPO_CONFIG[t];
                            const Icon = config.icon;
                            const isActive = t === currentTipo;
                            return (
                                <button
                                    key={t}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClassify(affiliateId, t);
                                        setOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${isActive ? 'bg-blue-500/10 text-blue-400' : 'text-slate-300 hover:bg-slate-700'
                                        }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {config.label}
                                    {isActive && <span className="ml-auto text-blue-400">✓</span>}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};

const MetaProgressBar = ({ atingida, meta, faturamentoPV }: { atingida: number; meta: number; faturamentoPV: number }) => {
    const pct = Math.min(atingida, 150);
    const isAboveMeta = atingida >= 100;

    return (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                        <Target className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-slate-300">Meta Coletiva do Período</h3>
                        <p className="text-xs text-slate-500">15% do faturamento aprovado do período anterior</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`text-2xl font-bold ${isAboveMeta ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {atingida.toFixed(1)}%
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {formatCurrency(faturamentoPV)} / {formatCurrency(meta)}
                    </p>
                </div>
            </div>

            <div className="relative h-4 bg-slate-800 rounded-full overflow-hidden">
                <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out ${isAboveMeta
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                            : pct > 70
                                ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                                : 'bg-gradient-to-r from-red-500 to-orange-400'
                        }`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                />
                <div className="absolute inset-y-0 left-[100%] -translate-x-px w-0.5 bg-white/30" />
            </div>

            <div className="flex justify-between mt-2 text-xs text-slate-500">
                <span>0%</span>
                <span>50%</span>
                <span className="font-semibold text-slate-400">Meta (100%)</span>
            </div>
        </div>
    );
};

const SummaryCard = ({ title, value, subtitle, icon: Icon, color, loading }: {
    title: string; value: string; subtitle: string; icon: React.ElementType; color: string; loading: boolean;
}) => (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:border-slate-700 transition-colors">
        <div className="flex items-start justify-between">
            <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
                {loading ? (
                    <Skeleton className="h-7 w-28 mt-2" />
                ) : (
                    <p className="text-xl font-bold text-slate-100 mt-1.5">{value}</p>
                )}
                {loading ? (
                    <Skeleton className="h-3.5 w-20 mt-2" />
                ) : (
                    <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
                )}
            </div>
            <div className={`p-2.5 rounded-lg ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
    </div>
);

const VendedoraRow = ({ vendedora, index, isExpanded, onToggle, onClassify }: {
    vendedora: VendedoraPerformance; index: number; isExpanded: boolean; onToggle: () => void;
    onClassify: (id: number, tipo: TipoAfiliado) => void;
}) => {
    const badge = getRankBadge(index);
    const colorIdx = index % avatarColors.length;

    return (
        <div className={`border-b border-border last:border-b-0 transition-colors ${isExpanded ? 'bg-slate-800/30' : 'hover:bg-slate-800/20'}`}>
            <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
                onClick={onToggle}
            >
                {/* Rank */}
                <div className="w-8 text-center shrink-0">
                    {badge ? (
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-sm font-bold ${badge.bg}`}>
                            {badge.emoji}
                        </span>
                    ) : (
                        <span className="text-sm font-semibold text-slate-500">#{index + 1}</span>
                    )}
                </div>

                {/* Avatar + Name + Tipo */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColors[colorIdx]} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                        {getInitials(vendedora.affiliate_name)}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-200 truncate">{vendedora.affiliate_name}</p>
                            {vendedora.is_coprodutor && vendedora.is_afiliado && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                                    Dupla função
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <TipoBadge tipo={vendedora.affiliate_tipo} />
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="hidden md:flex items-center gap-6">
                    <div className="text-right min-w-[80px]">
                        <p className="text-sm font-bold text-emerald-400">{formatCurrency(vendedora.valor_total_aprovado)}</p>
                        <p className="text-xs text-slate-500">{vendedora.vendas_aprovadas} vendas</p>
                    </div>
                    <div className="text-right min-w-[70px]">
                        <p className="text-sm font-semibold text-slate-300">{formatCurrency(vendedora.ticket_medio)}</p>
                        <p className="text-xs text-slate-500">ticket médio</p>
                    </div>
                    <div className="text-right min-w-[60px]">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${vendedora.taxa_conversao >= 70 ? 'bg-emerald-500/15 text-emerald-400' :
                                vendedora.taxa_conversao >= 40 ? 'bg-amber-500/15 text-amber-400' :
                                    'bg-red-500/15 text-red-400'
                            }`}>
                            {vendedora.taxa_conversao}%
                        </span>
                        <p className="text-xs text-slate-500 mt-0.5">conversão</p>
                    </div>
                    <div className="text-right min-w-[80px]">
                        <p className="text-sm font-semibold text-blue-400">{formatCurrency(vendedora.comissao_total)}</p>
                        <p className="text-xs text-slate-500">comissão</p>
                    </div>
                </div>

                {/* Toggle */}
                <button className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="px-5 pb-4 pt-0">
                    <div className="ml-11 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-900/50 rounded-lg border border-border">
                        {/* Mobile stats */}
                        <div className="md:hidden col-span-2 grid grid-cols-2 gap-3 pb-3 border-b border-border">
                            <div>
                                <p className="text-xs text-slate-500">Faturamento</p>
                                <p className="text-sm font-bold text-emerald-400">{formatCurrency(vendedora.valor_total_aprovado)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Comissão</p>
                                <p className="text-sm font-bold text-blue-400">{formatCurrency(vendedora.comissao_total)}</p>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs text-slate-500 mb-1">Vendas Aprovadas</p>
                            <p className="text-lg font-bold text-emerald-400">{vendedora.vendas_aprovadas}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Vendas Pendentes</p>
                            <p className="text-lg font-bold text-amber-400">{vendedora.vendas_pendentes}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Recusadas/Expiradas</p>
                            <p className="text-lg font-bold text-red-400">{vendedora.vendas_recusadas}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Valor Pendente</p>
                            <p className="text-lg font-bold text-amber-400">{formatCurrency(vendedora.valor_total_pendente)}</p>
                        </div>

                        <div className="col-span-2 md:col-span-4 pt-3 border-t border-border flex flex-wrap items-center gap-4 text-xs text-slate-400">
                            <span className="flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5" />
                                {vendedora.affiliate_email}
                            </span>
                            {vendedora.affiliate_phone && (
                                <span className="flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5" />
                                    {vendedora.affiliate_phone}
                                </span>
                            )}
                            <span className="flex items-center gap-1.5">
                                <BarChart3 className="w-3.5 h-3.5" />
                                Código: {vendedora.affiliate_pid}
                            </span>
                            {vendedora.primeira_venda && (
                                <span>Primeira venda: {format(new Date(vendedora.primeira_venda), 'dd/MM/yyyy')}</span>
                            )}
                            {vendedora.ultima_venda && (
                                <span>Última venda: {format(new Date(vendedora.ultima_venda), 'dd/MM/yyyy')}</span>
                            )}
                            <div className="ml-auto">
                                <ClassificadorDropdown
                                    affiliateId={vendedora.affiliate_id}
                                    currentTipo={vendedora.affiliate_tipo}
                                    onClassify={onClassify}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

type FilterTab = 'todos' | TipoAfiliado;

const FILTER_TABS: { key: FilterTab; label: string; icon: React.ElementType }[] = [
    { key: 'todos', label: 'Todos', icon: Users },
    { key: 'vendedora', label: 'Vendedoras', icon: UserCheck },
    { key: 'influencer', label: 'Influencers', icon: Megaphone },
    { key: 'coprodutor', label: 'Coprodutores', icon: Users },
    { key: 'nao_classificado', label: 'Não classificados', icon: HelpCircle },
];

export const DesempenhoVendedoras: React.FC = () => {
    const { startDate, endDate } = useDateFilter();
    const [activeFilter, setActiveFilter] = useState<FilterTab>('todos');
    const tipoParam = activeFilter === 'todos' ? null : activeFilter;
    const { vendedoras, metricas, isLoading, error } = useDesempenhoVendedoras(startDate, endDate, tipoParam);
    const classificar = useClassificarAfiliado();
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const filtered = vendedoras.filter(v =>
        v.affiliate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.affiliate_email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleClassify = (affiliateId: number, tipo: TipoAfiliado) => {
        classificar.mutate({ affiliateId, tipo });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
                    <Trophy className="w-7 h-7 text-amber-400" />
                    Desempenho Pós-Venda
                </h2>
                <p className="text-slate-500 mt-1">
                    Performance das vendedoras e afiliados · {format(startDate, 'dd/MM')} até {format(endDate, 'dd/MM')}
                </p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm">
                    Erro ao carregar dados: {(error as Error).message}
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-900/50 p-1 rounded-lg border border-border overflow-x-auto">
                {FILTER_TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeFilter === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveFilter(tab.key)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all ${isActive
                                    ? 'bg-blue-600/15 text-blue-400 border border-blue-600/30 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800 border border-transparent'
                                }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Meta Progress */}
            {metricas && metricas.meta_valor > 0 && (
                <MetaProgressBar
                    atingida={metricas.meta_atingida_pct}
                    meta={metricas.meta_valor}
                    faturamentoPV={metricas.faturamento_pv}
                />
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <SummaryCard
                    title="Faturamento PV"
                    value={metricas ? formatCurrency(metricas.faturamento_pv) : 'R$ 0'}
                    subtitle={`${metricas?.total_vendas_aprovadas || 0} vendas aprovadas`}
                    icon={DollarSign}
                    color="bg-emerald-500/15 text-emerald-400"
                    loading={isLoading}
                />
                <SummaryCard
                    title="Pendente PV"
                    value={metricas ? formatCurrency(metricas.faturamento_pendente_pv) : 'R$ 0'}
                    subtitle="Aguardando pagamento"
                    icon={TrendingUp}
                    color="bg-amber-500/15 text-amber-400"
                    loading={isLoading}
                />
                <SummaryCard
                    title="Afiliados Ativos"
                    value={String(metricas?.total_vendedoras || 0)}
                    subtitle={`${metricas?.total_vendas_pv || 0} vendas totais`}
                    icon={Users}
                    color="bg-blue-500/15 text-blue-400"
                    loading={isLoading}
                />
                <SummaryCard
                    title="Ticket Médio"
                    value={metricas ? formatCurrency(metricas.ticket_medio_geral) : 'R$ 0'}
                    subtitle="Média por venda aprovada"
                    icon={BarChart3}
                    color="bg-cyan-500/15 text-cyan-400"
                    loading={isLoading}
                />
                <SummaryCard
                    title="Conversão Geral"
                    value={`${metricas?.taxa_conversao_geral || 0}%`}
                    subtitle="Aprovadas / Total"
                    icon={Percent}
                    color="bg-indigo-500/15 text-indigo-400"
                    loading={isLoading}
                />
            </div>

            {/* Ranking Table */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-slate-900/30">
                    <div className="flex items-center gap-2.5">
                        <Award className="w-5 h-5 text-amber-400" />
                        <h3 className="text-sm font-semibold text-slate-200">Ranking</h3>
                        <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-border">
                            {filtered.length} {filtered.length === 1 ? 'afiliado' : 'afiliados'}
                        </span>
                    </div>
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 pr-3 py-1.5 text-sm bg-slate-800 border border-border rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 w-48"
                        />
                    </div>
                </div>

                {/* Column Headers (desktop) */}
                <div className="hidden md:flex items-center gap-4 px-5 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-border bg-slate-900/20">
                    <div className="w-8 text-center">#</div>
                    <div className="flex-1">Afiliado</div>
                    <div className="text-right min-w-[80px]">Faturamento</div>
                    <div className="text-right min-w-[70px]">Ticket Médio</div>
                    <div className="text-right min-w-[60px]">Conversão</div>
                    <div className="text-right min-w-[80px]">Comissão</div>
                    <div className="w-8" />
                </div>

                {/* Rows */}
                {isLoading ? (
                    <div className="p-6 space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <Skeleton className="h-9 w-9 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-40" />
                                    <Skeleton className="h-3 w-24" />
                                </div>
                                <Skeleton className="h-4 w-20" />
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">
                            {searchTerm
                                ? 'Nenhum afiliado encontrado com esse filtro.'
                                : 'Nenhuma venda de afiliado no período selecionado.'}
                        </p>
                    </div>
                ) : (
                    filtered.map((v, i) => (
                        <VendedoraRow
                            key={v.affiliate_id}
                            vendedora={v}
                            index={i}
                            isExpanded={expandedId === v.affiliate_id}
                            onToggle={() => setExpandedId(expandedId === v.affiliate_id ? null : v.affiliate_id)}
                            onClassify={handleClassify}
                        />
                    ))
                )}
            </div>

            {/* Footer Info */}
            {metricas && metricas.faturamento_periodo_anterior > 0 && (
                <div className="text-xs text-slate-600 text-center">
                    Faturamento do período anterior: {formatCurrency(metricas.faturamento_periodo_anterior)}
                    {' · '}Meta (15%): {formatCurrency(metricas.meta_valor)}
                </div>
            )}
        </div>
    );
};

export default DesempenhoVendedoras;
