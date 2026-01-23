import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DashboardMetrics } from '../types';
import { DollarSign, Package, Clock, ShoppingBag, Wallet, Barcode, QrCode } from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';
import { startOfDay, format } from 'date-fns';

// Helper: Parser robusto para valores monetários (suporta number, string BR "1.000,00" e US "1000.00")
const parseCurrencyValue = (value: any): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  
  if (typeof value === 'string') {
    // Remove tudo que não é número, ponto, vírgula ou sinal negativo
    let clean = value.replace(/[^\d.,-]/g, '');
    
    // Detecção heurística de formato BR vs US
    const hasComma = clean.includes(',');
    const hasDot = clean.includes('.');

    if (hasComma && hasDot) {
      // Ex: 1.500,00 (BR) -> último separador é vírgula
      if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else {
        // Ex: 1,500.00 (US)
        clean = clean.replace(/,/g, '');
      }
    } else if (hasComma) {
      // Ex: 150,00 ou 1500,00
      clean = clean.replace(',', '.');
    }
    // Se só tem ponto (1500.00), o parseFloat já entende nativamente

    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

// Helper: Tenta encontrar o método de pagamento em várias estruturas possíveis
const getPaymentMethod = (order: any): string => {
  // 1. Tenta colunas diretas comuns
  const directColumns = [
    order.metodo_pagamento,
    order.forma_pagamento,
    order.payment_method,
    order.method,
    order.tipo_pagamento
  ];

  for (const col of directColumns) {
    if (col && typeof col === 'string') return col.toLowerCase();
  }

  // 2. Tenta buscar dentro de metadata (JSONB)
  if (order.metadata && typeof order.metadata === 'object') {
    // Ticto/Hotmart structure often puts it here
    if (order.metadata.payment_method) return String(order.metadata.payment_method).toLowerCase();
    if (order.metadata.metodo_pagamento) return String(order.metadata.metodo_pagamento).toLowerCase();
    if (order.metadata.forma_pagamento) return String(order.metadata.forma_pagamento).toLowerCase();
    
    // Sometimes nested deeper? (e.g. transaction.payment_method)
    if (order.metadata.transaction?.payment_method) return String(order.metadata.transaction.payment_method).toLowerCase();
  }

  return '';
};

const MetricCard = ({ title, value, subtext, icon: Icon, loading, color, footer }: any) => (
  <div className="bg-surface border border-border p-6 rounded-xl shadow-sm hover:border-slate-700 transition-colors flex flex-col justify-between h-full">
    <div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-24 mt-2 mb-1" />
          ) : (
            <h3 className="text-2xl font-bold text-slate-100 mt-2">{value}</h3>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
          <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-4 w-32 mt-2" />
      ) : (
        <div className="mt-2">
           {subtext && <p className="text-sm text-slate-500">{subtext}</p>}
        </div>
      )}
    </div>
    {footer && !loading && (
        <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400 space-y-1">
            {footer}
        </div>
    )}
  </div>
);

export const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    faturamentoAprovado: 0,
    faturamentoPendente: 0,
    detalhePendente: { pix: 0, boleto: 0 },
    aguardandoEnvio: 0,
    assinaturasAtrasadas: 0,
    carrinhosHoje: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const todayStart = startOfDay(new Date()).toISOString();

        console.log("Fetching dashboard metrics...");

        // 1. Fetch ALL sales
        const { data: salesData, error: salesError } = await supabase
          .from('pedidos')
          .select('*');

        if (salesError) {
            console.error("Error fetching sales:", salesError);
        } else {
            console.log("Raw Sales Data Loaded:", salesData?.length, "records");
        }

        let approved = 0;
        let pending = 0;
        let pendingPix = 0;
        let pendingBoleto = 0;

        (salesData || []).forEach(order => {
            // Use robust parser for value
            const val = parseCurrencyValue(order.valor_total);
            const status = (order.status || '').toLowerCase().trim();
            
            // Use robust finder for payment method
            const method = getPaymentMethod(order);

            if (['aprovado', 'pago', 'paid', 'approved', 'completed'].includes(status)) {
                approved += val;
            } else if (['pendente', 'waiting payment', 'aguardando', 'pending', 'waiting_payment'].includes(status)) {
                pending += val;
                
                if (method.includes('pix')) {
                    pendingPix += val;
                } else if (method.includes('boleto')) {
                    pendingBoleto += val;
                } else {
                    // Debug: Se estiver pendente mas não cair nem em pix nem boleto
                    // console.log("Método desconhecido para pendente:", method, order);
                }
            }
        });

        // 2. Aguardando Envio
        const { count: pendingCount, error: pendingError } = await supabase
          .from('pedidos_unificados')
          .select('*', { count: 'exact', head: true })
          .eq('status_envio', 'Pendente');

        // 3. Assinaturas Atrasadas
        const { count: lateCount, error: lateError } = await supabase
          .from('assinaturas')
          .select('*', { count: 'exact', head: true })
          .or('status.eq.Atrasada,status.eq.late,status.eq.Late,status.ilike.%atrasada%');

        // 4. Carrinhos Hoje
        const { count: cartCount, error: cartError } = await supabase
          .from('carrinhos_abandonados')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', todayStart);

        setMetrics({
          faturamentoAprovado: approved,
          faturamentoPendente: pending,
          detalhePendente: {
              pix: pendingPix,
              boleto: pendingBoleto
          },
          aguardandoEnvio: pendingCount || 0,
          assinaturasAtrasadas: lateCount || 0,
          carrinhosHoje: cartCount || 0,
        });

      } catch (error) {
        console.error('CRITICAL Error fetching metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Visão Geral</h2>
        <p className="text-slate-400">Resumo da operação em {format(new Date(), 'dd/MM/yyyy')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {/* Receita Aprovada */}
        <MetricCard
          title="Receita Total"
          value={formatCurrency(metrics.faturamentoAprovado)}
          subtext="Total Acumulado (Aprovados)"
          icon={DollarSign}
          loading={loading}
          color="bg-emerald-500 text-emerald-500"
        />

        {/* Receita Pendente (Com detalhe) */}
        <MetricCard
          title="Faturamento Pendente"
          value={formatCurrency(metrics.faturamentoPendente)}
          icon={Wallet}
          loading={loading}
          color="bg-yellow-500 text-yellow-500"
          subtext="Contas a Receber (Total)"
          footer={
            <>
                <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1"><QrCode className="w-3 h-3 text-teal-400"/> Pix:</span>
                    <span className="text-slate-200">{formatCurrency(metrics.detalhePendente.pix)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1"><Barcode className="w-3 h-3 text-slate-400"/> Boleto:</span>
                    <span className="text-slate-200">{formatCurrency(metrics.detalhePendente.boleto)}</span>
                </div>
            </>
          }
        />

        {/* Métricas Operacionais */}
        <MetricCard
          title="Logística (Backlog)"
          value={metrics.aguardandoEnvio}
          subtext="Pedidos parados"
          icon={Package}
          loading={loading}
          color="bg-blue-500 text-blue-500"
        />
        <MetricCard
          title="Risco de Churn"
          value={metrics.assinaturasAtrasadas}
          subtext="Assinaturas atrasadas"
          icon={Clock}
          loading={loading}
          color="bg-red-500 text-red-500"
        />
        <MetricCard
          title="Carrinhos (Hoje)"
          value={metrics.carrinhosHoje}
          subtext="Oportunidade recente"
          icon={ShoppingBag}
          loading={loading}
          color="bg-violet-500 text-violet-500"
        />
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border p-6 rounded-xl h-64 flex items-center justify-center text-slate-500">
          <p>Gráfico de Conversão (Pix vs Boleto)</p>
        </div>
        <div className="bg-surface border border-border p-6 rounded-xl h-64 flex items-center justify-center text-slate-500">
           <p>Fluxo de Expedição</p>
        </div>
      </div>
    </div>
  );
};
