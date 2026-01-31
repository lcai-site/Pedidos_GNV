// ================================================================
// USE ORDER DATA HOOK
// ================================================================
// Hook para buscar e gerenciar dados de pedidos

import { useState, useEffect } from 'react';
import { PedidoUnificado } from '../types/logistics.types';
import { fetchOrders } from '../services/orderService';

export const useOrderData = () => {
    const [orders, setOrders] = useState<PedidoUnificado[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    /**
     * Busca pedidos do servidor
     */
    const loadOrders = async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await fetchOrders();
            setOrders(data);
        } catch (err) {
            console.error('Error fetching logistics:', err);
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Recarrega pedidos
     */
    const refetch = () => {
        loadOrders();
    };

    /**
     * Atualiza um pedido localmente (otimistic update)
     */
    const updateOrderLocally = (id: string, updates: Partial<PedidoUnificado>) => {
        setOrders(prev => prev.map(o =>
            o.id === id ? { ...o, ...updates } : o
        ));
    };

    // Carregar pedidos ao montar
    useEffect(() => {
        loadOrders();
    }, []);

    return {
        orders,
        loading,
        error,
        refetch,
        updateOrderLocally
    };
};
