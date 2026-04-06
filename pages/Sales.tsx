import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { StatusBadge } from '../components/ui/StatusBadge';
import { TableSkeleton } from '../components/ui/Skeleton';
import { format } from 'date-fns';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useDateFilter } from '../context/DateFilterContext';
import { Pedido } from '../types';

export const Sales: React.FC = () => {
    const { startDate, endDate } = useDateFilter();
    const [data, setData] = useState<Pedido[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [searchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Sincronizar busca se a URL mudar (ao clicar numa notificação)
    useEffect(() => {
        const searchUrl = searchParams.get('search');
        if (searchUrl && searchUrl !== searchTerm) {
            setSearchTerm(searchUrl);
        }
    }, [searchParams]);

    useEffect(() => {
        const fetchSales = async () => {
            setLoading(true);
            try {
                const from = (page - 1) * pageSize;
                const to = from + pageSize - 1;

                let query = supabase
                    .from('ticto_pedidos')
                    .select('*', { count: 'exact' })
                    .gte('order_date', startDate.toISOString())
                    .lte('order_date', endDate.toISOString())
                    .order('order_date', { ascending: false })
                    .range(from, to);

                if (debouncedSearch) {
                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(debouncedSearch);
                    if (isUUID) {
                        query = query.eq('id', debouncedSearch);
                    } else {
                        query = query.or(`customer_name.ilike.%${debouncedSearch}%,customer_cpf.ilike.%${debouncedSearch}%`);
                    }
                }

                const { data: sales, count, error } = await query;
                if (error) throw error;

                setData(sales || []);
                setTotalCount(count || 0);
            } catch (err) {
                console.error('Erro ao buscar vendas:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchSales();
    }, [startDate, endDate, page, pageSize, debouncedSearch]);

    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-black text-slate-100 tracking-tight uppercase">Vendas Gerais</h2>
                <div className="w-12 h-1 bg-[#a3e635]"></div>
            </div>

            <div className="bg-[#0f172a]/90 backdrop-blur-sm border border-slate-800 overflow-hidden relative">
                <div className="p-4 border-b border-slate-800/70 bg-[#020617]/50 flex flex-col sm:flex-row gap-4 justify-between items-center relative z-10">
                    <div className="relative w-full sm:w-96 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 group-focus-within:text-[#a3e635] transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, CPF ou ID..."
                            className="w-full bg-[#020617] border border-slate-800 rounded-none pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] transition-all font-mono placeholder:text-slate-600"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 font-mono">
                        <span>Mostrar:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                            className="bg-[#020617] border border-slate-800 rounded-none px-3 py-1.5 text-slate-200 focus:outline-none focus:border-[#a3e635] cursor-pointer"
                        >
                            <option value={25}>25 pxs</option>
                            <option value={50}>50 pxs</option>
                            <option value={100}>100 pxs</option>
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="p-4"><TableSkeleton /></div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left relative z-10">
                                <thead className="text-[10px] text-slate-400 uppercase tracking-widest bg-[#020617] border-b border-slate-800 font-mono">
                                    <tr>
                                        <th className="px-6 py-4 font-bold border-r border-slate-800/50">Data</th>
                                        <th className="px-6 py-4 font-bold border-r border-slate-800/50">Cliente/ID</th>
                                        <th className="px-6 py-4 font-bold border-r border-slate-800/50">Valor</th>
                                        <th className="px-6 py-4 font-bold border-r border-slate-800/50">Status</th>
                                        <th className="px-6 py-4 font-bold">Pagamento</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {data.map((item) => {
                                        const clientName = item.customer_name || 'Cliente Desconhecido';
                                        const clientCpf = item.customer_cpf || '';
                                        const paymentMethod = item.payment_method || 'N/A';

                                        return (
                                            <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group cursor-default">
                                                <td className="px-6 py-4 text-slate-400 font-mono text-xs whitespace-nowrap border-r border-slate-800/50 group-hover:text-slate-200">
                                                    {item.order_date ? format(new Date(item.order_date), 'dd/MM/yyyy HH:mm') : '-'}
                                                </td>
                                                <td className="px-6 py-4 border-r border-slate-800/50">
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-200 font-bold tracking-tight">{clientName}</span>
                                                        <span className="text-[11px] text-slate-500 font-mono mt-0.5">{clientCpf}</span>
                                                        <span className="text-[9px] text-slate-600 font-mono mt-1 w-32 truncate" title={item.id}>{item.id}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-100 font-black font-mono border-r border-slate-800/50 group-hover:text-[#a3e635] transition-colors">
                                                    {typeof item.paid_amount === 'number'
                                                        ? item.paid_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                        : item.paid_amount}
                                                </td>
                                                <td className="px-6 py-4 border-r border-slate-800/50"><StatusBadge status={item.status} /></td>
                                                <td className="px-6 py-4 text-slate-400 font-mono text-[11px] uppercase tracking-widest">{paymentMethod}</td>
                                            </tr>
                                        );
                                    })}
                                    {data.length === 0 && (
                                        <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-mono text-xs uppercase tracking-widest">Nenhuma venda encontrada no perímetro.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="px-4 py-3 border-t border-slate-800 bg-[#020617] flex items-center justify-between relative z-10">
                            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                                View: {data.length > 0 ? (page - 1) * pageSize + 1 : 0} - {Math.min(page * pageSize, totalCount)} / {totalCount} DATA_POINTS
                            </span>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-1 px-3 border border-slate-700 bg-slate-900 hover:border-[#a3e635] hover:text-[#a3e635] text-slate-400 disabled:opacity-30 disabled:hover:border-slate-700 disabled:hover:text-slate-400 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-[10px] font-mono font-bold text-slate-300 px-3 uppercase tracking-widest">
                                    PG {page} / {totalPages || 1}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages || totalPages === 0}
                                    className="p-1 px-3 border border-slate-700 bg-slate-900 hover:border-[#a3e635] hover:text-[#a3e635] text-slate-400 disabled:opacity-30 disabled:hover:border-slate-700 disabled:hover:text-slate-400 transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Sales;
