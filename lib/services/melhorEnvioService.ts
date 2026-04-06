// Serviço para integração com API Melhor Envio

import { supabase } from '../supabase';
import type { Cotacao, Dimensoes, PedidoParaEtiqueta } from '../types/labels';
import { logger } from '../utils/logger';

// Usar proxy local para evitar CORS
const MELHOR_ENVIO_BASE_URL = '/api/melhor-envio';
const TOKEN = import.meta.env.VITE_MELHOR_ENVIO_TOKEN;
const USER_AGENT = import.meta.env.VITE_MELHOR_ENVIO_USER_AGENT;

// IDs de transportadoras inválidas (conforme N8N)
const TRANSPORTADORAS_INVALIDAS = [12, 15, 16, 27, 34];

// Endereço de origem (remetente)
// FIX: `company_document` é o campo correto para CNPJ na API do Melhor Envio
//      `document` é usado para CPF (pessoa física). Usar `document` com CNPJ causa erro de validação.
const ENDERECO_ORIGEM: Record<string, string> = {
    name: 'GROUP NUTRA VITA LTDA',
    phone: '31 98275 7682',
    email: '',
    company_document: '42.916.722/0001-30',
    address: 'Rua Tuiuti',
    number: '460',
    district: 'Cidade Nova I',
    postal_code: '13339010',
    city: 'Indaiatuba',
    country_id: 'BR',
    state_abbr: 'SP'
};

/**
 * Remove formatação de CPF/CNPJ (pontos, traços, barras) deixando apenas dígitos
 */
function sanitizarDocumento(doc: string | undefined | null): string {
    if (!doc) return '';
    return doc.replace(/[^\d]/g, '');
}

class MelhorEnvioService {
    private headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': USER_AGENT
    };

    // Cache da agência dos Correios para evitar chamadas repetidas à API
    private cachedAgency: string | null = null;

    /**
     * Busca a agência dos Correios mais próxima do CEP de origem via API do Melhor Envio.
     * O campo `agency` é obrigatório para serviços dos Correios (PAC, SEDEX, etc.)
     * Resultado é cacheado para evitar chamadas repetidas.
     */
    private async buscarAgenciaCorreios(): Promise<string | null> {
        // Retorna do cache se já foi buscado
        if (this.cachedAgency !== null) {
            return this.cachedAgency;
        }

        try {
            logger.flow('MelhorEnvioService', 'buscarAgenciaCorreios', { cep: ENDERECO_ORIGEM.postal_code });

            const response = await fetch(
                `${MELHOR_ENVIO_BASE_URL}/me/shipment/agencies?postal_code=${ENDERECO_ORIGEM.postal_code}`,
                {
                    method: 'GET',
                    headers: this.headers
                }
            );

            if (!response.ok) {
                logger.warn('Não foi possível buscar agências dos Correios', {
                    service: 'MelhorEnvioService',
                    status: response.status,
                    statusText: response.statusText,
                });
                return null;
            }

            const agencies = await response.json();

            if (!Array.isArray(agencies) || agencies.length === 0) {
                logger.warn('Nenhuma agência encontrada para o CEP', {
                    service: 'MelhorEnvioService',
                    cep: ENDERECO_ORIGEM.postal_code,
                });
                return null;
            }

            // Pega a primeira agência disponível (normalmente a mais próxima)
            const agency = agencies[0];
            const agencyCode = String(agency.id || agency.code || agency.agency || '');

            if (agencyCode) {
                this.cachedAgency = agencyCode;
                logger.info('Agência dos Correios encontrada', {
                    service: 'MelhorEnvioService',
                    agencyCode,
                    name: agency.name,
                    address: agency.address,
                });
                return agencyCode;
            }

            logger.warn('Agência encontrada mas sem código válido', {
                service: 'MelhorEnvioService',
                agency: agencies[0],
            });
            return null;

        } catch (error) {
            logger.apiError('MelhorEnvioService', 'buscarAgenciaCorreios', error, {
                cep: ENDERECO_ORIGEM.postal_code,
            });
            return null;
        }
    }

    /**
     * Retorna o endereço de origem com a agência dos Correios incluída (se disponível)
     */
    private async getEnderecoOrigemComAgencia(): Promise<Record<string, string>> {
        const agency = await this.buscarAgenciaCorreios();
        const from = { ...ENDERECO_ORIGEM };

        if (agency) {
            from.agency = agency;
        }

        return from;
    }

    /**
     * Calcula preço de frete para um CEP de destino
     */
    async calcularFrete(cepDestino: string, dimensoes: Dimensoes): Promise<Cotacao[]> {
        try {
            const response = await fetch(`${MELHOR_ENVIO_BASE_URL}/me/shipment/calculate`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    from: {
                        postal_code: ENDERECO_ORIGEM.postal_code
                    },
                    to: {
                        postal_code: cepDestino
                    },
                    package: dimensoes,
                    options: {
                        insurance_value: 1.00,
                        receipt: false,
                        own_hand: false
                    }
                })
            });

            if (!response.ok) {
                let errorDetails = response.statusText;
                try {
                    const errorData = await response.json();
                    if (errorData.message) {
                        errorDetails = errorData.message;
                        if (errorData.errors) {
                            const validationErrors = Object.values(errorData.errors).flat().join(', ');
                            if (validationErrors) {
                                errorDetails += ` (${validationErrors})`;
                            }
                        }
                    } else if (errorData.error) {
                        errorDetails = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
                    } else {
                        errorDetails = JSON.stringify(errorData);
                    }
                } catch (e) {
                    // Ignora erro de parser se não houver JSON
                }
                throw new Error(`Erro ao calcular frete: ${errorDetails}`);
            }

            const cotacoes: Cotacao[] = await response.json();

            // Filtra transportadoras inválidas e preços zerados
            return cotacoes.filter(cotacao => {
                const preco = parseFloat(cotacao.price);
                return preco > 0 && !TRANSPORTADORAS_INVALIDAS.includes(cotacao.id);
            });

        } catch (error) {
            logger.apiError('MelhorEnvioService', 'calcularFrete', error, { cepDestino, dimensoes });
            throw error;
        }
    }

    /**
     * Adiciona pedido ao carrinho da Melhor Envio
     */
    async adicionarAoCarrinho(
        pedido: PedidoParaEtiqueta,
        servicoId: number,
        dimensoes: Dimensoes
    ): Promise<string> {
        try {
            // Busca endereço de origem com agência dos Correios (quando disponível)
            const fromComAgencia = await this.getEnderecoOrigemComAgencia();

            const payload = {
                from: fromComAgencia,
                to: {
                    name: pedido.nome_cliente,
                    phone: pedido.telefone,
                    email: pedido.email,
                    document: sanitizarDocumento(pedido.cpf),
                    address: pedido.logradouro,
                    state_register: pedido.estado,
                    city: pedido.cidade,
                    country_id: 'BR',
                    postal_code: pedido.cep,
                    state_abbr: pedido.estado,
                    complement: pedido.complemento || '',
                    number: pedido.numero,
                    district: pedido.bairro,
                    note: `WHATSAPP ${pedido.telefone}`
                },
                options: {
                    reminder: pedido.descricao_pacote,
                    insurance_value: '1.00',
                    receipt: false,
                    own_hand: false,
                    reverse: false,
                    non_commercial: true
                },
                service: servicoId,
                products: [
                    {
                        name: pedido.descricao_pacote,
                        quantity: '1',
                        unitary_value: '1.00'
                    }
                ],
                volumes: [dimensoes]
            };

            logger.flow('MelhorEnvioService', 'adicionarAoCarrinho', {
                servicoId,
                agency: fromComAgencia.agency || 'N/A',
                pedidoId: pedido.id,
            });

            const response = await fetch(`${MELHOR_ENVIO_BASE_URL}/me/cart`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                let errorDetails = response.statusText;
                try {
                    const errorData = await response.json();
                    logger.error('Erro da API Melhor Envio', errorData, { service: 'MelhorEnvioService', action: 'adicionarAoCarrinho' });
                    if (errorData.message) {
                        errorDetails = errorData.message;
                        if (errorData.errors) {
                            const validationErrors = Object.values(errorData.errors).flat().join(', ');
                            if (validationErrors) {
                                errorDetails += ` (${validationErrors})`;
                            }
                        }
                    } else if (errorData.error) {
                        errorDetails = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
                    } else {
                        errorDetails = JSON.stringify(errorData);
                    }
                } catch (e) {
                    // Ignora erro de parser
                }
                throw new Error(`Erro ao adicionar ao carrinho: ${errorDetails}`);
            }

            const data = await response.json();
            return data.id; // Retorna ID do carrinho

        } catch (error) {
            logger.apiError('MelhorEnvioService', 'adicionarAoCarrinho', error, { servicoId, pedidoId: pedido.id });
            throw error;
        }
    }

    /**
     * Busca dados de uma ordem/etiqueta pelo ID
     * Útil para recuperar o código de rastreio real após pagamento
     */
    async buscarOrdem(_id: string): Promise<any> {
        try {
            const response = await fetch(`${MELHOR_ENVIO_BASE_URL}/me/orders/${_id}`, {
                method: 'GET',
                headers: this.headers
            });

            if (!response.ok) {
                return null;
            }

            return await response.json();
        } catch (error) {
            logger.apiError('MelhorEnvioService', 'buscarOrdem', error, { id: _id });
            return null;
        }
    }

    /**
     * Busca informações de rastreio dos pedidos no Melhor Envio.
     * 
     * Estratégia:
     * 1. Busca itens no carrinho (GET /me/cart) — retorna status e tracking de cada item
     * 2. Para cada cart ID salvo no banco, tenta buscar a ordem individual (GET /me/orders/{id})
     * 
     * O tracking só está disponível após a postagem (order.posted).
     * Antes disso, o campo tracking pode ser null.
     */
    async buscarOrdens(_status?: string): Promise<any[]> {
        try {
            const resultados: any[] = [];

            // Estratégia 1: Buscar itens do carrinho
            logger.debug('Buscando itens do carrinho', { service: 'MelhorEnvioService' });
            try {
                const cartResponse = await fetch(`${MELHOR_ENVIO_BASE_URL}/me/cart`, {
                    method: 'GET',
                    headers: this.headers
                });

                logger.debug('Cart status', { service: 'MelhorEnvioService', status: cartResponse.status });
                const cartText = await cartResponse.text();

                if (cartText && cartText.trim().length > 0) {
                    const cartData = JSON.parse(cartText);
                    const cartItems = Array.isArray(cartData) ? cartData : (cartData.items || cartData.data || []);

                    if (cartItems.length > 0) {
                        logger.debug('Itens no carrinho', {
                            service: 'MelhorEnvioService',
                            count: cartItems.length,
                            items: cartItems.map((i: any) => ({ id: i.id, status: i.status || i.state })),
                        });
                        resultados.push(...cartItems);
                    }
                }
            } catch (e) {
                logger.warn('Erro ao buscar carrinho', { service: 'MelhorEnvioService', error: e });
            }

            // Estratégia 2: Tentar buscar orders sem filtro
            logger.debug('Buscando orders', { service: 'MelhorEnvioService' });
            try {
                const ordersResponse = await fetch(`${MELHOR_ENVIO_BASE_URL}/me/orders?per_page=100`, {
                    method: 'GET',
                    headers: this.headers
                });

                logger.debug('Orders status', { service: 'MelhorEnvioService', status: ordersResponse.status });
                const ordersText = await ordersResponse.text();

                if (ordersText && ordersText.trim().length > 0 && ordersResponse.status === 200) {
                    const ordersData = JSON.parse(ordersText);
                    const orders = Array.isArray(ordersData) ? ordersData : (ordersData.orders || ordersData.data || []);

                    if (orders.length > 0) {
                        logger.debug('Orders encontradas', {
                            service: 'MelhorEnvioService',
                            count: orders.length,
                            items: orders.map((o: any) => ({ id: o.id, status: o.status })),
                        });
                        resultados.push(...orders);
                    }
                }
            } catch (e) {
                logger.warn('Erro ao buscar orders', { service: 'MelhorEnvioService', error: e });
            }

            logger.debug('Total de itens encontrados', { service: 'MelhorEnvioService', count: resultados.length });
            return resultados;

        } catch (error) {
            logger.apiError('MelhorEnvioService', 'buscarOrdens', error);
            return [];
        }
    }

    /**
     * Busca uma ordem específica pelo ID (cart ID ou order ID)
     */
    async buscarOrdemPorId(id: string): Promise<any> {
        try {
            logger.debug('Buscando ordem', { service: 'MelhorEnvioService', id });

            const response = await fetch(`${MELHOR_ENVIO_BASE_URL}/me/orders/${id}`, {
                method: 'GET',
                headers: this.headers
            });

            logger.debug('Order status', { service: 'MelhorEnvioService', id, status: response.status });
            const text = await response.text();

            if (!text || text.trim().length === 0) return null;
            return JSON.parse(text);
        } catch (e) {
            logger.warn('Erro ao buscar ordem', { service: 'MelhorEnvioService', id, error: e });
            return null;
        }
    }

    /**
     * Sincroniza códigos de rastreio do Melhor Envio com o banco de dados.
     * 
     * Para cada pedido selecionado:
     * 1. Busca o item no carrinho pelo cart ID (salvo como codigo_rastreio)
     * 2. Se o item tem tracking, atualiza o banco com o código real
     * 3. Se não tem tracking mas tem tracking_url, salva a URL (tracking pode demorar até 1 dia útil após postagem)
     * 4. Se não tem tracking, tenta buscar a ordem individual
     * 
     * Nota: O tracking só está disponível após a postagem (order.posted).
     * Antes disso, o campo tracking pode ser null. Porém, o tracking_url
     * já aparece antes do código bruto de rastreio ser preenchido.
     * 
     * @param pedidoIds - IDs específicos para sincronizar (opcional). Se não informado, sincroniza todos pendentes.
     */
    async sincronizarRastreios(pedidoIds?: string[]): Promise<{
        atualizados: number;
        atualizadosUrl: number;
        naoEncontrados: number;
        detalhes: Array<{ pedidoId: string; rastreioAnterior: string; rastreioNovo: string; trackingUrl: string | null; transportadora: string }>;
    }> {
        const resultado = {
            atualizados: 0,
            atualizadosUrl: 0,
            naoEncontrados: 0,
            detalhes: [] as Array<{ pedidoId: string; rastreioAnterior: string; rastreioNovo: string; trackingUrl: string | null; transportadora: string }>
        };

        try {
            // 1. Buscar pedidos no banco
            let query = supabase
                .from('pedidos_consolidados_v3')
                .select('id, codigo_rastreio, tracking_url, nome_cliente, cpf');

            if (pedidoIds && pedidoIds.length > 0) {
                query = query.in('id', pedidoIds);
            } else {
                query = query.eq('logistica_provider', 'Melhor Envio')
                    .in('status_envio', ['Processando', 'Etiquetado', 'Pago', 'Etiqueta Gerada', 'Postado']);
            }

            const { data: pedidosPendentes, error: dbError } = await query;

            if (dbError) {
                throw new Error(`Erro ao buscar pedidos pendentes: ${dbError.message}`);
            }

            if (!pedidosPendentes || pedidosPendentes.length === 0) {
                logger.info('Nenhum pedido pendente de sincronização', { service: 'MelhorEnvioService' });
                return resultado;
            }

            logger.info('Pedidos para sincronizar', {
                service: 'MelhorEnvioService',
                count: pedidosPendentes.length
            });

            // 2. Buscar todos os itens do carrinho e ordens de uma vez
            const todosItens = await this.buscarOrdens();

            // 3. Criar mapa de ID -> dados (tracking + tracking_url + transportadora)
            const mapaItens = new Map<string, { tracking: string; trackingUrl: string; transportadora: string; status: string }>();

            for (const item of todosItens) {
                if (item.id) {
                    const tracking = item.tracking || item.tracking_number || '';
                    const trackingUrl = item.tracking_url || item.tracking_link || '';
                    const transportadora = item.carrier?.name || item.carrier_name || item.carrier || '';
                    const status = item.status || item.state || '';
                    mapaItens.set(String(item.id), { tracking, trackingUrl, transportadora, status });
                }
                if (item.order_id) {
                    const tracking = item.tracking || item.tracking_number || '';
                    const trackingUrl = item.tracking_url || item.tracking_link || '';
                    const transportadora = item.carrier?.name || item.carrier_name || item.carrier || '';
                    const status = item.status || item.state || '';
                    mapaItens.set(String(item.order_id), { tracking, trackingUrl, transportadora, status });
                }
            }

            logger.debug('Itens mapeados do Melhor Envio', {
                service: 'MelhorEnvioService',
                count: mapaItens.size
            });

            // 4. Para cada pedido, tentar encontrar o tracking
            for (const pedido of pedidosPendentes) {
                const cartId = pedido.codigo_rastreio;
                if (!cartId) continue;

                logger.debug('Verificando pedido', {
                    service: 'MelhorEnvioService',
                    pedidoId: pedido.id,
                    cartId
                });

                // Buscar no mapa
                let dadosItem = mapaItens.get(String(cartId));

                // Se não encontrou no mapa, tentar busca individual
                if (!dadosItem) {
                    const ordemIndividual = await this.buscarOrdemPorId(String(cartId));
                    if (ordemIndividual) {
                        const tracking = ordemIndividual.tracking || ordemIndividual.tracking_number || '';
                        const trackingUrl = ordemIndividual.tracking_url || ordemIndividual.tracking_link || '';
                        const transportadora = ordemIndividual.carrier?.name || ordemIndividual.carrier_name || '';
                        const status = ordemIndividual.status || '';
                        dadosItem = { tracking, trackingUrl, transportadora, status };
                        logger.debug('Order individual encontrada', {
                            service: 'MelhorEnvioService',
                            tracking,
                            trackingUrl,
                            status,
                            carrier: transportadora
                        });
                    }
                }

                if (dadosItem && dadosItem.tracking && dadosItem.tracking !== cartId && dadosItem.tracking.length > 5) {
                    const updateData: Record<string, any> = {
                        codigo_rastreio: dadosItem.tracking,
                        melhor_envio_id: cartId, // CRITICAL FIX: Salvar o UUID original
                        transportadora: dadosItem.transportadora,
                        status_envio: 'Postado', // Mantém o restante como estava
                        data_postagem: new Date().toISOString(),
                        observacao: `Rastreio synchronizado do Melhor Envio (status: ${dadosItem.status})`
                    };

                    if (dadosItem.trackingUrl) {
                        updateData.tracking_url = dadosItem.trackingUrl;
                    }

                    const { error: updateError } = await supabase
                        .from('pedidos_consolidados_v3')
                        .update(updateData)
                        .eq('id', pedido.id);

                    if (updateError) {
                        logger.error('Erro ao atualizar pedido', updateError, {
                            service: 'MelhorEnvioService',
                            pedidoId: pedido.id
                        });
                    } else {
                        resultado.atualizados++;
                        resultado.detalhes.push({
                            pedidoId: pedido.id,
                            rastreioAnterior: cartId,
                            rastreioNovo: dadosItem.tracking,
                            trackingUrl: dadosItem.trackingUrl || null,
                            transportadora: dadosItem.transportadora
                        });
                        logger.info('Pedido atualizado com rastreio', {
                            service: 'MelhorEnvioService',
                            pedidoId: pedido.id,
                            de: cartId,
                            para: dadosItem.tracking,
                            transportadora: dadosItem.transportadora
                        });
                    }
                } else if (dadosItem && dadosItem.trackingUrl && !pedido.tracking_url) {
                    const { error: updateError } = await supabase
                        .from('pedidos_consolidados_v3')
                        .update({
                            tracking_url: dadosItem.trackingUrl,
                            transportadora: dadosItem.transportadora,
                            observacao: `Aguardando código de rastreio (status: ${dadosItem.status}). tracking_url disponível.`
                        })
                        .eq('id', pedido.id);

                    if (updateError) {
                        logger.error('Erro ao atualizar tracking_url', updateError, {
                            service: 'MelhorEnvioService',
                            pedidoId: pedido.id
                        });
                    } else {
                        resultado.atualizadosUrl++;
                        resultado.detalhes.push({
                            pedidoId: pedido.id,
                            rastreioAnterior: cartId,
                            rastreioNovo: '',
                            trackingUrl: dadosItem.trackingUrl,
                            transportadora: dadosItem.transportadora
                        });
                        logger.info('tracking_url salva', {
                            service: 'MelhorEnvioService',
                            pedidoId: pedido.id,
                            trackingUrl: dadosItem.trackingUrl
                        });
                    }
                } else {
                    resultado.naoEncontrados++;
                    logger.debug('Pedido sem tracking', {
                        service: 'MelhorEnvioService',
                        pedidoId: pedido.id,
                        status: dadosItem?.status,
                        encontrado: !!dadosItem
                    });
                }
            }

            logger.info('Sincronização concluída', {
                service: 'MelhorEnvioService',
                atualizados: resultado.atualizados,
                atualizadosUrl: resultado.atualizadosUrl,
                naoEncontrados: resultado.naoEncontrados
            });

        } catch (error) {
            logger.apiError('MelhorEnvioService', 'sincronizarRastreios', error);
            throw error;
        }

        return resultado;
    }

    /**
     * Ordena cotações por menor preço
     */
    ordenarPorMenorPreco(cotacoes: Cotacao[]): Cotacao[] {
        return cotacoes.sort((a, b) => {
            const precoA = parseFloat(a.price);
            const precoB = parseFloat(b.price);
            return precoA - precoB;
        });
    }

    /**
     * Gera PIX/Checkout de etiquetas no carrinho do Melhor Envio e aciona Webhook N8N
     */
    async gerarPixWebook(pedidoIds: string[]): Promise<any> {
        try {
            // 1. Buscar UUIDs que representam as etiquetas no carrinho
            const { data: pedidos } = await supabase
                .from('pedidos_consolidados_v3')
                .select('codigo_rastreio')
                .in('id', pedidoIds)
                .eq('logistica_provider', 'Melhor Envio');

            if (!pedidos || pedidos.length === 0) {
                throw new Error('Nenhum pedido do Melhor Envio encontrado para esses IDs.');
            }

            const cartIds = pedidos
                .map(p => p.codigo_rastreio)
                .filter(c => c && c.length === 36);

            if (cartIds.length === 0) {
                throw new Error('As etiquetas selecionadas não possuem UUIDs válidos pendentes de pagamento.');
            }

            // 2. Chamar endpoint de Checkout na API oficial (Gera a Fatura)
            const checkoutRes = await fetch(`${MELHOR_ENVIO_BASE_URL}/me/shipment/checkout`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    orders: cartIds
                })
            });

            if (!checkoutRes.ok) {
                const errText = await checkoutRes.text();
                throw new Error(`Falha no Melhor Envio (HTTP ${checkoutRes.status}): ${errText}`);
            }

            const checkoutJson = await checkoutRes.json();

            // 3. Enviar Payload da Fatura/Link para o Webhook do N8N
            const webhookUrl = "https://webhook.belafit.app/webhook/pixme";
            const webhookRes = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids_crm: pedidoIds,
                    uuids_melhor_envio: cartIds,
                    checkout_data: checkoutJson
                })
            });

            if (!webhookRes.ok) {
                throw new Error(`Checkout realizado, mas falha ao acionar n8n (${webhookRes.status}).`);
            }

            return checkoutJson;
        } catch (error) {
            logger.apiError('MelhorEnvioService', 'gerarPixWebook', error, { pedidoIds });
            throw error;
        }
    }
}

export const melhorEnvioService = new MelhorEnvioService();
