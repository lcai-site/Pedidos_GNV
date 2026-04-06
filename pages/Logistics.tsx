import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { PedidoUnificado } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Modal } from '../components/ui/Modal';
import { SimpleLabelProgressModal } from '../components/ui/SimpleLabelProgressModal';
import { Search, Printer, Truck, AlertTriangle, Save, Pencil, User, MapPin, Phone, FileText, CheckCircle2, Mail, ChevronLeft, ChevronRight, Calendar, Clock, Lock, StickyNote, PenTool, AlertCircle, RotateCcw, Trash2, RefreshCw, CheckSquare, MessageCircle, Tag, X, Database, ShoppingBag, ExternalLink } from 'lucide-react';
import type { ResultadoEtiqueta } from '../types/labels';
import { useDateFilter } from '../context/DateFilterContext';
import { useNotification } from '../lib/contexts/NotificationContext';
import { format, parseISO, startOfDay, addDays, setHours, setMinutes, isAfter, isEqual, isBefore, getDay } from 'date-fns';
import { toast } from 'sonner';
import { ENV } from '../lib/config/environment';
import { useAuth } from '../lib/contexts/AuthContext';

// ✨ NOVO: Imports do módulo logistics refatorado
import { useOrderEdit, EditOrderModal, getDeepVal, DEEP_SEARCH_KEYS, formatGroupCodes, ExportButton, getSafeShipDate, getPostSaleDate } from '../modules/logistics';
import BotaoConsolidar from '../components/BotaoConsolidar';
import BotaoRelatorioEnvios from '../components/BotaoRelatorioEnvios';
import { BotaoCriarPedidoManual } from '../components/BotaoCriarPedidoManual';
import { ModalUnificarEndereco } from '../components/ModalUnificarEndereco';

// ✨ PROTEÇÃO DE ETIQUETAS
import { useResetEtiqueta, useResetEtiquetasEmMassa, verificarEtiqueta } from '../lib/hooks/useEtiquetas';
import { ConfirmResetEtiquetaModal, SelecaoFreteModal, TotalizacaoFrete } from '../components/Logistics';

// ✨ FRETE E ENVIO
import { useConsultarFrete, useTotalizacaoFrete, useMarcarPostado, useMarcarPostadoEmMassa, useVoltarParaEnvios, formatarMoeda, CotacaoFrete } from '../lib/hooks/useFrete';

export const formatNomenclatura = (rawName: string): string => {
  if (!rawName || rawName === 'UNREGISTERED_DATA') return 'UNREGISTERED_DATA';

  // Se já começar com o padrão de sigla (DP - , BF - , BL - ), retornar como está (respeita a formatação do banco)
  if (/^(DP|BF|BL)\s*-\s*/i.test(rawName)) {
    return rawName.toUpperCase();
  }

  const text = String(rawName).toUpperCase();
  // ... resto da lógica de fallback ...

  // 1. Encontrar Sigla
  const siglaMatch = text.match(/\b(DP|BF|BL)\b/);
  let sigla = siglaMatch ? siglaMatch[0] : '';
  if (!sigla) {
    if (text.includes('DESEJO PROIBIDO')) sigla = 'DP';
    else if (text.includes('BELA FORMA')) sigla = 'BF';
    else if (text.includes('BELA LUMI')) sigla = 'BL';
  }

  // 2. Encontrar Oferta Principal
  let oferta = '';
  const compreMatch = text.match(/COMPRE\s+\d+\s+(?:LEVE|GANHE)\s+\d+/);
  if (compreMatch) {
    oferta = compreMatch[0];
  }

  // 3. Extrair Complementos (Order Bump, Upsell, PVs)
  const complementos: string[] = [];

  if (text.match(/ORDER\s*BUMP/)) {
    complementos.push('+ ORDER BUMP');
  } else {
    const obMatch = text.match(/\b(\d+)\s*OB\b/);
    if (obMatch) complementos.push(`+ ${obMatch[0]}`);
  }

  if (text.match(/UPSELL/)) {
    complementos.push('+ UPSELL');
  } else {
    const upMatch = text.match(/\b(\d+)\s*UP\b/);
    if (upMatch) complementos.push(`+ ${upMatch[0]}`);
  }

  // Extrai pós-vendas no formato "+ 2 BF", "1 BL", "+1DP"
  const pvRegex = /(?:\+\s*)?(\d+)\s*(BF|BL|DP|PV)\b/g;
  let pvMatch;
  while ((pvMatch = pvRegex.exec(text)) !== null) {
    complementos.push(`+ ${pvMatch[1]} ${pvMatch[2]}`);
  }

  // Garante que só fique complementos únicos caso haja repetição
  const complementosUnicos = Array.from(new Set(complementos));
  const complementosStr = complementosUnicos.length > 0 ? ' ' + complementosUnicos.join(' ') : '';

  if (sigla && oferta) {
    return `${sigla} - ${oferta}${complementosStr}`;
  }

  // 4. Fallback: Se não for "COMPRE X LEVE Y", tenta limpar a string e colar os complementos
  let cleaned = text
    .replace(/BELA LUMI/gi, '')
    .replace(/DESEJO PROIBIDO/gi, '')
    .replace(/BELA FORMA/gi, '')
    .replace(/TRAFEGO/gi, '')
    .replace(/ORDER\s*BUMP/gi, '')
    .replace(/UPSELL/gi, '')
    .replace(/\b\d+\s*OB\b/gi, '')
    .replace(/\b\d+\s*UP\b/gi, '')
    .replace(/(?:\+\s*)?\d+\s*(BF|BL|DP|PV)\b/gi, ''); // remove PVs do texto

  if (sigla) cleaned = cleaned.replace(new RegExp(`\\b${sigla}\\b`, 'g'), '');

  cleaned = cleaned.replace(/[-+]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  if (sigla) {
    if (cleaned) return `${sigla} - ${cleaned}${complementosStr}`;
    return `${sigla}${complementosStr}`;
  }

  return text;
};

export const Logistics: React.FC = () => {
  const { startDate, endDate } = useDateFilter();
  const { notifications, openSimilarPairModal } = useNotification();
  const { can } = useAuth();
  const [allOrders, setAllOrders] = useState<PedidoUnificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [trackingUpdates, setTrackingUpdates] = useState<{ [key: string]: string }>({});
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!window.confirm("Atenção: Apenas dados faltantes ou desatualizados do Staging serão atualizados pelo banco de Produção Oficial. Deseja continuar?")) {
      return;
    }

    setIsSyncing(true);
    const loadingToast = toast.loading('Sincronizando bancos de dados...');

    try {
      const { data, error } = await supabase.functions.invoke('sync-staging', {
        method: 'POST'
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.success) {
        toast.success(data.message || 'Sincronização iniciada com sucesso!', { id: loadingToast, duration: 8000 });
      } else {
        throw new Error(data?.error || 'Erro desconhecido ao iniciar sincronização.');
      }
    } catch (err: any) {
      console.error('Sync Error:', err);
      if (err.message?.includes('GITHUB_PAT')) {
        toast.error('O sistema precisa de autorização no GitHub para executar a cópia. Fale com a equipe técnica (Chave GITHUB_PAT ausente).', { id: loadingToast, duration: 8000 });
      } else {
        toast.error(`Falha ao sincronizar: ${err.message}`, { id: loadingToast, duration: 8000 });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Logistics Logic State
  const [shippingRefDate, setShippingRefDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState<'sales' | 'postSale' | 'pvDone' | 'ready' | 'labeled' | 'sent' | 'cancelados'>('sales');

  // Client-Side Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // ✨ NOVO: Hook de edição refatorado (substitui estado manual)
  const {
    isEditModalOpen,
    editingOrder,
    editForm,
    fieldErrors,
    saving,
    openEditModal,
    closeEditModal,
    updateField,
    saveEdit
  } = useOrderEdit();

  // Label Generation State
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [currentProduto, setCurrentProduto] = useState<'DP' | 'BF' | 'BL'>('DP');
  const [labelProgress, setLabelProgress] = useState({
    total: 0,
    processados: 0,
    sucesso: 0,
    erros: 0,
    detalhes: [] as ResultadoEtiqueta[],
    concluido: false
  });
  const cancelGenerationRef = useRef(false);

  // Bulk Selection State
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  // Date Filter State
  const [dateFilter, setDateFilter] = useState('');

  // Inline edit: descricao_pacote
  const [editingDescricaoId, setEditingDescricaoId] = useState<string | null>(null);
  const [editingDescricaoValue, setEditingDescricaoValue] = useState<string>('');

  // Merge orders modal
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeMainId, setMergeMainId] = useState<string>('');
  const [mergeDescricao, setMergeDescricao] = useState<string>('');
  const [mergeSaving, setMergeSaving] = useState(false);

  // ✨ PROTEÇÃO DE ETIQUETAS - Estados do modal de confirmação
  const [isResetEtiquetaModalOpen, setIsResetEtiquetaModalOpen] = useState(false);
  const [pedidoParaResetar, setPedidoParaResetar] = useState<{ id: string; codigoRastreio: string; nomeCliente: string } | null>(null);
  const [pendingUndoLabelId, setPendingUndoLabelId] = useState<string | null>(null);

  // ✨ MODAL DE ESCOLHA DE PROVEDOR (Correios vs Melhor Envio)
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<string | null>(null);

  const openProviderChoice = (product: string) => {
    setPendingProduct(product);
    setIsProviderModalOpen(true);
  };

  const handleConfirmedGenerate = (provider: 'correios' | 'melhorenvio') => {
    if (!pendingProduct) return;
    setSelectedProvider(provider);
    setIsProviderModalOpen(false);
    handleGenerateLabels(pendingProduct as any, provider);
  };

  // Divergência de Unificação
  const [selectedDivergence, setSelectedDivergence] = useState<{ parent: PedidoUnificado; child: any } | null>(null);
  const [resolvingDivergence, setResolvingDivergence] = useState(false);

  // Modal Cancelar Pedido
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [pedidoParaCancelar, setPedidoParaCancelar] = useState<PedidoUnificado | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [canceling, setCanceling] = useState(false);

  const handleConfirmCancel = async () => {
    if (!pedidoParaCancelar) return;
    if (!motivoCancelamento.trim()) {
      toast.error('Informe o motivo do cancelamento.');
      return;
    }
    setCanceling(true);
    try {
      const loadingToast = toast.loading('Cancelando pedido...');
      const { data, error } = await supabase.rpc('cancelar_pedido_logistica', {
        p_pedido_id: pedidoParaCancelar.id,
        p_motivo: motivoCancelamento.trim()
      });
      if (error) throw error;
      if (data?.status === 'error') throw new Error(data.message);
      
      toast.success('Pedido cancelado com sucesso.', { id: loadingToast });
      setIsCancelModalOpen(false);
      setPedidoParaCancelar(null);
      setMotivoCancelamento('');
      fetchOrders();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao cancelar pedido.');
    } finally {
      setCanceling(false);
    }
  };

  const [restoring, setRestoring] = useState(false);
  const handleRestorePedido = async (orderId: string) => {
    if (!confirm('Deseja realmente restaurar este pedido para a aba "Prontos"?')) return;
    setRestoring(true);
    const loadingToast = toast.loading('Restaurando pedido...');
    try {
      const { data, error } = await supabase.rpc('restaurar_pedido_logistica', { p_pedido_id: orderId });
      if (error) throw error;
      if (data?.status === 'error') throw new Error(data.message);
      
      toast.success('Pedido restaurado com sucesso.', { id: loadingToast });
      fetchOrders();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao restaurar pedido.', { id: loadingToast });
    } finally {
      setRestoring(false);
    }
  };

  // Modal de Unificação por Endereço
  const [isUnificarEnderecoModalOpen, setIsUnificarEnderecoModalOpen] = useState(false);
  const [pedidoParaUnificar, setPedidoParaUnificar] = useState<string | null>(null);

  const resetEtiqueta = useResetEtiqueta();
  const resetEtiquetasEmMassa = useResetEtiquetasEmMassa();

  // ✨ FRETE - Estados para cotação e seleção
  const [isSelecaoFreteModalOpen, setIsSelecaoFreteModalOpen] = useState(false);
  const [pedidoParaCotacao, setPedidoParaCotacao] = useState<{ id: string; nomeCliente: string; cep: string } | null>(null);
  const [cotacoesFrete, setCotacoesFrete] = useState<CotacaoFrete[]>([]);
  const consultarFrete = useConsultarFrete();
  const marcarPostado = useMarcarPostado();
  const marcarPostadoEmMassa = useMarcarPostadoEmMassa();
  const voltarParaEnvios = useVoltarParaEnvios();
  // Formatar datas para ISO (YYYY-MM-DD) para o Supabase
  const formatDateForSupabase = (date: Date | string) => {
    if (!date) return undefined;
    const dateStr = typeof date === 'string' ? date : date.toISOString();
    return dateStr.split('T')[0]; // YYYY-MM-DD
  };

  // ✨ FRETE (NOVO: Totalização calculada localmente na UI renderizada para sincronizar com filtros/abas)
  // Removido hook useTotalizacaoFrete para evitar dessincronização com as ordens carregadas (que ignoram o data picker global)

  // ✨ NOTA: Funções utilitárias agora vêm do módulo logistics
  // - validateOrder → do serviço orderValidationService
  // - getSafeShipDate → do utils/dateRules
  // - getDeepVal → do utils/deepSearch
  // - parseAddressString, formatGroupCodes → do utils/addressParser
  // - openEditModal → do hook useOrderEdit

  // Keys para deep search (mantido aqui pois é usado em várias funções locais)
  const keys = {
    nome: ['nome_cliente', 'cliente_nome', 'cliente', 'nome', 'full_name', 'name', 'buyer_name'],
    cpf: ['cpf', 'cliente_cpf', 'doc', 'documento', 'cpf_cliente', 'tax_id', 'vat_number'],
    phone: ['telefone', 'cliente_telefone', 'phone', 'celular', 'whatsapp', 'phone_number', 'mobile'],
    email: ['email_cliente', 'email', 'cliente_email', 'contact_email', 'buyer_email', 'user_email', 'mail'],
    zip: ['cep', 'zip', 'zipcode', 'zip_code', 'postal_code'],
    street: ['rua', 'logradouro', 'street', 'street_name', 'address_line_1', 'endereco_rua', 'thoroughfare'],
    number: ['numero', 'number', 'street_number', 'num', 'endereco_numero', 'house_number', 'nr', 'n'],
    comp: ['complemento', 'comp', 'complement', 'address_line_2', 'endereco_complemento', 'extra'],
    neighborhood: ['bairro', 'neighborhood', 'district', 'endereco_bairro', 'suburb'],
    city: ['cidade', 'city', 'municipio', 'endereco_cidade', 'town'],
    state: ['estado', 'uf', 'state', 'state_code', 'endereco_estado', 'region'],
    fullAddress: ['endereco', 'endereco_completo', 'full_address', 'cliente_endereco', 'address', 'formatted_address']
  };

  // Carregar pedidos ao montar o componente + Realtime
  useEffect(() => {
    fetchOrders();

    // Debounce para evitar múltiplas chamadas rápidas do Realtime
    let realtimeTimeout: NodeJS.Timeout;
    const debouncedFetchOrders = () => {
      clearTimeout(realtimeTimeout);
      realtimeTimeout = setTimeout(() => fetchOrders(), 300);
    };

    // Realtime subscription para atualização automática
    const channel = supabase
      .channel('logistics-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_consolidados_v3' }, () => {
        debouncedFetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(realtimeTimeout);
    };
  }, []);

  const fetchOrders = async (retryCount = 0) => {
    setLoading(true);
    setPage(1);
    try {
      const { data, error } = await supabase
        .from('pedidos_consolidados_v3')
        .select('*')
        .order('data_venda', { ascending: false })
        .limit(5000);

      if (error) {
        // Se for erro de conexão/cache, tenta novamente até 3 vezes
        if (retryCount < 3 && (error.code === 'PGRST205' || error.message.includes('fetch'))) {
          console.warn(`[Logística] Erro de busca (tentativa ${retryCount + 1}/3). Retentando em 1s...`);
          setTimeout(() => fetchOrders(retryCount + 1), 1000 * (retryCount + 1));
          return;
        }
        throw error;
      };

      // Para a maioria das abas, ignoramos Unificados e Cancelados
      const validOrders = (data || []).filter(o => o.status_aprovacao !== 'Unificado');
      setAllOrders(validOrders);
    } catch (error: any) {
      console.error('Error fetching logistics:', error);
      // Fallback visual ou alerta para o usuário
      // Se falhou tudo, não zera, mantém o estado anterior se houver (mas aqui é init)
    } finally {
      if (retryCount === 0 || retryCount >= 3) setLoading(false);
    }
  };

  const handleTrackingChange = (id: string, value: string) => {
    setTrackingUpdates(prev => ({ ...prev, [id]: value }));
  };

  const saveTracking = async (id: string) => {
    const code = trackingUpdates[id];
    if (!code) return;

    const oldOrders = [...allOrders];
    setAllOrders(allOrders.map(o => o.id === id ? { ...o, codigo_rastreio: code, status_envio: 'Enviado' } : o));

    try {
      const { error } = await supabase
        .from('pedidos_consolidados_v3')
        .update({ codigo_rastreio: code, status_envio: 'Enviado' })
        .eq('id', id);

      if (error) throw error;

      const newUpdates = { ...trackingUpdates };
      delete newUpdates[id];
      setTrackingUpdates(newUpdates);

    } catch (err) {
      console.error("Failed to update", err);
      alert("Erro ao salvar rastreio");
      setAllOrders(oldOrders);
    }
  };

  // Helper function to deep patch address in nested objects
  const patchAddressInObject = (obj: any, form: any) => {
    if (!obj || typeof obj !== 'object') return obj;
    const newObj = Array.isArray(obj) ? [...obj] : { ...obj };

    // 1. Atualizar sub-objeto 'address' ou 'endereco' se existir
    // Ex: customer.address
    if (newObj.address && typeof newObj.address === 'object') {
      newObj.address = {
        ...newObj.address,
        street: form.logradouro,
        street_number: form.numero,
        number: form.numero,
        zip_code: form.cep,
        zip: form.cep,
        neighborhood: form.bairro,
        city: form.cidade,
        state: form.estado,
        complement: form.complemento
      };
    }

    if (newObj.endereco && typeof newObj.endereco === 'object') {
      newObj.endereco = {
        ...newObj.endereco,
        logradouro: form.logradouro,
        rua: form.logradouro,
        numero: form.numero,
        bairro: form.bairro,
        cidade: form.cidade,
        estado: form.estado,
        cep: form.cep,
        complemento: form.complemento
      };
    }

    // 2. Atualizar chaves planas no próprio objeto se ele parecer ser um objeto de endereço
    const objectKeys = Object.keys(newObj);
    const hasFlatAddressLikeKeys = objectKeys.some(k =>
      ['rua', 'logradouro', 'street', 'cep', 'zip', 'city', 'cidade'].includes(k.toLowerCase())
    );

    if (hasFlatAddressLikeKeys) {
      if (newObj.rua !== undefined) newObj.rua = form.logradouro;
      if (newObj.logradouro !== undefined) newObj.logradouro = form.logradouro;
      if (newObj.street !== undefined) newObj.street = form.logradouro;

      if (newObj.numero !== undefined) newObj.numero = form.numero;
      if (newObj.number !== undefined) newObj.number = form.numero;

      if (newObj.bairro !== undefined) newObj.bairro = form.bairro;
      if (newObj.neighborhood !== undefined) newObj.neighborhood = form.bairro;

      if (newObj.cidade !== undefined) newObj.cidade = form.cidade;
      if (newObj.city !== undefined) newObj.city = form.cidade;

      if (newObj.estado !== undefined) newObj.estado = form.estado;
      if (newObj.state !== undefined) newObj.state = form.estado;
      if (newObj.uf !== undefined) newObj.uf = form.estado;

      if (newObj.cep !== undefined) newObj.cep = form.cep;
      if (newObj.zip !== undefined) newObj.zip = form.cep;

      if (newObj.complemento !== undefined) newObj.complemento = form.complemento;
      if (newObj.complement !== undefined) newObj.complement = form.complemento;
    }

    return newObj;
  };

  // ✨ NOTA: handleEditSave foi REMOVIDA - agora usa saveEdit do hook useOrderEdit
  // O hook já faz toda a lógica de atualização via SQL function


  const getFraudRisk = (order: PedidoUnificado) => {
    // 1. Se o pedido atual for UPSELL ou BUMP, NUNCA exibe o alerta
    const currentLabel = `${order.descricao_pacote || ''} ${order.nome_oferta || ''} ${order.nome_produto || ''}`.toUpperCase();
    if (currentLabel.includes('UPSELL') || currentLabel.includes('BUMP')) return false;

    const cpf = getDeepVal(order, keys.cpf);
    const address = getDeepVal(order, keys.fullAddress) || getDeepVal(order, keys.street);
    const orderDate = order.data_venda ? new Date(order.data_venda) : null;

    if (!cpf || !orderDate) return false;

    const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

    const sameCPF = allOrders.filter(o => {
      const oCpf = getDeepVal(o, keys.cpf);
      const oDate = o.data_venda ? new Date(o.data_venda) : null;

      if (!oCpf || oCpf !== cpf || o.id === order.id || !oDate) return false;

      const diffMs = Math.abs(orderDate.getTime() - oDate.getTime());

      // Filtra por mesmo CPF + limita apenas a 5 dias
      if (diffMs > FIVE_DAYS_MS) return false;

      // 2. Se o pedido comparado for UPSELL ou BUMP, ignoramos também
      const oLabel = `${o.descricao_pacote || ''} ${o.nome_oferta || ''} ${o.nome_produto || ''}`.toUpperCase();
      if (oLabel.includes('UPSELL') || oLabel.includes('BUMP')) return false;

      return true;
    });

    const hasDifferentAddress = sameCPF.some(o => {
      const oAddr = getDeepVal(o, keys.fullAddress) || getDeepVal(o, keys.street);
      return oAddr && oAddr !== address;
    });

    return hasDifferentAddress;
  };

  const getDisplayAddress = (order: PedidoUnificado) => {
    // Se foi editado, montar endereço a partir dos campos flat (que são atualizados pela edição)
    if (order.foi_editado && order.logradouro) {
      const parts = [order.logradouro];
      if (order.numero) parts[0] += ', ' + order.numero;
      if (order.complemento) parts.push(order.complemento);
      if (order.bairro) parts.push(order.bairro);
      if (order.cidade) parts.push(order.cidade);
      if (order.estado) parts[parts.length - 1] += ' - ' + order.estado;
      return parts.join(' - ');
    }

    // Fallback: endereco_completo -> campos planos -> deep search
    if (order.endereco_completo) return order.endereco_completo;

    const street = getDeepVal(order, keys.street);
    const num = getDeepVal(order, keys.number);
    const city = getDeepVal(order, keys.city);
    const uf = getDeepVal(order, keys.state);
    if (street) return `${street}, ${num} - ${city}/${uf}`;

    return getDeepVal(order, keys.fullAddress) || 'Endereço n/d';
  }

  // --- Filtering & Rules Logic ---

  // 1. Filter by Search Term and Date
  const searchFilteredOrders = allOrders.filter(order => {
    if (!order) return false;

    // Date filter
    if (dateFilter) {
      const orderDate = order.data_venda ? format(new Date(order.data_venda), 'dd/MM/yy') : '';
      if (!orderDate.includes(dateFilter)) return false;
    }

    // Text search
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const pkgDesc = String(order.descricao_pacote || '').toLowerCase();
    const name = String(getDeepVal(order, keys.nome)).toLowerCase();
    const email = String(getDeepVal(order, keys.email)).toLowerCase();
    const cpf = String(getDeepVal(order, keys.cpf)).toLowerCase();
    const phone = String(getDeepVal(order, keys.phone)).toLowerCase();
    const fullAddr = String(getDisplayAddress(order)).toLowerCase();
    const rawGroup = order.codigos_agrupados;
    const groupCode = Array.isArray(rawGroup) ? rawGroup.join(' ').toLowerCase() : String(rawGroup || '').toLowerCase();
    const transCode = String(order.codigo_transacao || '').toLowerCase();
    return pkgDesc.includes(term) || name.includes(term) || email.includes(term) || cpf.includes(term) || phone.includes(term) || groupCode.includes(term) || fullAddr.includes(term) || transCode.includes(term);
  });

  // 2. Aplicação da Regra de Janela de Pós-Venda
  const categorizedOrders = {
    sales: [] as PedidoUnificado[],
    postSale: [] as PedidoUnificado[],
    pvDone: [] as PedidoUnificado[],
    ready: [] as PedidoUnificado[],
    labeled: [] as PedidoUnificado[],
    sent: [] as PedidoUnificado[],
    cancelados: [] as PedidoUnificado[]
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const refDateStr = shippingRefDate; // Já é YYYY-MM-DD

  searchFilteredOrders.forEach(order => {
    if (order.status_aprovacao === 'Cancelado') {
      categorizedOrders.cancelados.push(order);
      return;
    }

    // Se já foi postado (data_postagem) → aba "Enviados"
    if (order.data_postagem || order.status_envio === 'Postado') {
      categorizedOrders.sent.push(order);
      return;
    }

    // Se tem etiqueta gerada (codigo_rastreio) mas não foi postado → aba "Etiquetados"
    // Inclui UUIDs do carrinho (36 chars) que serão sincronizados
    if (order.codigo_rastreio && !order.data_postagem) {
      categorizedOrders.labeled.push(order);
      return;
    }

    // ✨ PEDIDO MANUAL: Se for marcado como manual no metadata, vai direto para Envios (Prontos)
    // Pula toda a lógica de Pós-Venda e dia de despacho automático.
    if (order.metadata && typeof order.metadata === 'object' && 'tipo' in order.metadata && order.metadata.tipo === 'manual') {
      categorizedOrders.ready.push(order);
      return;
    }

    // LÓGICA UNIFICADA: Envios = dia_despacho é a data de referência
    // Usamos status_date (confirmação do pagamento) como referência principal para o despacho
    const dataReferencia = order.status_date || order.data_venda || order.created_at;

    const diaDespachoStr = order.dia_despacho
      ? order.dia_despacho
      : format(getSafeShipDate(dataReferencia), 'yyyy-MM-dd');

    // Calcular o dia de PV para este pedido baseado na mesma referência
    const diaPVStr = format(getPostSaleDate(dataReferencia), 'yyyy-MM-dd');
    const isPostSaleDue = diaPVStr === todayStr || diaPVStr < todayStr;

    // Prioridade 0 (EXCEÇÃO MANUAL): Se o dia de despacho foi setado manualmente (não é null no BD) 
    // e já chegou, o pedido vai DIRETO para a aba Envios, ignorando o bloqueio de Pós-Vendas.
    const hasManualDispatch = !!order.dia_despacho;
    if (hasManualDispatch && (diaDespachoStr === refDateStr || diaDespachoStr < refDateStr)) {
      categorizedOrders.ready.push(order);
      return;
    }

    // Prioridade 1: Aba Pós-Venda (Se está no dia de PV ou passou, e o contato NÃO foi feito)
    // O pedido fica aqui mesmo que já seja dia de despacho (se o fluxo for automático).
    if (isPostSaleDue && !order.pv_realizado) {
      categorizedOrders.postSale.push(order);
      return;
    }

    // Prioridade 2: PV Já Realizado (Obrigatório)
    // Se o contato foi feito, ele DEVE passar pela aba PV Realizado.
    // Ele só sai daqui para Envios se for movido manualmente hoje (Prioridade 0) 
    // ou se a regra automática de Prioridade 3 permitir no dia correto.
    if (order.pv_realizado) {
      // Se já é o dia de despacho (automático ou manual), vai para Envios.
      // Caso contrário, fica no PV Realizado.
      if (diaDespachoStr === refDateStr || diaDespachoStr < refDateStr) {
        categorizedOrders.ready.push(order);
      } else {
        categorizedOrders.pvDone.push(order);
      }
      return;
    }

    // Prioridade 3: Aba Envios (Fluxo Automático - Sem PV)
    if (diaDespachoStr === refDateStr || diaDespachoStr < refDateStr) {
      categorizedOrders.ready.push(order);
    }
    // Prioridade 4: Aba Vendas (Venda recente, ainda não é dia de PV)
    else {
      categorizedOrders.sales.push(order);
    }
  });

  const currentList = categorizedOrders[activeTab];

  const totalPages = Math.ceil(currentList.length / pageSize);
  const displayedOrders = currentList.slice((page - 1) * pageSize, page * pageSize);

  // Calcula `totalizacaoFrete` baseado nos itens `categorizedOrders` visíveis, seja Etiquetados ou Enviados
  const totalizacaoFrete = React.useMemo(() => {
    const list = activeTab === 'labeled' ? categorizedOrders.labeled : activeTab === 'sent' ? categorizedOrders.sent : [];
    const totalizacao = {
      mini_envios: { count: 0, valor: 0 },
      pac: { count: 0, valor: 0 },
      sedex: { count: 0, valor: 0 },
      total: { count: 0, valor: 0 },
    };

    list.forEach(pedido => {
      const tipo = pedido.tipo_envio || pedido.logistica_servico;
      const valor = pedido.valor_frete !== undefined && pedido.valor_frete !== null
        ? pedido.valor_frete
        : pedido.logistica_valor;

      if (valor !== undefined && valor !== null && tipo) {
        const tipoUpper = String(tipo).toUpperCase();
        const valorNum = Number(valor);

        if (tipoUpper.includes('MINI')) {
          totalizacao.mini_envios.count++;
          totalizacao.mini_envios.valor += valorNum;
        } else if (tipoUpper === 'PAC') {
          totalizacao.pac.count++;
          totalizacao.pac.valor += valorNum;
        } else if (tipoUpper === 'SEDEX') {
          totalizacao.sedex.count++;
          totalizacao.sedex.valor += valorNum;
        }
        totalizacao.total.count++;
        totalizacao.total.valor += valorNum;
      }
    });

    return totalizacao;
  }, [categorizedOrders, activeTab]);

  useEffect(() => {
    setPage(1);
    setSelectedOrders(new Set());
  }, [searchTerm, pageSize, activeTab, shippingRefDate, dateFilter]);

  // Renderiza Badges de Mudança
  const renderChangeBadges = (order: PedidoUnificado) => {
    // VERIFICA SE É PEDIDO MANUAL (prioridade máxima)
    if (order.metadata && typeof order.metadata === 'object' && 'tipo' in order.metadata && order.metadata.tipo === 'manual') {
      return (
        <div className="flex items-center gap-1 mt-1 text-[10px] text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/30">
          <FileText className="w-3 h-3" /> Pedido Manual
        </div>
      );
    }

    // Se não é manual, verifica se foi editado
    if (!order.foi_editado) return null;

    // Se temos a lista detalhada
    if (order.campos_alterados && order.campos_alterados.length > 0) {
      return (
        <div className="flex flex-wrap gap-1 mt-1">
          {order.campos_alterados.map((campo) => {
            let badgeColor = "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
            let Icon = PenTool;

            if (campo === 'Endereço') {
              badgeColor = "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800";
              Icon = MapPin;
            } else if (campo === 'Contato') {
              badgeColor = "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800";
              Icon = Phone;
            } else if (campo === 'Nome' || campo === 'CPF') {
              badgeColor = "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800";
              Icon = User;
            }

            return (
              <div key={campo} className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${badgeColor}`}>
                <Icon className="w-2.5 h-2.5" /> {campo}
              </div>
            );
          })}
        </div>
      );
    }

    // Fallback genérico se a coluna campos_alterados não estiver populada ainda
    return (
      <div className="flex items-center gap-1 mt-1 text-[10px] text-blue-500 font-medium bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded w-fit border border-blue-200 dark:border-blue-800">
        <PenTool className="w-3 h-3" /> Editado
      </div>
    );
  };

  // Handler para gerar etiquetas (usando serviço direto, sem API routes)
  const [selectedProvider, setSelectedProvider] = useState<'melhorenvio' | 'correios'>('correios');

  const handleGenerateLabels = async (produto: 'DP' | 'BF' | 'BL', providerOverride?: 'correios' | 'melhorenvio') => {
    const actualProvider = providerOverride || selectedProvider;
    try {
      setCurrentProduto(produto);
      cancelGenerationRef.current = false;
      setLabelProgress({
        total: 0,
        processados: 0,
        sucesso: 0,
        erros: 0,
        detalhes: [],
        concluido: false
      });
      setIsLabelModalOpen(true);

      const { labelGenerationService } = await import('../lib/services/labelGenerationService');

      const onProgress = (resultado: ResultadoEtiqueta) => {
        setLabelProgress(prev => ({
          ...prev,
          processados: prev.processados + 1,
          sucesso: resultado.status === 'sucesso' ? prev.sucesso + 1 : prev.sucesso,
          erros: resultado.status === 'erro' ? prev.erros + 1 : prev.erros,
          detalhes: [...prev.detalhes, resultado]
        }));
      };

      // Filtra SEMPRE pelo produto clicado — mesmo com seleção manual
      let idsParaGerar: string[] = [];

      if (selectedOrders.size > 0) {
        // Filtra os selecionados mantendo apenas os do produto clicado
        idsParaGerar = Array.from(selectedOrders).filter(id => {
          const order = allOrders.find(o => o.id === id);
          return order?.descricao_pacote?.toUpperCase().startsWith(produto);
        });
      } else {
        // Pega todos listados na visualização filtrando pelo produto
        idsParaGerar = currentList
          .filter(o => o.descricao_pacote?.toUpperCase().startsWith(produto) && !o.codigo_rastreio)
          .map(o => o.id);
      }

      if (idsParaGerar.length === 0) {
        setIsLabelModalOpen(false);
        alert(`Nenhum pedido do produto ${produto} disponível na listagem atual para gerar etiqueta.\nSelecione um pedido ou garanta que ele está visível na aba Prontos.`);
        return;
      }

      const resultado = await labelGenerationService.gerarEtiquetas(
        produto,
        idsParaGerar.length, // Gera para a quantia exata de itens
        onProgress,
        () => cancelGenerationRef.current,
        idsParaGerar,
        (foundTotal: number) => setLabelProgress(prev => ({ ...prev, total: foundTotal })),
        actualProvider
      );

      setLabelProgress(prev => ({ ...prev, concluido: true, total: resultado.sucesso + resultado.erros }));
      setSelectedOrders(new Set());
      await fetchOrders();

    } catch (error: any) {
      alert(`Erro: ${error.message}`);
      setIsLabelModalOpen(false);
    }
  };

  // Handler: Marcar pedido como "Etiqueta Gerada" manualmente
  const handleMarkAsLabeled = async (orderId: string) => {
    try {
      const { data, error } = await supabase.rpc('marcar_etiqueta_gerada', { p_ids: [orderId] });
      if (error) throw error;
      if (data?.status === 'error') throw new Error(data.message);
      await fetchOrders();
    } catch (error: any) {
      alert(`Erro ao marcar etiqueta: ${error.message}`);
    }
  };

  // Handler: Marcar selecionados como "Etiqueta Gerada" em massa
  const handleBulkMarkLabeled = async () => {
    if (selectedOrders.size === 0) return;
    if (!confirm(`Marcar ${selectedOrders.size} pedido(s) como Etiqueta Gerada?`)) return;
    try {
      const ids = Array.from(selectedOrders);
      const { data, error } = await supabase.rpc('marcar_etiqueta_gerada', { p_ids: ids });
      if (error) throw error;
      if (data?.status === 'error') throw new Error(data.message);
      setSelectedOrders(new Set());
      await fetchOrders();
    } catch (error: any) {
      alert(`Erro ao marcar etiqueta em massa: ${error.message}`);
    }
  };

  // Helper: Cancela pré-postagem nos Correios via Edge Function (se aplicável)
  const cancelarEtiquetaCorreios = async (orderId: string, codigoRastreio: string): Promise<void> => {
    const order = allOrders.find(o => o.id === orderId);
    const provider = (order as any)?.logistica_provider || '';

    // Só cancela se foi gerada via Correios Nativo E tem código real (não fallback)
    if (provider !== 'Correios Nativo' || !codigoRastreio) return;

    try {
      const { error } = await supabase.functions.invoke('correios-cancel-label', {
        body: { codigoRastreio }
      });

      if (error) {
        console.warn(`[cancelarEtiquetaCorreios] Aviso ao cancelar ${codigoRastreio} nos Correios:`, error.message);
        // Não bloqueia o fluxo — o desfazer local continua mesmo se a API falhar
      } else {
        console.log(`[cancelarEtiquetaCorreios] Pré-postagem ${codigoRastreio} cancelada nos Correios.`);
      }
    } catch (e: any) {
      console.warn('[cancelarEtiquetaCorreios] Erro silencioso:', e.message);
    }
  };

  // Handler: Desfazer etiqueta (individual)
  const handleUndoLabel = async (orderId: string) => {
    try {
      // ✨ VERIFICAR SE TEM ETIQUETA ANTES DE REMOVER
      const { temEtiqueta, codigoRastreio } = await verificarEtiqueta(orderId);

      if (temEtiqueta && codigoRastreio) {
        // Buscar informações do pedido para o modal
        const order = allOrders.find(o => o.id === orderId);
        if (order) {
          setPedidoParaResetar({
            id: orderId,
            codigoRastreio: codigoRastreio,
            nomeCliente: order.nome_cliente || 'Cliente'
          });
          setPendingUndoLabelId(orderId);
          setIsResetEtiquetaModalOpen(true);
          return; // Aguardar confirmação do usuário
        }
      }

      // Se não tem etiqueta, prossegue normalmente
      const { data, error } = await supabase.rpc('desfazer_etiqueta_gerada', { p_ids: [orderId] });
      if (error) throw error;
      if (data?.status === 'error') throw new Error(data.message);
      await fetchOrders();
    } catch (error: any) {
      alert(`Erro ao desfazer etiqueta: ${error.message}`);
    }
  };

  // ✨ Handler para confirmar remoção da etiqueta após modal
  const handleConfirmResetEtiqueta = async (pedidoId: string) => {
    try {
      // Cancela nos Correios primeiro (silencioso se falhar)
      const order = allOrders.find(o => o.id === pedidoId);
      const codigoRastreio = (order as any)?.codigo_rastreio || '';
      await cancelarEtiquetaCorreios(pedidoId, codigoRastreio);

      // Depois reseta a etiqueta localmente
      const result = await resetEtiqueta.mutateAsync({
        pedidoId,
        confirmacao: true
      });

      if (result.success) {
        const { data, error } = await supabase.rpc('desfazer_etiqueta_gerada', { p_ids: [pedidoId] });
        if (error) throw error;
        if (data?.status === 'error') throw new Error(data.message);
        await fetchOrders();
      }
    } catch (error: any) {
      alert(`Erro ao desfazer etiqueta: ${error.message}`);
    } finally {
      setIsResetEtiquetaModalOpen(false);
      setPedidoParaResetar(null);
      setPendingUndoLabelId(null);
    }
  };

  // Handler: Desfazer etiqueta em massa (ÚNICA CONFIRMAÇÃO E PROCESSAMENTO)
  const handleBulkUndoLabel = async () => {
    if (selectedOrders.size === 0) return;

    // ✨ VERIFICAR SE ALGUM PEDIDO TEM ETIQUETA GERADA (todos de uma vez)
    const selectedIds = Array.from(selectedOrders);
    const pedidosComEtiqueta = [];

    for (const id of selectedIds) {
      const { temEtiqueta, codigoRastreio } = await verificarEtiqueta(id);
      if (temEtiqueta) {
        const order = allOrders.find(o => o.id === id);
        pedidosComEtiqueta.push({
          id,
          codigoRastreio,
          nomeCliente: order?.nome_cliente || order?.cliente_nome || order?.cliente || 'Cliente'
        });
      }
    }

    // ✨ UMA ÚNICA CONFIRMAÇÃO PARA TODOS
    if (pedidosComEtiqueta.length > 0) {
      const confirmMsg = `ATENÇÃO: ${pedidosComEtiqueta.length} pedido(s) já possuem etiqueta gerada.\n\n` +
        `Códigos que serão invalidados:\n` +
        pedidosComEtiqueta.map(p => `- ${p.codigoRastreio} (${p.nomeCliente})`).join('\n') +
        `\n\nDeseja prosseguir e cancelar estas etiquetas?`;

      if (!confirm(confirmMsg)) return;
    } else {
      // Se não tem etiquetas, confirmação normal
      if (!confirm(`Desfazer etiqueta de ${selectedOrders.size} pedido(s)? Eles voltarão para Prontos para Envio.`)) return;
    }

    try {
      // Cancela nos Correios os pedidos com logistica_provider = 'Correios Nativo'
      const cancelPromises = selectedIds.map(async (id) => {
        const order = allOrders.find(o => o.id === id);
        const codigo = (order as any)?.codigo_rastreio || '';
        await cancelarEtiquetaCorreios(id, codigo);
      });
      await Promise.allSettled(cancelPromises); // silencioso — não bloqueia

      // ✨ UMA ÚNICA CHAMADA EM MASSA
      await resetEtiquetasEmMassa.mutateAsync(selectedIds);

      setSelectedOrders(new Set());
      await fetchOrders();
    } catch (error: any) {
      alert(`Erro ao desfazer etiqueta em massa: ${error.message}`);
    }
  };

  // Handler: Marcar como postado em massa (ÚNICA CHAMADA)
  const handleBulkMarkSent = async () => {
    if (selectedOrders.size === 0) return;
    if (!confirm(`Marcar ${selectedOrders.size} pedido(s) como postados? Eles serão movidos para a aba ENVIADOS.`)) return;

    try {
      const ids = Array.from(selectedOrders);
      // UMA ÚNICA CHAMADA PARA TODOS OS PEDIDOS
      await marcarPostadoEmMassa.mutateAsync(ids);
      setSelectedOrders(new Set());
      await fetchOrders();
      // Toast já é mostrado no hook com o total
    } catch (error: any) {
      alert(`Erro ao marcar como postado: ${error.message}`);
    }
  };

  // Handler: Voltar pedidos de ENVIADOS para ENVIOS
  const handleBulkVoltarParaEnvios = async () => {
    if (selectedOrders.size === 0) return;
    if (!confirm(`Voltar ${selectedOrders.size} pedido(s) para a aba ENVIOS? Eles serão removidos da aba ENVIADOS.`)) return;

    try {
      const ids = Array.from(selectedOrders);
      await voltarParaEnvios.mutateAsync(ids);
      setSelectedOrders(new Set());
      await fetchOrders();
    } catch (error: any) {
      alert(`Erro ao voltar pedidos: ${error.message}`);
    }
  };

  // Handler para limpar rastreio (Reset) - USA FUNÇÃO SQL COM CONFIRMAÇÃO
  const handleClearTracking = async (orderId: string) => {
    if (!confirm('Deseja resetar o código de rastreio para gerar nova etiqueta?')) return;

    try {
      // Usar a função SQL que permite remoção com confirmação
      const { data, error } = await supabase.rpc('resetar_etiqueta_pedido', {
        p_pedido_id: orderId,
        p_confirmacao: true  // Confirmação explícita para o trigger
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.error || data.message || 'Erro ao remover etiqueta');
      }

      await fetchOrders();
      toast.success('Etiqueta removida com sucesso!');
    } catch (error: any) {
      alert(`Erro ao limpar rastreio: ${error.message}`);
    }
  };

  const handleGerarPixMelhorEnvio = async () => {
    if (selectedOrders.size === 0) {
      toast.error('Selecione ao menos um pedido para gerar o PIX.');
      return;
    }

    if (!confirm(`Deseja gerar o PIX/Checkout para os ${selectedOrders.size} pedido(s) selecionado(s) e enviar ao Webhook?`)) return;

    const toastId = toast.loading('Gerando checkout e acionando Webhook N8N...');
    setLoading(true);
    try {
      const { melhorEnvioService } = await import('../lib/services/melhorEnvioService');
      const ids = Array.from(selectedOrders);
      await melhorEnvioService.gerarPixWebook(ids);
      toast.success('PIX gerado com sucesso! Verifique o WhatsApp ou o webhook.', { id: toastId, duration: 6000 });
      setSelectedOrders(new Set());
    } catch (error: any) {
      console.error(error);
      toast.error(`Erro ao gerar PIX: ${error.message}`, { id: toastId, duration: 8000 });
    } finally {
      setLoading(false);
    }
  };

  // Handler para Sincronizar Rastreios (Trocar ID do Carrinho por Código Real do Melhor Envio)
  const handleSyncLabels = async () => {
    if (selectedOrders.size === 0) {
      toast.error('Selecione pelo menos um pedido para sincronizar os rastreios.');
      return;
    }

    if (!confirm(`Deseja sincronizar os rastreios dos ${selectedOrders.size} pedidos selecionados manualmente no Melhor Envio?`)) return;

    setLoading(true);
    const toastId = toast.loading('Sincronizando rastreios selecionados com a Melhor Envio...');

    try {
      const response = await supabase.functions.invoke('sync-melhor-envio-tracking', {
        method: 'POST',
        body: { order_ids: Array.from(selectedOrders) }
      });

      const { data, error } = response;

      // Verificar erro de permissão (401/403)
      if (error?.code === 403 || error?.code === 401 || error?.message?.includes('permission') || error?.message?.includes('UserAuthError')) {
        console.error('❌ ERRO DE PERMISSÃO:', error);
        throw new Error(
          'ERRO DE CONFIGURAÇÃO (401/403): O token da Melhor Envio ou as permissões da Função estão incorretas. ' +
          'Acesse o Dashboard do Supabase para configurar as Variáveis de Ambiente.'
        );
      }

      if (error) throw new Error(error.message);

      if (data && data.success) {
        toast.success(data.message || 'Sincronização concluída com sucesso!', { id: toastId, duration: 8000 });
      } else {
        toast.error(data?.message || 'Sincronização não encontrou arquivos postados.', { id: toastId, duration: 8000 });
      }

      setSelectedOrders(new Set());
      await fetchOrders();
    } catch (error: any) {
      console.error('❌ ERRO AO SINCRONIZAR RASTREIOS:', error);

      // Mensagens de erro mais informativas
      let errorMessage = error.message || 'Erro desconhecido ao sincronizar rastreios';

      if (error.message?.includes('MELHOR_ENVIO_TOKEN')) {
        errorMessage = '⚠️ VARIÁVEIS DE AMBIENTE AUSENTES: Configure MELHOR_ENVIO_TOKEN no Supabase. Veja: CORRECAO_ERRO_403_SINCRONIZACAO.md';
      }

      toast.error(errorMessage, {
        id: toastId,
        duration: 15000,
        description: 'Execute o script de emergência: scripts/sync_rastreios_emergencia.js'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handler para Resetar Etiquetas em Massa por Produto
  const handleBulkResetLabels = async (produto: 'DP' | 'BF' | 'BL') => {
    const produtoNome = {
      'DP': 'Desejo Proibido',
      'BF': 'Bela Forma',
      'BL': 'Bela Lumi'
    }[produto];

    // Filtrar pedidos do produto que têm rastreio
    const candidates = allOrders.filter(o =>
      o.descricao_pacote?.startsWith(produto) && o.codigo_rastreio
    );

    if (candidates.length === 0) {
      alert(`Nenhuma etiqueta de ${produtoNome} encontrada para resetar.`);
      return;
    }

    if (!confirm(`⚠️ ATENÇÃO: Deseja resetar ${candidates.length} etiqueta(s) de ${produtoNome}?\n\nIsso apagará todos os códigos de rastreio e permitirá gerar novas etiquetas.\n\nEsta ação NÃO pode ser desfeita!`)) {
      return;
    }

    setLoading(true);
    try {
      let resetados = 0;

      for (const order of candidates) {
        const { error } = await supabase
          .from('pedidos_consolidados_v3')
          .update({
            codigo_rastreio: null,
            status_envio: 'Pendente',
            erro_ia: null,
            observacao: null
          })
          .eq('id', order.id);

        if (!error) resetados++;
      }

      alert(`✅ Reset concluído!\n\n${resetados} etiqueta(s) de ${produtoNome} foram resetadas.`);
      await fetchOrders();

    } catch (error: any) {
      alert(`Erro ao resetar etiquetas: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Marcar PV como realizado
  const handleMarkPV = async (orderId: string) => {
    const loadingToast = toast.loading('Movendo pedido para PV Realizado...');
    try {
      const { data, error } = await supabase.rpc('marcar_pv_realizado', { p_order_id: orderId });

      if (error) throw error;
      if (data?.status === 'error') throw new Error(data.message);

      // Atualiza estado local imediatamente para feedback visual instantâneo
      setAllOrders(prev => prev.map(o => o.id === orderId ? {
        ...o,
        pv_realizado: true,
        pv_realizado_at: new Date().toISOString()
        // REMOVIDO: foi_editado: true - não deve marcar como editado apenas por mudança de aba
      } : o));

      setSelectedOrders(prev => { const n = new Set(prev); n.delete(orderId); return n; });

      toast.success('Pedido enviado para a aba PV REALIZADO!', { id: loadingToast });

      // Recarrega para garantir sincronia total com o banco
      await fetchOrders();
    } catch (err: any) {
      console.error('Erro ao marcar PV:', err);
      toast.error(`Erro ao mover pedido: ${err.message}`, { id: loadingToast });
    }
  };

  // Handler: Enviar selecionados do PV Realizado para ENVIOS (em massa)
  const handleBulkSendToEnvios = async () => {
    if (selectedOrders.size === 0) return;
    if (!confirm(`Deseja enviar ${selectedOrders.size} pedido(s) selecionado(s) para a aba ENVIOS agora?`)) return;

    const toastId = toast.loading(`Movendo ${selectedOrders.size} pedido(s) para ENVIOS...`);
    setLoading(true);
    let sucesso = 0;
    let erros = 0;
    const hoje = format(new Date(), 'yyyy-MM-dd');

    try {
      for (const orderId of Array.from(selectedOrders)) {
        // Usa a function RPC que já tem permissão
        const { error } = await supabase.rpc('desmarcar_pv_realizado', { p_order_id: orderId });

        if (error) {
          erros++;
        } else {
          sucesso++;
          // Após desmarcar PV, atualiza dia_despacho para hoje
          await supabase
            .from('pedidos_consolidados_v3')
            .update({ dia_despacho: hoje })
            .eq('id', orderId);
        }
      }

      // Atualiza estado local
      setAllOrders(prev => prev.map(o =>
        selectedOrders.has(o.id) ? {
          ...o,
          dia_despacho: hoje,
          pv_realizado: false,
          pv_realizado_at: undefined
        } : o
      ));
      setSelectedOrders(new Set());

      if (erros === 0) {
        toast.success(`${sucesso} pedido(s) movidos para ENVIOS com sucesso!`, { id: toastId, duration: 5000 });
        // Muda para aba ENVIOS automaticamente
        setActiveTab('ready');
      } else {
        toast.error(`${sucesso} OK, ${erros} com erro. Verifique.`, { id: toastId, duration: 6000 });
      }
    } catch (err: any) {
      console.error('Erro no catch:', err);
      toast.error(`Erro: ${err.message}`, { id: toastId });
    } finally {
      setLoading(false);
      // Recarrega após a operação para sincronizar com o banco
      fetchOrders();
    }
  };


  // Handler: Reverter selecionados de ENVIOS para PV Realizado (em massa)
  const handleBulkMoveToPVDone = async () => {
    if (selectedOrders.size === 0) return;
    if (!confirm(`Deseja mover ${selectedOrders.size} pedido(s) selecionado(s) de volta para PV REALIZADO?`)) return;

    const toastId = toast.loading(`Movendo ${selectedOrders.size} pedido(s) para PV REALIZADO...`);
    setLoading(true);
    let sucesso = 0;
    let erros = 0;

    try {
      for (const orderId of Array.from(selectedOrders)) {
        // Marcamos pv_realizado como true para entrar na aba pvDone
        const { error } = await supabase.rpc('marcar_pv_realizado', { p_order_id: orderId });
        if (error) {
          erros++;
        } else {
          sucesso++;
          // Limpamos o dia_despacho forçado
          await supabase
            .from('pedidos_consolidados_v3')
            .update({ dia_despacho: null })
            .eq('id', orderId);
        }
      }

      // Atualiza estado local
      setAllOrders(prev => prev.map(o =>
        selectedOrders.has(o.id) ? {
          ...o,
          pv_realizado: true,
          pv_realizado_at: new Date().toISOString(),
          dia_despacho: null
        } : o
      ));
      setSelectedOrders(new Set());

      if (erros === 0) {
        toast.success(`${sucesso} pedido(s) movidos para PV REALIZADO!`, { id: toastId, duration: 5000 });
        setActiveTab('pvDone');
      } else {
        toast.error(`${sucesso} OK, ${erros} com erro.`, { id: toastId });
      }
      await fetchOrders();
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Handler: Enviar pedido individual de ENVIOS para PV Realizado
  const handleMoveToPVDone = async (orderId: string) => {
    const loadingToast = toast.loading('Movendo pedido para PV REALIZADO...');
    try {
      const { error: rpcError } = await supabase.rpc('marcar_pv_realizado', { p_order_id: orderId });
      if (rpcError) throw rpcError;

      // Limpa dia_despacho para que ele saia de ENVIOS e fique em PV Realizado
      const { error: updateError } = await supabase
        .from('pedidos_consolidados_v3')
        .update({ dia_despacho: null })
        .eq('id', orderId);
      if (updateError) throw updateError;

      // Atualiza local
      setAllOrders(prev => prev.map(o => o.id === orderId ? {
        ...o,
        pv_realizado: true,
        pv_realizado_at: new Date().toISOString(),
        dia_despacho: null
      } : o));

      toast.success('Pedido movido para PV REALIZADO!', { id: loadingToast });
      setActiveTab('pvDone');
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`, { id: loadingToast });
    } finally {
      fetchOrders();
    }
  };

  // Handler: Reverter selecionados do PV Realizado para PÓS-VENDAS (em massa)
  const handleBulkRevertToPostSale = async () => {
    if (selectedOrders.size === 0) return;
    if (!confirm(`Deseja reverter ${selectedOrders.size} pedido(s) selecionado(s) para a aba PÓS-VENDAS agora?`)) return;

    const toastId = toast.loading(`Revertendo ${selectedOrders.size} pedido(s) para PÓS-VENDAS...`);
    setLoading(true);
    let sucesso = 0;
    let erros = 0;

    try {
      for (const orderId of Array.from(selectedOrders)) {
        const { error } = await supabase.rpc('desmarcar_pv_realizado', { p_order_id: orderId });
        if (error) { erros++; } else { sucesso++; }
      }

      // Atualiza estado local
      setAllOrders(prev => prev.map(o =>
        selectedOrders.has(o.id) ? { ...o, pv_realizado: false, pv_realizado_at: undefined } : o
      ));
      setSelectedOrders(new Set());

      if (erros === 0) {
        toast.success(`${sucesso} pedido(s) revertidos para PÓS-VENDAS com sucesso!`, { id: toastId, duration: 5000 });
      } else {
        toast.error(`${sucesso} OK, ${erros} com erro. Verifique.`, { id: toastId, duration: 6000 });
      }
      await fetchOrders();
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Handler: Desmarcar PV
  const handleUnmarkPV = async (orderId: string) => {
    const loadingToast = toast.loading('Revertendo PV realizado...');
    try {
      const { data, error } = await supabase.rpc('desmarcar_pv_realizado', { p_order_id: orderId });

      if (error) throw error;
      if (data?.status === 'error') throw new Error(data.message);

      setAllOrders(prev => prev.map(o => o.id === orderId ? {
        ...o,
        pv_realizado: false,
        pv_realizado_at: undefined,
        dia_despacho: undefined // Volta para o cálculo automático de data segura
      } : o));

      toast.success('PV revertido com sucesso!', { id: loadingToast });
      await fetchOrders();
    } catch (err: any) {
      console.error('Erro ao desmarcar PV:', err);
      toast.error(`Erro ao reverter: ${err.message}`, { id: loadingToast });
    }
  };

  // Handler: Enviar pedido individual de PV Realizado para ENVIOS
  const handleSendToEnvios = async (orderId: string) => {
    const loadingToast = toast.loading('Movendo pedido para ENVIOS...');
    try {
      const hoje = format(new Date(), 'yyyy-MM-dd');

      // Usa a function RPC que já tem permissão
      const { error: rpcError } = await supabase.rpc('desmarcar_pv_realizado', { p_order_id: orderId });
      if (rpcError) throw rpcError;

      // Após desmarcar PV, atualiza dia_despacho para hoje
      const { error: updateError } = await supabase
        .from('pedidos_consolidados_v3')
        .update({ dia_despacho: hoje })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Atualiza estado local
      setAllOrders(prev => prev.map(o => o.id === orderId ? {
        ...o,
        dia_despacho: hoje,
        pv_realizado: false,
        pv_realizado_at: undefined
      } : o));

      toast.success('Pedido movido para ENVIOS!', { id: loadingToast });
      // Muda para aba ENVIOS automaticamente
      setActiveTab('ready');
    } catch (err: any) {
      console.error('Erro ao enviar para ENVIOS:', err);
      toast.error(`Erro: ${err.message}`, { id: loadingToast });
    } finally {
      // Recarrega após a operação para sincronizar com o banco
      fetchOrders();
    }
  };

  // Handler: Abrir modal de unificação por endereço
  const handleOpenUnificarEnderecoModal = (orderId: string) => {
    setPedidoParaUnificar(orderId);
    setIsUnificarEnderecoModalOpen(true);
  };

  // Handler: Fechar modal de unificação por endereço
  const handleCloseUnificarEnderecoModal = () => {
    setIsUnificarEnderecoModalOpen(false);
    setPedidoParaUnificar(null);
  };

  // Handler: Após unificação com sucesso
  const handleUnifySuccess = () => {
    toast.success('Pedidos unificados com sucesso!');
    handleCloseUnificarEnderecoModal();
    fetchOrders();
  };

  // Handler: Bulk Marcar PV
  const handleBulkMarkPV = async () => {
    if (selectedOrders.size === 0) return;
    const ids = Array.from(selectedOrders);
    try {
      for (const id of ids) {
        await supabase.rpc('marcar_pv_realizado', { p_order_id: id });
      }
      setAllOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, pv_realizado: true, pv_realizado_at: new Date().toISOString() } : o));
      setSelectedOrders(new Set());
    } catch (err: any) {
      alert(`Erro ao marcar PV em massa: ${err.message}`);
    }
  };

  // Handler: Salvar edição inline de descricao_pacote
  const saveDescricaoRef = useRef(false);
  const saveDescricao = async (orderId: string) => {
    // Guard contra chamada dupla (Enter + onBlur disparam simultaneamente)
    if (saveDescricaoRef.current) return;
    const newVal = editingDescricaoValue.trim();
    setEditingDescricaoId(null);
    if (!newVal) return;

    saveDescricaoRef.current = true;

    // Atualização otimista ANTES da RPC — garante que o Realtime refetch não sobrescreve
    setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, descricao_pacote: newVal } : o));

    try {
      const { data, error } = await supabase.rpc('atualizar_descricao_pacote', { p_id: orderId, p_descricao: newVal });
      if (error) throw error;
      if (data?.status === 'error') throw new Error(data.message);
      console.log('[saveDescricao] Salvo com sucesso:', newVal);
    } catch (err: any) {
      // Reverter atualização otimista em caso de erro
      setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, descricao_pacote: o.descricao_pacote } : o));
      alert(`Erro ao salvar descrição: ${err.message}`);
    } finally {
      saveDescricaoRef.current = false;
    }
  };

  // Gera descrição combinada inteligente para o modal de unificação.
  // Usa nome_oferta como fonte (sempre gerada pelo consolidar_pedidos),
  // e adiciona sufixos do pedido absorvido que ainda não estejam no main.
  const buildMergeDescricao = (main: PedidoUnificado, absorbed: PedidoUnificado): string => {
    const mainDesc = (main.descricao_pacote || main.nome_oferta || '').trim();
    const absDesc = (absorbed.descricao_pacote || absorbed.nome_oferta || '').trim();

    // Se a descrição absorvida já estiver contida na principal, não duplica
    if (mainDesc.toUpperCase().includes(absDesc.toUpperCase())) {
      return mainDesc;
    }

    // Tentar extrair a sigla do absorvido (DP, BF, BL)
    const siglaAbsMatch = absDesc.match(/\b(DP|BF|BL)\b/i);
    if (siglaAbsMatch) {
      const siglaAbs = siglaAbsMatch[0].toUpperCase();
      if (!mainDesc.toUpperCase().includes(siglaAbs)) {
        return `${mainDesc} + 1 ${siglaAbs}`;
      }
    }

    // Fallback: Concatena as strings se forem diferentes o suficiente
    return `${mainDesc} + ${absDesc}`;
  };

  // Handler: Abrir modal de unificação
  const handleOpenMerge = () => {
    const ids = Array.from(selectedOrders);
    if (ids.length !== 2) return;
    const main = allOrders.find(o => o.id === ids[0])!;
    const absorbed = allOrders.find(o => o.id === ids[1])!;
    setMergeMainId(ids[0]);
    setMergeDescricao(buildMergeDescricao(main, absorbed));
    setIsMergeModalOpen(true);
  };

  // Handler: Confirmar unificação
  const handleMergeOrders = async () => {
    const ids = Array.from(selectedOrders);
    const absorbId = ids.find(id => id !== mergeMainId)!;
    setMergeSaving(true);
    try {
      const { data, error } = await supabase.rpc('unificar_pedidos', {
        p_manter_id: mergeMainId,
        p_absorver_id: absorbId,
        p_nova_descricao: mergeDescricao
      });
      if (error) throw error;
      if (data?.status === 'error') throw new Error(data.message);
      setIsMergeModalOpen(false);
      setSelectedOrders(new Set());
      await fetchOrders();
    } catch (err: any) {
      alert(`Erro ao unificar: ${err.message}`);
    } finally {
      setMergeSaving(false);
    }
  };

  // Selection helpers
  const toggleSelectOrder = (id: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === displayedOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(displayedOrders.map(o => o.id)));
    }
  };

  return (
    <div className="space-y-6 font-mono text-slate-300">
      {/* Top Header & Actions - Command Center Style */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-black text-slate-100 tracking-tight uppercase">Logística de Envios</h2>
            <div className="w-12 h-1 bg-[#a3e635]"></div>
          </div>

          {/* Quadro de Meta PV — Atualização em tempo real via Supabase Realtime */}
          {(() => {
            const totalPV = categorizedOrders.postSale.length;
            const meta = Math.ceil(totalPV * 0.15);
            const vendasCC = allOrders.filter(o => {
              const cod = (o.codigo_transacao || '').toUpperCase();
              if (!cod.endsWith('CC')) return false;
              if (!o.data_venda) return false;
              const orderDayStr = format(new Date(o.data_venda), 'yyyy-MM-dd');
              return orderDayStr === todayStr;
            }).length;
            const progresso = meta > 0 ? Math.min(vendasCC / meta, 1) : 0;
            const percentual = Math.round(progresso * 100);
            const isComplete = progresso >= 1;

            return (
              <div className={`border-2 px-6 py-4 flex items-center gap-6 transition-all duration-500 ${isComplete
                ? 'border-[#22c55e] bg-[#22c55e]/10 shadow-[0_0_20px_rgba(34,197,94,0.25)]'
                : 'border-[#fb923c]/60 bg-[#fb923c]/5 shadow-[0_0_16px_rgba(251,146,60,0.1)]'
                }`}>
                <div className="flex flex-col gap-1">
                  <span className={`text-[10px] font-black tracking-[0.2em] uppercase ${isComplete ? 'text-[#22c55e]' : 'text-[#fb923c]'}`}>🎯 Meta PV</span>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-black font-mono tabular-nums leading-none ${isComplete ? 'text-[#22c55e]' : vendasCC > 0 ? 'text-[#fb923c]' : 'text-text-primary'}`}>
                      {vendasCC}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 min-w-[120px]">
                  <div className="w-full h-3 bg-surface-dark overflow-hidden border border-border">
                    <div
                      className={`h-full transition-all duration-700 ease-out ${isComplete ? 'bg-[#22c55e] shadow-[0_0_8px_#22c55e]' : 'bg-[#fb923c] shadow-[0_0_8px_#fb923c]'}`}
                      style={{ width: `${percentual}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-black font-mono tracking-widest text-center ${isComplete ? 'text-[#22c55e]' : 'text-slate-400'}`}>
                    {percentual}%
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Botões de Ação Auxiliar Rápida */}
          <div className="flex items-start gap-2 border border-slate-800 bg-[#020617] p-1.5">
            {can('logistics:edit') && <BotaoCriarPedidoManual onSuccess={() => fetchOrders()} />}
            {can('logistics:edit') && <BotaoConsolidar onComplete={() => fetchOrders()} />}
            <BotaoRelatorioEnvios pedidosEnvios={categorizedOrders.ready} />
          </div>

          {/* Date Selector for Shipping Reference */}
          <div className="flex items-center gap-2 bg-background border border-border px-3 py-1.5 transition-colors focus-within:border-[#a3e635]">
            <Calendar className="w-4 h-4 text-text-secondary" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden sm:inline">Data Envio:</span>
            <input
              type="date"
              value={shippingRefDate}
              onChange={(e) => setShippingRefDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-text-primary outline-none font-mono"
            />
            <button
              onClick={() => setShippingRefDate(format(new Date(), 'yyyy-MM-dd'))}
              className="text-[10px] uppercase tracking-widest font-bold text-[#a3e635] hover:text-[#020617] bg-primary/10 hover:bg-primary px-2 py-1 ml-1 transition-all border border-primary/30 hover:border-transparent"
              title="Resetar para Hoje"
            >
              Hoje
            </button>
          </div>

          {activeTab === 'ready' && selectedOrders.size > 0 && can('logistics:edit') && (
            <button
              onClick={handleBulkMoveToPVDone}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border border-indigo-500/30 text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white"
              title="Mover Selecionados para PV Realizado"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              MOVER PARA PV REALIZADO ({selectedOrders.size})
            </button>
          )}

          {/* Botões de Geração de Etiquetas — Visíveis apenas na aba Envios */}
          {activeTab === 'ready' && can('logistics:generate_labels') && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mr-2 mb-1">Gerar Etiquetas</span>
              <div className="flex items-center gap-0">
                {['DP', 'BF', 'BL', 'BH', 'SS', 'MJ'].map((sigla) => (
                  <button
                    key={sigla}
                    onClick={() => openProviderChoice(sigla)}
                    className={`px-4 py-2 border text-xs font-black transition-colors border-slate-700 bg-slate-900 text-slate-300 hover:text-[#020617] hover:bg-[#a3e635] hover:border-[#a3e635] ${
                      sigla === 'DP' ? 'rounded-l-none' : ''
                    } ${sigla === 'MJ' ? 'border-r rounded-r-none' : 'border-r-0'}`}
                    title={`Gerar Etiquetas ${sigla}`}
                  >
                    {sigla}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Botão de Exportação */}
          <div className="border border-border bg-background transition-all hover:border-slate-400 dark:hover:border-slate-600">
            <ExportButton orders={displayedOrders} />
          </div>

          {/* Botão Sync (Apenas Dev) */}
          {ENV.isDevelopment && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors border border-indigo-500/30 text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white disabled:opacity-50"
              title="Sincronizar Produção → Staging"
            >
              <Database className={`w-3.5 h-3.5 ${isSyncing ? 'animate-pulse text-indigo-300' : ''}`} />
              {isSyncing ? 'SYNC...' : 'SYNC DB'}
            </button>
          )}

        </div>
      </div>

      <div className="bg-surface backdrop-blur-sm border border-border overflow-hidden flex flex-col min-h-[600px] relative">


        {/* Tabs & Filters */}
        <div className="p-5 border-b border-border bg-background flex flex-col xl:flex-row gap-6 justify-between items-center">

          {/* Segmented Control Tabs - Tactical Grid */}
          <div className="flex bg-background border border-border p-0.5 self-start xl:self-center flex-wrap">
            {/* 1. VENDAS */}
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-5 py-2.5 text-[11px] font-mono font-bold uppercase tracking-widest transition-all duration-200 flex items-center gap-2 relative ${activeTab === 'sales'
                ? 'text-amber-400 bg-amber-400/10 border border-amber-400/40 shadow-[inset_0_0_8px_rgba(251,191,36,0.15)]'
                : 'text-text-secondary hover:text-text-primary hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent'
                }`}
            >
              <ShoppingBag className="w-4 h-4" />
              Vendas
              <span className={`px-1.5 py-0.5 text-[9px] font-black ${activeTab === 'sales' ? 'bg-amber-400 text-[#020617]' : 'bg-slate-800 text-slate-400'}`}>
                {categorizedOrders.sales.length}
              </span>
            </button>
            {/* 2. PÓS VENDAS */}
            <button
              onClick={() => setActiveTab('postSale')}
              className={`px-5 py-2.5 text-[11px] font-mono font-bold uppercase tracking-widest transition-all duration-200 flex items-center gap-2 relative ${activeTab === 'postSale'
                ? 'text-[#fb923c] bg-[#fb923c]/10 border border-[#fb923c]/40 shadow-[inset_0_0_8px_rgba(251,146,60,0.15)]'
                : 'text-text-secondary hover:text-text-primary hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent'
                }`}
            >
              <Phone className="w-4 h-4" />
              Pós Vendas
              <span className={`px-1.5 py-0.5 text-[9px] font-black ${activeTab === 'postSale' ? 'bg-[#fb923c] text-[#020617]' : 'bg-slate-800 text-slate-400'}`}>
                {categorizedOrders.postSale.length}
              </span>
            </button>
            {/* 3. PV REALIZADO */}
            <button
              onClick={() => setActiveTab('pvDone')}
              className={`px-5 py-2.5 text-[11px] font-mono font-bold uppercase tracking-widest transition-all duration-200 flex items-center gap-2 relative ${activeTab === 'pvDone'
                ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/40 shadow-[inset_0_0_8px_rgba(52,211,153,0.15)]'
                : 'text-text-secondary hover:text-text-primary hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent'
                }`}
            >
              <CheckSquare className="w-4 h-4" />
              PV Realizado
              <span className={`px-1.5 py-0.5 text-[9px] font-black ${activeTab === 'pvDone' ? 'bg-emerald-400 text-[#020617]' : 'bg-slate-800 text-slate-400'}`}>
                {categorizedOrders.pvDone.length}
              </span>
            </button>
            {/* 4. ENVIOS */}
            <button
              onClick={() => setActiveTab('ready')}
              className={`px-5 py-2.5 text-[11px] font-mono font-bold uppercase tracking-widest transition-all duration-200 flex items-center gap-2 relative ${activeTab === 'ready'
                ? 'text-[#a3e635] bg-[#a3e635]/10 border border-[#a3e635]/40 shadow-[inset_0_0_8px_rgba(163,230,53,0.15)]'
                : 'text-text-secondary hover:text-text-primary hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent'
                }`}
            >
              <Truck className="w-4 h-4" />
              Envios
              <span className={`px-1.5 py-0.5 text-[9px] font-black ${activeTab === 'ready' ? 'bg-[#a3e635] text-[#020617]' : 'bg-slate-800 text-slate-400'}`}>
                {categorizedOrders.ready.length}
              </span>
            </button>
            {/* 5. ETIQUETADOS */}
            <button
              onClick={() => setActiveTab('labeled')}
              className={`px-5 py-2.5 text-[11px] font-mono font-bold uppercase tracking-widest transition-all duration-200 flex items-center gap-2 relative ${activeTab === 'labeled'
                ? 'text-cyan-400 bg-cyan-400/10 border border-cyan-400/40 shadow-[inset_0_0_8px_rgba(34,211,238,0.15)]'
                : 'text-text-secondary hover:text-text-primary hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent'
                }`}
            >
              <Tag className="w-4 h-4" />
              Etiquetados
              <span className={`px-1.5 py-0.5 text-[9px] font-black ${activeTab === 'labeled' ? 'bg-cyan-400 text-[#020617]' : 'bg-slate-800 text-slate-400'}`}>
                {categorizedOrders.labeled.length}
              </span>
            </button>
            {/* 6. ENVIADOS */}
            <button
              onClick={() => setActiveTab('sent')}
              className={`px-5 py-2.5 text-[11px] font-mono font-bold uppercase tracking-widest transition-all duration-200 flex items-center gap-2 relative ${activeTab === 'sent'
                ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/40 shadow-[inset_0_0_8px_rgba(52,211,153,0.15)]'
                : 'text-text-secondary hover:text-text-primary hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent'
                }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Enviados
              <span className={`px-1.5 py-0.5 text-[9px] font-black ${activeTab === 'sent' ? 'bg-emerald-400 text-[#020617]' : 'bg-slate-800 text-slate-400'}`}>
                {categorizedOrders.sent?.length || 0}
              </span>
            </button>
            {/* 7. CANCELADOS */}
            <button
              onClick={() => setActiveTab('cancelados')}
              className={`px-5 py-2.5 text-[11px] font-mono font-bold uppercase tracking-widest transition-all duration-200 flex items-center gap-2 relative ${activeTab === 'cancelados'
                ? 'text-red-400 bg-red-400/10 border border-red-400/40 shadow-[inset_0_0_8px_rgba(248,113,113,0.15)]'
                : 'text-text-secondary hover:text-text-primary hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent'
                }`}
            >
              <Trash2 className="w-4 h-4" />
              Cancelados
              <span className={`px-1.5 py-0.5 text-[9px] font-black ${activeTab === 'cancelados' ? 'bg-red-400 text-[#020617]' : 'bg-slate-800 text-slate-400'}`}>
                {categorizedOrders.cancelados?.length || 0}
              </span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
            <div className="relative w-full sm:w-80 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 group-focus-within:text-[#a3e635] transition-colors" />
              <input
                type="text"
                placeholder="BUSCAR CLIENTE, CPF..."
                className="w-full bg-background border border-border rounded-none pl-10 pr-4 py-2.5 text-xs font-mono font-medium text-text-primary placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative w-full sm:w-40 group">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 group-focus-within:text-[#a3e635] transition-colors" />
              <input
                type="text"
                placeholder="DD/MM/AA"
                className="w-full bg-background border border-border rounded-none pl-10 pr-4 py-2.5 text-xs font-mono font-bold text-text-primary placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] transition-all"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Banner Pós Vendas — com Meta */}
        {activeTab === 'postSale' && (() => {
          const totalPV = categorizedOrders.postSale.length;
          const meta = Math.ceil(totalPV * 0.15);
          return (
            <div className="mx-6 mt-6 bg-[#fb923c]/10 border border-[#fb923c]/40 shadow-[inset_0_0_8px_rgba(251,146,60,0.15)] p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-widest uppercase text-[#fb923c]">
                <Phone className="w-4 h-4" />
                REALIZAR PÓS-VENDA DESTES PEDIDOS HOJE
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-slate-500">
                  META PV:
                </span>
                <span className="px-3 py-1 bg-[#fb923c] text-[#020617] text-sm font-black font-mono tracking-wider">
                  {meta} VENDAS
                </span>
                <span className="text-[10px] font-mono font-bold tracking-widest text-slate-600">
                  (15% de {totalPV})
                </span>
              </div>
            </div>
          );
        })()}
        {activeTab === 'sales' && (
          <div className="mx-6 mt-6 bg-amber-400/10 border border-amber-400/40 shadow-[inset_0_0_8px_rgba(251,191,36,0.15)] p-3 text-center text-xs font-mono font-bold tracking-widest uppercase text-amber-400 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            VENDAS RECENTES — PÓS-VENDA SERÁ NO PRÓXIMO DIA ÚTIL
          </div>
        )}

        {/* Bulk Action Bar — Ready Tab */}
        {selectedOrders.size > 0 && activeTab === 'ready' && (
          <div className="mx-6 mt-6 bg-[#a3e635]/10 border border-[#a3e635]/40 shadow-[inset_0_0_8px_rgba(163,230,53,0.15)] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
            <span className="text-[11px] text-[#a3e635] font-mono font-bold tracking-widest uppercase">
              // {selectedOrders.size} ALVOS SELECIONADOS
            </span>
            <div className="flex items-center gap-3">
              {selectedOrders.size === 2 && can('pedidos:edit') && (() => {
                const ids = Array.from(selectedOrders);
                const o1 = allOrders.find(o => o.id === ids[0]);
                const o2 = allOrders.find(o => o.id === ids[1]);
                const sameCpf = o1 && o2 && getDeepVal(o1, ['cpf', 'cpf_cliente']) === getDeepVal(o2, ['cpf', 'cpf_cliente']);
                if (!sameCpf) return null;
                return (
                  <button
                    onClick={handleOpenMerge}
                    className="bg-transparent border border-[#fb923c] text-[#fb923c] hover:bg-[#fb923c] hover:text-[#020617] px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all focus:outline-none flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    UNIFICAR PEDIDOS
                  </button>
                );
              })()}
              {can('logistics:generate_labels') && (
                <button
                  onClick={handleBulkMarkLabeled}
                  className="bg-[#a3e635] hover:bg-[#84cc16] text-[#020617] px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all focus:outline-none flex items-center gap-2"
                >
                  <Tag className="w-3.5 h-3.5" />
                  FORÇAR ETIQUETA GERADA
                </button>
              )}
            </div>
          </div>
        )}

        {/* Totalização de Frete — Labeled Tab */}
        {activeTab === 'labeled' && (
          <div className="mx-6 mt-6">
            <TotalizacaoFrete
              miniEnvios={totalizacaoFrete.mini_envios}
              pac={totalizacaoFrete.pac}
              sedex={totalizacaoFrete.sedex}
              total={totalizacaoFrete.total}
              isLoading={false}
            />
          </div>
        )}

        {/* Bulk Action Bar — Labeled Tab */}
        {selectedOrders.size > 0 && activeTab === 'labeled' && (
          <div className="mx-6 mt-6 bg-cyan-400/10 border border-cyan-400/40 shadow-[inset_0_0_8px_rgba(34,211,238,0.15)] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
            <span className="text-[11px] text-cyan-400 font-mono font-bold tracking-widest uppercase">
              // {selectedOrders.size} CÓDIGOS EM ANÁLISE
            </span>
            <div className="flex gap-2">
              {can('logistics:sync') && (
                <button
                  onClick={handleSyncLabels}
                  disabled={loading}
                  className="bg-transparent border border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-[#020617] px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all focus:outline-none flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  SINCRONIZAR RASTREIOS
                </button>
              )}
              {can('logistics:edit') && (
                <button
                  onClick={handleBulkMarkSent}
                  disabled={marcarPostadoEmMassa.isPending}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all focus:outline-none flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {marcarPostadoEmMassa.isPending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      PROCESSANDO...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      MARCAR COMO POSTADO
                    </>
                  )}
                </button>
              )}
              {can('logistics:generate_labels') && (
                <button
                  onClick={handleBulkUndoLabel}
                  disabled={resetEtiquetasEmMassa.isPending}
                  className="bg-transparent border border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-[#020617] px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all focus:outline-none flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetEtiquetasEmMassa.isPending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                      REMOVENDO...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      DESFAZER ETIQUETAS
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bulk Action Bar — Enviados Tab */}
        {selectedOrders.size > 0 && activeTab === 'sent' && (
          <div className="mx-6 mt-6 bg-emerald-400/10 border border-emerald-400/40 shadow-[inset_0_0_8px_rgba(52,211,153,0.15)] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
            <span className="text-[11px] text-emerald-400 font-mono font-bold tracking-widest uppercase">
              // {selectedOrders.size} ENVIOS SELECIONADOS
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleSyncLabels}
                disabled={loading}
                className="bg-transparent border border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-[#020617] px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all focus:outline-none flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                SINCRONIZAR RASTREIOS
              </button>
              {can('logistics:edit') && (
                <button
                  onClick={handleBulkVoltarParaEnvios}
                  disabled={voltarParaEnvios.isPending}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all focus:outline-none flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {voltarParaEnvios.isPending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      PROCESSANDO...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      VOLTAR PARA ENVIOS
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => setSelectedOrders(new Set())}
                className="bg-transparent border border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-[#020617] px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all focus:outline-none flex items-center gap-2"
              >
                <X className="w-3.5 h-3.5" />
                LIMPAR SELEÇÃO
              </button>
            </div>
          </div>
        )}

        {/* Bulk Action Bar — Pós Vendas Tab */}
        {selectedOrders.size > 0 && activeTab === 'postSale' && (
          <div className="mx-6 mt-6 bg-[#fb923c]/10 border border-[#fb923c]/40 shadow-[inset_0_0_8px_rgba(251,146,60,0.15)] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
            <span className="text-[11px] text-[#fb923c] font-mono font-bold tracking-widest uppercase">
              // {selectedOrders.size} PEDIDOS SELECIONADOS
            </span>
            {can('dashboard_posvenda:view_all') && (
              <button
                onClick={handleBulkMarkPV}
                className="bg-[#fb923c] hover:bg-orange-500 text-[#020617] px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all focus:outline-none flex items-center gap-2"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                MARCAR PV REALIZADO
              </button>
            )}
          </div>
        )}

        {/* Bulk Action Bar — PV Realizado Tab */}
        {selectedOrders.size > 0 && activeTab === 'pvDone' && (
          <div className="mx-6 mt-6 bg-emerald-400/10 border border-emerald-400/40 shadow-[inset_0_0_8px_rgba(52,211,153,0.15)] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
            <span className="text-[11px] text-emerald-400 font-mono font-bold tracking-widest uppercase">
              // {selectedOrders.size} PEDIDOS SELECIONADOS
            </span>
            <div className="flex items-center gap-3">
              {can('logistics:edit') && (
                <button
                  onClick={handleBulkRevertToPostSale}
                  disabled={loading}
                  className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all focus:outline-none flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      PROCESSANDO...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      REVERTER PARA PÓS-VENDAS
                    </>
                  )}
                </button>
              )}
              {can('logistics:edit') && (
                <button
                  onClick={handleBulkSendToEnvios}
                  disabled={loading}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all focus:outline-none flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      PROCESSANDO...
                    </>
                  ) : (
                    <>
                      <Truck className="w-3.5 h-3.5" />
                      ENVIAR PARA ENVIOS
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto flex-1 mt-0 relative z-10 border-t border-slate-800">
          {loading ? (
            <div className="p-8"><TableSkeleton /></div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-400 uppercase tracking-widest bg-[#020617] border-b border-slate-800 font-mono">
                <tr>
                  {(activeTab === 'ready' || activeTab === 'labeled' || activeTab === 'sent' || activeTab === 'postSale' || activeTab === 'pvDone' || activeTab === 'sales') && (
                    <th className="px-5 py-4 w-12 border-r border-slate-800/50">
                      <input
                        type="checkbox"
                        checked={displayedOrders.length > 0 && selectedOrders.size === displayedOrders.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded-none border-slate-700 bg-slate-900 text-[#a3e635] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#a3e635]"
                      />
                    </th>
                  )}
                  <th className="px-5 py-4 font-bold border-r border-slate-800/50">DAT::SYS</th>
                  <th className="px-5 py-4 font-bold border-r border-slate-800/50">PRODUTO/TARGET</th>
                  <th className="px-5 py-4 font-bold border-r border-slate-800/50">DESTINATÁRIO</th>
                  <th className="px-5 py-4 font-bold border-r border-slate-800/50">SLOT</th>
                  <th className="px-5 py-4 font-bold border-r border-slate-800/50">TRACK</th>
                  {activeTab === 'labeled' && (
                    <th className="px-5 py-4 font-bold border-r border-slate-800/50">FRETE</th>
                  )}
                  <th className="px-5 py-4 font-bold text-right">#OP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {displayedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'labeled' ? 9 : 8} className="px-6 py-16 text-center text-slate-500 font-mono uppercase text-xs tracking-widest">
                      &gt; ARRAY DE DADOS VAZIO NA VARREDURA DO PERÍMETRO
                    </td>
                  </tr>
                ) : (
                  displayedOrders.map((order) => {
                    const isRisk = getFraudRisk(order);
                    const clientName = getDeepVal(order, keys.nome) || 'Cliente sem nome';
                    const clientCpf = getDeepVal(order, keys.cpf) || 'CPF N/A';
                    const clientEmail = getDeepVal(order, keys.email);
                    const displayCodes = formatGroupCodes(order.codigos_agrupados);
                    const addressDisplay = getDisplayAddress(order);

                    // Correção: Extrair data sem shift de timezone
                    const getSafeDateFromStr = (dateStr: string | null | undefined, fallbackDate: Date) => {
                      if (!dateStr) return fallbackDate;
                      // Formato esperado: YYYY-MM-DD
                      const [y, m, d] = dateStr.split('-').map(Number);
                      return new Date(y, m - 1, d);
                    };

                    const safeDate = getSafeDateFromStr(
                      order.dia_despacho,
                      getSafeShipDate(order.data_venda || order.created_at)
                    );
                    const isLate = activeTab === 'postSale';

                    const dupNotif = notifications.find(n => n.type === 'possivel_duplicata' && n.similarPair?.pedidoPai.id === order.id);

                    return (
                      <tr key={order.id} className={`group border-b border-border hover:bg-surface-hover transition-colors duration-200 cursor-default ${selectedOrders.has(order.id) ? 'bg-[#a3e635]/5 shadow-[inset_4px_0_0_#a3e635]' : isRisk ? 'bg-amber-500/5 shadow-[inset_4px_0_0_#f59e0b]' : dupNotif ? 'bg-amber-500/5 shadow-[inset_4px_0_0_#fbbf24]' : ''}`}>
                        {(activeTab === 'ready' || activeTab === 'labeled' || activeTab === 'sent' || activeTab === 'postSale' || activeTab === 'pvDone' || activeTab === 'sales') && (
                          <td className="px-5 py-5 w-12 border-r border-slate-800/50">
                            <input
                              type="checkbox"
                              checked={selectedOrders.has(order.id)}
                              onChange={() => toggleSelectOrder(order.id)}
                              className="w-4 h-4 rounded-none border-slate-700 bg-slate-900 text-[#a3e635] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#a3e635]"
                            />
                          </td>
                        )}
                        <td className="px-5 py-5 font-mono text-xs border-r border-slate-800/50 text-slate-500 whitespace-nowrap group-hover:text-slate-200">
                          {format(new Date(order.data_venda || order.created_at), 'dd/MM/yy HH:mm')}
                          {renderChangeBadges(order)}
                        </td>
                        <td className="px-5 py-5 border-r border-slate-800/50">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-500 font-mono tracking-widest font-bold" title={displayCodes}>
                              {order.codigo_transacao || displayCodes.substring(0, 25)}
                            </span>
                            {editingDescricaoId === order.id ? (
                              <input
                                autoFocus
                                value={editingDescricaoValue}
                                onChange={e => setEditingDescricaoValue(e.target.value)}
                                onBlur={() => saveDescricao(order.id)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveDescricao(order.id);
                                  if (e.key === 'Escape') setEditingDescricaoId(null);
                                }}
                                className="w-full bg-background border border-[#a3e635] rounded-none px-2 py-1 text-xs font-mono font-bold text-text-primary focus:outline-none focus:ring-1 focus:ring-[#a3e635]"
                              />
                            ) : (
                              <span
                                className="font-bold text-text-primary cursor-pointer hover:text-[#a3e635] transition-colors tracking-tight uppercase"
                                onDoubleClick={() => {
                                  setEditingDescricaoId(order.id);
                                  setEditingDescricaoValue(order.descricao_pacote || order.nome_oferta || '');
                                }}
                                title="Duplo clique para editar"
                              >
                                {formatNomenclatura(order.descricao_pacote || order.nome_oferta || 'UNREGISTERED_DATA')}
                              </span>
                            )}
                            {isRisk && can('pedidos:edit') && (
                              <button
                                onClick={() => handleOpenUnificarEnderecoModal(order.id)}
                                className="inline-flex items-center gap-1.5 text-amber-500 border border-amber-500/40 text-[9px] uppercase font-bold tracking-widest mt-1 w-fit bg-amber-500/10 px-2 py-0.5 shadow-[0_0_8px_rgba(245,158,11,0.15)] hover:bg-amber-500/20 hover:shadow-[0_0_12px_rgba(245,158,11,0.3)] transition-all cursor-pointer"
                                title="Clique para ver pedidos e unificar"
                              >
                                <AlertTriangle className="w-3 h-3" /> Verificar: mesmo endereço
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-5 border-r border-border">
                          <div className="flex flex-col group/client relative max-w-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-text-primary font-bold tracking-tight uppercase">{clientName}</span>
                              {order.observacao && (
                                <span className="relative" title={order.observacao}>
                                  <MessageCircle className="w-3.5 h-3.5 text-text-secondary fill-surface-dark" />
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col mt-0.5">
                              <span className="font-mono text-[11px] font-bold text-[#a3e635]">{clientCpf}</span>
                              <span className="text-[10px] text-slate-500 font-mono tracking-tight uppercase truncate mt-1 group-hover/client:text-slate-300 transition-colors" title={addressDisplay}>{addressDisplay}</span>
                            </div>
                            {order.observacao && (
                              <div className={`mt-2.5 flex items-start gap-2 border p-2 relative ${order.error_geracao_etiqueta ? 'bg-red-500/10 border-red-500/40 shadow-[inset_2px_0_0_#ef4444]' : 'bg-[#fb923c]/5 border-[#fb923c]/30 shadow-[inset_2px_0_0_#fb923c]'}`}>
                                <span className={`text-[10px] font-mono uppercase tracking-widest font-bold leading-snug break-words ${order.error_geracao_etiqueta ? 'text-red-500' : 'text-[#fb923c]'}`}>
                                  {order.error_geracao_etiqueta && "🚨 ERROR: "}
                                  {order.observacao}
                                </span>
                              </div>
                            )}

                            {dupNotif && dupNotif.similarPair && (
                              <button
                                onClick={() => openSimilarPairModal(dupNotif.similarPair!)}
                                className="mt-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-400 py-1.5 px-3 text-[9px] font-bold uppercase tracking-widest outline-none flex items-center justify-center gap-2 animate-pulse transition-all shadow-md w-full"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" /> POSSÍVEL DUPLICATA
                              </button>
                            )}

                            {order.tem_divergencia && order.itens_divergentes && order.itens_divergentes.length > 0 && (
                              <button
                                onClick={() => setSelectedDivergence({ parent: order, child: order.itens_divergentes![0] })}
                                className="mt-2 bg-red-500 hover:bg-red-600 text-white py-1.5 px-3 text-[9px] font-bold uppercase tracking-widest outline-none flex items-center justify-center gap-2 transition-all shadow-lg animate-bounce-subtle"
                              >
                                <AlertCircle className="w-3.5 h-3.5" /> DIVERGÊNCIA DE DADOS
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-5 border-r border-border">
                          <div className={`inline-flex items-center justify-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 border w-fit ${isLate ? 'bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/40 shadow-[0_0_8px_rgba(251,146,60,0.15)]' : 'bg-surface border-border text-text-secondary'}`}>
                            {isLate ? <Lock className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                            {format(safeDate, 'dd/MM')}
                          </div>
                        </td>
                        <td className="px-5 py-5 border-r border-border">
                          {order.codigo_rastreio ? (
                            <div className="flex flex-col gap-1.5 group/tracking">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 text-text-primary bg-background px-3 py-1.5 border border-border w-fit">
                                  <Truck className="w-3.5 h-3.5 text-[#a3e635]" />
                                  <span className="font-mono text-xs font-bold tracking-widest">{order.codigo_rastreio}</span>
                                </div>
                              </div>
                              {order.status_rastreio && (() => {
                                const s = order.status_rastreio;
                                const cfg =
                                  s === 'Entregue' ? { color: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10', dot: 'bg-emerald-400' } :
                                    s === 'Saiu para entrega' ? { color: 'text-blue-400 border-blue-400/40 bg-blue-400/10', dot: 'bg-blue-400' } :
                                      s === 'Em trânsito' ? { color: 'text-sky-400 border-sky-400/40 bg-sky-400/10', dot: 'bg-sky-400' } :
                                        s === 'Em distribuição' ? { color: 'text-cyan-400 border-cyan-400/40 bg-cyan-400/10', dot: 'bg-cyan-400' } :
                                          s === 'Postado' || s === 'Coletado' ? { color: 'text-[#a3e635] border-[#a3e635]/40 bg-[#a3e635]/10', dot: 'bg-[#a3e635]' } :
                                            s === 'Etiqueta emitida' ? { color: 'text-indigo-400 border-indigo-400/40 bg-indigo-400/10', dot: 'bg-indigo-400' } :
                                              s.includes('Devolvido') || s === 'Não entregue' ? { color: 'text-red-400 border-red-400/40 bg-red-400/10', dot: 'bg-red-400' } :
                                                s.includes('Tentativa') ? { color: 'text-amber-400 border-amber-400/40 bg-amber-400/10', dot: 'bg-amber-400' } :
                                                  s === 'Cancelado' ? { color: 'text-rose-400 border-rose-400/40 bg-rose-400/10', dot: 'bg-rose-400' } :
                                                    { color: 'text-slate-400 border-slate-700 bg-slate-800/50', dot: 'bg-slate-400' };
                                return (
                                  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[9px] font-mono font-bold uppercase tracking-widest w-fit ${cfg.color}`}
                                    title={order.ultimo_evento_correios || s}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                    {s}
                                  </div>
                                );
                              })()}
                              {order.tracking_url && (
                                <a
                                  href={order.tracking_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="opacity-0 group-hover/tracking:opacity-100 p-1.5 text-blue-500 hover:text-blue-400 transition-all border border-transparent hover:border-blue-500/50 hover:bg-blue-500/10"
                                  title="Rastrear no Melhor Rastreio"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                              {can('logistics:reset_labels') && (
                                <button
                                  onClick={() => handleClearTracking(order.id)}
                                  className="opacity-0 group-hover/tracking:opacity-100 p-1.5 text-slate-500 hover:text-red-500 transition-all border border-transparent hover:border-red-500/50 hover:bg-red-500/10"
                                  title="Resetar Rastreio (Gerar Novamente)"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ) : order.tracking_url ? (
                            // Tem tracking_url mas ainda não tem código de rastreio (pode demorar até 1 dia útil)
                            <div className="flex items-center gap-2 group/tracking">
                              <div className="flex items-center gap-2 text-amber-400 bg-amber-500/10 px-3 py-1.5 border border-amber-500/30 w-fit">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="font-mono text-[10px] font-bold tracking-widest">AGUARDANDO</span>
                              </div>
                              <a
                                href={order.tracking_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="opacity-0 group-hover/tracking:opacity-100 p-1.5 text-blue-500 hover:text-blue-400 transition-all border border-transparent hover:border-blue-500/50 hover:bg-blue-500/10"
                                title="Rastrear no Melhor Rastreio"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="[RASTREIO]"
                                className="bg-background border border-border px-2 py-1.5 text-xs font-mono font-bold tracking-widest text-text-primary w-32 focus:border-[#a3e635] focus:outline-none focus:ring-1 focus:ring-[#a3e635] uppercase placeholder-slate-400 dark:placeholder-slate-600 rounded-none transition-all shadow-[inset_0_1px_3px_0_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_3px_0_rgba(0,0,0,0.5)]"
                                value={trackingUpdates[order.id] || ''}
                                onChange={(e) => handleTrackingChange(order.id, e.target.value)}
                              />
                              {can('logistics:edit') && trackingUpdates[order.id] && (
                                <button
                                  onClick={() => saveTracking(order.id)}
                                  className="text-[#020617] bg-[#a3e635] hover:bg-[#84cc16] px-2 py-1.5 font-bold uppercase tracking-widest text-[9px] flex items-center gap-1 transition-colors outline-none"
                                  title="Salvar"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  SET
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        {activeTab === 'labeled' && (
                          <td className="px-5 py-5 border-r border-border">
                            {/* DEBUG */}
                            {(() => {
                              const tipo = order.tipo_envio || order.logistica_servico;
                              const valor = order.valor_frete !== undefined && order.valor_frete !== null
                                ? order.valor_frete
                                : order.logistica_valor;

                              console.log('[FRETE DEBUG]', {
                                id: order.id?.slice(0, 8),
                                tipo_envio: order.tipo_envio,
                                logistica_servico: order.logistica_servico,
                                valor_frete: order.valor_frete,
                                logistica_valor: order.logistica_valor,
                                tipoFinal: tipo,
                                valorFinal: valor
                              });

                              if (tipo || valor !== undefined && valor !== null) {
                                return (
                                  <div className="flex flex-col gap-1">
                                    {tipo && (
                                      <span className={`text-[10px] px-2 py-0.5 border w-fit font-bold uppercase tracking-wider ${tipo === 'SEDEX'
                                        ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                                        : tipo === 'PAC'
                                          ? 'border-blue-500/30 text-blue-400 bg-blue-500/10'
                                          : tipo.includes('Mini') || tipo.includes('MINI')
                                            ? 'border-purple-500/30 text-purple-400 bg-purple-500/10'
                                            : 'border-slate-500/30 text-slate-400 bg-slate-500/10'
                                        }`}>
                                        {tipo}
                                      </span>
                                    )}
                                    <span className="font-mono text-[11px] font-bold text-emerald-400">
                                      {valor !== undefined && valor !== null
                                        ? formatarMoeda(Number(valor))
                                        : 'R$ 0,00'}
                                    </span>
                                  </div>
                                );
                              }
                              return <span className="text-[10px] text-slate-600 font-mono uppercase">N/A</span>;
                            })()}
                          </td>
                        )}
                        <td className="px-5 py-5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            {activeTab === 'ready' && !order.codigo_rastreio && (
                              <div className="flex items-center gap-1">
                                {can('logistics:generate_labels') && (
                                  <button
                                    onClick={() => handleMarkAsLabeled(order.id)}
                                    className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                    title="Marcar Etiqueta Gerada"
                                  >
                                    <Tag className="w-4 h-4" />
                                  </button>
                                )}
                                {can('logistics:edit') && (
                                  <button
                                    onClick={() => handleMoveToPVDone(order.id)}
                                    className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                    title="Mover para PV Realizado"
                                  >
                                    <CheckSquare className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            )}
                            {activeTab === 'labeled' && (
                              <>
                                {can('logistics:edit') && (
                                  <button
                                    onClick={() => {
                                      marcarPostado.mutate(order.id, {
                                        onSuccess: () => toast.success('Pedido marcado como postado!')
                                      });
                                    }}
                                    disabled={marcarPostado.isPending}
                                    className="text-emerald-400 hover:text-emerald-300 p-2.5 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Marcar como Postado"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                )}
                                {can('logistics:generate_labels') && (
                                  <button
                                    onClick={() => handleUndoLabel(order.id)}
                                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                    title="Desfazer Gerar Etiqueta"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                            {activeTab === 'postSale' && can('dashboard_posvenda:view_all') && (
                              <button
                                onClick={() => handleMarkPV(order.id)}
                                className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                title="Marcar PV Realizado"
                              >
                                <CheckSquare className="w-4 h-4" />
                              </button>
                            )}
                            {activeTab === 'pvDone' && (
                              <>
                                {can('logistics:edit') && (
                                  <button
                                    onClick={() => handleSendToEnvios(order.id)}
                                    className="text-slate-400 hover:text-[#a3e635] p-2.5 hover:bg-[#a3e635]/10 rounded-lg transition-colors"
                                    title="Enviar para Aba ENVIOS"
                                  >
                                    <Truck className="w-5 h-5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleUnmarkPV(order.id)}
                                  className="text-blue-600 hover:text-slate-500 dark:text-blue-400 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                  title="Desmarcar PV (Voltar para Pós-Vendas)"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {activeTab === 'cancelados' && (
                              <button
                                onClick={() => handleRestorePedido(order.id)}
                                className="text-emerald-600 hover:text-slate-500 dark:text-emerald-400 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="Restaurar Pedido (Voltar para Prontos)"
                                disabled={restoring}
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            {can('pedidos:edit') && (
                              <>
                                <button
                                  onClick={() => openEditModal(order)}
                                  className="text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-200 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                  title="Editar Pedido"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setPedidoParaCancelar(order);
                                    setIsCancelModalOpen(true);
                                  }}
                                  className="text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 p-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                  title="Excluir / Cancelar Pedido"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Client-Side Pagination Footer - Terminal Style */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#020617] flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-slate-500">
              BUFFER: <span className="text-[#a3e635]">{currentList.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> — <span className="text-[#a3e635]">{Math.min(page * pageSize, currentList.length)}</span> / <span className="text-[#a3e635]">{currentList.length}</span> ROWS
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-[#0f172a] border border-slate-700 text-slate-300 font-mono text-[10px] font-bold tracking-widest uppercase px-2 py-1 focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] cursor-pointer rounded-none appearance-none"
            >
              <option value={50}>50 R</option>
              <option value={100}>100 R</option>
              <option value={500}>500 R</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 border border-slate-700 bg-slate-900 hover:border-[#a3e635] hover:text-[#a3e635] text-slate-500 disabled:opacity-30 disabled:hover:border-slate-700 disabled:hover:text-slate-500 transition-colors rounded-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-[10px] font-mono font-black text-slate-300 px-3 tracking-widest">
              PG {page}/{totalPages || 1}
            </span>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="p-1.5 border border-slate-700 bg-slate-900 hover:border-[#a3e635] hover:text-[#a3e635] text-slate-500 disabled:opacity-30 disabled:hover:border-slate-700 disabled:hover:text-slate-500 transition-colors rounded-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      {/* ✨ Modal de Unificação de Pedidos */}
      {isMergeModalOpen && (() => {
        const ids = Array.from(selectedOrders);
        const orders2 = ids.map(id => allOrders.find(o => o.id === id)!).filter(Boolean);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-[#0f172a] border border-[#fb923c]/50 rounded-none shadow-[0_0_20px_rgba(251,146,60,0.1)] w-full max-w-lg transform animate-slide-up">
              <div className="px-6 py-4 border-b border-[#fb923c]/30 flex items-center justify-between bg-[#fb923c]/5">
                <h3 className="text-sm font-mono font-bold tracking-widest text-[#fb923c] uppercase">
                  :: MERGE_ORDERS :: UNIFICAÇÃO
                </h3>
                <button onClick={() => setIsMergeModalOpen(false)} className="text-slate-500 hover:text-red-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                {/* Escolha do pedido principal */}
                <div>
                  <p className="text-xs font-mono font-bold tracking-widest text-slate-400 mb-3 uppercase">
                    &gt; SELECIONE CÓDIGO FONTE (MASTER):
                  </p>
                  <div className="space-y-3">
                    {orders2.map(o => (
                      <label key={o.id} className={`flex items-start gap-3 p-4 border cursor-pointer transition-all duration-200 group ${mergeMainId === o.id
                        ? 'border-[#a3e635] bg-[#a3e635]/10 shadow-[inset_2px_0_0_#a3e635]'
                        : 'border-slate-800 bg-[#020617] hover:border-slate-600'
                        }`}>
                        <div className="flex h-5 items-center">
                          <input
                            type="radio"
                            name="merge-main"
                            value={o.id}
                            checked={mergeMainId === o.id}
                            onChange={() => {
                              setMergeMainId(o.id);
                              // Recalcular descrição com o outro pedido como absorvido
                              const absorbedOrder = orders2.find(x => x.id !== o.id);
                              if (absorbedOrder) {
                                setMergeDescricao(buildMergeDescricao(o, absorbedOrder));
                              } else {
                                setMergeDescricao(o.nome_oferta || o.descricao_pacote || '');
                              }
                            }}
                            className="w-4 h-4 rounded-none border-slate-700 bg-slate-900 text-[#a3e635] focus:ring-0 cursor-pointer"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className={`font-mono font-bold text-xs uppercase tracking-widest transition-colors ${mergeMainId === o.id ? 'text-[#a3e635]' : 'text-text-primary group-hover:text-text-primary'}`}>
                            {formatNomenclatura(o.descricao_pacote || o.nome_oferta || 'UNREGISTERED_DATA')}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-text-secondary mt-0.5 uppercase tracking-widest">
                            ID: {o.codigo_transacao}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                {/* Nova descrição */}
                <div className="pt-2">
                  <label className="text-xs font-mono font-bold tracking-widest text-slate-400 mb-2 block uppercase">
                    &gt; NOVA IDENTIFICAÇÃO (TARGET):
                  </label>
                  <input
                    type="text"
                    value={mergeDescricao}
                    onChange={e => setMergeDescricao(e.target.value)}
                    className="w-full bg-[#020617] border border-slate-800 rounded-none px-4 py-3 text-xs font-mono font-bold tracking-widest text-slate-200 focus:outline-none focus:border-[#fb923c] focus:ring-1 focus:ring-[#fb923c] transition-all"
                    placeholder="E.G. TARGET_MERGED_DATA"
                  />
                  <p className="text-[10px] font-mono font-bold tracking-widest text-[#fb923c] uppercase mt-3 flex items-start gap-2 bg-[#fb923c]/10 p-2 border border-[#fb923c]/20">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> O SEGUNDO CÓDIGO SERÁ COMPLETAMENTE ABSORVIDO PELA MATRIZ.
                  </p>
                </div>
              </div>
              <div className="px-6 py-4 flex items-center justify-end gap-3 bg-[#020617] border-t border-[#fb923c]/30">
                <button
                  onClick={() => setIsMergeModalOpen(false)}
                  disabled={mergeSaving}
                  className="px-5 py-2.5 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 border border-slate-800 hover:text-slate-300 hover:border-slate-500 transition-all disabled:opacity-50"
                >
                  ABORTAR
                </button>
                <button
                  onClick={handleMergeOrders}
                  disabled={mergeSaving || !mergeDescricao.trim()}
                  className="px-5 py-2.5 text-[10px] font-mono font-bold uppercase tracking-widest text-[#020617] bg-[#fb923c] hover:bg-orange-500 disabled:opacity-50 flex items-center gap-2 transition-all"
                >
                  {mergeSaving ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> EXECUTANDO...</>
                  ) : (
                    <><RefreshCw className="w-3.5 h-3.5" /> INICIAR MERGE</>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ✨ Modal de Divergência de Dados */}
      {selectedDivergence && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-red-500/50 w-full max-w-2xl shadow-[0_0_30px_rgba(239,68,68,0.2)] animate-slide-up">
            <div className="px-6 py-4 border-b border-red-500/30 flex items-center justify-between bg-red-500/10">
              <h3 className="text-sm font-mono font-bold tracking-widest text-red-500 uppercase flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> CONFLITO DE DADOS DETECTADO
              </h3>
              <button onClick={() => setSelectedDivergence(null)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                &gt; SISTEMA DETECTOU DADOS DIVERGENTES ENTRE O PEDIDO PAI E UM ITEM QUE COINCIDE COM O MESMO CPF. SELECIONE A AÇÃO DESEJADA:
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Lado Esquerdo: Pedido Pai */}
                <div className="space-y-3">
                  <div className="text-[9px] font-mono font-black text-slate-500 uppercase border-b border-slate-800 pb-1">PEDIDO PAI (ORIGINAL)</div>
                  <div className="bg-slate-900/50 p-3 border border-slate-800 space-y-2">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-mono text-slate-500 uppercase">Nome</span>
                      <span className="text-xs font-bold text-white uppercase">{selectedDivergence.parent.nome_cliente}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-mono text-slate-500 uppercase">E-mail</span>
                      <span className="text-xs font-bold text-white lowercase">{selectedDivergence.parent.email}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-mono text-slate-500 uppercase">Telefone</span>
                      <span className="text-xs font-bold text-white">{selectedDivergence.parent.telefone}</span>
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Item Filho */}
                <div className="space-y-3">
                  <div className="text-[9px] font-mono font-black text-red-500 uppercase border-b border-red-500/20 pb-1">ITEM FILHO (DIVERGENTE)</div>
                  <div className="bg-red-500/5 p-3 border border-red-500/20 space-y-2">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-mono text-slate-500 uppercase">Nome</span>
                      <span className={`text-xs font-bold uppercase ${selectedDivergence.child.nome?.toLowerCase() !== selectedDivergence.parent.nome_cliente?.toLowerCase() ? 'text-red-400 underline underline-offset-4 decoration-red-500/50' : 'text-slate-300'}`}>
                        {selectedDivergence.child.nome}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-mono text-slate-500 uppercase">E-mail</span>
                      <span className={`text-xs font-bold lowercase ${selectedDivergence.child.email?.toLowerCase() !== selectedDivergence.parent.email?.toLowerCase() ? 'text-red-400 underline underline-offset-4 decoration-red-500/50' : 'text-slate-300'}`}>
                        {selectedDivergence.child.email}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-mono text-slate-500 uppercase">Telefone</span>
                      <span className={`text-xs font-bold ${selectedDivergence.child.fone?.replace(/\D/g, '') !== selectedDivergence.parent.telefone?.replace(/\D/g, '') ? 'text-red-400 underline underline-offset-4 decoration-red-500/50' : 'text-slate-300'}`}>
                        {selectedDivergence.child.fone}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-red-500/10 border border-red-500/20 p-3">
                <p className="text-[10px] font-mono font-bold text-red-400 uppercase leading-snug">
                  <AlertCircle className="w-3 h-3 inline mr-1 mb-0.5" /> AO UNIFICAR, O ITEM FILHO SERÁ ABSORVIDO PELO PAI E A QUANTIDADE DE PRODUTOS SERÁ ATUALIZADA.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 flex items-center justify-end gap-3 bg-[#020617] border-t border-slate-800">
              <button
                disabled={resolvingDivergence}
                onClick={async () => {
                  setResolvingDivergence(true);
                  try {
                    const { error } = await supabase.rpc('salvar_decisao_unificacao', {
                      p_hash_filho: selectedDivergence.child.hash,
                      p_hash_pai: selectedDivergence.parent.codigo_transacao,
                      p_acao: 'SEPARAR'
                    });
                    if (error) throw error;
                    toast.success('Decisão salva: Pedidos mantidos separados.');
                    setSelectedDivergence(null);
                    fetchOrders();
                  } catch (e: any) {
                    toast.error('Erro ao salvar decisão: ' + e.message);
                  } finally {
                    setResolvingDivergence(false);
                  }
                }}
                className="px-5 py-2.5 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 border border-slate-800 hover:text-white hover:border-slate-600 transition-all disabled:opacity-50"
              >
                MANTER SEPARADO
              </button>
              <button
                disabled={resolvingDivergence}
                onClick={async () => {
                  setResolvingDivergence(true);
                  try {
                    const { error } = await supabase.rpc('salvar_decisao_unificacao', {
                      p_hash_filho: selectedDivergence.child.hash,
                      p_hash_pai: selectedDivergence.parent.codigo_transacao,
                      p_acao: 'UNIFICAR'
                    });
                    if (error) throw error;
                    toast.success('Unificação realizada com sucesso!');
                    setSelectedDivergence(null);
                    fetchOrders();
                  } catch (e: any) {
                    toast.error('Erro ao unificar: ' + e.message);
                  } finally {
                    setResolvingDivergence(false);
                  }
                }}
                className="px-5 py-2.5 text-[10px] font-mono font-bold uppercase tracking-widest text-[#020617] bg-red-500 hover:bg-red-600 shadow-[0_4px_12px_rgba(239,68,68,0.3)] disabled:opacity-50 flex items-center gap-2 transition-all"
              >
                {resolvingDivergence ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> PROCESSANDO...</>
                ) : (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> CONFIRMAR UNIFICAÇÃO</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ NOVO: Modal de Edição Refatorado */}
      <EditOrderModal
        isOpen={isEditModalOpen}
        order={editingOrder}
        form={editForm}
        errors={fieldErrors}
        saving={saving}
        onClose={closeEditModal}
        onSave={() => saveEdit(() => {
          // Callback de sucesso: atualizar UI localmente
          if (editingOrder) {
            setAllOrders(prev => prev.map(o => o.id === editingOrder.id ? {
              ...o,
              cpf: editForm.cpf,
              nome_cliente: editForm.nome,
              telefone: editForm.telefone,
              email: editForm.email,
              cep: editForm.cep,
              logradouro: editForm.logradouro,
              numero: editForm.numero,
              complemento: editForm.complemento,
              bairro: editForm.bairro,
              cidade: editForm.cidade,
              estado: editForm.estado,
              observacao: editForm.observacao
            } : o));
          }
        })}
        onChange={updateField}
      />

      {/* Modal de Progresso de Geração de Etiquetas */}
      <SimpleLabelProgressModal
        isOpen={isLabelModalOpen}
        onClose={() => {
          setIsLabelModalOpen(false);
          fetchOrders(); // Recarrega pedidos após conclusão
        }}
        onCancel={() => { cancelGenerationRef.current = true; }}
        produto={currentProduto}
        total={labelProgress.total}
        processados={labelProgress.processados}
        sucesso={labelProgress.sucesso}
        erros={labelProgress.erros}
        detalhes={labelProgress.detalhes}
        concluido={labelProgress.concluido}
      />

      {/* ✨ Modal de Confirmação para Remover Etiqueta */}
      {pedidoParaResetar && (
        <ConfirmResetEtiquetaModal
          isOpen={isResetEtiquetaModalOpen}
          pedidoId={pedidoParaResetar.id}
          codigoRastreio={pedidoParaResetar.codigoRastreio}
          nomeCliente={pedidoParaResetar.nomeCliente}
          onClose={() => {
            setIsResetEtiquetaModalOpen(false);
            setPedidoParaResetar(null);
            setPendingUndoLabelId(null);
          }}
          onConfirm={handleConfirmResetEtiqueta}
          isLoading={resetEtiqueta.isPending}
        />
      )}

      {/* ✨ Modal de Seleção de Frete */}
      {pedidoParaCotacao && (
        <SelecaoFreteModal
          isOpen={isSelecaoFreteModalOpen}
          pedidoId={pedidoParaCotacao.id}
          nomeCliente={pedidoParaCotacao.nomeCliente}
          cep={pedidoParaCotacao.cep}
          cotacoes={cotacoesFrete}
          onClose={() => {
            setIsSelecaoFreteModalOpen(false);
            setPedidoParaCotacao(null);
            setCotacoesFrete([]);
          }}
          onConfirm={(tipoEnvio, valor) => {
            // Aqui você implementa a geração da etiqueta com o tipo escolhido
            toast.success(`Etiqueta ${tipoEnvio} gerada! Valor: ${valor}`);
            setIsSelecaoFreteModalOpen(false);
          }}
          isLoading={consultarFrete.isPending}
        />
      )}

      {/* ✨ Modal de Unificação por Endereço */}
      <ModalUnificarEndereco
        isOpen={isUnificarEnderecoModalOpen}
        onClose={handleCloseUnificarEnderecoModal}
        pedidoId={pedidoParaUnificar}
        onUnify={handleUnifySuccess}
      />

      {/* ✨ Modal de Cancelar Pedido */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => {
          setIsCancelModalOpen(false);
          setPedidoParaCancelar(null);
          setMotivoCancelamento('');
        }}
        title="Deseja realmente excluir este pedido?"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Você está prestes a excluir (cancelar) o pedido de <strong>{pedidoParaCancelar ? (getDeepVal(pedidoParaCancelar, keys.nome) || pedidoParaCancelar.nome_cliente) : ''}</strong>. 
            Esta ação o removerá do quadro de logística.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Motivo do Cancelamento <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-white sm:text-sm h-24 resize-none"
              placeholder="Ex: Cliente desistiu antes do envio, pedido duplicado etc..."
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => {
                setIsCancelModalOpen(false);
                setPedidoParaCancelar(null);
                setMotivoCancelamento('');
              }}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmCancel}
              disabled={canceling || !motivoCancelamento.trim()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {canceling ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Processando...
                </>
              ) : 'Confirmar Exclusão'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ✨ MODAL DE SELEÇÃO DE PROVEDOR (CORREIOS VS MELHOR ENVIO) */}
      <Modal
        isOpen={isProviderModalOpen}
        onClose={() => setIsProviderModalOpen(false)}
        title={`GERAR ETIQUETAS: ${pendingProduct}`}
      >
        <div className="p-4 space-y-6">
          <p className="text-sm text-slate-400 font-mono tracking-tight text-center uppercase">
            &gt; SELECIONE O CANAL DE EXPEDIÇÃO PARA O LOTE <span className="text-[#a3e635] font-black">{pendingProduct}</span>:
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleConfirmedGenerate('correios')}
              className="flex flex-col items-center justify-center gap-4 p-8 border-2 border-[#a3e635]/30 hover:border-[#a3e635] bg-[#a3e635]/5 hover:bg-[#a3e635]/10 group transition-all duration-300"
            >
              <div className="w-16 h-16 rounded-full bg-[#a3e635]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Printer className="w-8 h-8 text-[#a3e635]" />
              </div>
              <div className="text-center">
                <span className="block text-lg font-black text-white tracking-widest uppercase">CORREIOS</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Nativo (SIGEP)</span>
              </div>
            </button>

            <button
              onClick={() => handleConfirmedGenerate('melhorenvio')}
              className="flex flex-col items-center justify-center gap-4 p-8 border-2 border-[#fb923c]/30 hover:border-[#fb923c] bg-[#fb923c]/5 hover:bg-[#fb923c]/10 group transition-all duration-300"
            >
              <div className="w-16 h-16 rounded-full bg-[#fb923c]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Truck className="w-8 h-8 text-[#fb923c]" />
              </div>
              <div className="text-center">
                <span className="block text-lg font-black text-white tracking-widest uppercase">MELHOR ENVIO</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-[#fb923c]/70">Sistema de Backup</span>
              </div>
            </button>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-none">
            <p className="text-[9px] font-mono font-bold text-slate-500 uppercase leading-relaxed text-center">
              <AlertCircle className="w-3 h-3 inline mr-1 mb-0.5" /> 
              Dica: Use o Melhor Envio apenas se o serviço dos Correios apresentar instabilidade na API oficial.
            </p>
          </div>
        </div>
      </Modal>
    </div >
  );
};