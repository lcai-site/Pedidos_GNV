import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PedidoUnificado } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Modal } from '../components/ui/Modal';
import { Search, Printer, Truck, AlertTriangle, Save, Pencil, User, MapPin, Phone, FileText, CheckCircle2, Home, Mail } from 'lucide-react';

export const Logistics: React.FC = () => {
  const [orders, setOrders] = useState<PedidoUnificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [trackingUpdates, setTrackingUpdates] = useState<{ [key: string]: string }>({});
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PedidoUnificado | null>(null);
  
  // Form State desmembrado
  const [editForm, setEditForm] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    email: '', // Novo campo
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    syncTicto: false
  });
  const [saving, setSaving] = useState(false);

  // --- Helpers de Leitura de Dados (Deep Search) ---
  
  // Busca valor em profundidade (Root -> Metadata -> Customer -> Address)
  const getDeepVal = (obj: any, keys: string[]): string => {
    if (!obj) return '';

    // 1. Nível Raiz
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') return String(obj[key]);
    }

    // 2. Objetos Aninhados Comuns (JSONB)
    const nestedObjs = ['metadata', 'customer', 'shipping', 'address', 'dados_entrega', 'endereco_json'];
    for (const nest of nestedObjs) {
      if (obj[nest] && typeof obj[nest] === 'object') {
        // Busca direta no objeto aninhado
        for (const key of keys) {
           if (obj[nest][key] !== undefined && obj[nest][key] !== null && String(obj[nest][key]).trim() !== '') return String(obj[nest][key]);
        }
        // Busca em sub-nível de endereço (ex: metadata.address.street)
        if (obj[nest].address && typeof obj[nest].address === 'object') {
             for (const key of keys) {
               if (obj[nest].address[key] !== undefined && obj[nest].address[key] !== null && String(obj[nest].address[key]).trim() !== '') return String(obj[nest].address[key]);
            }
        }
      }
    }
    
    return '';
  };

  // Listas de chaves possíveis para cada campo (Português, Inglês, Snake_case, CamelCase)
  const keys = {
    nome: ['nome_cliente', 'cliente_nome', 'cliente', 'nome', 'full_name', 'name', 'buyer_name'],
    cpf: ['cpf', 'cliente_cpf', 'doc', 'documento', 'cpf_cliente', 'tax_id', 'vat_number'],
    phone: ['telefone', 'cliente_telefone', 'phone', 'celular', 'whatsapp', 'phone_number', 'mobile'],
    email: ['email', 'cliente_email', 'contact_email', 'buyer_email', 'user_email'],
    zip: ['cep', 'zip', 'zipcode', 'zip_code', 'postal_code'],
    street: ['rua', 'logradouro', 'street', 'street_name', 'address_line_1', 'endereco_rua', 'thoroughfare'],
    number: ['numero', 'number', 'street_number', 'num', 'endereco_numero', 'house_number'],
    comp: ['complemento', 'comp', 'complement', 'address_line_2', 'endereco_complemento', 'extra'],
    neighborhood: ['bairro', 'neighborhood', 'district', 'endereco_bairro', 'suburb'],
    city: ['cidade', 'city', 'municipio', 'endereco_cidade', 'town'],
    state: ['estado', 'uf', 'state', 'state_code', 'endereco_estado', 'region'],
    fullAddress: ['endereco', 'endereco_completo', 'full_address', 'cliente_endereco', 'address', 'formatted_address']
  };

  // Parser de Fallback para extrair dados de string completa
  const parseAddressString = (fullAddr: string) => {
    if (!fullAddr) return {};
    const result: any = {};
    
    // Tenta extrair CEP (xxxxx-xxx ou xxxxxxxx)
    const cepMatch = fullAddr.match(/\b\d{5}[-.\s]?\d{3}\b/);
    if (cepMatch) result.cep = cepMatch[0].replace(/\D/g, '');

    // Tenta extrair UF (2 letras maiúsculas no final ou após traço)
    const ufMatch = fullAddr.match(/\b([A-Z]{2})\b$/) || fullAddr.match(/-\s*([A-Z]{2})\b/);
    if (ufMatch) result.estado = ufMatch[1];

    // Separação por vírgula para tentar pegar Rua, Num, Bairro, Cidade
    // Ex: "Rua das Flores, 123, Centro, São Paulo"
    const parts = fullAddr.split(',').map(p => p.trim());
    
    if (parts.length >= 1) result.logradouro = parts[0];
    if (parts.length >= 2) {
       // Se o segundo item parece um número ou "S/N"
       if (/^(\d+|s\/n|sn)$/i.test(parts[1])) {
          result.numero = parts[1];
          if (parts.length >= 3) result.bairro = parts[2];
          if (parts.length >= 4) result.cidade = parts[3];
       } else {
          // Talvez seja "Rua das Flores 123" na primeira parte?
          // Fallback genérico
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
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pedidos_unificados')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
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
    
    const oldOrders = [...orders];
    setOrders(orders.map(o => o.id === id ? { ...o, codigo_rastreio: code, status_envio: 'Enviado' } : o));

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
      setOrders(oldOrders);
    }
  };

  // --- Edit Logic ---

  const openEditModal = (order: PedidoUnificado) => {
    setEditingOrder(order);
    
    // 1. Tenta pegar campos individuais usando busca profunda
    let cep = getDeepVal(order, keys.zip);
    let logradouro = getDeepVal(order, keys.street);
    let numero = getDeepVal(order, keys.number);
    let complemento = getDeepVal(order, keys.comp);
    let bairro = getDeepVal(order, keys.neighborhood);
    let cidade = getDeepVal(order, keys.city);
    let estado = getDeepVal(order, keys.state);

    // 2. Se logradouro estiver vazio, tenta fazer parse do endereço completo
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
      email: getDeepVal(order, keys.email), // Carrega email
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      syncTicto: true 
    });
    
    setIsEditModalOpen(true);
  };

  // Helper para decidir qual chave usar no Update
  // Ex: Se o objeto original tem 'cliente_telefone', usa essa chave. Se não, usa 'telefone'.
  const resolveUpdateKey = (order: any, candidates: string[], defaultKey: string) => {
     if (!order) return defaultKey;
     for (const key of candidates) {
         if (Object.prototype.hasOwnProperty.call(order, key)) return key;
     }
     // Fallback: tenta ver se alguma das chaves tem valor não nulo
     for (const key of candidates) {
        if (order[key] !== undefined) return key;
     }
     return defaultKey;
  };

  const handleEditSave = async () => {
    if (!editingOrder) return;
    setSaving(true);

    try {
      const enderecoCompleto = `${editForm.logradouro}, ${editForm.numero} ${editForm.complemento ? '- ' + editForm.complemento : ''} - ${editForm.bairro}, ${editForm.cidade} - ${editForm.estado}, ${editForm.cep}`.replace(/, ,/g, ',');

      // Descobre os nomes corretos das colunas para este registro específico
      const phoneKey = resolveUpdateKey(editingOrder, ['cliente_telefone', 'telefone', 'phone', 'celular'], 'telefone');
      const emailKey = resolveUpdateKey(editingOrder, ['cliente_email', 'email', 'contact_email'], 'email');
      const nameKey = resolveUpdateKey(editingOrder, ['nome_cliente', 'cliente_nome', 'nome'], 'nome_cliente');
      const cpfKey = resolveUpdateKey(editingOrder, ['cliente_cpf', 'cpf'], 'cpf');

      // Monta o objeto de update usando as chaves corretas
      const updates: any = {};
      
      // Dados Pessoais
      updates[nameKey] = editForm.nome;
      updates[cpfKey] = editForm.cpf;
      updates[phoneKey] = editForm.telefone;
      updates[emailKey] = editForm.email;

      // Dados de Endereço (tenta chaves padrão, o Supabase ignora se não existir ou dá erro? 
      // Idealmente deveríamos checar também, mas endereço é mais padronizado na sua estrutura)
      updates['cep'] = editForm.cep;
      updates['rua'] = editForm.logradouro;
      updates['numero'] = editForm.numero;
      updates['complemento'] = editForm.complemento;
      updates['bairro'] = editForm.bairro;
      updates['cidade'] = editForm.cidade;
      updates['estado'] = editForm.estado;
      
      // Endereço completo concatenado
      updates['endereco_completo'] = enderecoCompleto;
      // updates['endereco'] = enderecoCompleto; // Cuidado ao duplicar updates, pode confundir triggers

      console.log("Saving updates with keys:", { phoneKey, emailKey, nameKey, updates });

      const { error } = await supabase
        .from('pedidos_unificados')
        .update(updates)
        .eq('id', editingOrder.id);

      if (error) {
         console.warn("Update falhou, tentando fallback simples...", error);
         // Fallback para update simplificado se o anterior falhar por coluna inexistente
         const simpleUpdates: any = {
             endereco_completo: enderecoCompleto
         };
         // Tenta chaves hardcoded mais prováveis
         simpleUpdates['telefone'] = editForm.telefone; 
         simpleUpdates['email'] = editForm.email;
         
         await supabase.from('pedidos_unificados').update(simpleUpdates).eq('id', editingOrder.id);
      }

      setOrders(orders.map(o => o.id === editingOrder.id ? { ...o, ...updates } : o));
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Error updating order:", error);
      alert("Erro ao atualizar dados. Verifique o console.");
    } finally {
      setSaving(false);
    }
  };

  const getFraudRisk = (order: PedidoUnificado) => {
    const cpf = getDeepVal(order, keys.cpf);
    const address = getDeepVal(order, keys.fullAddress) || getDeepVal(order, keys.street);

    if (!cpf) return false;

    const sameCPF = orders.filter(o => {
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
     const street = getDeepVal(order, keys.street);
     const num = getDeepVal(order, keys.number);
     const city = getDeepVal(order, keys.city);
     const uf = getDeepVal(order, keys.state);
     
     if (street) {
        return `${street}, ${num} - ${city}/${uf}`;
     }
     return getDeepVal(order, keys.fullAddress) || 'Endereço n/d';
  }

  const filteredOrders = orders.filter(order => {
    if (!order) return false;
    const term = searchTerm.toLowerCase();
    
    const pkgDesc = String(order.descricao_pacote || '').toLowerCase();
    const name = String(getDeepVal(order, keys.nome)).toLowerCase();
    const email = String(getDeepVal(order, keys.email)).toLowerCase();
    const fullAddr = String(getDisplayAddress(order)).toLowerCase();
    const rawGroup = order.codigos_agrupados;
    const groupCode = Array.isArray(rawGroup) 
      ? rawGroup.join(' ').toLowerCase() 
      : String(rawGroup || '').toLowerCase();

    return pkgDesc.includes(term) || name.includes(term) || email.includes(term) || groupCode.includes(term) || fullAddr.includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Logística de Envios</h2>
          <p className="text-slate-400">Gerencie etiquetas e códigos de rastreio dos pacotes unificados.</p>
        </div>
        <div className="flex gap-2">
            <button 
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
              onClick={() => alert('Gerando etiquetas em lote... (Simulação)')}
            >
              <Printer className="w-4 h-4" />
              Gerar Etiquetas
            </button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="p-4 border-b border-border bg-slate-900/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar por cliente, email, endereço, pacote ou SKU..." 
              className="w-full bg-slate-950 border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4"><TableSkeleton /></div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-900/80 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Pacote / Produtos</th>
                  <th className="px-6 py-4 font-medium">Cliente</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Rastreio</th>
                  <th className="px-6 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      {orders.length === 0 ? 'Nenhum pedido encontrado na tabela.' : 'Nenhum pedido corresponde à busca.'}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const isRisk = getFraudRisk(order);
                    const clientName = getDeepVal(order, keys.nome) || 'Cliente sem nome';
                    const clientCpf = getDeepVal(order, keys.cpf) || 'CPF N/A';
                    const clientEmail = getDeepVal(order, keys.email);
                    const displayCodes = formatGroupCodes(order.codigos_agrupados);
                    const addressDisplay = getDisplayAddress(order);

                    return (
                      <tr key={order.id} className={`hover:bg-slate-800/50 transition-colors ${isRisk ? 'bg-red-900/10' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-200">{order.descricao_pacote || 'Pacote sem descrição'}</span>
                            <span className="text-xs text-slate-500 font-mono mt-1" title={displayCodes}>
                              Ref: {displayCodes.length > 30 ? displayCodes.substring(0, 30) + '...' : displayCodes}
                            </span>
                            {isRisk && (
                                <span className="flex items-center gap-1 text-red-400 text-xs mt-1 font-bold">
                                    <AlertTriangle className="w-3 h-3" /> Possível Fraude (Endereço divergente)
                                </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col group relative max-w-xs">
                            <span className="text-slate-300 font-medium">{clientName}</span>
                            <div className="flex flex-col mt-1">
                                <span className="text-xs text-slate-500">{clientCpf}</span>
                                {clientEmail && <span className="text-xs text-slate-500 truncate">{clientEmail}</span>}
                                <span className="text-xs text-slate-400 truncate mt-1" title={addressDisplay}>{addressDisplay}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={order.status_envio || 'Pendente'} />
                        </td>
                        <td className="px-6 py-4">
                          {order.codigo_rastreio ? (
                             <div className="flex items-center gap-2 text-slate-300 bg-slate-900 px-3 py-1.5 rounded border border-border w-fit">
                                <Truck className="w-3 h-3 text-blue-400" />
                                <span className="font-mono">{order.codigo_rastreio}</span>
                             </div>
                          ) : (
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="Cole o código aqui"
                                    className="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200 w-32 lg:w-40 focus:border-blue-500 focus:outline-none"
                                    value={trackingUpdates[order.id] || ''}
                                    onChange={(e) => handleTrackingChange(order.id, e.target.value)}
                                />
                                {trackingUpdates[order.id] && (
                                    <button 
                                        onClick={() => saveTracking(order.id)}
                                        className="text-green-500 hover:text-green-400 p-1"
                                        title="Salvar Rastreio"
                                    >
                                        <Save className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                             <button 
                                onClick={() => openEditModal(order)}
                                className="text-slate-400 hover:text-blue-400 p-2 hover:bg-slate-800 rounded transition-colors"
                                title="Editar Dados"
                             >
                                <Pencil className="w-4 h-4" />
                             </button>
                             <button 
                                className="text-blue-400 hover:text-blue-300 font-medium text-xs border border-blue-500/30 px-3 py-1.5 rounded hover:bg-blue-500/10 transition-colors whitespace-nowrap"
                                onClick={() => alert('Simulação: Etiqueta ZPL/PDF gerada.')}
                             >
                                Etiqueta
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
      </div>

      {/* Edit Modal (Desmembrado e com Email) */}
      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)}
        title="Editar Informações de Envio"
      >
        <div className="space-y-4">
          
          {/* Dados Pessoais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 flex items-center gap-2">
                   <User className="w-3 h-3" /> Nome do Cliente
                </label>
                <input 
                  type="text" 
                  value={editForm.nome}
                  onChange={e => setEditForm({...editForm, nome: e.target.value})}
                  className="w-full bg-slate-950 border border-border rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500 outline-none"
                />
             </div>
             <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 flex items-center gap-2">
                   <FileText className="w-3 h-3" /> CPF
                </label>
                <input 
                  type="text" 
                  value={editForm.cpf}
                  onChange={e => setEditForm({...editForm, cpf: e.target.value})}
                  className="w-full bg-slate-950 border border-border rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500 outline-none"
                />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 flex items-center gap-2">
                    <Phone className="w-3 h-3" /> Telefone / WhatsApp
                </label>
                <input 
                    type="text" 
                    value={editForm.telefone}
                    onChange={e => setEditForm({...editForm, telefone: e.target.value})}
                    placeholder="+55 (11) 99999-9999"
                    className="w-full bg-slate-950 border border-border rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500 outline-none"
                />
            </div>
             <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 flex items-center gap-2">
                    <Mail className="w-3 h-3" /> Email
                </label>
                <input 
                    type="email" 
                    value={editForm.email}
                    onChange={e => setEditForm({...editForm, email: e.target.value})}
                    placeholder="cliente@email.com"
                    className="w-full bg-slate-950 border border-border rounded-lg px-3 py-2 text-slate-200 focus:border-blue-500 outline-none"
                />
            </div>
          </div>

          {/* Endereço Desmembrado */}
          <div className="pt-4 border-t border-border mt-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-2 mb-3 uppercase tracking-wide">
                 <MapPin className="w-3 h-3" /> Endereço de Entrega
              </label>
              
              <div className="grid grid-cols-4 gap-3">
                  {/* Linha 1: CEP (1/4) e Logradouro (3/4) */}
                  <div className="col-span-1 space-y-1">
                      <label className="text-[10px] uppercase text-slate-500 font-semibold">CEP</label>
                      <input 
                        type="text" 
                        value={editForm.cep}
                        onChange={e => setEditForm({...editForm, cep: e.target.value})}
                        className="w-full bg-slate-950 border border-border rounded px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 outline-none"
                      />
                  </div>
                  <div className="col-span-3 space-y-1">
                      <label className="text-[10px] uppercase text-slate-500 font-semibold">Rua / Logradouro</label>
                      <input 
                        type="text" 
                        value={editForm.logradouro}
                        onChange={e => setEditForm({...editForm, logradouro: e.target.value})}
                        className="w-full bg-slate-950 border border-border rounded px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 outline-none"
                      />
                  </div>

                  {/* Linha 2: Número (1/4), Complemento (1/4), Bairro (2/4) */}
                  <div className="col-span-1 space-y-1">
                      <label className="text-[10px] uppercase text-slate-500 font-semibold">Número</label>
                      <input 
                        type="text" 
                        value={editForm.numero}
                        onChange={e => setEditForm({...editForm, numero: e.target.value})}
                        className="w-full bg-slate-950 border border-border rounded px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 outline-none"
                      />
                  </div>
                   <div className="col-span-1 space-y-1">
                      <label className="text-[10px] uppercase text-slate-500 font-semibold">Compl.</label>
                      <input 
                        type="text" 
                        value={editForm.complemento}
                        onChange={e => setEditForm({...editForm, complemento: e.target.value})}
                        className="w-full bg-slate-950 border border-border rounded px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 outline-none"
                      />
                  </div>
                  <div className="col-span-2 space-y-1">
                      <label className="text-[10px] uppercase text-slate-500 font-semibold">Bairro</label>
                      <input 
                        type="text" 
                        value={editForm.bairro}
                        onChange={e => setEditForm({...editForm, bairro: e.target.value})}
                        className="w-full bg-slate-950 border border-border rounded px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 outline-none"
                      />
                  </div>

                   {/* Linha 3: Cidade (3/4), UF (1/4) */}
                  <div className="col-span-3 space-y-1">
                      <label className="text-[10px] uppercase text-slate-500 font-semibold">Cidade</label>
                      <input 
                        type="text" 
                        value={editForm.cidade}
                        onChange={e => setEditForm({...editForm, cidade: e.target.value})}
                        className="w-full bg-slate-950 border border-border rounded px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 outline-none"
                      />
                  </div>
                   <div className="col-span-1 space-y-1">
                      <label className="text-[10px] uppercase text-slate-500 font-semibold">UF</label>
                      <input 
                        type="text" 
                        maxLength={2}
                        value={editForm.estado}
                        onChange={e => setEditForm({...editForm, estado: e.target.value.toUpperCase()})}
                        className="w-full bg-slate-950 border border-border rounded px-2 py-1.5 text-sm text-slate-200 focus:border-blue-500 outline-none uppercase"
                      />
                  </div>
              </div>
          </div>

          <div className="pt-4 border-t border-border mt-4">
             <div className="flex items-center gap-2 mb-4">
                <input 
                  type="checkbox" 
                  id="syncTicto"
                  checked={editForm.syncTicto}
                  onChange={e => setEditForm({...editForm, syncTicto: e.target.checked})}
                  className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="syncTicto" className="text-sm text-slate-300 select-none cursor-pointer">
                   Sincronizar alteração na Ticto (API)
                </label>
             </div>
             
             <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleEditSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Salvar Alterações
                    </>
                  )}
                </button>
             </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};