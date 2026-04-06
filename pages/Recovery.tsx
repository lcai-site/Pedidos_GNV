import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { 
  MessageCircle, 
  RefreshCw, 
  AlertCircle, 
  Search, 
  Copy, 
  CheckCircle2,
  ShoppingCart,
  Clock,
  XCircle,
  Trash2,
  ExternalLink,
  Send,
  Filter,
  TrendingUp,
  Users,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useDateFilter } from '../context/DateFilterContext';
import { SectionHeader } from '../components/ui/SectionHeader';
import { QuickStat } from '../components/ui/QuickStat';
import { toast } from 'sonner';

interface RecoveryItem {
  id: string;
  transaction_hash: string;
  order_date: string;
  status: string;
  status_label: string;
  payment_method: string;
  paid_amount: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  product_name: string;
  offer_name: string;
  link_pagamento: string;
  transaction_pix_qr_code: string;
  transaction_bank_slip_code: string;
  utm_source: string;
  utm_campaign: string;
  prioridade: number;
  contatado?: boolean;
  data_contato_recuperacao?: string;
}

type StatusFilter = 'todos' | 'Carrinho Abandonado' | 'Pendente' | 'Recusado' | 'Cancelado' | 'Expirado';

export const Recovery: React.FC = () => {
  const navigate = useNavigate();
  const { startDate, endDate } = useDateFilter();
  const [data, setData] = useState<RecoveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pageSize = 12;

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Tentar usar a view primeiro
      let query = supabase
        .from('view_recuperacao')
        .select('*', { count: 'exact' })
        .gte('order_date', startDate.toISOString())
        .lte('order_date', endDate.toISOString())
        // Excluir qualquer variante de sucesso (Ticto, ViralMart, Manual)
        .not('status', 'in', '("authorized","approved","paid","completed","refunded","Aprovado","Pago","Aguardando Envio","Sucesso")') 
        .order('prioridade', { ascending: true })
        .order('order_date', { ascending: false })
        .range(from, to);

      // Aplicar filtro de status se não for "todos"
      if (statusFilter !== 'todos') {
        query = query.eq('status_label', statusFilter);
      }

      if (searchTerm) {
        query = query.or(`customer_name.ilike.%${searchTerm}%,customer_email.ilike.%${searchTerm}%,customer_phone.ilike.%${searchTerm}%`);
      }

      const { data: result, count, error: queryError } = await query;

      // Se a view não existir, fazer fallback para a tabela direta
      if (queryError && queryError.message?.includes('view_recuperacao')) {
        console.log('View não encontrada, usando fallback...');
        await fetchDataFallback();
        return;
      }

      if (queryError) {
        setErrorMsg(queryError.message);
        toast.error(`Erro: ${queryError.message}`);
        return;
      }

      setData(result || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('Erro ao buscar recuperação:', err);
      setErrorMsg(err?.message || 'Erro desconhecido');
      toast.error(`Erro ao carregar: ${err?.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  // Fallback: query direta na tabela se a view não existir
  const fetchDataFallback = async () => {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();

      let query = supabase
        .from('ticto_pedidos')
        .select('*', { count: 'exact' })
        .gte('order_date', startISO)
        .lte('order_date', endISO)
        // Excluir rigorosamente qualquer venda que já foi confirmada
        .not('status', 'in', '("authorized","approved","paid","completed","refunded","chargeback","Pre-Order","Aprovado","Pago","Aguardando Envio","Sucesso")')
        .order('order_date', { ascending: false })
        .range(from, to);

      if (searchTerm) {
        query = query.or(`customer_name.ilike.%${searchTerm}%,customer_email.ilike.%${searchTerm}%,customer_phone.ilike.%${searchTerm}%`);
      }

      const { data: result, count, error } = await query;

      if (error) throw error;

      // Mapear para o formato esperado
      const mappedData: RecoveryItem[] = (result || []).map((item: any) => ({
        id: item.id,
        transaction_hash: item.transaction_hash,
        order_date: item.order_date,
        status: item.status,
        status_label: getStatusLabel(item.status),
        payment_method: item.payment_method,
        paid_amount: item.paid_amount || 0,
        customer_name: item.customer_name,
        customer_email: item.customer_email,
        customer_phone: item.customer_phone,
        product_name: item.product_name,
        offer_name: item.offer_name,
        link_pagamento: item.transaction_pix_url || item.transaction_bank_slip_url || item.checkout_url,
        transaction_pix_qr_code: item.transaction_pix_qr_code,
        transaction_bank_slip_code: item.transaction_bank_slip_code,
        utm_source: item.utm_source,
        utm_campaign: item.utm_campaign,
        prioridade: getPrioridade(item.status),
        contatado: item.contatado_recuperacao || false,
        data_contato_recuperacao: item.data_contato_recuperacao,
      }));

      // Aplicar filtro de status manualmente
      let filteredData = mappedData;
      if (statusFilter !== 'todos') {
        filteredData = mappedData.filter(item => item.status_label === statusFilter);
      }

      setData(filteredData);
      setTotalCount(count || 0);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro no fallback');
      toast.error(`Erro fallback: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string): string => {
    const statusMap: Record<string, string> = {
      'cart_abandoned': 'Carrinho Abandonado',
      'abandoned': 'Carrinho Abandonado',
      'waiting_payment': 'Pendente',
      'pending': 'Pendente',
      'refused': 'Recusado',
      'denied': 'Recusado',
      'failed': 'Recusado',
      'canceled': 'Cancelado',
      'cancelled': 'Cancelado',
      'expired': 'Expirado',
      'chargeback': 'Chargeback',
    };
    return statusMap[status] || status;
  };

  const getPrioridade = (status: string): number => {
    if (['cart_abandoned', 'abandoned'].includes(status)) return 0;
    if (['waiting_payment', 'pending'].includes(status)) return 1;
    if (['refused', 'denied', 'failed'].includes(status)) return 2;
    if (['canceled', 'cancelled'].includes(status)) return 3;
    return 4;
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, page, statusFilter]);

  // Debounce na busca
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) setPage(1);
      else fetchData();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'Carrinho Abandonado': 
        return { 
          color: 'violet', 
          bg: 'bg-violet-500/10', 
          text: 'text-violet-400', 
          border: 'border-violet-500/20',
          icon: ShoppingCart,
          label: 'Abandono'
        };
      case 'Pendente': 
        return { 
          color: 'amber', 
          bg: 'bg-amber-500/10', 
          text: 'text-amber-400', 
          border: 'border-amber-500/20',
          icon: Clock,
          label: 'Pendente'
        };
      case 'Recusado': 
        return { 
          color: 'rose', 
          bg: 'bg-rose-500/10', 
          text: 'text-rose-400', 
          border: 'border-rose-500/20',
          icon: XCircle,
          label: 'Recusado'
        };
      case 'Cancelado': 
        return { 
          color: 'slate', 
          bg: 'bg-slate-500/10', 
          text: 'text-slate-400', 
          border: 'border-slate-500/20',
          icon: Trash2,
          label: 'Cancelado'
        };
      case 'Expirado': 
        return { 
          color: 'orange', 
          bg: 'bg-orange-500/10', 
          text: 'text-orange-400', 
          border: 'border-orange-500/20',
          icon: Clock,
          label: 'Expirado'
        };
      default: 
        return { 
          color: 'blue', 
          bg: 'bg-blue-500/10', 
          text: 'text-blue-400', 
          border: 'border-blue-500/20',
          icon: AlertCircle,
          label: status
        };
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, '');
    // Se começar com 55 (Brasil), mantém, senão adiciona
    return clean.startsWith('55') ? clean : `55${clean}`;
  };

  const formatPhoneDisplay = (phone: string | null) => {
    if (!phone) return 'N/D';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 13) { // +55 + DDD + 9 dígitos
      return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 5)} ${clean.slice(5, 9)}-${clean.slice(9)}`;
    }
    return `+${clean}`;
  };

  // Verificar se cliente já comprou o produto após o abandono
  const checkIfCustomerAlreadyBought = async (item: RecoveryItem): Promise<boolean> => {
    try {
      // Buscar pedidos aprovados do mesmo cliente com mesmo produto após a data do abandono
      const { data: approvedOrders, error } = await supabase
        .from('ticto_pedidos')
        .select('*')
        .eq('customer_email', item.customer_email)
        .ilike('product_name', `%${item.product_name}%`)
        .in('status', ['authorized', 'approved', 'paid', 'completed'])
        .gt('order_date', item.order_date);

      if (error) {
        console.error('Erro ao verificar compras:', error);
        return false;
      }

      // Se encontrou pedidos aprovados, o cliente já comprou
      return approvedOrders && approvedOrders.length > 0;
    } catch (err) {
      console.error('Erro na verificação:', err);
      return false;
    }
  };

  const handleWhatsAppClick = async (item: RecoveryItem) => {
    const phone = formatPhone(item.customer_phone);
    if (!phone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }

    // Verificar se o cliente já comprou o produto
    toast.info('Verificando se cliente já comprou...', { duration: 2000 });
    const alreadyBought = await checkIfCustomerAlreadyBought(item);
    
    if (alreadyBought) {
      toast.warning('Cliente já comprou este produto após o abandono. Mensagem não enviada.', {
        duration: 5000,
        description: 'O pedido será marcado como não necessita contato.'
      });
      
      // Marcar como contatado para não aparecer novamente
      setData(prevData => prevData.filter(d => d.id !== item.id));
      
      await supabase
        .from('ticto_pedidos')
        .update({ 
          contatado_recuperacao: true, 
          data_contato_recuperacao: new Date().toISOString(),
          observacao_recuperacao: 'Cliente já comprou o produto posteriormente'
        })
        .eq('id', item.id);
      
      return;
    }

    const primeiroNome = item.customer_name?.split(' ')[0] || 'Cliente';
    const valor = item.paid_amount?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '';
    
    // Mensagem de recuperação pré-preenchida no chat interno
    const mensagemTexto = 
      `Olá ${primeiroNome}!` +
      `\n\n` +
      `Notamos que você iniciou uma compra de ${item.product_name}${valor ? ` no valor de ${valor}` : ''}, ` +
      `mas não conseguiu finalizar.` +
      `\n\n` +
      `Posso ajudar com alguma informação ou esclarecer alguma dúvida? ` +
      `Estamos aqui para garantir que você tenha a melhor experiência!`;

    // Marca como contatado localmente
    setData(prevData => prevData.map(d =>
      d.id === item.id ? { ...d, contatado: true } : d
    ));

    // Marca no Supabase
    try {
      await supabase
        .from('ticto_pedidos')
        .update({ contatado_recuperacao: true, data_contato_recuperacao: new Date().toISOString() })
        .eq('id', item.id);
    } catch (error) {
      console.error('Erro ao marcar como contatado:', error);
    }

    // Navega para o CRM Chat com dados e mensagem pré-preenchida
    navigate(
      `/crm/chat?tel=${phone}` +
      `&name=${encodeURIComponent(item.customer_name || '')}` +
      `&email=${encodeURIComponent(item.customer_email || '')}` +
      `&msg=${encodeURIComponent(mensagemTexto)}`
    );
  };

  // Estatísticas
  const stats = {
    total: data.length,
    carrinhos: data.filter(d => d.status_label === 'Carrinho Abandonado').length,
    pendentes: data.filter(d => d.status_label === 'Pendente').length,
    recusados: data.filter(d => d.status_label === 'Recusado').length,
    contatados: data.filter(d => d.contatado).length,
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const statusOptions: StatusFilter[] = ['todos', 'Carrinho Abandonado', 'Pendente', 'Recusado', 'Cancelado', 'Expirado'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="Recuperação de Vendas"
        subtitle="Oportunidades de recuperar carrinhos abandonados e vendas não concluídas"
        icon={TrendingUp}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickStat
          label="Total Oportunidades"
          value={totalCount}
          icon={ShoppingCart}
          color="info"
          loading={loading}
        />
        <QuickStat
          label="Carrinhos Abandonados"
          value={stats.carrinhos}
          icon={ShoppingCart}
          color="warning"
          loading={loading}
        />
        <QuickStat
          label="Pagamentos Pendentes"
          value={stats.pendentes}
          icon={Clock}
          color="amber"
          loading={loading}
        />
        <QuickStat
          label="Contatados"
          value={stats.contatados}
          icon={CheckCircle2}
          color="success"
          loading={loading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between p-4 rounded-2xl border border-slate-800 bg-slate-900/50">
        {/* Status Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                statusFilter === status
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {status === 'todos' ? 'Todos' : status}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou telefone..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={fetchData} 
            className="p-2.5 bg-slate-800/50 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/20 shrink-0">
              <AlertCircle className="h-6 w-6 text-rose-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-rose-400">Erro ao carregar dados</h3>
              <p className="text-sm text-rose-300/80 mt-1">{errorMsg}</p>
              <div className="mt-3 p-3 rounded-lg bg-rose-950/50 border border-rose-500/20">
                <p className="text-xs text-rose-200/70">
                  <strong>Solução:</strong> Execute as migrations no Supabase para criar a view de recuperação.
                  Arquivos: <code>046_add_crm_contact_tracking.sql</code> e <code>047_add_contact_date_tracking.sql</code>
                </p>
              </div>
              <button 
                onClick={fetchData}
                className="mt-3 px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 rounded-2xl border border-slate-800 bg-slate-900/30 animate-pulse" />
          ))}
        </div>
      ) : !errorMsg && data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-slate-800 bg-slate-900/30 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
            <ShoppingCart className="w-10 h-10 text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-300">Nenhuma oportunidade encontrada</h3>
          <p className="text-slate-500 mt-2 max-w-md">
            {statusFilter !== 'todos' 
              ? `Não há pedidos com status "${statusFilter}" no período selecionado.` 
              : 'Não há carrinhos abandonados ou vendas pendentes no período selecionado.'}
          </p>
        </div>
      ) : !errorMsg && (
        <>
          {/* Grid de Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((item) => {
              const statusConfig = getStatusConfig(item.status_label);
              const StatusIcon = statusConfig.icon;
              const phone = formatPhone(item.customer_phone);

              return (
                <div 
                  key={item.id} 
                  className={`group relative rounded-2xl border ${item.contatado ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/50'} p-5 transition-all duration-300 hover:border-slate-700 hover:shadow-lg hover:shadow-black/20`}
                >
                  {/* Badge de Contatado */}
                  {item.contatado && (
                    <div className="absolute -top-2 -right-2 flex flex-col items-end">
                      <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-lg shadow-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        Contatado
                      </div>
                      {item.data_contato_recuperacao && (
                        <span className="mt-1 text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          {format(new Date(item.data_contato_recuperacao), 'dd/MM HH:mm', { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">{statusConfig.label}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {format(new Date(item.order_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </span>
                  </div>

                  {/* Cliente */}
                  <div className="mb-4">
                    <h3 className="font-semibold text-slate-200 truncate" title={item.customer_name}>
                      {item.customer_name || 'Cliente Desconhecido'}
                    </h3>
                    <div className="mt-2 space-y-1">
                      {item.customer_email && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate">{item.customer_email}</span>
                        </div>
                      )}
                      {phone && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-mono">{formatPhoneDisplay(item.customer_phone)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Produto */}
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-800 mb-4">
                    <div className="text-xs text-slate-500 mb-1">Produto</div>
                    <div className="text-sm text-slate-300 font-medium truncate" title={item.product_name}>
                      {item.product_name || item.offer_name || 'N/A'}
                    </div>
                    {item.paid_amount > 0 && (
                      <div className="text-emerald-400 font-semibold mt-1">
                        {item.paid_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    )}
                  </div>

                  {/* UTM Source (se existir) */}
                  {item.utm_source && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-[10px] text-slate-500 uppercase">Origem:</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-400">
                        {item.utm_source}
                      </span>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex gap-2">
                    {phone ? (
                      <button
                        onClick={() => handleWhatsAppClick(item)}
                        disabled={item.contatado}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 ${
                          item.contatado 
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white shadow-lg shadow-green-500/20 hover:shadow-green-500/30 hover:scale-[1.02]'
                        }`}
                      >
                        <MessageCircle className="w-4 h-4" />
                        {item.contatado ? 'Contatado' : 'WhatsApp'}
                      </button>
                    ) : (
                      <div className="flex-1 py-2.5 rounded-xl text-xs font-medium text-center text-slate-500 bg-slate-800/50">
                        Sem telefone
                      </div>
                    )}

                    {/* Link de Pagamento */}
                    {item.link_pagamento && (
                      <>
                        <button
                          onClick={() => copyToClipboard(item.link_pagamento, 'Link')}
                          className="p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors border border-slate-800"
                          title="Copiar link de pagamento"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <a
                          href={item.link_pagamento}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors border border-slate-800"
                          title="Abrir link de pagamento"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginação */}
          {totalCount > pageSize && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <span className="text-sm text-slate-500">
                Mostrando <span className="text-slate-300 font-medium">{((page - 1) * pageSize) + 1}</span> - <span className="text-slate-300 font-medium">{Math.min(page * pageSize, totalCount)}</span> de <span className="text-slate-300 font-medium">{totalCount}</span>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-medium bg-slate-800/50 border border-slate-800 rounded-xl text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-medium bg-slate-800/50 border border-slate-800 rounded-xl text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Recovery;
