import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
const CORREIOS_BASIC_AUTH = Deno.env.get('CORREIOS_BASIC_AUTH') || '';

const SERVICOS_CORREIOS = {
    MINI_ENVIOS: { codigo: '04227', nome: 'Mini Envios', prazo: 12 },
    PAC: { codigo: '03298', nome: 'PAC', prazo: 8 },
    SEDEX: { codigo: '03220', nome: 'SEDEX', prazo: 3 }
};

serve(async (req) => {
    const origin = req.headers.get('Origin') || '*';
    const dynamicCorsHeaders = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'OPTIONS, POST, GET, PUT, DELETE',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: dynamicCorsHeaders });
    }

    try {
        const bodyParsed = await req.json();
        const { cep, peso, comprimento, largura, altura, pedido_id } = bodyParsed;

        if (!cep) {
            throw new Error('CEP é obrigatório');
        }

        const cleanCep = String(cep).replace(/\D/g, '');
        if (cleanCep.length !== 8) {
            throw new Error('CEP inválido');
        }

        // Tratamento robusto de peso (Garantir gramas para os Correios)
        let weightGrams = 300;
        const rawWeight = peso;
        if (typeof rawWeight === 'string' && rawWeight.includes('.')) {
            weightGrams = Math.round(parseFloat(rawWeight) * 1000);
        } else if (typeof rawWeight === 'string') {
            weightGrams = parseInt(rawWeight, 10);
        } else if (typeof rawWeight === 'number') {
            weightGrams = rawWeight < 10 ? Math.round(rawWeight * 1000) : rawWeight;
        }

        const dimensoes = {
            peso: String(weightGrams),
            comprimento: String(comprimento || 20),
            largura: String(largura || 16),
            altura: String(altura || 4)
        };

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Autenticar
        const tokenResponse = await fetch('https://api.correios.com.br/token/v1/autentica/cartaopostagem', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Authorization': `Basic ${CORREIOS_BASIC_AUTH}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ numero: "0079253997" })
        });

        if (!tokenResponse.ok) {
            throw new Error('Erro na autenticação dos Correios');
        }

        const tokenData = await tokenResponse.json();
        const bearerToken = tokenData.token;

        const dataAtual = new Date();
        const today = `${String(dataAtual.getDate()).padStart(2, '0')}/${String(dataAtual.getMonth() + 1).padStart(2, '0')}/${dataAtual.getFullYear()}`;

        const cotacoes = [];

        for (const [tipo, servico] of Object.entries(SERVICOS_CORREIOS)) {
            try {
                const precoPayload = {
                    idLote: "1",
                    parametrosProduto: [{
                        coProduto: servico.codigo,
                        nuRequisicao: "1",
                        nuContrato: "9912699626",
                        nuDR: 36,
                        cepOrigem: "13339010",
                        psObjeto: dimensoes.peso,
                        nuUnidade: "",
                        tpObjeto: "2",
                        comprimento: dimensoes.comprimento,
                        largura: dimensoes.largura,
                        altura: dimensoes.altura,
                        diametro: "0",
                        psCubico: "0",
                        criterios: [""],
                        cepDestino: cleanCep,
                        dtEvento: today
                    }]
                };

                const precoResp = await fetch('https://api.correios.com.br/preco/v1/nacional', {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'Authorization': `Bearer ${bearerToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(precoPayload)
                });

                if (precoResp.ok) {
                    const pData = await precoResp.json();
                    
                    if (Array.isArray(pData) && pData.length > 0) {
                        const resultado = pData[0];
                        
                        if (resultado.pcFinal && !resultado.txErro) {
                            cotacoes.push({
                                tipo: tipo,
                                nome: servico.nome,
                                codigo: servico.codigo,
                                valor: parseFloat(resultado.pcFinal.replace(',', '.')),
                                prazo: resultado.prazoEntrega || servico.prazo,
                                disponivel: true
                            });
                        } else if (resultado.txErro) {
                            console.log(`[correios-cotacao] ${servico.nome} indisponível: ${resultado.txErro}`);
                            cotacoes.push({
                                tipo: tipo,
                                nome: servico.nome,
                                codigo: servico.codigo,
                                valor: 0,
                                prazo: 0,
                                disponivel: false,
                                erro: resultado.txErro
                            });
                        }
                    }
                }
            } catch (err) {
                console.error(`Erro ${tipo}:`, err);
            }
        }

        // Salvar no banco se tiver pedido_id
        if (pedido_id && cotacoes.length > 0) {
            const cotacaoJson = {};
            cotacoes.forEach(c => {
                cotacaoJson[c.tipo.toLowerCase()] = {
                    nome: c.nome,
                    valor: c.valor,
                    prazo: c.prazo,
                    disponivel: c.disponivel
                };
            });

            await supabase.rpc('salvar_cotacao_frete', {
                p_pedido_id: pedido_id,
                p_cotacao: cotacaoJson,
                p_tipo_escolhido: null
            });
        }

        const disponiveis = cotacoes.filter(c => c.disponivel);
        
        return new Response(JSON.stringify({
            success: true,
            cotacoes: cotacoes,
            melhor_opcao: disponiveis.sort((a, b) => a.valor - b.valor)[0] || null,
            total_cotacoes: disponiveis.length
        }), {
            headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }
});
