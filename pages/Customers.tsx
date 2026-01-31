import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Search, MapPin, Phone, Mail, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { PedidoUnificado } from '../types';

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
  zip: ['cep', 'zip', 'zipcode', 'zip_code']
};

interface CustomerDisplay {
  id: string; // Usaremos o ID do pedido mais recente como chave ou gerar um hash
  nome: string;
  email: string;
  telefone: string;
  endereco: string;
  ultimoPedido: string;
}

export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
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

      if (error) throw error;

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
              ultimoPedido: order.created_at
            });
          }
        }
      });

      setCustomers(Array.from(customerMap.values()));
    } catch (error) {
      console.error('Error fetching customers:', error);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Base de Clientes</h2>
          <p className="text-slate-500 dark:text-slate-400">Lista única de clientes extraída dos pedidos recentes.</p>
        </div>
        <div className="text-sm text-slate-500">
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
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
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
                            <div className="font-medium text-slate-900 dark:text-slate-200">{customer.nome}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-4 py-3 border-t border-border bg-slate-50 dark:bg-slate-900/30 flex items-center justify-between">
          <span className="text-xs text-slate-500">
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
    </div>
  );
};