import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DashboardMetrics } from '../types';
import { DollarSign, Package, Clock, ShoppingBag, Wallet, Barcode, QrCode, XCircle, Ban, RefreshCcw } from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';
import { format } from 'date-fns';
import { useDateFilter } from '../context/DateFilterContext';

// Helper: Parser robusto para valores monetários
const parseCurrencyValue = (value: any): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    let clean = value.replace(/[^\d.,-]/g, '');
    const hasComma = clean.includes(',');
    const hasDot = clean.includes('.');

    if (hasComma && hasDot) {
      if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else {
        clean = clean.replace(/,/g, '');
      }
    } else if (hasComma) {
      clean = clean.replace(',', '.');
    }
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

// Helper: Tenta encontrar o método de pagamento
const getPaymentMethod = (order: any): string => {
  if (!order) return '';

  const directColumns = [
    order.metodo_pagamento,
    order.forma_pagamento,
    order.payment_method,
    order.method,
    order.tipo_pagamento,
    order.payment_type
  ];

  for (const col of directColumns) {
    if (col && typeof col === 'string') return col.toLowerCase();
  }

  // Deep check in metadata
  if (order.metadata && typeof order.metadata === 'object') {
    if (order.metadata.payment_method) return String(order.metadata.payment_method).toLowerCase();
    if (order.metadata.metodo_pagamento) return String(order.metadata.metodo_pagamento).toLowerCase();
    if (order.metadata.forma_pagamento) return String(order.metadata.forma_pagamento).toLowerCase();
    if (order.metadata.transaction?.payment_method) return String(order.metadata.transaction.payment_method).toLowerCase();
  }

  return '';
};

const MetricCard = ({ title, value, count, subtext, icon: Icon, loading, color, footer }: any) => (
  <div className="bg-surface border border-border p-6 rounded-xl shadow-sm hover:border-slate-700 transition-colors flex flex-col justify-between h-full">
    <div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-24 mt-2 mb-1" />
          ) : (
            <div className="flex items-baseline gap-2 mt-2 flex-wrap">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</h3>
              {count !== undefined && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-border">
                  {count} {count === 1 ? 'pedido' : 'pedidos'}
                </span>
              )}
            </div>
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
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 space-y-1">
        {footer}
      </div>
    )}
  </div>
);

export const Dashboard: React.FC = () => {
  const { startDate, endDate } = useDateFilter();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    faturamentoAprovado: 0,
    countAprovado: 0,
    faturamentoPendente: 0,
    countPendente: 0,
    faturamentoExpirado: 0,
    countExpirado: 0,
    faturamentoRecusado: 0,
    countRecusado: 0,
    faturamentoReembolsado: 0,
    countReembolsado: 0,
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
        const startISO = startDate.toISOString();
        const endISO = endDate.toISOString();

        console.log(`Fetching dashboard metrics from ${startISO} to ${endISO}`);

        // 1. Fetch sales (usando data_venda e deduplicando por CPF)
        const { data: salesData, error: salesError } = await supabase
          .from('pedidos')
          .select('*')
          .gte('data_venda', startISO)  // ✅ CORRIGIDO: usar data_venda
          .lte('data_venda', endISO)
          .limit(20000);

        if (salesError) {
          console.error("Error fetching sales:", salesError);
        }


        console.log(`📊 Total de vendas no período: ${salesData?.length || 0}`);
        console.log(`📅 Período: ${startISO} até ${endISO}`);

        let approved = 0;
        let countApproved = 0;

        let pending = 0;
        let countPending = 0;

        let expired = 0;
        let countExpired = 0;

        let refused = 0;
        let countRefused = 0;

        let refunded = 0;
        let countRefunded = 0;

        let pendingPix = 0;
        let pendingBoleto = 0;

        // ✅ Processar TODAS as vendas (cada registro é válido)
        (salesData || []).forEach(order => {

          const rawVal = order.valor_total ?? order.valor ?? order.amount ?? order.total ?? order.price;
          const val = parseCurrencyValue(rawVal);

          // ✅ CORRIGIDO: Normalizar status (case-insensitive)
          const status = (order.status || '').toLowerCase().trim();
          const method = getPaymentMethod(order);

          if (['aprovado', 'pago', 'paid', 'approved', 'completed', 'succeeded', 'authorized'].includes(status)) {
            approved += val;
            countApproved++;
          } else if (['pendente', 'waiting payment', 'aguardando', 'pending', 'waiting_payment', 'processing'].includes(status)) {
            pending += val;
            countPending++;

            // Categorizar por método de pagamento
            if (method.includes('pix')) {
              pendingPix += val;
            } else {
              // TUDO que não for Pix vai para "Outros" (incluindo sem método definido)
              pendingBoleto += val;
            }
          } else if (status.includes('expirado') || status.includes('expired')) {
            expired += val;
            countExpired++;
          } else if (status.includes('recusado') || status.includes('refused') || status.includes('denied') || status.includes('falha') || status.includes('failed')) {
            refused += val;
            countRefused++;
          } else if (status.includes('reembolsado') || status.includes('refunded') || status.includes('estornado')) {
            refunded += val;
            countRefunded++;
          }
        });

        // 🔍 DEBUG: Mostrar totais calculados
        console.log(`💰 APROVADO: ${countApproved} vendas = R$ ${approved.toFixed(2)}`);
        console.log(`⏳ PENDENTE: ${countPending} vendas = R$ ${pending.toFixed(2)}`);
        console.log(`❌ RECUSADO: ${countRefused} vendas = R$ ${refused.toFixed(2)}`);
        console.log(`⏰ EXPIRADO: ${countExpired} vendas = R$ ${expired.toFixed(2)}`);
        console.log(`💸 REEMBOLSADO: ${countRefunded} vendas = R$ ${refunded.toFixed(2)}`);

        // 2. Aguardando Envio (Logística)
        const { count: pendingCount } = await supabase
          .from('pedidos_consolidados_v3')
          .select('*', { count: 'exact', head: true })
          .eq('status_envio', 'Pendente')
          .gte('created_at', startISO)
          .lte('created_at', endISO);

        // 3. Assinaturas Atrasadas
        const { count: lateCount } = await supabase
          .from('assinaturas')
          .select('*', { count: 'exact', head: true })
          .or('status.eq.Atrasada,status.eq.late,status.eq.Late,status.ilike.%atrasada%')
          .gte('created_at', startISO)
          .lte('created_at', endISO);

        // 4. Carrinhos
        const { count: cartCount } = await supabase
          .from('carrinhos_abandonados')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startISO)
          .lte('created_at', endISO);

        setMetrics({
          faturamentoAprovado: approved,
          countAprovado: countApproved,
          faturamentoPendente: pending,
          countPendente: countPending,
          faturamentoExpirado: expired,
          countExpirado: countExpired,
          faturamentoRecusado: refused,
          countRecusado: countRefused,
          faturamentoReembolsado: refunded,
          countReembolsado: countRefunded,
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
  }, [startDate, endDate]);

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Visão Geral</h2>
        <p className="text-slate-500 dark:text-slate-400">Resumo da operação de {format(startDate, 'dd/MM')} até {format(endDate, 'dd/MM')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <MetricCard
          title="Total Vendas Confirmadas"
          value={formatCurrency(metrics.faturamentoAprovado)}
          count={metrics.countAprovado}
          subtext="Total Acumulado (Aprovados)"
          icon={DollarSign}
          loading={loading}
          color="bg-emerald-500 text-emerald-500"
        />

        <MetricCard
          title="Faturamento Pendente"
          value={formatCurrency(metrics.faturamentoPendente)}
          count={metrics.countPendente}
          icon={Wallet}
          loading={loading}
          color="bg-yellow-500 text-yellow-500"
          subtext="Contas a Receber (Total)"
          footer={
            <>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1"><QrCode className="w-3 h-3 text-teal-400" /> Pix:</span>
                <span className="text-slate-900 dark:text-slate-200">{formatCurrency(metrics.detalhePendente.pix)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1"><Barcode className="w-3 h-3 text-slate-400" /> Outros:</span>
                <span className="text-slate-900 dark:text-slate-200">{formatCurrency(metrics.detalhePendente.boleto)}</span>
              </div>
            </>
          }
        />

        <MetricCard
          title="Logística (Pendentes)"
          value={metrics.aguardandoEnvio}
          // Logística não tem valor monetário na métrica principal, apenas quantidade
          subtext="No período selecionado"
          icon={Package}
          loading={loading}
          color="bg-blue-500 text-blue-500"
        />
        <MetricCard
          title="Risco de Churn"
          value={metrics.assinaturasAtrasadas}
          subtext="Atrasadas (criadas no período)"
          icon={Clock}
          loading={loading}
          color="bg-red-500 text-red-500"
        />
        <MetricCard
          title="Carrinhos"
          value={metrics.carrinhosHoje}
          subtext="Abandonados no período"
          icon={ShoppingBag}
          loading={loading}
          color="bg-violet-500 text-violet-500"
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Métricas de Conversão & Perdas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            title="Expirado (Perdido)"
            value={formatCurrency(metrics.faturamentoExpirado)}
            count={metrics.countExpirado}
            subtext="Boletos ou Pix não pagos"
            icon={XCircle}
            loading={loading}
            color="bg-slate-500 text-slate-500"
          />
          <MetricCard
            title="Recusado (Cartão)"
            value={formatCurrency(metrics.faturamentoRecusado)}
            count={metrics.countRecusado}
            subtext="Transações negadas"
            icon={Ban}
            loading={loading}
            color="bg-orange-500 text-orange-500"
          />
          <MetricCard
            title="Reembolsado"
            value={formatCurrency(metrics.faturamentoReembolsado)}
            count={metrics.countReembolsado}
            subtext="Devoluções ou Estornos"
            icon={RefreshCcw}
            loading={loading}
            color="bg-rose-500 text-rose-500"
          />
        </div>
      </div>
    </div>
  );
};