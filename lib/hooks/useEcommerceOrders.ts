import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { EcommerceOrder, OrderStatus } from '../../types/ecommerce';
import { toast } from 'sonner';

export const ECOMMERCE_ORDERS_KEY = ['ecommerce-orders'] as const;

export function useEcommerceOrders() {
    return useQuery<EcommerceOrder[]>({
        queryKey: ECOMMERCE_ORDERS_KEY,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ecommerce_pedidos')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as EcommerceOrder[];
        },
        staleTime: 1000 * 60 * 5,
    });
}

export function useUpdateEcommerceOrderStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
            const { error, data } = await supabase
                .from('ecommerce_pedidos')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data as EcommerceOrder;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ECOMMERCE_ORDERS_KEY });
            toast.success('Status do pedido atualizado!');
        },
        onError: (error) => {
            console.error('Error updating order status:', error);
            toast.error('Erro ao atualizar status: ' + error.message);
        },
    });
}
