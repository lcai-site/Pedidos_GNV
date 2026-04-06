import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { MessageSquare, CheckCircle2, Search, Send, User, Phone, ShoppingBag, X, Loader2, Mail, Pencil, Check, ChevronDown, ChevronUp, Tag, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Atendimento {
  id: string;
  telefone: string;
  cliente_nome: string;
  email: string | null; // Coluna adicionada na migration 119
  status: 'novo' | 'em_andamento' | 'concluido';
  responsavel_id: string | null;
  pedido_id: string | null;
  ultima_mensagem_em: string;
  created_at: string;
  etiquetas: string[];
}

interface Mensagem {
  id: string;
  atendimento_id: string;
  direcao: 'in' | 'out';
  tipo: string;
  conteudo: string;
  status_envio: string;
  created_at: string;
}

export const CRMChat: React.FC = () => {
  const { profile, can } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTel = searchParams.get('tel') || '';
  const defaultName = searchParams.get('name') || '';
  const defaultEmail = searchParams.get('email') || '';
  // Mensagem de recuperação pré-preenchida vinda do Recovery (?msg=)
  const defaultMsg = searchParams.get('msg') || '';
  const hasAutoStarted = useRef(false);
  
  const [activeTab, setActiveTab] = useState<'novos' | 'meus' | 'concluidos'>('meus');
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [searchTerm, setSearchTerm] = useState(defaultTel);
  
  const [selectedTicket, setSelectedTicket] = useState<Atendimento | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [newMessage, setNewMessage] = useState(defaultMsg); // pré-preenchido se vier do Recovery
  const [isLoading, setIsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Ref com o created_at da última mensagem REAL (não-temp) — usado pelo polling
  const latestMsgTimestampRef = useRef<string>(new Date(0).toISOString());

  // Histórico do cliente no Dossiê
  const [historicoPedidos, setHistoricoPedidos] = useState<any[]>([]);

  // Painel Dados do Cliente
  const [isDadosOpen, setIsDadosOpen] = useState(true);
  const [isEditingDados, setIsEditingDados] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingDados, setSavingDados] = useState(false);

  // Sugestão de merge por email existente no sistema
  const [emailSugestao, setEmailSugestao] = useState<{ nome: string; telefone: string; email: string } | null>(null);
  const emailDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Etiquetas
  const [allEtiquetas, setAllEtiquetas] = useState<string[]>([]);
  const [etiquetaSearch, setEtiquetaSearch] = useState('');
  const [showEtiquetaDropdown, setShowEtiquetaDropdown] = useState(false);
  const etiquetaRef = useRef<HTMLDivElement>(null);

  // 1. Carregar Atendimentos
  const loadAtendimentos = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('crm_atendimentos')
        .select('*')
        .order('ultima_mensagem_em', { ascending: false });
      if (error) throw error;
      if (data) setAtendimentos(data.map(a => ({ ...a, etiquetas: a.etiquetas || [] })));
    } catch (error) {
      console.error('Erro ao carregar tickets:', error);
      toast.error('Erro ao listar atendimentos');
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar todas as etiquetas únicas do sistema (agora usando crm_tags)
  const loadAllEtiquetas = async () => {
    const { data, error } = await supabase
      .from('crm_tags')
      .select('nome')
      .eq('ativo', true);
    if (!data || error) return;
    const nomes = data.map((t: any) => t.nome);
    setAllEtiquetas(nomes.sort());
  };

  useEffect(() => {
    // Iniciar ou selecionar a conversa automaticamente por URL params
    if (defaultTel && profile && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      const attemptAutoStart = async () => {
        setIsLoading(true);
        try {
          // Tenta encontrar ticket existente do cliente localmente ou no DB
          const { data: existing, error: existErr } = await supabase
            .from('crm_atendimentos')
            .select('*')
            .like('telefone', `%${defaultTel.replace(/\D/g, '')}%`)
            .order('ultima_mensagem_em', { ascending: false })
            .limit(1)
            .single();

          if (existing && !existErr) {
            // Se encontrou o ticket existente, mas falta o e-mail, e temos na URL, atualizamos
            if (!existing.email && defaultEmail) {
              const { error: updateErr } = await supabase.from('crm_atendimentos').update({ email: defaultEmail }).eq('id', existing.id);
              if (!updateErr) existing.email = defaultEmail;
            }
            setSelectedTicket({ ...existing, etiquetas: existing.etiquetas || [] });
            setActiveTab(existing.status === 'novo' ? 'novos' : (existing.status === 'em_andamento' && existing.responsavel_id !== profile.id ? 'novos' : (existing.status === 'concluido' ? 'concluidos' : 'meus')));
          } else {
            // Se não encontrou, cria um novo imediatamente com nome e email (se existir)
            let telStr = defaultTel.replace(/\D/g, '');
            if (telStr.length === 10 || telStr.length === 11) telStr = '55' + telStr;
            
            if (telStr.length >= 10) {
              const titleName = defaultName ? defaultName : `Cliente (${telStr})`;
              const { data, error } = await supabase
                .from('crm_atendimentos')
                .insert({
                  telefone: telStr,
                  cliente_nome: titleName,
                  email: defaultEmail || null,
                  status: 'em_andamento',
                  responsavel_id: profile.id
                })
                .select()
                .single();

              if (!error && data) {
                toast.success('Conversa iniciada automaticamente!');
                setSelectedTicket({ ...data, etiquetas: data.etiquetas || [] });
                setActiveTab('meus');
              }
            }
          }
        } catch (err) {
          console.error('Erro no auto-start de chat:', err);
        } finally {
          setIsLoading(false);
          // Chama a carga de atendimentos normalmente após resolver auto-start
          loadAtendimentos();
        }
      };
      attemptAutoStart();
    } else if (!hasAutoStarted.current) {
      loadAtendimentos();
    }
    
    loadAllEtiquetas();

    // Inscrição Realtime para novos tickets e atualizações
    const subscription = supabase
      .channel('crm_atendimentos_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_atendimentos' }, () => {
        loadAtendimentos();
      })
      .subscribe();

    // Fechar dropdown de etiquetas ao clicar fora
    const handleClickOutside = (e: MouseEvent) => {
      if (etiquetaRef.current && !etiquetaRef.current.contains(e.target as Node)) {
        setShowEtiquetaDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      supabase.removeChannel(subscription);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 2. Carregar Mensagens do Ticket Selecionado
  useEffect(() => {
    if (!selectedTicket) return;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('crm_mensagens')
        .select('*')
        .eq('atendimento_id', selectedTicket.id)
        .order('created_at', { ascending: true });
        
      if (!error && data) setMensagens(data);
      scrollToBottom();
    };

    const loadHistorico = async () => {
       const tail = selectedTicket.telefone.slice(-8);
       const { data, error } = await supabase
         .from('pedidos_consolidados_v3')
         .select('id, codigo_transacao, nome_cliente, email, nome_produto, status_aprovacao, valor_total_aprovado, data_venda')
         .ilike('telefone', `%${tail}%`)
         .order('data_venda', { ascending: false });
       if (!error && data) setHistoricoPedidos(data);
    };

    loadMessages();
    loadHistorico();

    // FIX: Sem `filter` no canal — o filtro por atendimento_id é feito no JS.
    // Motivo: mensagens inseridas pelo webhook-zapi via service_role não propagam
    // eventos Realtime filtrados corretamente por RLS, causando silêncio no canal.
    const messageSub = supabase
      .channel(`mensagens_ticket_${selectedTicket.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'crm_mensagens',
      }, (payload) => {
        const nova = payload.new as Mensagem;
        // Filtrar no cliente para garantir que é deste ticket
        if (nova.atendimento_id !== selectedTicket.id) return;

        // Evitar duplicata de optimistic update: substituir temp por real
        setMensagens(prev => {
          const jaExiste = prev.some(m => m.id === nova.id);
          if (jaExiste) return prev;
          // Remover o placeholder optimista (id começa com 'temp-') e adicionar o real
          const semTemp = prev.filter(m => !m.id.startsWith('temp-') || m.conteudo !== nova.conteudo || m.direcao !== nova.direcao);
          return [...semTemp, nova];
        });

        // FIX: Atualizar `ultima_mensagem_em` na lista de atendimentos sem reload completo
        setAtendimentos(prev => prev.map(a =>
          a.id === nova.atendimento_id
            ? { ...a, ultima_mensagem_em: nova.created_at }
            : a
        ));

        scrollToBottom();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messageSub);
    };
  }, [selectedTicket]);

  // POLLING FALLBACK: garante entrega mesmo quando o Realtime falha
  // (ex: inserções via service_role que o Realtime server pode não entregar por contexto RLS).
  // Busca somente mensagens com created_at > última mensagem conhecida — sem custo alto.
  useEffect(() => {
    if (!selectedTicket) return;

    // Atualiza o timestamp de referência sempre que chegam novas mensagens reais
    const reais = mensagens.filter(m => !m.id.startsWith('temp-'));
    if (reais.length > 0) {
      const ultimo = reais[reais.length - 1].created_at;
      if (ultimo > latestMsgTimestampRef.current) {
        latestMsgTimestampRef.current = ultimo;
      }
    }
  }, [mensagens, selectedTicket]);

  useEffect(() => {
    if (!selectedTicket) return;
    // Zera o ref ao trocar de ticket
    latestMsgTimestampRef.current = new Date(0).toISOString();

    const poll = setInterval(async () => {
      const since = latestMsgTimestampRef.current;
      const { data } = await supabase
        .from('crm_mensagens')
        .select('*')
        .eq('atendimento_id', selectedTicket.id)
        .gt('created_at', since)
        .order('created_at', { ascending: true });

      if (!data || data.length === 0) return;

      setMensagens(prev => {
        // Deduplica: insere apenas mensagens que ainda não existem (por id)
        const novas = (data as Mensagem[]).filter(m => !prev.some(e => e.id === m.id));
        if (novas.length === 0) return prev;
        // Remove temp com mesmo conteúdo/direção que a real já confirmou
        const semTemp = prev.filter(p =>
          !p.id.startsWith('temp-') ||
          !novas.some(n => n.conteudo === p.conteudo && n.direcao === p.direcao)
        );
        return [...semTemp, ...novas];
      });

      // Atualiza sidebar sem reload completo
      setAtendimentos(prev => prev.map(a =>
        a.id === selectedTicket.id
          ? { ...a, ultima_mensagem_em: (data as Mensagem[]).at(-1)!.created_at }
          : a
      ));

      scrollToBottom();
    }, 3000); // 3 segundos — responsivo sem sobrecarregar

    return () => clearInterval(poll);
  }, [selectedTicket]); // selectedTicket como única dep: o poll usa ref para o timestamp

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // 3. Enviar Mensagem
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const texto = newMessage.trim();
    if (!texto || !selectedTicket || !profile) return;

    // FIX OPTIMISTIC UPDATE: Exibe a mensagem imediatamente no chat antes da confirmação do DB/ZAPI.
    // O evento Realtime vai substituir este placeholder pelo registro real.
    const tempId = `temp-${Date.now()}`;
    const mensagemOtimista: Mensagem = {
      id: tempId,
      atendimento_id: selectedTicket.id,
      direcao: 'out',
      tipo: 'text',
      conteudo: texto,
      status_envio: 'enviando',
      created_at: new Date().toISOString(),
    };
    setMensagens(prev => [...prev, mensagemOtimista]);
    setNewMessage('');
    scrollToBottom();

    try {
      setSending(true);

      // PASSO A: Salvar no DB
      const { data: newMsg, error } = await supabase
        .from('crm_mensagens')
        .insert({
          atendimento_id: selectedTicket.id,
          direcao: 'out',
          tipo: 'text',
          conteudo: texto,
          criado_por_id: profile.id,
          status_envio: 'enviando'
        })
        .select()
        .single();

      if (error) throw error;

      // Substituir optimista pelo registro real (caso o Realtime não chegue a remover)
      setMensagens(prev => prev.map(m => m.id === tempId ? (newMsg as Mensagem) : m));

      // PASSO B: Chamar a Z-API (via Edge Function Proxy)
      const { error: fnError } = await supabase.functions.invoke('zapi-proxy', {
        body: {
          action: 'send-text',
          phone: selectedTicket.telefone.replace(/\D/g, ''),
          message: newMsg.conteudo
        }
      });

      // Se falhar no envio, marca o status da mensagem como 'erro' no DB
      if (fnError) {
        await supabase.from('crm_mensagens').update({ status_envio: 'erro' }).eq('id', newMsg.id);
        setMensagens(prev => prev.map(m => m.id === newMsg.id ? { ...m, status_envio: 'erro' } : m));
        toast.warning('Mensagem salva, mas falhou ao enviar para WhatsApp.');
      }

    } catch (error) {
      // Revertrer optimista em caso de erro de DB
      setMensagens(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(texto);
      console.error('Erro ao enviar:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  // 4. Assumir Atendimento
  const assumirTicket = async (ticketId: string) => {
     if (!profile) return;
     try {
       const { data, error } = await supabase.rpc('atribuir_atendimento', {
          p_atendimento_id: ticketId,
          p_novo_responsavel_id: profile.id
       });
       if (error) throw error;
       toast.success('Atendimento atribuído a você!');
       if (selectedTicket?.id === ticketId) {
          setSelectedTicket(prev => prev ? {...prev, responsavel_id: profile.id, status: 'em_andamento'} : null);
       }
       loadAtendimentos();
     } catch (err: any) {
       toast.error(err.message || 'Erro ao assumir');
     }
  };

  const concluirTicket = async (ticketId: string) => {
    try {
      const { error } = await supabase.from('crm_atendimentos').update({ status: 'concluido' }).eq('id', ticketId);
      if (error) throw error;
      toast.success('Atendimento concluído!');
      setSelectedTicket(null);
      loadAtendimentos();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Filtros
  const filteredAtendimentos = atendimentos.filter(a => {
     if (searchTerm && !a.telefone.includes(searchTerm) && !a.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
     if (activeTab === 'novos') return a.status === 'novo';
     if (activeTab === 'meus') return a.status === 'em_andamento' && a.responsavel_id === profile?.id;
     if (activeTab === 'concluidos') return a.status === 'concluido';
     return true;
  });

  // Iniciar edição dos dados do cliente
  const startEditDados = () => {
    setEditNome(selectedTicket?.cliente_nome || '');
    setEditTelefone(selectedTicket?.telefone || '');
    // FIX: usa selectedTicket.email (coluna real na migration 119)
    // com fallback para historicoPedidos caso o backfill ainda não tenha rodado
    setEditEmail(selectedTicket?.email || historicoPedidos[0]?.email || '');
    setEmailSugestao(null);
    setIsEditingDados(true);
  };

  // Busca email no sistema (debounced 500ms) e sugere merge se encontrar
  const handleEmailChange = (valor: string) => {
    setEditEmail(valor);
    setEmailSugestao(null);
    if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);
    if (!valor.trim() || !valor.includes('@')) return;
    emailDebounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('pedidos_consolidados_v3')
        .select('nome_cliente, telefone, email')
        .ilike('email', valor.trim())
        .limit(1)
        .single();
      if (data && data.email) {
        setEmailSugestao({ nome: data.nome_cliente, telefone: data.telefone, email: data.email });
      }
    }, 500);
  };

  // Aplicar sugestão de merge
  const aplicarMerge = () => {
    if (!emailSugestao) return;
    setEditNome(emailSugestao.nome || editNome);
    setEditTelefone(emailSugestao.telefone || editTelefone);
    setEditEmail(emailSugestao.email);
    setEmailSugestao(null);
    toast.success('Dados preenchidos a partir do cliente existente!');
  };

  // Salvar edições no atendimento (FIX: inclui email)
  const saveDados = async () => {
    if (!selectedTicket) return;
    try {
      setSavingDados(true);
      const { error } = await supabase
        .from('crm_atendimentos')
        .update({
          cliente_nome: editNome.trim(),
          telefone: editTelefone.trim(),
          email: editEmail.trim() || null, // FIX: salva email no banco
        })
        .eq('id', selectedTicket.id);
      if (error) throw error;
      // Atualiza estado local com os 3 campos
      const updated = { cliente_nome: editNome.trim(), telefone: editTelefone.trim(), email: editEmail.trim() || null };
      setSelectedTicket(prev => prev ? { ...prev, ...updated } : null);
      setAtendimentos(prev => prev.map(a => a.id === selectedTicket.id ? { ...a, ...updated } : a));
      setIsEditingDados(false);
      setEmailSugestao(null);
      toast.success('Dados atualizados!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSavingDados(false);
    }
  };

  // Adicionar etiqueta ao ticket
  const addEtiqueta = async (etiqueta: string) => {
    if (!selectedTicket) return;

    // 1. Criar na tabela global crm_tags se for uma etiqueta nova
    if (!allEtiquetas.includes(etiqueta)) {
      const { error: errorTag } = await supabase.from('crm_tags').insert({
        nome: etiqueta,
        cor: '#3b82f6', // cor padrão (azul)
        categoria: 'geral',
        icone: 'tag',
        ativo: true
      });
      if (!errorTag) {
        setAllEtiquetas(prev => [...prev, etiqueta].sort());
      }
    }

    // 2. Adicionar ao atendimento
    const atual = Array.isArray(selectedTicket.etiquetas) ? selectedTicket.etiquetas : [];
    if (atual.includes(etiqueta)) { setShowEtiquetaDropdown(false); return; }
    const novas = [...atual, etiqueta];
    const { error } = await supabase.from('crm_atendimentos').update({ etiquetas: novas }).eq('id', selectedTicket.id);
    if (error) { toast.error('Erro ao adicionar etiqueta'); return; }
    setSelectedTicket(prev => prev ? { ...prev, etiquetas: novas } : null);
    setAtendimentos(prev => prev.map(a => a.id === selectedTicket.id ? { ...a, etiquetas: novas } : a));
    
    setEtiquetaSearch('');
    setShowEtiquetaDropdown(false);
  };

  // Remover etiqueta do ticket
  const removeEtiqueta = async (etiqueta: string) => {
    if (!selectedTicket) return;
    const novas = (selectedTicket.etiquetas || []).filter(e => e !== etiqueta);
    const { error } = await supabase.from('crm_atendimentos').update({ etiquetas: novas }).eq('id', selectedTicket.id);
    if (error) { toast.error('Erro ao remover etiqueta'); return; }
    setSelectedTicket(prev => prev ? { ...prev, etiquetas: novas } : null);
    setAtendimentos(prev => prev.map(a => a.id === selectedTicket.id ? { ...a, etiquetas: novas } : a));
  };

  // Iniciar nova conversa (Cria ticket direto da busca)
  const iniciarNovaConversa = async () => {
    let telefoneLimpo = searchTerm.replace(/\D/g, '');
    if (telefoneLimpo.length < 10) return;
    
    // Garantir DDI ao criar ticket
    if (telefoneLimpo.length === 10 || telefoneLimpo.length === 11) {
      telefoneLimpo = '55' + telefoneLimpo;
    }

    if (!profile) {
      toast.error('Usuário não identificado.');
      return;
    }

    try {
      setIsLoading(true);
      
      const titleName = defaultName && defaultTel.replace(/\D/g, '') === telefoneLimpo ? defaultName : `Cliente (${telefoneLimpo})`;
      const insertEmail = defaultEmail && defaultTel.replace(/\D/g, '') === telefoneLimpo ? defaultEmail : null;

      const { data, error } = await supabase
        .from('crm_atendimentos')
        .insert({
          telefone: telefoneLimpo,
          cliente_nome: titleName,
          email: insertEmail,
          status: 'em_andamento',
          responsavel_id: profile.id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Nova conversa criada!');
      setSearchTerm(''); // Limpa a busca para visualizar
      setActiveTab('meus'); // Muda para a aba do atendente
      setSelectedTicket(data); // Abre o chat auto
      setAtendimentos(prev => [data, ...prev]);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao criar conversa');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] -mt-2 -mx-2">
      <SectionHeader title="Inbox Conversacional" subtitle="Atendimentos do WhatsApp via Z-API" />

      <div className="flex flex-1 overflow-hidden mt-4 gap-4">
         {/* Lado Esquerdo: Filas de Atendimento */}
         <div className="w-1/3 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
            {/* Abas */}
            <div className="flex border-b border-slate-800 shrink-0">
               <button onClick={() => setActiveTab('novos')} className={`flex-1 py-3 text-xs font-semibold uppercase ${activeTab === 'novos' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
                 Novos <span className="ml-1 bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">{atendimentos.filter(a => a.status === 'novo').length}</span>
               </button>
               <button onClick={() => setActiveTab('meus')} className={`flex-1 py-3 text-xs font-semibold uppercase ${activeTab === 'meus' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
                 Meus <span className="ml-1 bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">{atendimentos.filter(a => a.status === 'em_andamento' && a.responsavel_id === profile?.id).length}</span>
               </button>
               <button onClick={() => setActiveTab('concluidos')} className={`flex-1 py-3 text-xs font-semibold uppercase ${activeTab === 'concluidos' ? 'text-slate-200 border-b-2 border-slate-400' : 'text-slate-500 hover:text-slate-300'}`}>
                 Concluídos
               </button>
            </div>
            {/* Busca */}
            <div className="p-3 border-b border-slate-800 shrink-0 relative">
               <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
               <input 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none transition-colors"
                 placeholder="Buscar nome ou telefone..."
               />
            </div>
            {/* Lista */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
               {isLoading && <div className="text-center py-4 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" /> Carregando...</div>}
               {!isLoading && filteredAtendimentos.length === 0 && (
                 <div className="text-center py-8 flex flex-col items-center justify-center gap-3">
                   <p className="text-slate-500 text-sm">Nenhum atendimento nesta fila.</p>
                   {searchTerm && searchTerm.replace(/\D/g, '').length >= 10 && (
                     <button
                       onClick={iniciarNovaConversa}
                       className="px-4 py-2 mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 w-[80%]"
                     >
                       <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                       <span className="truncate">Iniciar chat: {searchTerm}</span>
                     </button>
                   )}
                 </div>
               )}
               {filteredAtendimentos.map(ticket => (
                 <button 
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`w-full text-left p-3 rounded-xl transition-all border ${selectedTicket?.id === ticket.id ? 'bg-slate-800/80 border-slate-600' : 'bg-transparent border-transparent hover:bg-slate-800/40'} flex flex-col gap-1`}
                 >
                    <div className="flex justify-between items-start w-full">
                       <span className="font-medium text-slate-200 truncate pr-2">{ticket.cliente_nome || ticket.telefone}</span>
                       <span className="text-[10px] text-slate-500 shrink-0">{format(new Date(ticket.ultima_mensagem_em), 'HH:mm')}</span>
                    </div>
                    <div className="flex justify-between items-center w-full">
                       <span className="text-xs text-slate-400">{ticket.telefone}</span>
                       {ticket.status === 'novo' && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                    </div>
                 </button>
               ))}
            </div>
         </div>

         {/* Centro: Chat */}
         {selectedTicket ? (
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
               {/* Header do Chat */}
               <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 border border-slate-700">
                        <User className="w-5 h-5" />
                     </div>
                     <div>
                        <h3 className="font-bold text-slate-200">{selectedTicket.cliente_nome}</h3>
                        <p className="text-xs text-slate-500">{selectedTicket.telefone}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     {selectedTicket.status === 'novo' && (
                        <button onClick={() => assumirTicket(selectedTicket.id)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors">
                           Assumir Atendimento
                        </button>
                     )}
                     {selectedTicket.status === 'em_andamento' && selectedTicket.responsavel_id === profile?.id && (
                        <button onClick={() => concluirTicket(selectedTicket.id)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1">
                           <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
                        </button>
                     )}
                     <button onClick={() => setSelectedTicket(null)} className="p-1.5 text-slate-500 hover:text-slate-300">
                        <X className="w-5 h-5" />
                     </button>
                  </div>
               </div>

               {/* Área de Mensagens */}
               <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/50 custom-scrollbar" style={{ backgroundImage: 'radial-gradient(circle at center, rgba(30,41,59,0.3) 0%, transparent 100%)' }}>
                  {mensagens.length === 0 && <div className="text-center text-slate-600 text-sm py-10">Nenhuma mensagem ainda.</div>}
                  {mensagens.map(msg => {
                     const isOut = msg.direcao === 'out';
                     return (
                        <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                           <div className={`max-w-[75%] rounded-2xl p-3 ${isOut ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-50 rounded-tr-sm' : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm'}`}>
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.conteudo}</p>
                              <div className={`text-[10px] mt-1 text-right ${isOut ? 'text-emerald-500/70' : 'text-slate-500'}`}>
                                 {format(new Date(msg.created_at), 'HH:mm')}
                              </div>
                           </div>
                        </div>
                     )
                  })}
                  <div ref={messagesEndRef} />
               </div>

               {/* Input Area */}
               <form onSubmit={handleSendMessage} className="p-4 bg-slate-950 border-t border-slate-800 flex gap-2">
                  <input
                     disabled={selectedTicket.status === 'concluido' || selectedTicket.status === 'novo' || (selectedTicket.status === 'em_andamento' && selectedTicket.responsavel_id !== profile?.id)}
                     value={newMessage}
                     onChange={(e) => setNewMessage(e.target.value)}
                     placeholder={
                        selectedTicket.status === 'concluido' ? "Atendimento concluído. Reabra para enviar." : 
                        selectedTicket.status === 'novo' ? "Clique em 'Assumir Atendimento' para conversar." :
                        "Digite uma mensagem..."
                     }
                     className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors"
                  />
                  <button 
                     disabled={sending || !newMessage.trim() || selectedTicket.status === 'concluido' || selectedTicket.status === 'novo' || (selectedTicket.status === 'em_andamento' && selectedTicket.responsavel_id !== profile?.id)}
                     className="w-12 h-12 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl flex items-center justify-center transition-colors shrink-0"
                  >
                     <Send className="w-5 h-5 -ml-0.5" />
                  </button>
               </form>
            </div>
         ) : (
            <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-500 border-dashed">
               <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
               <p>Selecione um atendimento para visualizar a conversa</p>
            </div>
         )}

         {/* Lado Direito: Dados do Cliente (Colapsável) */}
         {selectedTicket && (
            <div className={`bg-slate-900 border border-slate-800 rounded-xl flex flex-col relative shrink-0 transition-all duration-300 overflow-hidden ${isDadosOpen ? 'w-72' : 'w-14'}`}>
               {/* Header colapsável */}
               <button
                 onClick={() => setIsDadosOpen(p => !p)}
                 className="h-14 border-b border-slate-800 flex items-center gap-3 px-4 bg-slate-950 shrink-0 w-full hover:bg-slate-900 transition-colors"
               >
                 <User className="w-4 h-4 text-slate-400 shrink-0" />
                 {isDadosOpen && <span className="font-bold text-slate-200 flex-1 text-left text-sm">Dados do Cliente</span>}
                 {isDadosOpen ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />}
               </button>

               {isDadosOpen && (
                 <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-5">

                   {/* Info Básica + Botão Editar */}
                   <div>
                     <div className="flex items-center justify-between mb-3">
                       <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Informações</span>
                       {!isEditingDados ? (
                         <button onClick={startEditDados} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-400 transition-colors">
                           <Pencil className="w-3 h-3" /> Editar
                         </button>
                       ) : (
                         <div className="flex gap-2">
                           <button onClick={saveDados} disabled={savingDados} className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50">
                             <Check className="w-3 h-3" /> Salvar
                           </button>
                           <button onClick={() => setIsEditingDados(false)} className="text-[10px] text-slate-500 hover:text-slate-300">
                             Cancelar
                           </button>
                         </div>
                       )}
                     </div>

                     <div className="space-y-2">
                       {/* Nome */}
                       <div className="flex items-center gap-2">
                         <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                         {isEditingDados ? (
                           <input
                             value={editNome}
                             onChange={e => setEditNome(e.target.value)}
                             className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                             placeholder="Nome do cliente"
                           />
                         ) : (
                           <span className="text-sm text-slate-300 truncate">{selectedTicket.cliente_nome || '—'}</span>
                         )}
                       </div>

                       {/* Telefone */}
                       <div className="flex items-center gap-2">
                         <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                         {isEditingDados ? (
                           <input
                             value={editTelefone}
                             onChange={e => setEditTelefone(e.target.value)}
                             className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                             placeholder="Telefone"
                           />
                         ) : (
                           <span className="text-sm text-slate-300">{selectedTicket.telefone}</span>
                         )}
                       </div>

                       {/* Email */}
                       <div className="flex items-start gap-2">
                         <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-1" />
                         {isEditingDados ? (
                           <div className="flex-1 space-y-1.5">
                             <input
                               value={editEmail}
                               onChange={e => handleEmailChange(e.target.value)}
                               className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                               placeholder="Email"
                               type="email"
                               autoComplete="off"
                             />
                             {emailSugestao && (
                               <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 space-y-1">
                                 <p className="text-[10px] text-amber-400 font-semibold">⚠ Cliente encontrado:</p>
                                 <p className="text-[10px] text-slate-300 truncate font-medium">{emailSugestao.nome}</p>
                                 <p className="text-[10px] text-slate-400">{emailSugestao.telefone}</p>
                                 <button
                                   onClick={aplicarMerge}
                                   className="w-full mt-1 px-2 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] rounded border border-amber-500/30 transition-colors font-semibold"
                                 >
                                   Usar estes dados (merge)
                                 </button>
                               </div>
                             )}
                           </div>
                         ) : (
                           <span className="text-sm text-slate-300 truncate" title={selectedTicket.email || historicoPedidos[0]?.email || ''}>
                             {selectedTicket.email || historicoPedidos[0]?.email || <span className="text-slate-600 italic">sem email</span>}
                           </span>
                         )}
                       </div>
                     </div>
                   </div>

                   {/* Etiquetas dinâmicas */}
                   <div ref={etiquetaRef}>
                     <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                         <Tag className="w-3 h-3" /> Etiquetas
                       </span>
                     </div>

                     {/* Etiquetas do ticket */}
                     <div className="flex flex-wrap gap-1.5 mb-2 min-h-[24px]">
                       {(selectedTicket.etiquetas || []).length === 0 && (
                         <span className="text-[10px] text-slate-600 italic">Nenhuma etiqueta</span>
                       )}
                       {(selectedTicket.etiquetas || []).map(et => (
                         <span key={et} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] rounded border border-blue-500/30">
                           {et}
                           <button onClick={() => removeEtiqueta(et)} className="hover:text-red-400 transition-colors ml-0.5">
                             <X className="w-2.5 h-2.5" />
                           </button>
                         </span>
                       ))}
                     </div>

                     {/* Campo de busca/adição */}
                     <div className="relative">
                       <div className="flex gap-1">
                         <div className="relative flex-1">
                           <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                           <input
                             value={etiquetaSearch}
                             onChange={e => { setEtiquetaSearch(e.target.value); setShowEtiquetaDropdown(true); }}
                             onFocus={() => setShowEtiquetaDropdown(true)}
                             placeholder="Buscar ou criar..."
                             className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                           />
                         </div>
                         {etiquetaSearch.trim() && (
                           <button
                             onClick={() => addEtiqueta(etiquetaSearch.trim())}
                             className="px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shrink-0"
                             title="Criar nova etiqueta"
                           >
                             <Plus className="w-3 h-3" />
                           </button>
                         )}
                       </div>

                       {/* Dropdown de sugestões */}
                       {showEtiquetaDropdown && (
                         <div className="absolute top-full mt-1 left-0 right-0 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-36 overflow-y-auto">
                           {allEtiquetas
                             .filter(e =>
                               e.toLowerCase().includes(etiquetaSearch.toLowerCase()) &&
                               !(selectedTicket.etiquetas || []).includes(e)
                             )
                             .map(et => (
                               <button
                                 key={et}
                                 onClick={() => addEtiqueta(et)}
                                 className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2"
                               >
                                 <Tag className="w-3 h-3 text-slate-500" /> {et}
                               </button>
                             ))
                           }
                           {allEtiquetas.filter(e =>
                             e.toLowerCase().includes(etiquetaSearch.toLowerCase()) &&
                             !(selectedTicket.etiquetas || []).includes(e)
                           ).length === 0 && etiquetaSearch.trim() && (
                             <div className="px-3 py-2 text-[11px] text-slate-500">
                               Pressione + para criar “{etiquetaSearch.trim()}”
                             </div>
                           )}
                           {allEtiquetas.filter(e =>
                             e.toLowerCase().includes(etiquetaSearch.toLowerCase()) &&
                             !(selectedTicket.etiquetas || []).includes(e)
                           ).length === 0 && !etiquetaSearch.trim() && (
                             <div className="px-3 py-2 text-[11px] text-slate-500 italic">Nenhuma etiqueta no sistema ainda</div>
                           )}
                         </div>
                       )}
                     </div>
                   </div>

                   {/* Últimos Pedidos */}
                   <div>
                     <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                       <ShoppingBag className="w-3.5 h-3.5" /> Últimos Pedidos
                     </h4>
                     {historicoPedidos.length === 0 ? (
                       <p className="text-xs text-slate-500">Nenhum pedido encontrado na base Consolidados.</p>
                     ) : (
                       <div className="space-y-2">
                         {historicoPedidos.map(pedido => (
                           <div key={pedido.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                             <div className="text-[10px] text-slate-500 mb-1">{format(new Date(pedido.data_venda), 'dd/MM/yyyy HH:mm')}</div>
                             <div className="text-xs font-medium text-slate-300 mb-1 truncate" title={pedido.nome_produto}>{pedido.nome_produto}</div>
                             <div className="flex justify-between items-center mt-2">
                               <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                 pedido.status_aprovacao === 'Aprovado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                               }`}>{pedido.status_aprovacao}</span>
                               <span className="text-xs font-bold text-slate-200">R$ {pedido.valor_total_aprovado?.toFixed(2)}</span>
                             </div>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                 </div>
               )}
            </div>
         )}
      </div>
    </div>
  );
};
