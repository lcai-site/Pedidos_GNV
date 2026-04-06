import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Search, MapPin, Phone, Mail, User, ChevronLeft, ChevronRight, Edit2, X, Save, MessageSquare, ShoppingBag, Tag, ExternalLink, Calendar } from 'lucide-react';
import { PedidoUnificado } from '../types';
import { logger } from '../lib/utils/logger';
import { useAuth } from '../lib/contexts/AuthContext';
import { Modal } from '../components/ui/Modal';
import { toast } from 'sonner';

// Copiando Helpers de Deep Search para garantir consistência
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
  email: ['email_cliente', 'email', 'cliente_email', 'contact_email', 'buyer_email', 'user_email', 'mail'],
  phone: ['telefone', 'cliente_telefone', 'phone', 'celular', 'whatsapp', 'phone_number', 'mobile'],
  fullAddress: ['endereco_completo', 'endereco', 'full_address', 'cliente_endereco', 'address', 'formatted_address'],
  street: ['rua', 'logradouro', 'street', 'street_name', 'address_line_1'],
  number: ['numero', 'number', 'street_number', 'num'],
  city: ['cidade', 'city', 'municipio', 'endereco_cidade'],
  state: ['estado', 'uf', 'state', 'state_code', 'endereco_estado'],
  zip: ['cep', 'zip', 'zipcode', 'zip_code'],
  cpf: ['cpf', 'cliente_cpf', 'cpf_cliente', 'customer_document', 'document']
};

interface CustomerDisplay {
  id: string; // Usaremos o ID do pedido mais recente como chave ou gerar um hash
  nome: string;
  email: string;
  telefone: string;
  endereco: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  cpf?: string;
  ultimoPedido: string;
}

export const Customers: React.FC = () => {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Estado para Edição
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDisplay | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: ''
  });

  // Novo estado para o Modal 360
  const [activeTab, setActiveTab] = useState<'info' | 'historico' | 'crm'>('info');
  const [historico, setHistorico] = useState<any[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loadingCRM, setLoadingCRM] = useState(false);
  const [etiquetaSearch, setEtiquetaSearch] = useState('');
  const [showEtiquetaDropdown, setShowEtiquetaDropdown] = useState(false);
  
  // Ref para click fora do dropdown
  const etiquetaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCustomers();

    // Realtime subscription para atualização automática
    const channel = supabase
      .channel('customers-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_consolidados_v3' }, () => {
        fetchCustomers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCustomers = async (retryCount = 0) => {
    setLoading(true);
    try {
      // Buscamos um lote grande de pedidos recentes para extrair clientes.
      // Em um app de produção real com milhões de linhas, isso deveria ser uma tabela dedicada ou View SQL.
      // Para este escopo, deduziremos do histórico recente de envios (últimos 5000 pedidos).
      const { data, error } = await supabase
        .from('pedidos_consolidados_v3')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) {
        if (retryCount < 3) {
          setTimeout(() => fetchCustomers(retryCount + 1), 1000 * (retryCount + 1));
          return;
        }
        throw error;
      }

      const customerMap = new Map<string, CustomerDisplay>();

      (data as PedidoUnificado[] || []).forEach(order => {
        const email = getDeepVal(order, keys.email).toLowerCase().trim();
        const nome = getDeepVal(order, keys.nome);
        const telefone = getDeepVal(order, keys.phone);

        // Tentamos construir um endereço legível
        let endereco = getDeepVal(order, keys.fullAddress);
        if (!endereco || endereco.length < 5) {
          const rua = getDeepVal(order, keys.street);
          const num = getDeepVal(order, keys.number);
          const cidade = getDeepVal(order, keys.city);
          const uf = getDeepVal(order, keys.state);
          const cep = getDeepVal(order, keys.zip);

          if (rua) {
            endereco = `${rua}, ${num} - ${cidade}/${uf} - ${cep}`;
          }
        }

        // Chave de unicidade: Email preferencialmente, ou Nome + Telefone
        const uniqueKey = email || `${nome}-${telefone}`;

        if (uniqueKey && uniqueKey.length > 3) {
          // Se já existe, não sobrescrevemos pois estamos iterando do mais recente para o mais antigo (DESC),
          // então o primeiro que encontramos é o mais atual.
          if (!customerMap.has(uniqueKey)) {
            customerMap.set(uniqueKey, {
              id: order.id, // ID de referência
              nome: nome || 'Cliente Sem Nome',
              email: email || '-',
              telefone: telefone || '-',
              endereco: endereco || 'Endereço não informado',
              logradouro: getDeepVal(order, keys.street),
              numero: getDeepVal(order, keys.number),
              bairro: getDeepVal(order, ['bairro', 'neighborhood', 'address_neighborhood']),
              cidade: getDeepVal(order, keys.city),
              estado: getDeepVal(order, keys.state),
              cep: getDeepVal(order, keys.zip),
              cpf: getDeepVal(order, keys.cpf),
              ultimoPedido: order.created_at
            });
          }
        }
      });

      setCustomers(Array.from(customerMap.values()));
    } catch (error) {
      logger.error('Erro ao buscar clientes', error, { module: 'Customers' });
    } finally {
      setLoading(false);
    }
  };

  // Filtragem no cliente
  const filteredCustomers = customers.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      c.nome.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      c.telefone.includes(term) ||
      c.endereco.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredCustomers.length / pageSize);
  const displayedCustomers = filteredCustomers.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const fetchCustomerHistory = async (email: string, doc: string) => {
    setLoadingHistorico(true);
    try {
      let query = supabase.from('pedidos_consolidados_v3').select('*').order('created_at', { ascending: false });
      
      if (email && email !== '-') {
        query = query.ilike('email', email);
      } else if (doc && doc !== '-') {
        query = query.eq('cpf', doc);
      } else {
        setHistorico([]);
        setLoadingHistorico(false);
        return;
      }
      
      const { data } = await query;
      setHistorico(data || []);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const loadAllSystemTags = async () => {
    const { data } = await supabase.from('crm_tags').select('nome').eq('ativo', true);
    if (data) setAllTags(data.map((t: any) => t.nome).sort());
  };

  const fetchCRMData = async (email: string, phone: string) => {
    setLoadingCRM(true);
    try {
      const qEmail = email && email !== '-' ? email : '---';
      const qPhone = phone && phone !== '-' ? phone : '---';
      
      const { data } = await supabase
        .from('crm_atendimentos')
        .select('*')
        .or(`email.ilike.${qEmail},telefone.ilike.%${qPhone.slice(-8)}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (data) {
        setTicketId(data.id);
        setEtiquetas(data.etiquetas || []);
      } else {
        setTicketId(null);
        setEtiquetas([]);
      }
      await loadAllSystemTags();
    } catch {
      setTicketId(null);
      setEtiquetas([]);
      await loadAllSystemTags();
    } finally {
      setLoadingCRM(false);
    }
  };

  const handleOpenEdit = (customer: CustomerDisplay) => {
    setSelectedCustomer(customer);
    setActiveTab('info');
    setEditForm({
      nome: customer.nome,
      email: customer.email === '-' ? '' : customer.email,
      telefone: customer.telefone === '-' ? '' : customer.telefone,
      cpf: customer.cpf || '',
      logradouro: customer.logradouro || '',
      numero: customer.numero || '',
      bairro: customer.bairro || '',
      cidade: customer.cidade || '',
      estado: customer.estado || '',
      cep: customer.cep || ''
    });
    
    // Disparar buscas assíncronas
    fetchCustomerHistory(customer.email, customer.cpf || '');
    fetchCRMData(customer.email, customer.telefone);
    
    setIsEditModalOpen(true);
  };

  // Funções de Etiqueta (iguais ao Chat)
  const handleAddEtiqueta = async (tagName: string) => {
    if (!ticketId) {
      toast.error('Este cliente não possui um ticket de CRM ainda. Uma conversa precisa ser iniciada.');
      return;
    }
    
    if (!allTags.includes(tagName)) {
      const { error: errorTag } = await supabase.from('crm_tags').insert({
        nome: tagName, cor: '#3b82f6', categoria: 'geral', icone: 'tag', ativo: true
      });
      if (!errorTag) setAllTags(prev => [...prev, tagName].sort());
    }

    if (etiquetas.includes(tagName)) {
      setShowEtiquetaDropdown(false);
      return;
    }

    const novas = [...etiquetas, tagName];
    const { error } = await supabase.from('crm_atendimentos').update({ etiquetas: novas }).eq('id', ticketId);
    
    if (error) {
      toast.error('Erro ao adicionar etiqueta');
    } else {
      setEtiquetas(novas);
      setEtiquetaSearch('');
      setShowEtiquetaDropdown(false);
    }
  };

  const handleRemoveEtiqueta = async (tagName: string) => {
    if (!ticketId) return;
    const novas = etiquetas.filter(e => e !== tagName);
    const { error } = await supabase.from('crm_atendimentos').update({ etiquetas: novas }).eq('id', ticketId);
    if (!error) setEtiquetas(novas);
  };

  const handleUpdateCustomer = async () => {
    if (!selectedCustomer) return;
    setIsSaving(true);

    try {
      // ⚠️ UPDATE PREFERENCIAL VIA CPF (Mais robusto)
      if (selectedCustomer.cpf) {
        const { error } = await supabase.rpc('update_pedidos_consolidados', {
          p_cpf_antigo: selectedCustomer.cpf,
          p_cpf_novo: editForm.cpf,
          p_nome: editForm.nome,
          p_email: editForm.email,
          p_telefone: editForm.telefone,
          p_cep: editForm.cep,
          p_logradouro: editForm.logradouro,
          p_numero: editForm.numero,
          p_complemento: '', // Não mapeado inicialmente neste fetch simplificado
          p_bairro: editForm.bairro,
          p_cidade: editForm.cidade,
          p_estado: editForm.estado,
          p_observacao: 'Editado via Base de Clientes'
        });

        if (error) throw error;
      } else {
        // Fallback para update direto por email se CPF não existir
        const { error } = await supabase
          .from('pedidos_consolidados_v3')
          .update({
            nome_cliente: editForm.nome,
            email: editForm.email,
            telefone: editForm.telefone,
            logradouro: editForm.logradouro,
            numero: editForm.numero,
            bairro: editForm.bairro,
            cidade: editForm.cidade,
            estado: editForm.estado,
            cep: editForm.cep,
            foi_editado: true
          })
          .eq('email', selectedCustomer.email);

        if (error) throw error;
      }

      toast.success('Informações do cliente atualizadas com sucesso!');
      setIsEditModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      logger.error('Erro ao atualizar cliente', err);
      toast.error('Erro ao atualizar: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Base de Clientes</h2>
          <p className="text-slate-500 dark:text-slate-400">Lista única de clientes extraída dos pedidos recentes.</p>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Total Encontrado: <strong>{filteredCustomers.length}</strong>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou cidade..."
              className="w-full bg-white dark:bg-slate-950 border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span>Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-white dark:bg-slate-950 border border-border rounded px-2 py-1.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4"><TableSkeleton /></div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/80 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Nome / Contato</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Endereço Completo</th>
                  {can('clientes:edit') && <th className="px-6 py-4 font-medium text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  displayedCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <div 
                              className="font-medium text-blue-500 hover:underline cursor-pointer"
                              onClick={() => handleOpenEdit(customer)}
                              title="Ver Perfil Completo"
                            >
                              {customer.nome}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                              <Phone className="w-3 h-3" /> {customer.telefone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <Mail className="w-3.5 h-3.5" />
                          <span>{customer.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400 max-w-md">
                          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span className="truncate whitespace-normal leading-snug">{customer.endereco}</span>
                        </div>
                      </td>
                      {can('clientes:edit') && (
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleOpenEdit(customer)}
                            className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="Editar Cliente"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-4 py-3 border-t border-border bg-slate-50 dark:bg-slate-900/30 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Mostrando {filteredCustomers.length > 0 ? (page - 1) * pageSize + 1 : 0} até {Math.min(page * pageSize, filteredCustomers.length)} de {filteredCustomers.length}
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

      {/* Modal de Perfil Completo 360 */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Perfil: ${selectedCustomer?.nome || 'Cliente'}`}
        size="full"
      >
        <div className="flex flex-col w-full h-full max-w-[1400px] mx-auto">
          <div className="flex-1 pr-2 pb-6 space-y-8">
            
            {/* CABEÇALHO DE AÇÕES RÁPIDAS */}
            <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-900/50 p-4 rounded-xl border border-border">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-200 text-lg">{selectedCustomer?.nome}</h3>
                <p className="text-slate-500 text-sm flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" /> {selectedCustomer?.email} <span className="mx-1">•</span>
                  <Phone className="w-3.5 h-3.5" /> {selectedCustomer?.telefone}
                </p>
              </div>
              <button
                onClick={() => {
                  let phone = selectedCustomer?.telefone?.replace(/\D/g, '') || '';
                  if (phone.length === 10 || phone.length === 11) {
                    phone = `55${phone}`;
                  }
                  navigate(`/crm/chat${phone ? `?tel=${phone}&name=${encodeURIComponent(selectedCustomer?.nome || '')}&email=${encodeURIComponent(selectedCustomer?.email || '')}` : ''}`);
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-emerald-600/20"
              >
                <MessageSquare className="w-4 h-4" /> Conversar no WhatsApp <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* COLUNA ESQUERDA: DADOS E ENDEREÇO */}
              <div className="space-y-6">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-200 mb-4 border-b border-border pb-2">
                    <User className="w-4 h-4 text-blue-500" /> Dados Pessoais e Endereço
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Nome Completo</label>
                        <input
                          type="text"
                          className="w-full bg-slate-950 border border-border rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none"
                          value={editForm.nome}
                          onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">E-mail</label>
                        <input
                          type="email"
                          className="w-full bg-slate-950 border border-border rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Telefone</label>
                        <input
                          type="text"
                          className="w-full bg-slate-950 border border-border rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none"
                          value={editForm.telefone}
                          onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">CPF</label>
                        <input
                          type="text"
                          className="w-full bg-slate-950 border border-border rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none"
                          value={editForm.cpf}
                          onChange={(e) => setEditForm({ ...editForm, cpf: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-1 mt-4">
                      <label className="text-xs font-semibold text-slate-500 uppercase">Logradouro (Rua/Av)</label>
                      <input
                        type="text"
                        className="w-full bg-slate-950 border border-border rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none"
                        value={editForm.logradouro}
                        onChange={(e) => setEditForm({ ...editForm, logradouro: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Número</label>
                        <input
                          type="text"
                          className="w-full bg-slate-950 border border-border rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none"
                          value={editForm.numero}
                          onChange={(e) => setEditForm({ ...editForm, numero: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Bairro</label>
                        <input
                          type="text"
                          className="w-full bg-slate-950 border border-border rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none"
                          value={editForm.bairro}
                          onChange={(e) => setEditForm({ ...editForm, bairro: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1 space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">CEP</label>
                        <input
                          type="text"
                          className="w-full bg-slate-950 border border-border rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none"
                          value={editForm.cep}
                          onChange={(e) => setEditForm({ ...editForm, cep: e.target.value })}
                        />
                      </div>
                      <div className="col-span-1 space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Cidade</label>
                        <input
                          type="text"
                          className="w-full bg-slate-950 border border-border rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none"
                          value={editForm.cidade}
                          onChange={(e) => setEditForm({ ...editForm, cidade: e.target.value })}
                        />
                      </div>
                      <div className="col-span-1 space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">UF</label>
                        <input
                          type="text"
                          maxLength={2}
                          className="w-full bg-slate-950 border border-border rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none uppercase"
                          value={editForm.estado}
                          onChange={(e) => setEditForm({ ...editForm, estado: e.target.value.toUpperCase() })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUNA DIREITA: ETIQUETAS E HISTÓRICO */}
              <div className="space-y-8">
                
                {/* ETIQUETAS CRM */}
                <div>
                  <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-200 mb-4 border-b border-border pb-2">
                    <Tag className="w-4 h-4 text-emerald-500" /> Etiquetas do Cliente (CRM)
                  </h3>
                  
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-xl border border-border">
                    {loadingCRM ? (
                      <p className="text-slate-500 text-sm">Verificando CRM...</p>
                    ) : !ticketId ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-slate-500 mb-3">Este cliente ainda não iniciou ou não possui histórico de conversas no CRM.</p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {etiquetas.map(et => (
                            <div key={et} className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
                              {et}
                              <button onClick={() => handleRemoveEtiqueta(et)} className="ml-1 hover:text-white transition-colors" title="Remover Etiqueta">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          {etiquetas.length === 0 && (
                            <span className="text-slate-500 text-sm">Nenhuma etiqueta aplicada.</span>
                          )}
                        </div>

                        <div className="relative mt-2" ref={etiquetaRef}>
                          <input
                            type="text"
                            placeholder="Buscar ou adicionar nova etiqueta..."
                            className="w-full bg-white dark:bg-slate-950 border border-border rounded-lg px-4 py-2 text-sm text-slate-900 dark:text-slate-200 focus:border-blue-500 outline-none shadow-sm"
                            value={etiquetaSearch}
                            onChange={(e) => {
                              setEtiquetaSearch(e.target.value);
                              setShowEtiquetaDropdown(true);
                            }}
                            onFocus={() => setShowEtiquetaDropdown(true)}
                          />
                          {showEtiquetaDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-border rounded-lg shadow-xl overflow-hidden z-20 max-h-48 overflow-y-auto">
                              {allTags
                                .filter(t => t.toLowerCase().includes(etiquetaSearch.toLowerCase()))
                                .map(tag => (
                                  <button
                                    key={tag}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center justify-between"
                                    onClick={() => handleAddEtiqueta(tag)}
                                  >
                                    {tag}
                                    {etiquetas.includes(tag) && <span className="text-xs text-emerald-500 font-medium">Aplicada</span>}
                                  </button>
                                ))}
                              {etiquetaSearch && !allTags.some(t => t.toLowerCase() === etiquetaSearch.toLowerCase()) && (
                                <button
                                  className="w-full text-left px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 font-bold"
                                  onClick={() => handleAddEtiqueta(etiquetaSearch.trim())}
                                >
                                  + Criar etiqueta "{etiquetaSearch}"
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* HISTÓRICO DE COMPRAS */}
                <div>
                  <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-200 mb-4 border-b border-border pb-2">
                    <ShoppingBag className="w-4 h-4 text-purple-500" /> Histórico de Compras ({historico.length})
                  </h3>
                  
                  <div className="space-y-3">
                    {loadingHistorico ? (
                      <p className="text-slate-500 text-sm">Buscando histórico...</p>
                    ) : historico.length === 0 ? (
                      <div className="p-6 text-center bg-slate-50 dark:bg-slate-900/30 border border-border rounded-xl border-dashed">
                        <p className="text-slate-500 text-sm">Nenhum pedido encontrado para este cliente na base unificada.</p>
                      </div>
                    ) : (
                      <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 rounded-lg">
                        {historico.map((pedido) => (
                          <div key={pedido.id} className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-border rounded-xl flex justify-between items-start hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                            <div className="flex-1">
                              <p className="font-semibold text-slate-900 dark:text-slate-200 truncate pr-4" title={pedido.descricao_pacote}>
                                {pedido.descricao_pacote || 'Produto não descrito'}
                              </p>
                              <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-600 dark:text-slate-400 text-xs font-medium">
                                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {new Date(pedido.created_at).toLocaleDateString('pt-BR')}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                <span className={`uppercase px-2 py-0.5 rounded-full ${
                                  pedido.status_aprovacao === 'Aprovado' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                  pedido.status_aprovacao.includes('Cancelado') || pedido.status_aprovacao.includes('Recusado') ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                                  'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                                }`}>
                                  {pedido.status_aprovacao}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className="text-[10px] font-bold tracking-wider px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded uppercase text-slate-600 dark:text-slate-400">
                                {pedido.plataforma}
                              </span>
                              <span className="text-xs font-semibold text-slate-500">
                                {pedido.codigo_rastreio ? 'Com Rastreio' : 'S/ Rastreio'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>
          
          {/* RODAPÉ FIXED COM AÇÕES */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-auto bg-white dark:bg-slate-950 p-2">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="px-6 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Fechar Visualização
            </button>
            <button
              onClick={handleUpdateCustomer}
              disabled={isSaving}
              className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {isSaving ? 'Salvando...' : <><Save className="w-4 h-4" /> Salvar Alterações de Contato</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};