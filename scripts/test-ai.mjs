import { loadEnv } from 'vite';

const env = loadEnv('development', '.', '');

async function testAI() {
    console.log("Teste AI Analysis for Correios Error");

    const prompt = `Você é um especialista em logística e endereços brasileiros.

Analise o seguinte erro ao gerar etiqueta de envio:

**Cliente:** Test Client
**CPF:** 12345678901
**Endereço:** Rua Teste 123, Centro, São Paulo SP
**Erro:** MeusCorreios: CEP não existe na base DNE

Identifique o problema e sugira uma correção específica e objetiva.
Responda em português, de forma concisa (máximo 2 linhas).`;

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.VITE_OPEN_ROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://pedidos-gnv.app',
                'X-Title': 'Pedidos GNV - Label Generator'
            },
            body: JSON.stringify({
                model: env.VITE_OPEN_ROUTER_MODEL || 'nvidia/nemotron-3-nano-30b-a3b:free', // Default or from env
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
            console.error("OpenRouter API Failed:", response.status, await response.text());
            return;
        }

        const data = await response.json();
        const sugestao = data.choices[0]?.message?.content || 'Erro ao analisar. Verifique o endereço manualmente.';
        console.log("AI SUGGESTION:");
        console.log(sugestao);
    } catch (e) {
        console.error("Exception:", e);
    }
}

testAI();
