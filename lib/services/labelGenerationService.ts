// Serviço de geração de etiquetas (Frontend)
// Implementação direta sem API routes

import { supabase } from '../supabase';
import { melhorEnvioService } from './melhorEnvioService';
import { aiAnalysisService } from './aiAnalysisService';
import { calcularDimensoes } from '../utils/packageDimensions';
import type { PedidoParaEtiqueta, ResultadoEtiqueta } from '../../types/labels';

export class LabelGenerationService {
    /**
     * Gera etiquetas para um produto específico
     */
    async gerarEtiquetas(
        produto: 'DP' | 'BF' | 'BL',
        limite: number = 100,
        onProgress?: (resultado: ResultadoEtiqueta) => void,
        shouldCancel?: () => boolean
    ): Promise<{ sucesso: number; erros: number; detalhes: ResultadoEtiqueta[] }> {

        const detalhes: ResultadoEtiqueta[] = [];
        let sucesso = 0;
        let erros = 0;

        try {
            // Buscar pedidos pendentes
            const { data: pedidos, error } = await supabase
                .from('pedidos_consolidados_v3')
                .select('*')
                .ilike('descricao_pacote', `${produto}%`)
                // Removido filtro de codigo_rastreio para permitir regeneração
                .order('created_at', { ascending: true })
                .limit(limite);

            if (error) {
                throw new Error(`Erro ao buscar pedidos: ${error.message}`);
            }

            if (!pedidos || pedidos.length === 0) {
                return { sucesso: 0, erros: 0, detalhes: [] };
            }

            // 2. Processar cada pedido
            for (const pedido of pedidos as PedidoParaEtiqueta[]) {
                // Verificar se deve cancelar
                if (shouldCancel && shouldCancel()) {
                    console.log('⏸️ Geração cancelada pelo usuário');
                    break;
                }

                try {
                    // Calcular dimensões
                    const dimensoes = calcularDimensoes(pedido.descricao_pacote);

                    // Consultar preços
                    const cotacoes = await melhorEnvioService.calcularFrete(pedido.cep, dimensoes);

                    if (cotacoes.length === 0) {
                        throw new Error('Nenhuma transportadora disponível');
                    }

                    // Ordenar por menor preço
                    const cotacoesOrdenadas = melhorEnvioService.ordenarPorMenorPreco(cotacoes);
                    const melhorCotacao = cotacoesOrdenadas[0];

                    // Adicionar ao carrinho
                    const carrinhoId = await melhorEnvioService.adicionarAoCarrinho(
                        pedido,
                        melhorCotacao.id,
                        dimensoes
                    );

                    // Atualizar banco com código de rastreio
                    await supabase
                        .from('pedidos_consolidados_v3')
                        .update({
                            codigo_rastreio: carrinhoId,
                            status_envio: 'Processando'
                        })
                        .eq('id', pedido.id);

                    // Registrar sucesso
                    const resultado: ResultadoEtiqueta = {
                        cpf: pedido.cpf,
                        nome: pedido.nome_cliente,
                        status: 'sucesso',
                        codigo_rastreio: carrinhoId
                    };

                    detalhes.push(resultado);
                    sucesso++;

                    if (onProgress) {
                        onProgress(resultado);
                    }

                    // Delay para evitar rate limiting (1 segundo)
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error: any) {
                    console.error(`Erro ao processar pedido ${pedido.cpf}:`, error);

                    // Análise de erro via IA
                    let sugestaoIA: string | undefined;
                    try {
                        sugestaoIA = await aiAnalysisService.analisarErro({
                            cpf: pedido.cpf,
                            nome: pedido.nome_cliente,
                            endereco: pedido.endereco_completo,
                            erro: error.message
                        });
                    } catch (iaError) {
                        console.error('Erro ao analisar com IA:', iaError);
                    }

                    // Atualizar banco com erro
                    await supabase
                        .from('pedidos_consolidados_v3')
                        .update({
                            observacao: sugestaoIA || error.message,
                            tentativas_geracao: (pedido.tentativas_geracao || 0) + 1
                        })
                        .eq('id', pedido.id);

                    // Registrar erro
                    const resultado: ResultadoEtiqueta = {
                        cpf: pedido.cpf,
                        nome: pedido.nome_cliente,
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
            console.error('Erro fatal no processamento:', error);
            throw error;
        }
    }
}

export const labelGenerationService = new LabelGenerationService();
