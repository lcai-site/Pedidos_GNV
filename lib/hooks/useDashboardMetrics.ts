import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { DashboardMetrics } from '../../types';
import { toast } from 'sonner';

const EMPTY_METRICS: DashboardMetrics = {
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
};

async function fetchDashboardMetrics(startDate: Date, endDate: Date): Promise<DashboardMetrics> {
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    // Tenta usar RPC (muito mais rápido)
    const { data: rpcData, error: rpcError } = await supabase.rpc('dashboard_metrics', {
        p_start_date: startISO,
        p_end_date: endISO,
    });

    if (!rpcError && rpcData) {
        return rpcData as DashboardMetrics;
    }

    // Fallback: calcula no client (caso RPC não exista ainda)
    return fetchMetricsFallback(startISO, endISO);
}

async function fetchMetricsFallback(startISO: string, endISO: string): Promise<DashboardMetrics> {
    // Tentar com data_venda primeiro (é o campo correto para datas de venda)
    // Se falhar, tentar com created_at como fallback
    let salesData: any[] | null = null;
    let salesError: any = null;

    // Tentativa 1: filtrar por data_venda
    const res1 = await supabase
        .from('ticto_pedidos')
        .select('*')
        .gte('order_date', startISO)
        .lte('order_date', endISO);

    if (!res1.error && res1.data && res1.data.length > 0) {
        salesData = res1.data;
    } else {
        // Tentativa 2: filtrar por created_at
        const res2 = await supabase
            .from('ticto_pedidos')
            .select('*')
            .gte('created_at', startISO)
            .lte('created_at', endISO);

        if (res2.error) {
            return EMPTY_METRICS;
        }
        salesData = res2.data;
    }

    if (!salesData || salesData.length === 0) {
        return EMPTY_METRICS;
    }

    let approved = 0, countApproved = 0;
    let pending = 0, countPending = 0;
    let expired = 0, countExpired = 0;
    let refused = 0, countRefused = 0;
    let refunded = 0, countRefunded = 0;
    let pendingPix = 0, pendingOther = 0;

    salesData.forEach((order: any) => {
        const val = typeof order.paid_amount === 'number' ? order.paid_amount : parseFloat(order.paid_amount) || 0;
        const status = (order.status || '').toLowerCase().trim();
        const method = (order.payment_method || '').toLowerCase();

        if (['aprovado', 'pago', 'paid', 'approved', 'completed', 'succeeded', 'authorized'].includes(status)) {
            approved += val;
            countApproved++;
        } else if (['pendente', 'waiting payment', 'aguardando', 'pending', 'waiting_payment', 'processing'].includes(status)) {
            pending += val;
            countPending++;
            if (method.includes('pix')) {
                pendingPix += val;
            } else {
                pendingOther += val;
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


    // Secondary queries - Supabase client NÃO lança exceção, retorna { error }
    // Então precisamos checar error, não usar try/catch
    let awaitingShipment = 0;
    let lateSubscriptions = 0;
    let abandonedCarts = 0;

    const shipRes = await supabase
        .from('pedidos_consolidados_v3')
        .select('*', { count: 'exact', head: true })
        .eq('status_envio', 'Pendente')
        .gte('created_at', startISO)
        .lte('created_at', endISO);
    if (!shipRes.error) {
        awaitingShipment = shipRes.count || 0;
    }

    // assinaturas e carrinhos_abandonados podem não ter created_at
    // Consulta sem filtro de data (conta total)
    const subRes = await supabase
        .from('assinaturas')
        .select('*', { count: 'exact', head: true })
        .or('status.eq.Atrasada,status.eq.late,status.ilike.%atrasada%');
    if (!subRes.error) {
        lateSubscriptions = subRes.count || 0;
    }

    const cartRes = await supabase
        .from('view_recuperacao')
        .select('*', { count: 'exact', head: true });
    if (!cartRes.error) {
        abandonedCarts = cartRes.count || 0;
    }

    return {
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
        detalhePendente: { pix: pendingPix, boleto: pendingOther },
        aguardandoEnvio: awaitingShipment,
        assinaturasAtrasadas: lateSubscriptions,
        carrinhosHoje: abandonedCarts,
    };
}

export function useDashboardMetrics(startDate: Date, endDate: Date) {
    return useQuery<DashboardMetrics>({
        queryKey: ['dashboard-metrics', startDate.toISOString(), endDate.toISOString()],
        queryFn: () => fetchDashboardMetrics(startDate, endDate),
        placeholderData: (previousData) => previousData || EMPTY_METRICS,
        staleTime: 0, // Sempre buscar dados frescos quando o período mudar
        gcTime: 1000 * 60 * 5, // Manter em cache por 5 minutos
        retry: 1,
        refetchOnWindowFocus: false,
    });
}
