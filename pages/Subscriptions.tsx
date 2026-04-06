import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { StatusBadge } from '../components/ui/StatusBadge';
import { TableSkeleton } from '../components/ui/Skeleton';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDateFilter } from '../context/DateFilterContext';

export const Subscriptions: React.FC = () => {
    const { startDate, endDate } = useDateFilter();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 20;

    useEffect(() => {
        setLoading(true);
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        supabase.from('assinaturas')
            .select('*', { count: 'exact' })
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('proxima_cobranca', { ascending: true })
            .range(from, to)
            .then(({ data, count }) => {
                setData(data || []);
                setTotalCount(count || 0);
                setLoading(false);
            });
    }, [startDate, endDate, page]);

    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Assinaturas Recorrentes</h2>
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
                {loading ? <div className="p-4"><TableSkeleton /></div> : (
                    <>
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/80 border-b border-border">
                                <tr>
                                    <th className="px-6 py-4">Plano</th>
                                    <th className="px-6 py-4">Próxima Cobrança</th>
                                    <th className="px-6 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {data.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-100 dark:hover:bg-slate-800/50">
                                        <td className="px-6 py-4 text-slate-900 dark:text-slate-200 font-medium">{item.plano}</td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-300">{item.proxima_cobranca ? format(new Date(item.proxima_cobranca), 'dd/MM/yyyy') : '-'}</td>
                                        <td className="px-6 py-4"><StatusBadge status={item.status} /></td>
                                    </tr>
                                ))}
                                {data.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-slate-500 dark:text-slate-400">Sem dados para o período selecionado.</td></tr>}
                            </tbody>
                        </table>

                        {data.length > 0 && (
                            <div className="px-4 py-3 border-t border-border bg-slate-50 dark:bg-slate-900/30 flex items-center justify-between">
                                <span className="text-xs text-slate-500 dark:text-slate-400">Total: {totalCount} assinaturas</span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 disabled:opacity-50"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 px-2">{page} / {totalPages || 1}</span>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 disabled:opacity-50"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Subscriptions;
