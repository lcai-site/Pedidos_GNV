import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { StatusBadge } from '../components/ui/StatusBadge';
import { TableSkeleton } from '../components/ui/Skeleton';
import { format } from 'date-fns';
import { MessageCircle } from 'lucide-react';

// --- Sales Page ---
export const Sales: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('pedidos').select('*').order('created_at', { ascending: false })
      .then(({ data, error }) => { 
        if (error) console.error("Erro ao buscar vendas:", error);
        if (data && data.length > 0) console.log("Exemplo de venda:", data[0]); // Debug para ver as colunas reais
        setData(data || []); 
        setLoading(false); 
      });
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100">Vendas Gerais</h2>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? <div className="p-4"><TableSkeleton /></div> : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/80 border-b border-border">
              <tr>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((item) => {
                // Priorizando 'nome_cliente' conforme solicitado
                const clientName = item.nome_cliente || item.cliente || item.nome || item.cliente_nome || item.name || item.full_name || 'Cliente Desconhecido';
                const clientCpf = item.cpf || item.cliente_cpf || item.doc || item.documento || '';
                
                return (
                  <tr key={item.id} className="hover:bg-slate-800/50">
                    <td className="px-6 py-4 text-slate-300">
                      {item.created_at ? format(new Date(item.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                          <span className="text-slate-200 font-medium">{clientName}</span>
                          {clientCpf && <span className="text-xs text-slate-500">{clientCpf}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-200">
                      {item.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={item.status} /></td>
                  </tr>
                );
              })}
              {data.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">Sem dados.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// --- Subscriptions Page ---
export const Subscriptions: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('assinaturas').select('*').order('proxima_cobranca', { ascending: true })
      .then(({ data }) => { setData(data || []); setLoading(false); });
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100">Assinaturas Recorrentes</h2>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? <div className="p-4"><TableSkeleton /></div> : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/80 border-b border-border">
              <tr>
                <th className="px-6 py-4">Plano</th>
                <th className="px-6 py-4">Próxima Cobrança</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/50">
                  <td className="px-6 py-4 text-slate-200 font-medium">{item.plano}</td>
                  <td className="px-6 py-4 text-slate-300">{item.proxima_cobranca ? format(new Date(item.proxima_cobranca), 'dd/MM/yyyy') : '-'}</td>
                  <td className="px-6 py-4"><StatusBadge status={item.status} /></td>
                </tr>
              ))}
               {data.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-slate-500">Sem dados.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// --- Recovery Page ---
export const Recovery: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('carrinhos_abandonados').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setData(data || []); setLoading(false); });
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100">Recuperação de Carrinho</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <TableSkeleton /> : data.map((item) => (
            <div key={item.id} className="bg-surface border border-border p-5 rounded-xl flex flex-col justify-between hover:border-blue-500/50 transition-colors">
                <div>
                    <h3 className="font-semibold text-slate-200">{item.nome_produto}</h3>
                    <p className="text-sm text-slate-500 mt-1">{item.telefone_cliente}</p>
                    <p className="text-xs text-slate-600 mt-4">{item.created_at ? format(new Date(item.created_at), 'dd/MM HH:mm') : ''}</p>
                </div>
                <div className="mt-4 flex gap-2">
                    <a 
                        href={`https://wa.me/${item.telefone_cliente?.replace(/\D/g,'')}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex-1 bg-green-600/20 text-green-500 hover:bg-green-600/30 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                    </a>
                </div>
            </div>
        ))}
        {!loading && data.length === 0 && (
            <div className="col-span-full text-center text-slate-500 py-10">Nenhum carrinho abandonado recente.</div>
        )}
      </div>
    </div>
  );
};
