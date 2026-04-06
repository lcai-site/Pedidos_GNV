import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { EcommerceCategory, EcommerceCollection, EcommerceOffer, EcommerceStoreSettings } from '../../types/ecommerce';
import { toast } from 'sonner';

export const ECOMMERCE_CATEGORIES_KEY = ['ecommerce-categories'] as const;
export const ECOMMERCE_COLLECTIONS_KEY = ['ecommerce-collections'] as const;
export const ECOMMERCE_OFFERS_KEY = ['ecommerce-offers'] as const;
export const ECOMMERCE_SETTINGS_KEY = ['ecommerce-settings'] as const;

export function useEcommerceCategories() {
    return useQuery<EcommerceCategory[]>({
        queryKey: ECOMMERCE_CATEGORIES_KEY,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ecommerce_categorias')
                .select('*')
                .order('posicao', { ascending: true });

            if (error) throw error;
            return data as EcommerceCategory[];
        },
        staleTime: 1000 * 60 * 5,
    });
}

export function useEcommerceCollections() {
    return useQuery<EcommerceCollection[]>({
        queryKey: ECOMMERCE_COLLECTIONS_KEY,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ecommerce_colecoes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as EcommerceCollection[];
        },
        staleTime: 1000 * 60 * 5,
    });
}

export function useEcommerceOffers() {
    return useQuery<EcommerceOffer[]>({
        queryKey: ECOMMERCE_OFFERS_KEY,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ecommerce_ofertas')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as EcommerceOffer[];
        },
        staleTime: 1000 * 60 * 5,
    });
}

// Configurações
export function useEcommerceCoupons() {
    return useQuery<any[]>({
        queryKey: ['ecommerce-cupons'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ecommerce_cupons')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 5,
    });
}

export function useEcommerceSettings() {
    return useQuery<EcommerceStoreSettings>({
        queryKey: ECOMMERCE_SETTINGS_KEY,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ecommerce_configuracoes')
                .select('*')
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                // Mock default if none exists yet
                return {
                    nome_loja: 'Minha Loja GNV',
                    moeda: 'BRL',
                    timezone: 'America/Sao_Paulo',
                    email_contato: '',
                    telefone_contato: ''
                };
            }
            return data as EcommerceStoreSettings;
        },
        staleTime: 1000 * 60 * 10,
    });
}

export function useUpdateEcommerceSettings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (settings: Partial<EcommerceStoreSettings>) => {
            // Verifica se a row já existe
            const { data: existing } = await supabase
                .from('ecommerce_configuracoes')
                .select('id')
                .limit(1)
                .maybeSingle();

            if (existing) {
                const { error, data } = await supabase
                    .from('ecommerce_configuracoes')
                    .update({ ...settings, updated_at: new Date().toISOString() })
                    .eq('id', existing.id)
                    .select()
                    .single();
                if (error) throw error;
                return data;
            } else {
                const { error, data } = await supabase
                    .from('ecommerce_configuracoes')
                    .insert([{ ...settings }])
                    .select()
                    .single();
                if (error) throw error;
                return data;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ECOMMERCE_SETTINGS_KEY });
            toast.success('Configurações salvas!');
        },
        onError: (error) => {
            console.error('Error updating settings:', error);
            toast.error('Erro ao salvar as configurações: ' + error.message);
        },
    });
}
