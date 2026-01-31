// Serviço para integração com API Melhor Envio

import type { Cotacao, Dimensoes, PedidoParaEtiqueta } from '../types/labels';

// Usar proxy local para evitar CORS
const MELHOR_ENVIO_BASE_URL = '/api/melhor-envio';
const TOKEN = import.meta.env.VITE_MELHOR_ENVIO_TOKEN;
const USER_AGENT = import.meta.env.VITE_MELHOR_ENVIO_USER_AGENT;

// IDs de transportadoras inválidas (conforme N8N)
const TRANSPORTADORAS_INVALIDAS = [12, 15, 16, 27, 34];

// Endereço de origem (remetente)
const ENDERECO_ORIGEM = {
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

class MelhorEnvioService {
    private headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': USER_AGENT
    };

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
                    package: dimensoes
                })
            });

            if (!response.ok) {
                throw new Error(`Erro ao calcular frete: ${response.statusText}`);
            }

            const cotacoes: Cotacao[] = await response.json();

            // Filtra transportadoras inválidas e preços zerados
            return cotacoes.filter(cotacao => {
                const preco = parseFloat(cotacao.price);
                return preco > 0 && !TRANSPORTADORAS_INVALIDAS.includes(cotacao.id);
            });

        } catch (error) {
            console.error('Erro ao calcular frete:', error);
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
            const response = await fetch(`${MELHOR_ENVIO_BASE_URL}/me/cart`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    from: ENDERECO_ORIGEM,
                    to: {
                        name: pedido.nome_cliente,
                        phone: pedido.telefone,
                        email: pedido.email,
                        document: pedido.cpf,
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
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Erro ao adicionar ao carrinho: ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            return data.id; // Retorna ID do carrinho

        } catch (error) {
            console.error('Erro ao adicionar ao carrinho:', error);
            throw error;
        }
    }

    /**
     * Busca dados de uma ordem/etiqueta pelo ID
     * Útil para recuperar o código de rastreio real após pagamento
     */
    async buscarOrdem(id: string): Promise<any> {
        try {
            const response = await fetch(`${MELHOR_ENVIO_BASE_URL}/me/orders/${id}`, {
                method: 'GET',
                headers: this.headers
            });

            if (!response.ok) {
                // Se der 404, pode ser que ainda esteja no carrinho ou mudou de status
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error(`Erro ao buscar ordem ${id}:`, error);
            return null;
        }
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
}

export const melhorEnvioService = new MelhorEnvioService();
