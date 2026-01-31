// Serviço para análise de erros via IA (Open Router)

import type { ErroEtiqueta } from '../types/labels';

// Usar proxy local para evitar CORS
const OPEN_ROUTER_API_URL = '/api/openrouter/chat/completions';
const API_KEY = import.meta.env.VITE_OPEN_ROUTER_API_KEY;
const MODEL = import.meta.env.VITE_OPEN_ROUTER_MODEL;

class AIAnalysisService {
    /**
     * Analisa erro de geração de etiqueta usando IA
     */
    async analisarErro(erro: ErroEtiqueta): Promise<string> {
        try {
            const prompt = `Você é um especialista em logística e endereços brasileiros.

Analise o seguinte erro ao gerar etiqueta de envio:

**Cliente:** ${erro.nome}
**CPF:** ${erro.cpf}
**Endereço:** ${erro.endereco}
**Erro:** ${erro.erro}

Identifique o problema e sugira uma correção específica e objetiva.
Responda em português, de forma concisa (máximo 2 linhas).`;

            const response = await fetch(OPEN_ROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://pedidos-gnv.app',
                    'X-Title': 'Pedidos GNV - Label Generator'
                },
                body: JSON.stringify({
                    model: MODEL,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 150
                })
            });

            if (!response.ok) {
                throw new Error(`Erro na API Open Router: ${response.statusText}`);
            }

            const data = await response.json();
            const sugestao = data.choices[0]?.message?.content || 'Erro ao analisar. Verifique o endereço manualmente.';

            return sugestao.trim();

        } catch (error) {
            console.error('Erro ao analisar com IA:', error);
            return 'Erro ao analisar. Verifique o endereço manualmente.';
        }
    }
}

export const aiAnalysisService = new AIAnalysisService();
