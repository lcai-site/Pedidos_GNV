import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { EcommerceCustomer } from '../../types/ecommerce';

export const ECOMMERCE_CUSTOMERS_KEY = ['ecommerce-customers'] as const;

export function useEcommerceCustomers() {
    return useQuery<EcommerceCustomer[]>({
        queryKey: ECOMMERCE_CUSTOMERS_KEY,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ecommerce_clientes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as EcommerceCustomer[];
        },
        staleTime: 1000 * 60 * 5,
    });
}
