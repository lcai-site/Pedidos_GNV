import React from 'react';
import { 
  DollarSign, 
  Package, 
  Clock, 
  ShoppingBag, 
  Wallet, 
  QrCode, 
  XCircle, 
  RefreshCcw, 
  AlertTriangle,
  TrendingUp,
  Users,
  Truck,
  CreditCard,
  BarChart3,
  ArrowRight,
  Zap,
  Target,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import { MetricCard } from '../components/ui/MetricCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { QuickStat, QuickStatsGrid } from '../components/ui/QuickStat';
import { ActivityItem, ActivityList } from '../components/ui/ActivityItem';
import { useDateFilter } from '../context/DateFilterContext';
import { useDashboardMetrics } from '../lib/hooks/useDashboardMetrics';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useAuth } from '../lib/contexts/AuthContext';

// Mock sparkline data
const generateSparkline = (base: number, variance: number = 0.2): number[] => {
  return Array.from({ length: 12 }, (_, i) => {
    const randomFactor = 1 + (Math.random() - 0.5) * variance;
    return Math.round(base * randomFactor * (1 + i * 0.02));
  });
};

// Loading skeleton para métricas
const MetricsSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
        <div className="animate-pulse space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-3 w-24 rounded bg-slate-800" />
              <div className="h-8 w-32 rounded bg-slate-800" />
            </div>
            <div className="h-12 w-12 rounded-xl bg-slate-800" />
          </div>
          <div className="h-8 rounded bg-slate-800/50" />
        </div>
      </div>
    ))}
  </div>
);

export const Dashboard: React.FC = () => {
  const { startDate, endDate } = useDateFilter();
  const { data: metrics, isLoading: loading, error } = useDashboardMetrics(startDate, endDate);
  const auth = useAuth();

  const formatCurrency = (val: number) => 
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const dateRangeLabel = `${format(startDate, 'dd/MM', { locale: ptBR })} - ${format(endDate, 'dd/MM', { locale: ptBR })}`;

  // Mock data para sparklines
  const mockTrends = {
    approved: generateSparkline(5000),
    pending: generateSparkline(2000),
    expired: generateSparkline(500),
    refunded: generateSparkline(300),
  };

  // Calcular taxas e comparativos
  const totalVendas = (metrics?.countAprovado || 0) + (metrics?.countPendente || 0) + (metrics?.countExpirado || 0);
  const taxaConversao = totalVendas > 0 ? ((metrics?.countAprovado || 0) / totalVendas * 100).toFixed(1) : '0.0';
  const ticketMedio = (metrics?.faturamentoAprovado || 0) / (metrics?.countAprovado || 1);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-rose-500 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Erro ao carregar dados</h3>
            <p className="text-sm opacity-80">{(error as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section com Gradient */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-slate-800 p-8">
        {/* Background Effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-medium text-emerald-400">Dashboard</span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
                Visão Geral da Operação
              </h1>
              <p className="text-slate-400 max-w-xl">
                Acompanhe suas métricas de vendas, envios e performance em tempo real. 
                Período: <span className="text-slate-200 font-medium">{dateRangeLabel}</span>
              </p>
            </div>
            
            {/* Quick Stats Row */}
            <div className="flex flex-wrap gap-3">
              <QuickStat
                label="Aguardando Envio"
                value={metrics?.aguardandoEnvio || 0}
                icon={Truck}
                color="warning"
                loading={loading}
              />
              <QuickStat
                label="Assinaturas"
                value={metrics?.assinaturasAtrasadas || 0}
                icon={Clock}
                color="danger"
                loading={loading}
              />
              <QuickStat
                label="Carrinhos"
                value={metrics?.carrinhosHoje || 0}
                icon={ShoppingBag}
                color="info"
                loading={loading}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <MetricsSkeleton />
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {/* Vendas Aprovadas - Card Destaque */}
            <MetricCard
              title="Vendas Confirmadas"
              value={formatCurrency(metrics?.faturamentoAprovado || 0)}
              count={metrics?.countAprovado}
              subtitle="Total acumulado no período"
              icon={DollarSign}
              color="emerald"
              trend={12.5}
              trendLabel="vs período anterior"
              loading={loading}
              sparklineData={mockTrends.approved}
              footer={
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-slate-500">Ticket médio:</span>
                  </div>
                  <span className="font-semibold text-emerald-400">
                    {formatCurrency(ticketMedio)}
                  </span>
                </div>
              }
            />

            {/* Taxa de Conversão - Card Especial */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800/50 p-6 transition-all duration-300 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Taxa de Conversão</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <h3 className="text-3xl font-bold text-white">{taxaConversao}%</h3>
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                        <ArrowUpRight className="h-3 w-3" />
                        +2.3%
                      </span>
                    </div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Zap className="h-6 w-6" />
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000"
                      style={{ width: `${Math.min(parseFloat(taxaConversao), 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{metrics?.countAprovado || 0} aprovados</span>
                    <span>Meta: 15%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Faturamento Pendente */}
            <MetricCard
              title="Faturamento Pendente"
              value={formatCurrency(metrics?.faturamentoPendente || 0)}
              count={metrics?.countPendente}
              subtitle="Aguardando pagamento"
              icon={Clock}
              color="amber"
              trend={-5.2}
              trendLabel="vs período anterior"
              loading={loading}
              sparklineData={mockTrends.pending}
              footer={
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      PIX
                    </span>
                    <span className="font-medium text-slate-300">
                      {formatCurrency(metrics?.detalhePendente?.pix || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      Boleto
                    </span>
                    <span className="font-medium text-slate-300">
                      {formatCurrency(metrics?.detalhePendente?.boleto || 0)}
                    </span>
                  </div>
                </div>
              }
            />

            {/* Vendas Expiradas */}
            <MetricCard
              title="Vendas Expiradas"
              value={formatCurrency(metrics?.faturamentoExpirado || 0)}
              count={metrics?.countExpirado}
              subtitle="PIX/Boleto não pagos"
              icon={XCircle}
              color="rose"
              trend={3.1}
              trendLabel="vs período anterior"
              loading={loading}
              sparklineData={mockTrends.expired}
              footer={
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Taxa de expiração:</span>
                  <span className="font-semibold text-rose-400">
                    {totalVendas > 0 ? ((metrics?.countExpirado || 0) / totalVendas * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
              }
            />

            {/* Vendas Recusadas */}
            <MetricCard
              title="Vendas Recusadas"
              value={formatCurrency(metrics?.faturamentoRecusado || 0)}
              count={metrics?.countRecusado}
              subtitle="Cartão recusado ou cancelado"
              icon={CreditCard}
              color="slate"
              loading={loading}
            />

            {/* Reembolsos */}
            <MetricCard
              title="Reembolsos"
              value={formatCurrency(metrics?.faturamentoReembolsado || 0)}
              count={metrics?.countReembolsado}
              subtitle="Chargebacks e reembolsos"
              icon={RefreshCcw}
              color="violet"
              trend={-2.4}
              trendLabel="vs período anterior"
              loading={loading}
              sparklineData={mockTrends.refunded}
              footer={
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Taxa de reembolso:</span>
                  <span className="font-semibold text-violet-400">
                    {((metrics?.countReembolsado || 0) / (metrics?.countAprovado || 1) * 100).toFixed(2)}%
                  </span>
                </div>
              }
            />
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Recent Activity - ocupa 2 colunas */}
            <div className="lg:col-span-2">
              <ActivityList title="Atividade Recente">
                <ActivityItem
                  icon={Package}
                  iconColor="emerald"
                  title="Etiquetas geradas em lote"
                  description="47 pedidos processados para envio"
                  timestamp="Há 5 min"
                  status="success"
                />
                <ActivityItem
                  icon={DollarSign}
                  iconColor="emerald"
                  title="Venda aprovada"
                  description="R$ 297,00 • Maria Silva • DP - Compre 2 Leve 3"
                  timestamp="Há 12 min"
                  status="success"
                />
                <ActivityItem
                  icon={Truck}
                  iconColor="blue"
                  title="Pedido enviado"
                  description="BR123456789 • João Pereira"
                  timestamp="Há 32 min"
                  status="pending"
                />
                <ActivityItem
                  icon={AlertTriangle}
                  iconColor="amber"
                  title="Estoque baixo"
                  description="Bela Forma • Apenas 12 unidades"
                  timestamp="Há 1 hora"
                  status="warning"
                />
              </ActivityList>
            </div>

            {/* Quick Actions & Insights */}
            <div className="space-y-5">
              {/* Ações Rápidas */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  Ações Rápidas
                </h3>
                <div className="space-y-3">
                  {auth.can('logistics:view') && (
                    <button className="group flex w-full items-center justify-between rounded-xl bg-slate-800/50 p-3 transition-all duration-200 hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-transparent">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                          <Package className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-slate-200">Processar Envios</p>
                          <p className="text-xs text-slate-500">{metrics?.aguardandoEnvio || 0} pendentes</p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-emerald-400" />
                    </button>
                  )}
                  
                  {auth.can('assinaturas:view') && (
                    <button className="group flex w-full items-center justify-between rounded-xl bg-slate-800/50 p-3 transition-all duration-200 hover:bg-amber-500/10 hover:border-amber-500/30 border border-transparent">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 transition-colors group-hover:bg-amber-500 group-hover:text-white">
                          <RefreshCcw className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-slate-200">Assinaturas</p>
                          <p className="text-xs text-slate-500">{metrics?.assinaturasAtrasadas || 0} atrasadas</p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-amber-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* Performance Insight Card */}
              <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-900/5 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-emerald-400">Bom desempenho!</h4>
                    <p className="mt-1 text-sm text-slate-400">
                      Suas vendas estão <span className="font-semibold text-emerald-300">+12.5%</span> em relação ao período anterior.
                    </p>
                  </div>
                </div>
              </div>

              {/* Alert Card */}
              {(metrics?.aguardandoEnvio || 0) > 10 && (
                <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-900/5 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-amber-400">Atenção</h4>
                      <p className="mt-1 text-sm text-slate-400">
                        <span className="font-semibold text-amber-300">{metrics?.aguardandoEnvio} pedidos</span> aguardando despacho. Processar em até 24h.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
