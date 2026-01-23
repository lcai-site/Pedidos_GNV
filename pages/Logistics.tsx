import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PedidoUnificado } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Modal } from '../components/ui/Modal';
import { Search, Printer, Truck, AlertTriangle, Save, Pencil, User, MapPin, Phone, FileText, CheckCircle2, Mail, ChevronLeft, ChevronRight, Calendar, Clock, Lock, StickyNote, PenTool, AlertCircle } from 'lucide-react';
import { useDateFilter } from '../context/DateFilterContext';
import { addDays, isAfter, isBefore, startOfDay, format, parseISO, getDay } from 'date-fns';

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
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PedidoUnificado | null>(null);
  
  // Form State
  const [editForm, setEditForm] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    observacao: '',
    syncTicto: false
  });
  const [saving, setSaving] = useState(false);

  // --- REGRAS DO SCRIPT (V25) ---
  const getSafeShipDate = (orderDateStr: string): Date => {
    const d = new Date(orderDateStr);
    const dayOfWeek = getDay(d); // 0 = Domingo, ... 4 = Quinta, 5 = Sexta

    // Quinta (4) -> +4 dias (Segunda encerra janela)
    if (dayOfWeek === 4) {
      return addDays(d, 4);
    }
    // Sexta (5) -> +4 dias (Terça encerra janela)
    if (dayOfWeek === 5) {
      return addDays(d, 4);
    }
    // Dias normais -> +2 dias
    return addDays(d, 2);
  };

  // --- Helpers de Leitura de Dados (Deep Search) ---
  const getDeepVal = (obj: any, keys: string[]): string => {
    if (!obj) return '';

    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && typeof obj[key] !== 'object' && String(obj[key]).trim() !== '') {
        return String(obj[key]);
      }
    }

    const targets = [
      obj.metadata,
      obj.customer,
      obj.shipping,
      obj.address,
      obj.dados_entrega,
      obj.endereco_json,
      obj.payer,
      obj.metadata?.customer,
      obj.metadata?.buyer,
      obj.metadata?.address,
      obj.customer?.address
    ];

    for (const target of targets) {
      if (target && typeof target === 'object') {
        for (const key of keys) {
           if (target[key] !== undefined && target[key] !== null && typeof target[key] !== 'object' && String(target[key]).trim() !== '') {
             return String(target[key]);
           }
        }
      }
    }
    return '';
  };

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

  const parseAddressString = (fullAddr: string) => {
    if (!fullAddr) return {};
    const result: any = {};
    const cepMatch = fullAddr.match(/\b\d{5}[-.\s]?\d{3}\b/);
    if (cepMatch) result.cep = cepMatch[0].replace(/\D/g, '');
    const ufMatch = fullAddr.match(/\b([A-Z]{2})\b$/) || fullAddr.match(/-\s*([A-Z]{2})\b/);
    if (ufMatch) result.estado = ufMatch[1];
    const parts = fullAddr.split(',').map(p => p.trim());
    if (parts.length >= 1) result.logradouro = parts[0];
    if (parts.length >= 2) {
       if (/^(\d+|s\/n|sn)$/i.test(parts[1])) {
          result.numero = parts[1];
          if (parts.length >= 3) result.bairro = parts[2];
          if (parts.length >= 4) result.cidade = parts[3];
       } else {
          result.bairro = parts[1];
          if (parts.length >= 3) result.cidade = parts[2];
       }
    }
    return result;
  };

  const formatGroupCodes = (codes: string | string[] | null | undefined): string => {
    if (!codes) return '-';
    if (Array.isArray(codes)) return codes.join(', ');
    return String(codes);
  };

  useEffect(() => {
    fetchOrders();
  }, [startDate, endDate]);

  const fetchOrders = async () => {
    setLoading(true);
    setPage(1); // Reset pagination on new fetch
    try {
      const { data, error } = await supabase
        .from('pedidos_unificados')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) throw error;
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
        .from('pedidos_unificados')
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

  const openEditModal = (order: PedidoUnificado) => {
    setEditingOrder(order);
    let cep = getDeepVal(order, keys.zip);
    let logradouro = getDeepVal(order, keys.street);
    let numero = getDeepVal(order, keys.number);
    let complemento = getDeepVal(order, keys.comp);
    let bairro = getDeepVal(order, keys.neighborhood);
    let cidade = getDeepVal(order, keys.city);
    let estado = getDeepVal(order, keys.state);

    if (!logradouro) {
       const fullAddr = getDeepVal(order, keys.fullAddress);
       if (fullAddr) {
          const parsed = parseAddressString(fullAddr);
          if (parsed.logradouro) logradouro = parsed.logradouro;
          if (parsed.numero) numero = parsed.numero;
          if (parsed.bairro) bairro = parsed.bairro;
          if (parsed.cidade) cidade = parsed.cidade;
          if (parsed.estado) estado = parsed.estado;
          if (parsed.cep && !cep) cep = parsed.cep;
       }
    }

    setEditForm({
      nome: getDeepVal(order, keys.nome),
      cpf: getDeepVal(order, keys.cpf),
      telefone: getDeepVal(order, keys.phone),
      email: getDeepVal(order, keys.email),
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      observacao: order.observacao || '',
      syncTicto: true 
    });
    
    setIsEditModalOpen(true);
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
        ['rua','logradouro','street','cep','zip','city','cidade'].includes(k.toLowerCase())
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

  const handleEditSave = async () => {
    if (!editingOrder) return;
    setSaving(true);
    
    try {
      // 1. Preparar Dados Universais
      const enderecoCompleto = `${editForm.logradouro}, ${editForm.numero} ${editForm.complemento ? '- ' + editForm.complemento : ''} - ${editForm.bairro}, ${editForm.cidade} - ${editForm.estado}, ${editForm.cep}`.replace(/, ,/g, ',');
      const jsonColumns = ['dados_entrega', 'endereco_json', 'shipping', 'customer', 'metadata'];

      // --- PASSO A: ATUALIZAR TABELA 'PEDIDOS' (Fonte da Verdade) ---
      // Primeiro, buscamos o registro original na tabela 'pedidos' para ter certeza que estamos editando a estrutura correta
      const { data: originalSalesData, error: fetchError } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', editingOrder.id)
        .single();

      if (!fetchError && originalSalesData) {
         const salesUpdates: any = {};
         
         // Helper local para 'pedidos'
         const addIfKeyExistsInSales = (keyName: string, value: any) => {
            if (Object.prototype.hasOwnProperty.call(originalSalesData, keyName)) {
                salesUpdates[keyName] = value;
            }
         };

         // Mapeamento para 'pedidos'
         keys.nome.forEach(k => addIfKeyExistsInSales(k, editForm.nome));
         keys.email.forEach(k => addIfKeyExistsInSales(k, editForm.email));
         keys.phone.forEach(k => addIfKeyExistsInSales(k, editForm.telefone));
         keys.cpf.forEach(k => addIfKeyExistsInSales(k, editForm.cpf));
         
         // Endereço plano em 'pedidos'
         keys.zip.forEach(k => addIfKeyExistsInSales(k, editForm.cep));
         keys.street.forEach(k => addIfKeyExistsInSales(k, editForm.logradouro));
         keys.comp.forEach(k => addIfKeyExistsInSales(k, editForm.complemento));
         keys.neighborhood.forEach(k => addIfKeyExistsInSales(k, editForm.bairro));
         keys.city.forEach(k => addIfKeyExistsInSales(k, editForm.cidade));
         keys.state.forEach(k => addIfKeyExistsInSales(k, editForm.estado));
         keys.number.forEach(k => {
             if (Object.prototype.hasOwnProperty.call(originalSalesData, k)) {
                 const isPureNumber = /^\d+$/.test(editForm.numero);
                 salesUpdates[k] = isPureNumber ? parseInt(editForm.numero) : editForm.numero;
             }
         });

         // Deep Patch JSONs em 'pedidos'
         jsonColumns.forEach(jsonCol => {
            if (originalSalesData[jsonCol] && typeof originalSalesData[jsonCol] === 'object') {
                salesUpdates[jsonCol] = patchAddressInObject(originalSalesData[jsonCol], editForm);
            }
         });

         console.log("Atualizando PEDIDOS (Source):", salesUpdates);
         
         // Executa update na tabela fonte
         if (Object.keys(salesUpdates).length > 0) {
            await supabase.from('pedidos').update(salesUpdates).eq('id', editingOrder.id);
         }
      }

      // --- PASSO B: ATUALIZAR TABELA 'PEDIDOS_UNIFICADOS' (View/Cache) ---
      // Mesmo que seja uma view materializada, tentamos atualizar campos operacionais e o display string
      // para garantir que a UI reflita a mudança agora.
      
      const unifiedUpdates: any = {
        observacao: editForm.observacao,
        foi_editado: true,
        // Forçamos o endereço completo para exibição na tabela, independente da estrutura interna
        endereco_completo: enderecoCompleto,
        // Também salvamos campos planos caso existam na tabela unificada (para redundância)
        telefone: editForm.telefone,
        email: editForm.email
      };
      
      // Update redundante dos JSONs na unificada caso ela seja uma tabela real desconectada
      jsonColumns.forEach(jsonCol => {
        if (editingOrder[jsonCol] && typeof editingOrder[jsonCol] === 'object') {
            unifiedUpdates[jsonCol] = patchAddressInObject(editingOrder[jsonCol], editForm);
        }
      });

      console.log("Atualizando PEDIDOS_UNIFICADOS (Cache):", unifiedUpdates);

      const { error: unifiedError } = await supabase
        .from('pedidos_unificados')
        .update(unifiedUpdates)
        .eq('id', editingOrder.id);

      // Ignoramos erro na unificada se for 'view not updatable', pois já salvamos na 'pedidos'
      if (unifiedError) {
          console.warn("Aviso ao atualizar unificados (pode ser view):", unifiedError.message);
      }

      // --- PASSO C: ATUALIZAR UI ---
      setAllOrders(prev => prev.map(o => o.id === editingOrder.id ? { 
          ...o, 
          ...unifiedUpdates,
          // Garante campos visuais
          nome_cliente: editForm.nome,
          cliente: editForm.nome, // fallback
          telefone: editForm.telefone,
          email: editForm.email
      } : o));
      
      // FORÇA O FECHAMENTO DO MODAL
      setIsEditModalOpen(false);
      setEditingOrder(null); // Limpa seleção

    } catch (error: any) {
      console.error("Erro CRÍTICO ao salvar:", error);
      alert(`Erro ao salvar no banco de dados:\n${error.message || JSON.stringify(error)}`);
      // Mesmo com erro, se for algo parcial, fechamos para não travar o usuário
      setIsEditModalOpen(false); 
    } finally {
      setSaving(false);
    }
  };

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

  searchFilteredOrders.forEach(order => {
    // Se já foi enviado, sempre aparece na lista de prontos (histórico)
    if (order.status_envio === 'Enviado') {
        categorizedOrders.ready.push(order);
        return;
    }

    // Calcula quando esse pedido estaria "seguro" para envio
    const safeDate = getSafeShipDate(order.created_at);
    const safeDateStart = startOfDay(safeDate);

    // Se a data de referência (hoje/selecionada) for MAIOR ou IGUAL a data segura, está pronto.
    if (!isBefore(refDate, safeDateStart)) {
        categorizedOrders.ready.push(order);
    } else {
        categorizedOrders.waiting.push(order);
    }
  });

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
            </div>

            <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm">
              <Printer className="w-4 h-4" />
              Gerar Etiquetas ({categorizedOrders.ready.filter(o => o.status_envio !== 'Enviado').length})
            </button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[600px]">
        
        {/* Tabs & Filters */}
        <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900/50 flex flex-col lg:flex-row gap-4 justify-between items-center">
          
          {/* Tabs */}
          <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-lg self-start lg:self-center">
             <button
               onClick={() => setActiveTab('ready')}
               className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
                 activeTab === 'ready' 
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
               className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
                 activeTab === 'waiting' 
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
                             <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded border border-border w-fit">
                                <Truck className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                                <span className="font-mono">{order.codigo_rastreio}</span>
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
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Editar Informações de Envio">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2"><User className="w-3 h-3" /> Nome do Cliente</label>
                <input type="text" value={editForm.nome} onChange={e => setEditForm({...editForm, nome: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-border rounded-lg px-3 py-2 text-slate-900 dark:text-slate-200 focus:border-blue-500 outline-none" />
             </div>
             <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2"><FileText className="w-3 h-3" /> CPF</label>
                <input type="text" value={editForm.cpf} onChange={e => setEditForm({...editForm, cpf: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-border rounded-lg px-3 py-2 text-slate-900 dark:text-slate-200 focus:border-blue-500 outline-none" />
             </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2"><Phone className="w-3 h-3" /> Telefone / WhatsApp</label>
                <input type="text" value={editForm.telefone} onChange={e => setEditForm({...editForm, telefone: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-border rounded-lg px-3 py-2 text-slate-900 dark:text-slate-200 focus:border-blue-500 outline-none" />
            </div>
             <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2"><Mail className="w-3 h-3" /> Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-border rounded-lg px-3 py-2 text-slate-900 dark:text-slate-200 focus:border-blue-500 outline-none" />
            </div>
          </div>
          <div className="pt-4 border-t border-border mt-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3 uppercase tracking-wide"><MapPin className="w-3 h-3" /> Endereço de Entrega</label>
              <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-1 space-y-1"><label className="text-[10px] uppercase text-slate-500 font-semibold">CEP</label><input type="text" value={editForm.cep} onChange={e => setEditForm({...editForm, cep: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-border rounded px-2 py-1.5 text-sm text-slate-900 dark:text-slate-200 focus:border-blue-500 outline-none" /></div>
                  <div className="col-span-3 space-y-1"><label className="text-[10px] uppercase text-slate-500 font-semibold">Rua / Logradouro</label><input type="text" value={editForm.logradouro} onChange={e => setEditForm({...editForm, logradouro: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-border rounded px-2 py-1.5 text-sm text-slate-900 dark:text-slate-200 focus:border-blue-500 outline-none" /></div>
                  <div className="col-span-1 space-y-1"><label className="text-[10px] uppercase text-slate-500 font-semibold">Número</label><input type="text" value={editForm.numero} onChange={e => setEditForm({...editForm, numero: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-border rounded px-2 py-1.5 text-sm text-slate-900 dark:text-slate-200 focus:border-blue-500 outline-none" /></div>
                   <div className="col-span-1 space-y-1"><label className="text-[10px] uppercase text-slate-500 font-semibold">Compl.</label><input type="text" value={editForm.complemento} onChange={e => setEditForm({...editForm, complemento: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-border rounded px-2 py-1.5 text-sm text-slate-900 dark:text-slate-200 focus:border-blue-500 outline-none" /></div>
                  <div className="col-span-2 space-y-1"><label className="text-[10px] uppercase text-slate-500 font-semibold">Bairro</label><input type="text" value={editForm.bairro} onChange={e => setEditForm({...editForm, bairro: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-border rounded px-2 py-1.5 text-sm text-slate-900 dark:text-slate-200 focus:border-blue-500 outline-none" /></div>
                  <div className="col-span-3 space-y-1"><label className="text-[10px] uppercase text-slate-500 font-semibold">Cidade</label><input type="text" value={editForm.cidade} onChange={e => setEditForm({...editForm, cidade: e.target.value})} className="w-full bg-white dark:bg-slate-950 border border-border rounded px-2 py-1.5 text-sm text-slate-900 dark:text-slate-200 focus:border-blue-500 outline-none" /></div>
                   <div className="col-span-1 space-y-1"><label className="text-[10px] uppercase text-slate-500 font-semibold">UF</label><input type="text" maxLength={2} value={editForm.estado} onChange={e => setEditForm({...editForm, estado: e.target.value.toUpperCase()})} className="w-full bg-white dark:bg-slate-950 border border-border rounded px-2 py-1.5 text-sm text-slate-900 dark:text-slate-200 focus:border-blue-500 outline-none uppercase" /></div>
              </div>
          </div>
          <div className="pt-4 border-t border-border mt-4">
             <div className="space-y-2 mb-4">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 uppercase tracking-wide"><StickyNote className="w-3 h-3" /> Observações Internas</label>
                <textarea 
                    value={editForm.observacao} 
                    onChange={e => setEditForm({...editForm, observacao: e.target.value})} 
                    className="w-full bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-200 focus:border-yellow-500 outline-none min-h-[80px]"
                    placeholder="Adicione observações importantes sobre este pedido aqui..."
                />
             </div>
             <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" id="syncTicto" checked={editForm.syncTicto} onChange={e => setEditForm({...editForm, syncTicto: e.target.checked})} className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-blue-600 focus:ring-blue-500" />
                <label htmlFor="syncTicto" className="text-sm text-slate-700 dark:text-slate-300 select-none cursor-pointer">Sincronizar alteração na Ticto (API)</label>
             </div>
             <div className="flex gap-3 justify-end">
                <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-medium">Cancelar</button>
                <button onClick={handleEditSave} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50">{saving ? 'Salvando...' : <><CheckCircle2 className="w-4 h-4" /> Salvar Alterações</>}</button>
             </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};