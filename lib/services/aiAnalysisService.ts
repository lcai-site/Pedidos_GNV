// Serviço para análise de erros via IA (Open Router)

import { logger } from '../utils/logger';
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
            const prompt = `Você é um especialista sênior em logística brasileira e APIs de frete (Correios/Melhor Envio).
Sua missão é diagnosticar erros de geração de etiquetas e propor a solução EXATA.

CONHECIMENTOS TÉCNICOS:
- CEP: Deve ter EXATAMENTE 8 dígitos numéricos.
- Rua/Logradouro: Máximo 50 caracteres.
- Nome Cliente: Máximo 50 caracteres.
- Complemento: Máximo 30 caracteres.
- Bairro: Máximo 50 caracteres.
- CPF: Deve ser válido e conter apenas números ou padrão 000.000.000-00.
- Telefone: 10 ou 11 dígitos.

DADOS PARA ANÁLISE:
- Cliente: ${erro.nome}
- CPF: ${erro.cpf}
- Endereço Atual: ${erro.endereco}
- Código de Erro da API: ${erro.erro}

INSTRUÇÕES DE RESPOSTA:
1. Identifique se o erro é no Endereço (CEP inválido, rua longa, complemento longo), no Cliente (CPF/Nome) ou na API (Timeout/Auth).
2. Seja certeiro. Não use termos vagos como "verifique". Diga "O CEP tem 7 dígitos" ou "A rua excede 50 caracteres".
3. Formato OBRIGATÓRIO: "Causa: [problema detectado] | Solução: [ação exata para corrigir]".
4. Responda em português, de forma concisa (máximo 2 linhas).`;

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
            logger.apiError('AIAnalysisService', 'analisarErro', error, {
                cliente: erro.nome,
                cpf: erro.cpf
            });
            return 'Erro ao analisar. Verifique o endereço manualmente.';
        }
    }
}

export const aiAnalysisService = new AIAnalysisService();
