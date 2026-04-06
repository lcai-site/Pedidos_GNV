import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { EcommerceProduct, ProductStatus } from '../../types/ecommerce';
import { toast } from 'sonner';

export const ECOMMERCE_PRODUCTS_KEY = ['ecommerce-products'] as const;

export function useEcommerceProducts() {
    return useQuery<EcommerceProduct[]>({
        queryKey: ECOMMERCE_PRODUCTS_KEY,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ecommerce_produtos')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as EcommerceProduct[];
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

export function useCreateEcommerceProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (product: Omit<EcommerceProduct, 'id' | 'created_at' | 'updated_at'>) => {
            const { error, data } = await supabase
                .from('ecommerce_produtos')
                .insert(product)
                .select()
                .single();

            if (error) throw error;
            return data as EcommerceProduct;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ECOMMERCE_PRODUCTS_KEY });
            toast.success('Produto criado com sucesso!');
        },
        onError: (error) => {
            console.error('Error creating product:', error);
            toast.error('Erro ao criar produto: ' + error.message);
        },
    });
}

export function useUpdateEcommerceProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<EcommerceProduct> }) => {
            const { error, data } = await supabase
                .from('ecommerce_produtos')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data as EcommerceProduct;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ECOMMERCE_PRODUCTS_KEY });
            toast.success('Produto atualizado com sucesso!');
        },
        onError: (error) => {
            console.error('Error updating product:', error);
            toast.error('Erro ao atualizar produto: ' + error.message);
        },
    });
}

export function useDeleteEcommerceProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('ecommerce_produtos')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ECOMMERCE_PRODUCTS_KEY });
            toast.success('Produto excluído com sucesso!');
        },
        onError: (error) => {
            console.error('Error deleting product:', error);
            toast.error('Erro ao excluir produto: ' + error.message);
        },
    });
}
