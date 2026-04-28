import { supabase } from '../supabase';
import { melhorEnvioService } from './melhorEnvioService';
import { aiAnalysisService } from './aiAnalysisService';
import { calcularDimensoes } from '../utils/packageDimensions';
import type { PedidoParaEtiqueta, ResultadoEtiqueta } from '../types/labels';
import { logger } from '../utils/logger';

type PedidoEtiquetaLike = PedidoParaEtiqueta & Record<string, any>;

const FIELD_KEYS = {
    documento: ['cpf', 'cliente_cpf', 'cpf_cliente', 'customer_cpf', 'customer_cnpj', 'customer_document', 'documento', 'doc', 'document', 'tax_id', 'vat_number', 'cnpj'],
    nome: ['nome_cliente', 'cliente_nome', 'cliente', 'nome', 'full_name', 'name', 'buyer_name', 'customer_name'],
    telefone: ['telefone', 'cliente_telefone', 'phone', 'celular', 'whatsapp', 'phone_number', 'mobile'],
    email: ['email_cliente', 'email', 'cliente_email', 'contact_email', 'buyer_email', 'user_email', 'mail', 'customer_email'],
    cep: ['cep', 'cliente_cep', 'zip', 'zipcode', 'zip_code', 'postal_code'],
    rua: ['logradouro', 'endereco_rua', 'rua', 'street', 'street_name', 'address_line_1', 'thoroughfare'],
    numero: ['numero', 'endereco_numero', 'number', 'street_number', 'num', 'house_number', 'nr', 'n'],
    complemento: ['complemento', 'endereco_complemento', 'comp', 'complement', 'address_line_2', 'extra'],
    bairro: ['bairro', 'endereco_bairro', 'neighborhood', 'district', 'suburb'],
    cidade: ['cidade', 'endereco_cidade', 'city', 'municipio', 'town'],
    estado: ['estado', 'endereco_estado', 'uf', 'state', 'state_code', 'region']
};

const getFieldValue = (pedido: PedidoEtiquetaLike, keys: string[]): string => {
    const targets = [
        pedido,
        pedido.metadata,
        pedido.customer,
        pedido.shipping,
        pedido.address,
        pedido.dados_entrega,
        pedido.endereco_json,
        pedido.payer,
        pedido.metadata?.customer,
        pedido.metadata?.buyer,
        pedido.metadata?.address,
        pedido.customer?.address,
        pedido.shipping?.address
    ];

    for (const target of targets) {
        if (!target || typeof target !== 'object') continue;
        for (const key of keys) {
            const value = target[key];
            if (value !== undefined && value !== null && typeof value !== 'object' && String(value).trim() !== '') {
                return String(value).trim();
            }
        }
    }

    return '';
};

const normalizeDocumento = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 13) return digits.padStart(digits.length + 1, '0');
    return digits;
};

const getDocumentoPedido = (pedido: PedidoEtiquetaLike): string => normalizeDocumento(getFieldValue(pedido, FIELD_KEYS.documento));

const getPedidoValue = (pedido: PedidoEtiquetaLike, keys: string[], fallback = ''): string => (
    getFieldValue(pedido, keys) || fallback
);

export class LabelGenerationService {
    /**
     * Gera etiquetas para um produto específico
     */
    async gerarEtiquetas(
        produto: 'DP' | 'BF' | 'BL',
        limite: number = 100,
        onProgress?: (resultado: ResultadoEtiqueta) => void,
        shouldCancel?: () => boolean,
        orderIds?: string[],
        onStart?: (total: number) => void,
        provider: 'melhorenvio' | 'correios' = 'melhorenvio'
    ): Promise<{ sucesso: number; erros: number; detalhes: ResultadoEtiqueta[] }> {

        const WEBHOOK_ERROS_URL = import.meta.env.VITE_WEBHOOK_ERROS_URL || 'https://webhook.belafit.app/webhook/erros';

        const detalhes: ResultadoEtiqueta[] = [];
        let sucesso = 0;
        let erros = 0;
        const errosEnviadosAoWebhook = new Set<string>();

        try {
            // Buscar pedidos pendentes
            let query = supabase
                .from('pedidos_consolidados_v3')
                .select('*');

            if (orderIds && orderIds.length > 0) {
                query = query.in('id', orderIds);
            } else {
                query = query.ilike('descricao_pacote', `${produto}%`);
            }

            const { data: pedidos, error } = await query
                .order('created_at', { ascending: true })
                .limit(limite);

            if (error) {
                throw new Error(`Erro ao buscar pedidos: ${error.message}`);
            }

            if (!pedidos || pedidos.length === 0) {
                if (onStart) onStart(0);
                return { sucesso: 0, erros: 0, detalhes: [] };
            }

            if (onStart) onStart(pedidos.length);

            // 2. Processar cada pedido
            for (const pedido of pedidos as PedidoEtiquetaLike[]) {
                // Verificar se deve cancelar
                if (shouldCancel && shouldCancel()) {
                    logger.info('Geração cancelada pelo usuário', { service: 'LabelGenerationService' });
                    break;
                }

                try {
                    let codigoRastreio = '';

                    // ==========================================
                    // FLUXO CORREIOS NATIVO (EDGE FUNCTION)
                    // ==========================================
                    if (provider === 'correios') {
                        const dimensoes = calcularDimensoes(pedido.descricao_pacote);
                        const documento = getDocumentoPedido(pedido);

                        const payloadData = {
                            id: pedido.id,
                            cep: getPedidoValue(pedido, FIELD_KEYS.cep),
                            peso: String(dimensoes.weight * 1000),
                            comprimento: String(dimensoes.length),
                            largura: String(dimensoes.width),
                            altura: String(dimensoes.height),
                            nome_cliente: getPedidoValue(pedido, FIELD_KEYS.nome),
                            cliente_cpf: documento,
                            documento_cliente: documento,
                            endereco_rua: getPedidoValue(pedido, FIELD_KEYS.rua),
                            endereco_numero: getPedidoValue(pedido, FIELD_KEYS.numero),
                            endereco_complemento: getPedidoValue(pedido, FIELD_KEYS.complemento),
                            endereco_bairro: getPedidoValue(pedido, FIELD_KEYS.bairro),
                            endereco_cidade: getPedidoValue(pedido, FIELD_KEYS.cidade),
                            endereco_estado: getPedidoValue(pedido, FIELD_KEYS.estado),
                            cliente_telefone: getPedidoValue(pedido, FIELD_KEYS.telefone),
                            cliente_email: getPedidoValue(pedido, FIELD_KEYS.email),
                            produto_nome: pedido.descricao_pacote || pedido.nome_oferta || ''
                        };

                        const { data, error: edgeError } = await supabase.functions.invoke('correios-labels', {
                            body: { orderData: payloadData },
                        });

                        // Se a edge function retornar um 500 (mesmo com nosso timeout)
                        if (edgeError) {
                            logger.error('Edge Error nos Correios', edgeError, { service: 'LabelGenerationService', provider: 'correios' });
                            let errorMsg = edgeError.message || 'Erro de rede na API dos Correios';
                            let rawContextData = null;

                            if (edgeError.context && typeof edgeError.context.json === 'function') {
                                try {
                                    const errData = await edgeError.context.json();
                                    rawContextData = errData;
                                    if (errData && errData.error) {
                                        errorMsg = errData.error;
                                    }
                                } catch (e) {
                                    // fallback
                                }
                            }

                            const customErr: any = new Error(errorMsg);
                            customErr.rawContext = rawContextData || edgeError;
                            throw customErr;
                        }

                        // Agora a Edge Function sempre retorna HTTP 200, MAS com success: false no json
                        if (data && data.success === false) {
                            logger.error('Erro na Edge Function dos Correios', data.error, {
                                service: 'LabelGenerationService',
                                provider: 'correios',
                                error: data.error
                            });
                            const customErr: any = new Error(data.error || 'A cotação foi recusada pelos Correios.');
                            customErr.rawContext = data;
                            throw customErr;
                        }

                        if (!data || !data.tracking) {
                            const customErr: any = new Error('Falha na geração: Nenhum código de rastreio retornado pela API Correios');
                            customErr.rawContext = data;
                            throw customErr;
                        }

                        codigoRastreio = data.tracking;
                        logger.info('Etiqueta gerada com sucesso', {
                            service: 'LabelGenerationService',
                            provider: 'correios',
                            tracking: codigoRastreio
                        });
                    }
                    // ==========================================
                    // FLUXO MELHOR ENVIO (LEGADO)
                    // ==========================================
                    else {
                        const dimensoes = calcularDimensoes(pedido.descricao_pacote);
                        const pedidoNormalizado: PedidoParaEtiqueta = {
                            ...pedido,
                            cpf: getDocumentoPedido(pedido),
                            nome_cliente: getPedidoValue(pedido, FIELD_KEYS.nome, pedido.nome_cliente),
                            telefone: getPedidoValue(pedido, FIELD_KEYS.telefone, pedido.telefone || ''),
                            email: getPedidoValue(pedido, FIELD_KEYS.email, pedido.email || ''),
                            cep: getPedidoValue(pedido, FIELD_KEYS.cep, pedido.cep),
                            logradouro: getPedidoValue(pedido, FIELD_KEYS.rua, pedido.logradouro || ''),
                            numero: getPedidoValue(pedido, FIELD_KEYS.numero, pedido.numero || ''),
                            complemento: getPedidoValue(pedido, FIELD_KEYS.complemento, pedido.complemento || ''),
                            bairro: getPedidoValue(pedido, FIELD_KEYS.bairro, pedido.bairro || ''),
                            cidade: getPedidoValue(pedido, FIELD_KEYS.cidade, pedido.cidade || ''),
                            estado: getPedidoValue(pedido, FIELD_KEYS.estado, pedido.estado || '')
                        };
                        const cotacoes = await melhorEnvioService.calcularFrete(pedidoNormalizado.cep, dimensoes);
                        if (cotacoes.length === 0) {
                            throw new Error('Nenhuma transportadora disponível no Melhor Envio');
                        }

                        const cotacoesOrdenadas = melhorEnvioService.ordenarPorMenorPreco(cotacoes);
                        const melhorCotacao = cotacoesOrdenadas[0];

                        const carrinhoId = await melhorEnvioService.adicionarAoCarrinho(
                            pedidoNormalizado,
                            melhorCotacao.id,
                            dimensoes
                        );

                        // Atualiza no banco manual pro ME 
                        await supabase
                            .from('pedidos_consolidados_v3')
                            .update({
                                codigo_rastreio: carrinhoId,
                                status_envio: 'Processando',
                                logistica_provider: 'Melhor Envio'
                            })
                            .eq('id', pedido.id);

                        codigoRastreio = carrinhoId;
                    }

                    // Registrar sucesso local pra tabela do componente UI
                    const resultado: ResultadoEtiqueta = {
                        cpf: getDocumentoPedido(pedido),
                        nome: getPedidoValue(pedido, FIELD_KEYS.nome),
                        status: 'sucesso',
                        codigo_rastreio: codigoRastreio
                    };

                    detalhes.push(resultado);
                    sucesso++;

                    if (onProgress) {
                        onProgress(resultado);
                    }

                    // Delay para evitar rate limiting (1 segundo)
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error: any) {
                    logger.error(`Erro ao processar pedido`, error, {
                        service: 'LabelGenerationService',
                        cpf: getDocumentoPedido(pedido),
                        provider
                    });

                    // Análise de erro via IA
                    let sugestaoIA: string | undefined;
                    try {
                        sugestaoIA = await aiAnalysisService.analisarErro({
                            cpf: getDocumentoPedido(pedido),
                            nome: getPedidoValue(pedido, FIELD_KEYS.nome),
                            endereco: pedido.endereco_completo || '',
                            erro: error.message
                        });
                    } catch (iaError) {
                        logger.error('Erro ao analisar com IA', iaError, { service: 'LabelGenerationService' });
                    }

                    // Envia para o Webhook do n8n
                    const chaveErro = `${pedido.id}:${error.message}`;
                    if (!errosEnviadosAoWebhook.has(chaveErro)) {
                        errosEnviadosAoWebhook.add(chaveErro);
                        try {
                            await fetch(WEBHOOK_ERROS_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    pedidoId: pedido.id,
                                    nome: getPedidoValue(pedido, FIELD_KEYS.nome),
                                    cpf: getDocumentoPedido(pedido),
                                    transportadora: provider,
                                    erro: error.message,
                                    sugestao_ia: sugestaoIA,
                                    erro_original_json: error.rawContext || null
                                })
                            });
                        } catch (whError) {
                            logger.error('Falha ao acionar webhook de erros', whError, { service: 'LabelGenerationService' });
                        }
                    }

                    // Atualizar banco com erro
                    await supabase
                        .from('pedidos_consolidados_v3')
                        .update({
                            observacao: sugestaoIA || error.message,
                            tentativas_geracao: ((pedido.tentativas_geracao || 0) + 1),
                            error_geracao_etiqueta: true
                        })
                        .eq('id', pedido.id);

                    // Registrar erro
                    const resultado: ResultadoEtiqueta = {
                        cpf: getDocumentoPedido(pedido) || pedido.id,
                        nome: getPedidoValue(pedido, FIELD_KEYS.nome),
                        status: 'erro',
                        mensagem: error.message,
                        sugestao_ia: sugestaoIA
                    };

                    detalhes.push(resultado);
                    erros++;

                    if (onProgress) {
                        onProgress(resultado);
                    }
                }
            }

            return { sucesso, erros, detalhes };

        } catch (error: any) {
            logger.error('Erro fatal no processamento', error, { service: 'LabelGenerationService' });
            throw error;
        }
    }
}

export const labelGenerationService = new LabelGenerationService();
