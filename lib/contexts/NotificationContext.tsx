import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import type { SimilarOrderPair } from '../../components/SimilarOrdersModal';
import { useAuth } from './AuthContext';

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'warning' | 'info' | 'error' | 'success' | 'possivel_duplicata' | 'usuario_pendente' | 'nova_solicitacao' | 'solicitacao_resolvida' | 'reenvio_pendente';
    read: boolean;
    date: Date;
    link?: string;
    // Dados de par de pedidos similares (apenas para type === 'possivel_duplicata')
    similarPair?: SimilarOrderPair;
    // Dados de PV Órfão
    orphanPV?: any;
}

interface NotificationContextData {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    removeNotification: (id: string) => void;
    refreshNotifications: () => Promise<void>;
    // Modal de pedidos similares
    similarPairModalOpen: boolean;
    currentSimilarPair: SimilarOrderPair | null;
    openSimilarPairModal: (pair: SimilarOrderPair) => void;
    closeSimilarPairModal: () => void;
}

const NotificationContext = createContext<NotificationContextData>({} as NotificationContextData);

// Normaliza CPF: remove tudo que não é dígito
const normCPF = (s: string) => (s || '').replace(/\D/g, '');

// Normaliza nome: minúsculo, sem acentos, sem espaços extras
const normName = (s: string) =>
    (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

// Normaliza telefone: apenas dígitos
const normPhone = (s: string) => (s || '').replace(/\D/g, '');

// Normaliza email: minúsculo, sem espaços
const normEmail = (s: string) => (s || '').toLowerCase().trim();

// Detecta pares similares numa lista de pedidos consolidados
function detectSimilarPairs(orders: any[]): SimilarOrderPair[] {
    const pairs: SimilarOrderPair[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < orders.length; i++) {
        const a = orders[i];
        const cpfA = normCPF(a.cpf);
        if (!cpfA || cpfA.length < 11) continue;

        for (let j = i + 1; j < orders.length; j++) {
            const b = orders[j];
            const cpfB = normCPF(b.cpf);

            // Chave de par para evitar duplicatas
            const pairKey = [a.id, b.id].sort().join('|');
            if (seen.has(pairKey)) continue;

            // 1. CPF deve ser IGUAL
            if (!cpfB || cpfA !== cpfB) continue;

            // Checar divergências nos outros 3 campos
            const nameA = normName(a.nome_cliente);
            const nameB = normName(b.nome_cliente);
            const emailA = normEmail(a.email);
            const emailB = normEmail(b.email);
            const phoneA = normPhone(a.telefone);
            const phoneB = normPhone(b.telefone);

            const divergencias: string[] = [];
            if (nameA && nameB && nameA !== nameB) divergencias.push('Nome');
            if (emailA && emailB && emailA !== emailB) divergencias.push('E-mail');
            if (phoneA && phoneB && phoneA !== phoneB) divergencias.push('Telefone');

            // Só alerta se há pelo menos 1 divergência mas CPFs são iguais
            // e pelo menos mais um campo igual (nome ou telefone)
            const nameMatch = nameA && nameB && nameA === nameB;
            const phoneMatch = phoneA && phoneB && phoneA === phoneB;
            const hasSimilarity = nameMatch || phoneMatch;

            if (divergencias.length === 0 || !hasSimilarity) continue;

            // Determina ordem: pedido mais antigo é o "pai"
            const dateA = new Date(a.data_venda || a.created_at || 0).getTime();
            const dateB = new Date(b.data_venda || b.created_at || 0).getTime();
            const [pai, filho] = dateA <= dateB ? [a, b] : [b, a];

            const notifId = `similar-${pairKey}`;
            seen.add(pairKey);

            pairs.push({
                notificationId: notifId,
                pedidoPai: {
                    id: pai.id,
                    codigo_transacao: pai.codigo_transacao || pai.id,
                    nome_cliente: pai.nome_cliente || '',
                    email: pai.email || '',
                    telefone: pai.telefone || '',
                    cpf: pai.cpf || '',
                    descricao_pacote: pai.descricao_pacote || '',
                    data_venda: pai.data_venda || pai.created_at || '',
                    valor_total: pai.valor_total || 0,
                    divergencias,
                },
                pedidoFilho: {
                    id: filho.id,
                    codigo_transacao: filho.codigo_transacao || filho.id,
                    nome_cliente: filho.nome_cliente || '',
                    email: filho.email || '',
                    telefone: filho.telefone || '',
                    cpf: filho.cpf || '',
                    descricao_pacote: filho.descricao_pacote || '',
                    data_venda: filho.data_venda || filho.created_at || '',
                    valor_total: filho.valor_total || 0,
                    divergencias,
                },
            });
        }
    }

    return pairs;
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [similarPairModalOpen, setSimilarPairModalOpen] = useState(false);
    const [currentSimilarPair, setCurrentSimilarPair] = useState<SimilarOrderPair | null>(null);
    const { profile } = useAuth();

    // Evita reprocessar o mesmo conjunto de IDs
    const lastOrderIdsRef = useRef<string>('');

    const checkEstoqueBaixo = useCallback(async () => {
        try {
            const { data: produtos, error } = await supabase
                .from('estoque')
                .select('id, nome_produto, quantidade_atual, limite_alerta');

            if (error || !produtos) return;

            const alertas: Notification[] = [];

            produtos.forEach((produto: any) => {
                if (produto.quantidade_atual <= produto.limite_alerta) {
                    alertas.push({
                        id: `estoque-${produto.id}-${produto.quantidade_atual}`,
                        title: 'Estoque Baixo',
                        message: `O produto ${produto.nome_produto} está com estoque baixo (${produto.quantidade_atual} un).`,
                        type: 'warning',
                        read: false,
                        date: new Date(),
                        link: '/estoque'
                    });
                }
            });

            setNotifications(prev => {
                const others = prev.filter(n => !n.id.startsWith('estoque-'));
                const newAlerts = alertas.map(newAlert => {
                    const existing = prev.find(p => p.id === newAlert.id);
                    return existing ? existing : newAlert;
                });

                return [...others, ...newAlerts].sort((a, b) => b.date.getTime() - a.date.getTime());
            });
        } catch {
            // silently fail
        }
    }, []);

    const checkSimilarOrders = useCallback(async () => {
        try {
            const { data: orders, error } = await supabase
                .from('pedidos_consolidados_v3')
                .select('id, codigo_transacao, nome_cliente, email, telefone, cpf, descricao_pacote, data_venda, created_at, valor_total, status_envio, observacao')
                .not('cpf', 'is', null)
                .order('data_venda', { ascending: false })
                .limit(2000);

            if (error || !orders || orders.length === 0) return;

            // Evita reprocessar se os pedidos não mudaram
            const idsKey = orders.map((o: any) => o.id).join(',');
            if (idsKey === lastOrderIdsRef.current) return;
            lastOrderIdsRef.current = idsKey;

            // Filtra pedidos que já foram "unificados manualmente" (não devem vir como duplicatas)
            const activePairs = orders.filter((o: any) =>
                !String(o.observacao || '').includes('unificado manualmente')
            );

            const pairs = detectSimilarPairs(activePairs);

            setNotifications(prev => {
                // Remove notificações antigas de duplicatas
                const others = prev.filter(n => !n.id.startsWith('similar-'));

                const newPairNotifs: Notification[] = pairs
                    .filter(pair => !others.find(n => n.id === pair.notificationId))
                    .map(pair => ({
                        id: pair.notificationId,
                        title: '⚠️ Possível Pedido Duplicado',
                        message: `${pair.pedidoPai.nome_cliente} — mesmo CPF com ${pair.pedidoPai.divergencias.join(' e ')} diferentes. Clique para verificar.`,
                        type: 'possivel_duplicata' as const,
                        read: false,
                        date: new Date(),
                        similarPair: pair,
                    }));

                // Mantém o estado read das notificações existentes
                const existingPairNotifs = prev.filter(n => n.id.startsWith('similar-')).map(existing => {
                    const fresh = pairs.find(p => p.notificationId === existing.id);
                    if (fresh) return { ...existing, similarPair: fresh }; // atualiza dados
                    return null;
                }).filter(Boolean) as Notification[];

                return [...others, ...existingPairNotifs, ...newPairNotifs]
                    .sort((a, b) => {
                        // Duplicatas SEMPRE no topo quando não lidas
                        if (!a.read && a.type === 'possivel_duplicata') return -1;
                        if (!b.read && b.type === 'possivel_duplicata') return 1;
                        return b.date.getTime() - a.date.getTime();
                    });
            });
        } catch {
            // silently fail
        }
    }, []);

    // Verificar usuários pendentes de aprovação (apenas para ADM)
    const checkUsuariosPendentes = useCallback(async () => {
        // Só ADM recebe este alerta
        if (profile?.role !== 'adm') return;

        try {
            const { data: pendentes, error } = await supabase
                .from('profiles')
                .select('id, nome_completo, email, created_at')
                .eq('ativo', false)
                .order('created_at', { ascending: false });

            if (error || !pendentes) return;

            setNotifications(prev => {
                const others = prev.filter(n => !n.id.startsWith('pendente-'));

                const novas: Notification[] = pendentes.map((u: any) => {
                    const existing = prev.find(n => n.id === `pendente-${u.id}`);
                    if (existing) return existing; // preserva estado read
                    return {
                        id: `pendente-${u.id}`,
                        title: '👤 Novo Usuário Aguardando Aprovação',
                        message: `${u.nome_completo || 'Sem nome'} (${u.email}) solicitou acesso ao sistema.`,
                        type: 'usuario_pendente' as const,
                        read: false,
                        date: new Date(u.created_at || Date.now()),
                        link: '/usuarios',
                    };
                });

                return [...others, ...novas].sort((a, b) => b.date.getTime() - a.date.getTime());
            });
        } catch {
            // silently fail
        }
    }, [profile?.role]);

    // Verificar solicitações pendentes (ADM e gestor recebem este alerta)
    const checkSolicitacoesPendentes = useCallback(async () => {
        if (profile?.role !== 'adm' && profile?.role !== 'gestor') return;

        try {
            const { data: pendentes, error } = await supabase
                .from('solicitacoes')
                .select('id, cliente_nome, tipo, created_at')
                .eq('status', 'pendente')
                .order('created_at', { ascending: false });

            if (error || !pendentes) return;

            setNotifications(prev => {
                const others = prev.filter(n => !n.id.startsWith('solicitacao-'));

                const novas: Notification[] = pendentes.map((s: any) => {
                    const existing = prev.find(n => n.id === `solicitacao-${s.id}`);
                    if (existing) return existing; // preserva estado read

                    const tipoLabel: Record<string, string> = {
                        reembolso: 'Reembolso',
                        mudanca_endereco: 'Mudança de Endereço',
                        mudanca_produto: 'Mudança de Produto',
                        cancelamento: 'Cancelamento',
                    };

                    return {
                        id: `solicitacao-${s.id}`,
                        title: '📋 Nova Solicitação Pendente',
                        message: `${s.cliente_nome} solicitou ${tipoLabel[s.tipo] || s.tipo}. Clique para analisar.`,
                        type: 'nova_solicitacao' as const,
                        read: false,
                        date: new Date(s.created_at || Date.now()),
                        link: `/solicitacoes/${s.id}`,
                    };
                });

                return [...others, ...novas].sort((a, b) => b.date.getTime() - a.date.getTime());
            });
        } catch {
            // silently fail
        }
    }, [profile?.role]);

    // Verificar PVs Órfãos (Pós-Venda sem Pedido Pai)
    const checkOrphanPVs = useCallback(async () => {
        try {
            const { data: orphans, error } = await supabase
                .rpc('get_pos_vendas_orfaos', { p_dias: 15 });

            if (error || !orphans) return;

            // Filtra os que não foram consolidados (status 'ignorado')
            const trueOrphans = orphans.filter((o: any) => o.status_consolidacao === 'ignorado');

            setNotifications(prev => {
                const others = prev.filter(n => !(n.type === 'info' && n.id.startsWith('orphan-pv-')));
                
                const novas: Notification[] = trueOrphans.map((o: any) => {
                    const existing = prev.find(n => n.id === `orphan-pv-${o.id}`);
                    if (existing) return existing; // preserva estado read

                    return {
                        id: `orphan-pv-${o.id}`,
                        title: '⚠️ Pós-Venda Sem Pedido Pai',
                        message: `PV de ${o.nome_cliente} (${o.nome_oferta || o.produto}) não atrelado a pedido principal. Clique para analisar.`,
                        type: 'info' as const,
                        read: false,
                        date: new Date(o.data_venda || Date.now()),
                        link: `/sales?search=${o.id}`,
                        orphanPV: o
                    };
                });

                return [...others, ...novas].sort((a, b) => b.date.getTime() - a.date.getTime());
            });
        } catch {
            // silently fail
        }
    }, []);

    // Notifica o solicitante quando a SUA solicitação for aprovada ou recusada
    const checkMinhasSolicitacoesResolvidas = useCallback(async () => {
        if (!profile?.id) return;

        try {
            const { data: resolvidas, error } = await supabase
                .from('solicitacoes')
                .select('id, tipo, status, cliente_nome, aprovado_em')
                .eq('criado_por', profile.id)
                .in('status', ['aprovada', 'recusada'])
                .order('aprovado_em', { ascending: false })
                .limit(20);

            if (error || !resolvidas) return;

            setNotifications(prev => {
                const others = prev.filter(n => !n.id.startsWith('resolvida-'));

                const novas: Notification[] = resolvidas.map((s: any) => {
                    const existing = prev.find(n => n.id === `resolvida-${s.id}`);
                    if (existing) return existing; // preserva estado read

                    const tipoLabel: Record<string, string> = {
                        reembolso: 'Reembolso',
                        mudanca_endereco: 'Mudança de Endereço',
                        mudanca_produto: 'Mudança de Produto',
                        cancelamento: 'Cancelamento',
                    };

                    const aprovada = s.status === 'aprovada';
                    return {
                        id: `resolvida-${s.id}`,
                        title: aprovada ? '✅ Solicitação Aprovada' : '❌ Solicitação Recusada',
                        message: `Sua solicitação de ${tipoLabel[s.tipo] || s.tipo} para ${s.cliente_nome} foi ${aprovada ? 'aprovada' : 'recusada'}.`,
                        type: 'solicitacao_resolvida' as const,
                        read: false,
                        date: new Date(s.aprovado_em || Date.now()),
                        link: `/solicitacoes/${s.id}`,
                    };
                });

                return [...others, ...novas].sort((a, b) => b.date.getTime() - a.date.getTime());
            });
        } catch {
            // silently fail
        }
    }, [profile?.id]);

    // Notifica o responsável quando é designado para um reenvio
    const checkReenviosPendentes = useCallback(async () => {
        if (!profile?.id) return;
        try {
            const { data, error } = await supabase
                .from('solicitacoes')
                .select('id, numero_solicitacao, cliente_nome, observacoes_reenvio')
                .eq('responsavel_reenvio_id', profile.id)
                .eq('necessita_reenvio', true)
                .in('status', ['pendente', 'em_analise', 'aprovada'])
                .order('created_at', { ascending: false })
                .limit(10);

            if (error || !data) return;

            setNotifications(prev => {
                const others = prev.filter(n => !n.id.startsWith('reenvio-'));
                const novas: Notification[] = data.map((s: any) => {
                    const existing = prev.find(n => n.id === `reenvio-${s.id}`);
                    if (existing) return existing;
                    return {
                        id: `reenvio-${s.id}`,
                        title: '🔁 Reenvio Sob Sua Responsabilidade',
                        message: `Reclamação ${s.numero_solicitacao || ''} de ${s.cliente_nome} requer reenvio. Clique para ver detalhes.`,
                        type: 'reenvio_pendente' as const,
                        read: false,
                        date: new Date(),
                        link: `/solicitacoes/${s.id}`,
                    };
                });
                return [...others, ...novas].sort((a, b) => b.date.getTime() - a.date.getTime());
            });
        } catch {
            // silently fail
        }
    }, [profile?.id]);

    const refreshAll = useCallback(async () => {
        await Promise.allSettled([
            checkEstoqueBaixo(),
            checkSimilarOrders(),
            checkUsuariosPendentes(),
            checkSolicitacoesPendentes(),
            checkMinhasSolicitacoesResolvidas(),
            checkReenviosPendentes(), // ✨ NOVO: reenvios designados
            checkOrphanPVs(), // ✨ NOVO: PVs Órfãos
        ]);
    }, [checkEstoqueBaixo, checkSimilarOrders, checkUsuariosPendentes, checkSolicitacoesPendentes, checkMinhasSolicitacoesResolvidas, checkReenviosPendentes, checkOrphanPVs]);

    useEffect(() => {
        refreshAll();

        const channel = supabase
            .channel('notifications-master')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque' }, () => {
                checkEstoqueBaixo();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_consolidados_v3' }, () => {
                checkSimilarOrders();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                // Quando um novo usuário se cadastra ou muda status → reatualizar pendentes
                checkUsuariosPendentes();
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'solicitacoes' }, () => {
                checkSolicitacoesPendentes();
                checkReenviosPendentes(); // verifica se o usuário é responsável por algum reenvio
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'solicitacoes' }, () => {
                // Quando uma solicitação muda de status (aprovada/recusada) → atualizar lista ADMs
                checkSolicitacoesPendentes();
                // ✨ NOVO: E verificar se há resolução para o usuário atual (solicitante)
                checkMinhasSolicitacoesResolvidas();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ticto_pedidos' }, () => {
                checkOrphanPVs();
            })
            .subscribe();

        // Verifica periodicamente (a cada 5 minutos) para pegar novos pedidos
        const interval = setInterval(checkSimilarOrders, 5 * 60 * 1000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [checkEstoqueBaixo, checkSimilarOrders, checkUsuariosPendentes, refreshAll]);

    const markAsRead = useCallback((id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const openSimilarPairModal = useCallback((pair: SimilarOrderPair) => {
        setCurrentSimilarPair(pair);
        setSimilarPairModalOpen(true);
    }, []);

    const closeSimilarPairModal = useCallback(() => {
        setSimilarPairModalOpen(false);
        setCurrentSimilarPair(null);
    }, []);

    const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

    const value = useMemo(() => ({
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        removeNotification,
        refreshNotifications: refreshAll,
        similarPairModalOpen,
        currentSimilarPair,
        openSimilarPairModal,
        closeSimilarPairModal,
    }), [
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        removeNotification,
        refreshAll,
        similarPairModalOpen,
        currentSimilarPair,
        openSimilarPairModal,
        closeSimilarPairModal,
    ]);

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => useContext(NotificationContext);
