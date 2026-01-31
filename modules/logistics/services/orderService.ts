// ================================================================
// ORDER SERVICE
// ================================================================
// Serviço para operações CRUD de pedidos

import { supabase } from '../../../lib/supabase';
import { PedidoUnificado } from '../types/logistics.types';

/**
 * Busca todos os pedidos pendentes
 * 
 * @returns Lista de pedidos
 */
export const fetchOrders = async (): Promise<PedidoUnificado[]> => {
    const { data, error } = await supabase
        .from('pedidos_consolidados_v3')
        .select('*')
        .order('data_venda', { ascending: false })
        .limit(5000);

    if (error) throw error;

    console.log(`📦 LOGÍSTICA: Carregados ${data?.length || 0} pedidos pendentes`);

    return data || [];
};

/**
 * Atualiza código de rastreio de um pedido
 * 
 * @param id - ID do pedido
 * @param trackingCode - Código de rastreio
 */
export const updateTracking = async (id: string, trackingCode: string): Promise<void> => {
    const { error } = await supabase
        .from('pedidos_consolidados_v3')
        .update({
            codigo_rastreio: trackingCode,
            status_envio: 'Enviado'
        })
        .eq('id', id);

    if (error) throw error;
};

/**
 * Limpa código de rastreio de um pedido (reset)
 * 
 * @param orderId - ID do pedido
 */
export const clearTracking = async (orderId: string): Promise<void> => {
    const { error } = await supabase
        .from('pedidos_agrupados')
        .update({
            codigo_rastreio: null,
            data_envio: null,
            status_envio: 'Pendente'
        })
        .eq('id', orderId);

    if (error) throw error;
};

/**
 * Atualiza dados de um pedido via SQL function
 * 
 * @param cpfAntigo - CPF atual do pedido
 * @param formData - Novos dados do formulário
 * @returns Número de registros atualizados
 */
export const updateOrderData = async (
    cpfAntigo: string,
    formData: {
        cpf: string;
        nome: string;
        email: string;
        telefone: string;
        cep: string;
        logradouro: string;
        numero: string;
        complemento: string;
        bairro: string;
        cidade: string;
        estado: string;
        observacao: string;
    }
): Promise<number> => {
    const { data, error } = await supabase.rpc('update_pedidos_consolidados', {
        p_cpf_antigo: cpfAntigo || '',
        p_cpf_novo: formData.cpf || '',
        p_nome: formData.nome || '',
        p_email: formData.email || '',
        p_telefone: formData.telefone || '',
        p_cep: formData.cep || '',
        p_logradouro: formData.logradouro || '',
        p_numero: formData.numero || '',
        p_complemento: formData.complemento || '',
        p_bairro: formData.bairro || '',
        p_cidade: formData.cidade || '',
        p_estado: formData.estado || '',
        p_observacao: formData.observacao || ''
    });

    if (error) {
        console.error("❌ ERRO ao chamar função SQL:", error);
        throw error;
    }

    const count = data || 0;
    console.log(`✅ ${count} registro(s) atualizado(s) via SQL function!`);

    return count;
};
