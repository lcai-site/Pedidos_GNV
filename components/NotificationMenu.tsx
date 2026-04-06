import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Info, AlertTriangle, XCircle, CheckCircle, GitMerge, UserCheck } from 'lucide-react';
import { useNotification, Notification } from '../lib/contexts/NotificationContext';
import { SimilarOrdersModal } from './SimilarOrdersModal';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const NotificationMenu: React.FC = () => {
    const {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        removeNotification,
        openSimilarPairModal,
        closeSimilarPairModal,
        similarPairModalOpen,
        currentSimilarPair,
    } = useNotification();

    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Fecha ao clicar fora
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }

        // Notificação de possível duplicata → abre modal especial
        if (notification.type === 'possivel_duplicata' && notification.similarPair) {
            openSimilarPairModal(notification.similarPair);
            setIsOpen(false);
            return;
        }

        if (notification.link) {
            navigate(notification.link);
            setIsOpen(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'possivel_duplicata': return <GitMerge className="w-5 h-5 text-amber-500 animate-pulse" />;
            case 'divergencia_cpf': return <AlertTriangle className="w-5 h-5 text-red-600 animate-bounce" />;
            case 'usuario_pendente': return <UserCheck className="w-5 h-5 text-emerald-500" />;
            case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
            case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
            case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
            default: return <Info className="w-5 h-5 text-blue-500" />;
        }
    };

    const getNotifStyle = (notification: Notification) => {
        if (notification.type === 'possivel_duplicata' && !notification.read) {
            return 'bg-amber-50/40 dark:bg-amber-900/15 border-l-2 border-l-amber-500 hover:bg-amber-50/60 dark:hover:bg-amber-900/25';
        }
        if (notification.type === 'usuario_pendente' && !notification.read) {
            return 'bg-emerald-50/40 dark:bg-emerald-900/15 border-l-2 border-l-emerald-500 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/25';
        }
        if (!notification.read) {
            return 'bg-blue-50/30 dark:bg-blue-900/10 hover:bg-slate-50 dark:hover:bg-slate-800/50';
        }
        return 'hover:bg-slate-50 dark:hover:bg-slate-800/50';
    };

    // Conta apenas notificações de duplicatas não lidas para badge especial
    const duplicateUnreadCount = notifications.filter(
        n => n.type === 'possivel_duplicata' && !n.read
    ).length;

    // Conta usuários pendentes não lidos
    const pendingUsersCount = notifications.filter(
        n => n.type === 'usuario_pendente' && !n.read
    ).length;

    const hasDuplicateAlert = duplicateUnreadCount > 0;
    const hasPendingUsers = pendingUsersCount > 0;

    return (
        <>
            <div className="relative" ref={menuRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`relative p-2 rounded-lg transition-all duration-200 ${unreadCount > 0
                        ? hasDuplicateAlert
                            ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 animate-none'
                            : 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    title={hasDuplicateAlert ? `${duplicateUnreadCount} possível(is) pedido(s) duplicado(s) detectado(s)` : undefined}
                >
                    <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'animate-pulse' : ''}`} />

                    {/* Badge principal */}
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${hasDuplicateAlert ? 'bg-amber-400' : 'bg-red-400'} opacity-75`}></span>
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${hasDuplicateAlert ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                        </span>
                    )}
                </button>

                {/* Badge de contador se há múltiplas notificações */}
                {unreadCount > 1 && (
                    <span className={`absolute -top-1 -right-1 flex items-center justify-center h-4 min-w-4 px-0.5 text-[9px] font-black rounded-full text-white ${hasDuplicateAlert ? 'bg-amber-500' : 'bg-red-500'}`}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}

                {isOpen && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden transform origin-top-right transition-all">
                        <div className="p-4 border-b border-border flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-slate-900 dark:text-white">Notificações</h3>
                                {hasDuplicateAlert && (
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded border border-amber-200 dark:border-amber-800">
                                        <GitMerge className="w-2.5 h-2.5" />
                                        {duplicateUnreadCount} duplicata{duplicateUnreadCount > 1 ? 's' : ''}
                                    </span>
                                )}
                                {hasPendingUsers && (
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded border border-emerald-200 dark:border-emerald-800">
                                        <UserCheck className="w-2.5 h-2.5" />
                                        {pendingUsersCount} pendente{pendingUsersCount > 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                >
                                    <Check className="w-3 h-3" />
                                    Marcar todas como lidas
                                </button>
                            )}
                        </div>

                        <div className="max-h-[70vh] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Nenhuma notificação</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {notifications.map(notification => (
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`p-4 transition-colors cursor-pointer flex gap-3 ${getNotifStyle(notification)}`}
                                        >
                                            <div className="shrink-0 mt-1">
                                                {getIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <p className={`text-sm font-medium leading-snug ${!notification.read ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        {notification.title}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {!notification.read && (
                                                            <span className={`w-2 h-2 rounded-full mt-1 ${notification.type === 'possivel_duplicata' ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                {notification.type === 'possivel_duplicata' && (
                                                    <p className="text-[10px] text-amber-500 dark:text-amber-400 mt-1.5 font-medium flex items-center gap-1">
                                                        <GitMerge className="w-3 h-3" />
                                                        Clique para revisar e unificar
                                                    </p>
                                                )}
                                                {notification.type === 'usuario_pendente' && (
                                                    <p className="text-[10px] text-emerald-500 dark:text-emerald-400 mt-1.5 font-medium flex items-center gap-1">
                                                        <UserCheck className="w-3 h-3" />
                                                        Clique para aprovar ou recusar
                                                    </p>
                                                )}
                                                <p className="text-[10px] text-slate-400 mt-1.5">
                                                    {formatDistanceToNow(notification.date, { addSuffix: true, locale: ptBR })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Pedidos Similares — Renderizado fora do dropdown para z-index correto */}
            <SimilarOrdersModal
                isOpen={similarPairModalOpen}
                pair={currentSimilarPair}
                onClose={closeSimilarPairModal}
                onMerged={(notifId) => {
                    removeNotification(notifId);
                    closeSimilarPairModal();
                }}
            />
        </>
    );
};
