import { supabase } from '../supabase';
import { melhorEnvioService } from './melhorEnvioService';
import { aiAnalysisService } from './aiAnalysisService';
import { calcularDimensoes } from '../utils/packageDimensions';
import type { PedidoParaEtiqueta, ResultadoEtiqueta } from '../types/labels';
import { logger } from '../utils/logger';

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
            for (const pedido of pedidos as PedidoParaEtiqueta[]) {
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

                        const payloadData = {
                            id: pedido.id,
                            cep: pedido.cep || pedido.cliente_cep || '',
                            peso: String(dimensoes.weight * 1000),
                            comprimento: String(dimensoes.length),
                            largura: String(dimensoes.width),
                            altura: String(dimensoes.height),
                            nome_cliente: pedido.nome_cliente || pedido.cliente_nome || '',
                            cliente_cpf: pedido.cpf || pedido.cliente_cpf || '',
                            endereco_rua: pedido.logradouro || pedido.endereco_rua || '',
                            endereco_numero: pedido.numero || pedido.endereco_numero || '',
                            endereco_complemento: pedido.complemento || pedido.endereco_complemento || '',
                            endereco_bairro: pedido.bairro || pedido.endereco_bairro || '',
                            endereco_cidade: pedido.cidade || pedido.endereco_cidade || '',
                            endereco_estado: pedido.estado || pedido.endereco_estado || '',
                            cliente_telefone: pedido.telefone || (pedido as any).cliente_telefone || '',
                            cliente_email: pedido.email || pedido.cliente_email || '',
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
                        const cotacoes = await melhorEnvioService.calcularFrete(pedido.cep, dimensoes);
                        if (cotacoes.length === 0) {
                            throw new Error('Nenhuma transportadora disponível no Melhor Envio');
                        }

                        const cotacoesOrdenadas = melhorEnvioService.ordenarPorMenorPreco(cotacoes);
                        const melhorCotacao = cotacoesOrdenadas[0];

                        const carrinhoId = await melhorEnvioService.adicionarAoCarrinho(
                            pedido,
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
                        cpf: pedido.cpf || pedido.cliente_cpf || '',
                        nome: pedido.nome_cliente || pedido.cliente_nome || '',
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
                        cpf: pedido.cpf,
                        provider
                    });

                    // Análise de erro via IA
                    let sugestaoIA: string | undefined;
                    try {
                        sugestaoIA = await aiAnalysisService.analisarErro({
                            cpf: pedido.cpf || pedido.cliente_cpf,
                            nome: pedido.nome_cliente || pedido.cliente_nome,
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
                                    nome: pedido.nome_cliente || pedido.cliente_nome,
                                    cpf: pedido.cpf || pedido.cliente_cpf,
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
                        cpf: pedido.cpf || pedido.cliente_cpf,
                        nome: pedido.nome_cliente || pedido.cliente_nome,
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
