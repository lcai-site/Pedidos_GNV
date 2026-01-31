import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PedidoUnificado } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Modal } from '../components/ui/Modal';
import { SimpleLabelProgressModal } from '../components/ui/SimpleLabelProgressModal';
import { Search, Printer, Truck, AlertTriangle, Save, Pencil, User, MapPin, Phone, FileText, CheckCircle2, Mail, ChevronLeft, ChevronRight, Calendar, Clock, Lock, StickyNote, PenTool, AlertCircle, Package, RotateCcw, Trash2, RefreshCw } from 'lucide-react';
import type { ResultadoEtiqueta } from '../types/labels';
import { useDateFilter } from '../context/DateFilterContext';
import { format, parseISO, startOfDay, addDays, setHours, setMinutes, isAfter, isEqual, isBefore, getDay } from 'date-fns';

// ✨ NOVO: Imports do módulo logistics refatorado
import { useOrderEdit, EditOrderModal, getDeepVal, DEEP_SEARCH_KEYS, formatGroupCodes, ExportButton, getSafeShipDate } from '../modules/logistics';

export const Logistics: React.FC = () => {
  const { startDate, endDate } = useDateFilter();
  const [allOrders, setAllOrders] = useState<PedidoUnificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [trackingUpdates, setTrackingUpdates] = useState<{ [key: string]: string }>({});

  // Logistics Logic State
  const [shippingRefDate, setShippingRefDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'ready' | 'waiting'>('ready');

  // Client-Side Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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
  const [shouldCancelGeneration, setShouldCancelGeneration] = useState(false);

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

  // Carregar pedidos ao montar o componente
  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    setPage(1);
    try {
      const { data, error } = await supabase
        .from('pedidos_unificados')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      console.log(`📦 LOGÍSTICA: Carregados ${data?.length || 0} pedidos pendentes`);

      setAllOrders(data || []);
    } catch (error) {
      console.error('Error fetching logistics:', error);
    } finally {
      setLoading(false);
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
    const cpf = getDeepVal(order, keys.cpf);
    const address = getDeepVal(order, keys.fullAddress) || getDeepVal(order, keys.street);
    if (!cpf) return false;
    const sameCPF = allOrders.filter(o => {
      const oCpf = getDeepVal(o, keys.cpf);
      return oCpf && oCpf === cpf && o.id !== order.id;
    });
    const hasDifferentAddress = sameCPF.some(o => {
      const oAddr = getDeepVal(o, keys.fullAddress) || getDeepVal(o, keys.street);
      return oAddr && oAddr !== address;
    });
    return hasDifferentAddress;
  };

  const getDisplayAddress = (order: PedidoUnificado) => {
    // Prioridade: endereco_completo (nossa string formatada salva) -> campos planos -> deep search
    if (order.endereco_completo) return order.endereco_completo;

    const street = getDeepVal(order, keys.street);
    const num = getDeepVal(order, keys.number);
    const city = getDeepVal(order, keys.city);
    const uf = getDeepVal(order, keys.state);
    if (street) return `${street}, ${num} - ${city}/${uf}`;

    return getDeepVal(order, keys.fullAddress) || 'Endereço n/d';
  }

  // --- Filtering & Rules Logic ---

  // 1. Filtragem Geral (Busca)
  const searchFilteredOrders = allOrders.filter(order => {
    if (!order) return false;
    const term = searchTerm.toLowerCase();
    const pkgDesc = String(order.descricao_pacote || '').toLowerCase();
    const name = String(getDeepVal(order, keys.nome)).toLowerCase();
    const email = String(getDeepVal(order, keys.email)).toLowerCase();
    const fullAddr = String(getDisplayAddress(order)).toLowerCase();
    const rawGroup = order.codigos_agrupados;
    const groupCode = Array.isArray(rawGroup) ? rawGroup.join(' ').toLowerCase() : String(rawGroup || '').toLowerCase();
    return pkgDesc.includes(term) || name.includes(term) || email.includes(term) || groupCode.includes(term) || fullAddr.includes(term);
  });

  // 2. Aplicação da Regra de Janela de Pós-Venda
  const categorizedOrders = {
    ready: [] as PedidoUnificado[],
    waiting: [] as PedidoUnificado[]
  };

  const refDate = startOfDay(parseISO(shippingRefDate));
  const today = startOfDay(new Date());

  searchFilteredOrders.forEach(order => {
    // Se já foi enviado (tem data_envio), sempre aparece na lista de prontos (histórico)
    if (order.data_envio) {
      categorizedOrders.ready.push(order);
      return;
    }

    // ✅ LÓGICA SIMPLES: Pronto = dia_despacho é a data de referência
    // Se não houver dia_despacho, usar o cálculo antigo
    if (order.dia_despacho) {
      const diaDespacho = startOfDay(parseISO(order.dia_despacho));

      // Debug: Log para os primeiros 5 pedidos
      if (categorizedOrders.ready.length + categorizedOrders.waiting.length < 5) {
        console.log(`📦 Pedido ${order.codigo_transacao || order.id}:`, {
          data_venda: order.data_venda,
          dia_despacho: format(diaDespacho, 'dd/MM/yyyy'),
          ref_date: format(refDate, 'dd/MM/yyyy'),
          categoria: isEqual(diaDespacho, refDate) || isBefore(diaDespacho, refDate) ? 'PRONTO' : 'AGUARDANDO'
        });
      }

      // Se dia_despacho <= data de referência, está pronto
      if (isEqual(diaDespacho, refDate) || isBefore(diaDespacho, refDate)) {
        categorizedOrders.ready.push(order);
      } else {
        categorizedOrders.waiting.push(order);
      }
    } else {
      // Fallback: usar lógica antiga se não houver dia_despacho
      const cutoffDateTime = parseISO(order.corte_pv || order.data_venda);
      const isToday = isEqual(refDate, today);
      const refDateTime = isToday ? new Date() : setHours(setMinutes(refDate, 59), 23);

      if (isAfter(refDateTime, cutoffDateTime) || isEqual(refDateTime, cutoffDateTime)) {
        categorizedOrders.ready.push(order);
      } else {
        categorizedOrders.waiting.push(order);
      }
    }
  });

  // Log final de resumo
  console.log(`✅ CATEGORIZAÇÃO FINAL:`);
  console.log(`   ✅ Prontos para Envio: ${categorizedOrders.ready.length}`);
  console.log(`   ⏳ Aguardando Janela PV: ${categorizedOrders.waiting.length}`);
  console.log(`   📦 Total: ${categorizedOrders.ready.length + categorizedOrders.waiting.length}`);

  const currentList = activeTab === 'ready' ? categorizedOrders.ready : categorizedOrders.waiting;

  const totalPages = Math.ceil(currentList.length / pageSize);
  const displayedOrders = currentList.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, pageSize, activeTab, shippingRefDate]);

  // Renderiza Badges de Mudança
  const renderChangeBadges = (order: PedidoUnificado) => {
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
  const handleGenerateLabels = async (produto: 'DP' | 'BF' | 'BL') => {
    try {
      setCurrentProduto(produto);
      setShouldCancelGeneration(false); // Reset cancel flag
      setLabelProgress({
        total: 0,
        processados: 0,
        sucesso: 0,
        erros: 0,
        detalhes: [],
        concluido: false
      });
      setIsLabelModalOpen(true);

      // Importar serviço dinamicamente
      const { labelGenerationService } = await import('../lib/services/labelGenerationService');

      // Callback de progresso
      const onProgress = (resultado: ResultadoEtiqueta) => {
        setLabelProgress(prev => ({
          ...prev,
          processados: prev.processados + 1,
          sucesso: resultado.status === 'sucesso' ? prev.sucesso + 1 : prev.sucesso,
          erros: resultado.status === 'erro' ? prev.erros + 1 : prev.erros,
          detalhes: [...prev.detalhes, resultado]
        }));
      };

      // Iniciar geração
      const resultado = await labelGenerationService.gerarEtiquetas(
        produto,
        100,
        onProgress,
        () => {
          console.log('🔍 Verificando cancelamento:', shouldCancelGeneration);
          return shouldCancelGeneration;
        }
      );

      // Marcar como concluído
      setLabelProgress(prev => ({ ...prev, concluido: true, total: resultado.sucesso + resultado.erros }));

      // Recarregar pedidos
      await fetchOrders();

    } catch (error: any) {
      alert(`Erro: ${error.message}`);
      setIsLabelModalOpen(false);
    }
  };

  // Handler para limpar rastreio (Reset)
  const handleClearTracking = async (orderId: string) => {
    if (!confirm('Deseja resetar o código de rastreio para gerar nova etiqueta?')) return;

    try {
      const { error } = await supabase
        .from('pedidos_agrupados')
        .update({
          codigo_rastreio: null,
          status_envio: 'Pendente',
          erro_ia: null,
          observacao: null
        })
        .eq('id', orderId);

      if (error) throw error;

      await fetchOrders();
    } catch (error: any) {
      alert(`Erro ao limpar rastreio: ${error.message}`);
    }
  };

  // Handler para Sincronizar Rastreios (Trocar ID por Código Real)
  const handleSyncLabels = async () => {
    // Identificar pedidos com ID de etiqueta (length > 20 indica UUID)
    const candidates = allOrders.filter(o => o.codigo_rastreio && o.codigo_rastreio.length > 20);

    if (candidates.length === 0) {
      alert("Nenhum pedido com etiqueta pendente de sincronização encontrado na listagem atual.");
      return;
    }

    if (!confirm(`Deseja sincronizar ${candidates.length} pedido(s)?\nIsso buscará o código de rastreio real no Melhor Envio (correios/transportadora).`)) return;

    setLoading(true);
    try {
      const ids = candidates.map(o => o.id);
      const response = await fetch('/api/labels/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Erro na sincronização');

      let msg = `✅ Sincronização concluída!\n\nAtualizados: ${result.updated}\nAguardando Postagem: ${result.details.filter((d: any) => d.status === 'pending').length}\nErros: ${result.errors}`;

      alert(msg);
      await fetchOrders();

    } catch (error: any) {
      alert(`Erro ao sincronizar: ${error.message}`);
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

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Logística de Envios</h2>
          <p className="text-slate-500 dark:text-slate-400">Gestão inteligente com janelas de Pós-Venda.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Selector for Shipping Reference */}
          <div className="flex items-center gap-2 bg-surface border border-border px-3 py-2 rounded-lg shadow-sm">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-500 uppercase">Data Envio:</span>
            <input
              type="date"
              value={shippingRefDate}
              onChange={(e) => setShippingRefDate(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-900 dark:text-slate-200 outline-none"
            />
            <button
              onClick={() => setShippingRefDate(new Date().toISOString().split('T')[0])}
              className="text-[10px] uppercase font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded ml-1"
              title="Resetar para Hoje"
            >
              Hoje
            </button>
          </div>

          {/* Botões de Geração de Etiquetas por Produto */}
          <button
            onClick={() => handleGenerateLabels('DP')}
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
          >
            <Package className="w-4 h-4" />
            Etiquetas DP
          </button>

          <button
            onClick={() => handleGenerateLabels('BF')}
            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
          >
            <Package className="w-4 h-4" />
            Etiquetas BF
          </button>

          <button
            onClick={() => handleGenerateLabels('BL')}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
          >
            <Package className="w-4 h-4" />
            Etiquetas BL
          </button>

          <button
            onClick={handleSyncLabels}
            className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
            title="Buscar códigos de rastreio reais para etiquetas geradas"
          >
            <RefreshCw className="w-4 h-4" />
            Sincronizar Rastreio
          </button>

          {/* Separador visual */}
          <div className="h-8 w-px bg-slate-300 dark:bg-slate-700"></div>

          {/* Botão de Exportação */}
          <ExportButton orders={displayedOrders} />


        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[600px]">

        {/* Tabs & Filters */}
        <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900/50 flex flex-col lg:flex-row gap-4 justify-between items-center">

          {/* Tabs */}
          <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-lg self-start lg:self-center">
            <button
              onClick={() => setActiveTab('ready')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'ready'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Prontos para Envio
              <span className="ml-1 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-full text-xs text-slate-600 dark:text-slate-400">
                {categorizedOrders.ready.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('waiting')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'waiting'
                ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              <Clock className="w-4 h-4" />
              Aguardando Janela PV
              <span className="ml-1 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-full text-xs text-slate-600 dark:text-slate-400">
                {categorizedOrders.waiting.length}
              </span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar..."
                className="w-full bg-white dark:bg-slate-950 border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Warning Banner for Waiting Tab */}
        {activeTab === 'waiting' && (
          <div className="bg-orange-500/10 border-b border-orange-500/20 p-3 text-center text-xs text-orange-600 dark:text-orange-400 flex items-center justify-center gap-2">
            <Lock className="w-3.5 h-3.5" />
            Estes pedidos ainda estão dentro da janela de unificação de Pós-Venda. Só envie se for urgente.
          </div>
        )}

        <div className="overflow-x-auto flex-1">
          {loading ? (
            <div className="p-4"><TableSkeleton /></div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/80 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Data Pedido</th>
                  <th className="px-6 py-4 font-medium">Pacote / Produtos</th>
                  <th className="px-6 py-4 font-medium">Cliente</th>
                  <th className="px-6 py-4 font-medium">Liberado em</th>
                  <th className="px-6 py-4 font-medium">Rastreio</th>
                  <th className="px-6 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      Nenhum pedido encontrado nesta categoria.
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

                    const safeDate = getSafeShipDate(order.created_at);
                    const isLate = activeTab === 'waiting';

                    return (
                      <tr key={order.id} className={`hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors ${isRisk ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                          {format(new Date(order.created_at), 'dd/MM/yy HH:mm')}
                          {renderChangeBadges(order)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900 dark:text-slate-200">{order.descricao_pacote || 'Pacote sem descrição'}</span>
                            <span className="text-xs text-slate-500 font-mono mt-1" title={displayCodes}>
                              Ref: {displayCodes.length > 30 ? displayCodes.substring(0, 30) + '...' : displayCodes}
                            </span>
                            {isRisk && (
                              <span className="flex items-center gap-1 text-red-500 dark:text-red-400 text-xs mt-1 font-bold">
                                <AlertTriangle className="w-3 h-3" /> Risco Fraude
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col group relative max-w-xs">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{clientName}</span>
                            <div className="flex flex-col mt-1">
                              <span className="text-xs text-slate-500">{clientCpf}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1" title={addressDisplay}>{addressDisplay}</span>
                            </div>
                            {order.observacao && (
                              <div className="mt-2 flex items-start gap-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-2 rounded-lg">
                                <StickyNote className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-500 mt-0.5 shrink-0" />
                                <span className="text-xs text-yellow-800 dark:text-yellow-200 leading-snug break-words">
                                  {order.observacao}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded w-fit ${isLate ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                            {isLate ? <Lock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                            {format(safeDate, 'dd/MM (EEE)')}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {order.codigo_rastreio ? (
                            <div className="flex items-center gap-2 group/tracking">
                              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded border border-border w-fit">
                                <Truck className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                                <span className="font-mono">{order.codigo_rastreio}</span>
                              </div>
                              <button
                                onClick={() => handleClearTracking(order.id)}
                                className="opacity-0 group-hover/tracking:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                                title="Resetar Rastreio (Gerar Novamente)"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Rastreio..."
                                className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-slate-200 w-28 focus:border-blue-500 focus:outline-none"
                                value={trackingUpdates[order.id] || ''}
                                onChange={(e) => handleTrackingChange(order.id, e.target.value)}
                              />
                              {trackingUpdates[order.id] && (
                                <button
                                  onClick={() => saveTracking(order.id)}
                                  className="text-green-600 dark:text-green-500 hover:text-green-500 p-1"
                                  title="Salvar"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(order)}
                              className="text-slate-500 hover:text-blue-500 dark:text-slate-400 dark:hover:text-blue-400 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
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

        {/* Client-Side Pagination Footer */}
        <div className="px-4 py-3 border-t border-border bg-slate-50 dark:bg-slate-900/30 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Mostrando {currentList.length > 0 ? (page - 1) * pageSize + 1 : 0} até {Math.min(page * pageSize, currentList.length)} de {currentList.length}
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
      </div>
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
        onCancel={() => setShouldCancelGeneration(true)}
        produto={currentProduto}
        total={labelProgress.total}
        processados={labelProgress.processados}
        sucesso={labelProgress.sucesso}
        erros={labelProgress.erros}
        detalhes={labelProgress.detalhes}
        concluido={labelProgress.concluido}
      />
    </div >
  );
};