import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { StatusBadge } from '../components/ui/StatusBadge';
import { TableSkeleton } from '../components/ui/Skeleton';
import { format } from 'date-fns';
import { MessageCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDateFilter } from '../context/DateFilterContext';
import { Pedido } from '../types';

// --- Sales Page ---
export const Sales: React.FC = () => {
  const { startDate, endDate } = useDateFilter();
  const [data, setData] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  // Pagination & Search State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to page 1 on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      try {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
          .from('pedidos')
          .select('*', { count: 'exact' })
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false })
          .range(from, to);

        if (debouncedSearch) {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(debouncedSearch);
          
          if (isUUID) {
            query = query.eq('id', debouncedSearch);
          } else {
             query = query.or(`cliente.ilike.%${debouncedSearch}%,cpf.ilike.%${debouncedSearch}%`);
          }
        }

        const { data: sales, count, error } = await query;

        if (error) throw error;
        
        setData(sales || []);
        setTotalCount(count || 0);
      } catch (err) {
        console.error("Erro ao buscar vendas:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, [startDate, endDate, page, pageSize, debouncedSearch]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Vendas Gerais</h2>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar por nome, CPF ou ID..." 
              className="w-full bg-white dark:bg-slate-950 border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span>Mostrar:</span>
            <select 
              value={pageSize} 
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="bg-white dark:bg-slate-950 border border-border rounded px-2 py-1.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-4"><TableSkeleton /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/80 border-b border-border">
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Valor</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Pagamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map((item) => {
                    const clientName = item.nome_cliente || item.cliente || item.nome || item.cliente_nome || item.name || item.full_name || 'Cliente Desconhecido';
                    const clientCpf = item.cpf || item.cliente_cpf || item.doc || item.documento || '';
                    const paymentMethod = item.metodo_pagamento || item.forma_pagamento || 'N/A';
                    
                    return (
                      <tr key={item.id} className="hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-300 whitespace-nowrap">
                          {item.created_at ? format(new Date(item.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                              <span className="text-slate-900 dark:text-slate-200 font-medium">{clientName}</span>
                              <span className="text-xs text-slate-500 font-mono">{clientCpf}</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-600 font-mono mt-0.5 truncate max-w-[150px]" title={item.id}>{item.id}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-900 dark:text-slate-200 font-medium">
                          {typeof item.valor_total === 'number' 
                            ? item.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : item.valor_total}
                        </td>
                        <td className="px-6 py-4"><StatusBadge status={item.status} /></td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 capitalize">{paymentMethod}</td>
                      </tr>
                    );
                  })}
                  {data.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-500">Nenhuma venda encontrada para os filtros aplicados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-border bg-slate-50 dark:bg-slate-900/30 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Mostrando {data.length > 0 ? (page - 1) * pageSize + 1 : 0} até {Math.min(page * pageSize, totalCount)} de {totalCount} registros
              </span>
              
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 px-2">
                  Página {page} de {totalPages || 1}
                </span>

                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || totalPages === 0}
                  className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
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

// --- Subscriptions Page ---
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
                {data.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-slate-500">Sem dados para o período selecionado.</td></tr>}
                </tbody>
            </table>
            
            {/* Pagination */}
            {data.length > 0 && (
                <div className="px-4 py-3 border-t border-border bg-slate-50 dark:bg-slate-900/30 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Total: {totalCount} assinaturas</span>
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

// --- Recovery Page ---
export const Recovery: React.FC = () => {
  const { startDate, endDate } = useDateFilter();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 21; // Multiple of 3 for grid layout

  useEffect(() => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    supabase.from('carrinhos_abandonados')
      .select('*', { count: 'exact' })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Recuperação de Carrinho</h2>
        <span className="text-sm text-slate-500">Total: {totalCount}</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <TableSkeleton /> : data.map((item) => (
            <div key={item.id} className="bg-surface border border-border p-5 rounded-xl flex flex-col justify-between hover:border-blue-500/50 transition-colors">
                <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-200">{item.nome_produto}</h3>
                    <p className="text-sm text-slate-500 mt-1">{item.telefone_cliente}</p>
                    <p className="text-xs text-slate-600 mt-4">{item.created_at ? format(new Date(item.created_at), 'dd/MM HH:mm') : ''}</p>
                </div>
                <div className="mt-4 flex gap-2">
                    <a 
                        href={`https://wa.me/${item.telefone_cliente?.replace(/\D/g,'')}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex-1 bg-green-500/10 text-green-600 dark:text-green-500 hover:bg-green-500/20 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors border border-green-500/20"
                    >
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                    </a>
                </div>
            </div>
        ))}
        {!loading && data.length === 0 && (
            <div className="col-span-full text-center text-slate-500 py-10">Nenhum carrinho abandonado no período.</div>
        )}
      </div>
      
      {/* Pagination for Grid */}
      {!loading && data.length > 0 && (
          <div className="flex justify-center gap-2 mt-6">
             <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-surface border border-border rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                Anterior
             </button>
             <span className="px-4 py-2 text-slate-700 dark:text-slate-300 font-medium">
                Página {page} de {totalPages || 1}
             </span>
             <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-surface border border-border rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                Próxima
             </button>
          </div>
      )}
    </div>
  );
};