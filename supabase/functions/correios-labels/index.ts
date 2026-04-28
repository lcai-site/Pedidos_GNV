import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Supabase Environment Setup
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

// Secrets for Correios - Needs to be added in Supabase dashboard
const CORREIOS_BASIC_AUTH = Deno.env.get('CORREIOS_BASIC_AUTH') || 'NDI5MTY3MjIwMDAxMzA6YUNSaHdLeEtFemphMGpsNXNBUE5BZVFROEZJTWNrbnFyWElRVUQxOQ==';
const MEUSCORREIOS_TOKEN = Deno.env.get('MEUSCORREIOS_TOKEN') || 'Dp4GDpoF03LVIkuIWOJ4Tl4prxeCbArIZ/+Tf60D4Ho=';

serve(async (req) => {
    const origin = req.headers.get('Origin') || '*';
    const dynamicCorsHeaders = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'OPTIONS, POST, GET, PUT, DELETE',
    };

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: dynamicCorsHeaders });
    }

    try {
        const reqClone = req.clone();

        let bodyParsed;
        try {
            bodyParsed = await reqClone.json();
            console.log("[correios-labels] Payload recebido:", JSON.stringify(bodyParsed));
        } catch (e) {
            console.error("[correios-labels] Erro de parse do JSON:", e);
            throw new Error("Corpo da requisição não é um JSON válido.");
        }

        const orderData = bodyParsed.orderData;

        if (!orderData || !orderData.id) {
            throw new Error('A requisição não enviou o parâmetro "orderData" com um "id".');
        }

        // --- GLOBAL TIMEOUT PROMISE --- //
        // Supabase Edge Functions timeout forcefully at ~10-15s for the free tier, throwing a 5xx.
        // We will throw an internal error at 9s to ensure we return a 200 OK JSON error to the frontend
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error("A API dos Correios ou MelhorEnviou demorou demais para responder. Tempo Limite Excedido (9s)."));
            }, 9000);
        });

        const mainExecution = async () => {
            const supabase = createClient(supabaseUrl, supabaseKey);

        const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 4000) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch(url, { ...options, signal: controller.signal });
                clearTimeout(id);
                return response;
            } catch (error: any) {
                clearTimeout(id);
                if (error.name === 'AbortError') {
                    throw new Error(`Request to ${url} timed out after ${timeoutMs}ms.`);
                }
                throw error;
            }
        };

        // ============================================
        // 1. AUTHENTICATE WITH CORREIOS
        // ============================================
        console.log(`[correios-labels] Generating token for order ${orderData.id}...`);

        const tokenResponse = await fetchWithTimeout('https://api.correios.com.br/token/v1/autentica/cartaopostagem', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Authorization': `Basic ${CORREIOS_BASIC_AUTH}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ numero: "0079253997" }) // Fix for n8n format
        }, 3000);

        if (!tokenResponse.ok) {
            const errBody = await tokenResponse.text();
            throw new Error(`Correios Auth Error: HTTP ${tokenResponse.status} ${errBody}`);
        }

        const tokenData = await tokenResponse.json();
        const bearerToken = tokenData.token;

        if (!bearerToken) {
            throw new Error('Correios API não retornou um token válido de autorização.');
        }

        // ============================================
        // 2. GET BEST PRICE (PAC vs SEDEX vs MINI ENVIOS)
        // ============================================
        console.log(`[correios-labels] Requesting quotes...`);
        const servicos = [
            { nome: 'Mini Envios', codigo: '04227' },
            { nome: 'PAC', codigo: '03298' },
            { nome: 'SEDEX', codigo: '03220' }
        ];

        let cotacoes = [];

        const firstName = (orderData['Nome do Cliente'] || orderData.nome_cliente || orderData.cliente_nome || 'Consumidor').substring(0, 50);
        const street = (orderData['Rua'] || orderData.endereco_rua || 'Rua Principal').substring(0, 50);
        const number = (orderData['Número'] || orderData.endereco_numero || 'S/N');
        const comp = (orderData['Complemento'] || orderData.endereco_complemento || '').substring(0, 30);
        const district = (orderData['Bairro'] || orderData.endereco_bairro || 'Centro').substring(0, 50);
        const city = (orderData['Cidade'] || orderData.endereco_cidade || 'Indaiatuba').substring(0, 50);
        const state = (orderData['Estado'] || orderData.endereco_estado || 'SP').substring(0, 2);
        
        const rawCep = (orderData['CEP'] || orderData.cep || orderData.cliente_cep || '');
        const cleanCep = rawCep.replace(/\D/g, '');
        if (cleanCep.length !== 8) throw new Error(`CEP do cliente é inválido ("${cleanCep}"). Precisa ter 8 dígitos.`);
        
        const cpfStr = String(orderData['Documento do Cliente'] || orderData.cliente_cpf || orderData.documento_cliente || orderData.cpf || orderData.cnpj || '0').replace(/\D/g, '');
        if (cpfStr.length !== 11 && cpfStr.length !== 14) {
            throw new Error('Dados incompletos para gerar etiqueta: CPF/CNPJ.');
        }
        const email = (orderData['E-mail do Cliente'] || orderData.cliente_email || 'email@naoinformado.com');
        
        const rawPhone = orderData['Telefone Cliente'] || orderData.cliente_telefone || '';
        const cell = rawPhone ? String(rawPhone).replace(/\D/g, '').substring(0, 11) : "0";

        const productName = (orderData['Nome da Oferta'] || orderData.produto_nome || 'Produto');
        
        // Peso tem que ser em gramas (ex: 300) pro Meus Correios e pra cotacao.
        // O Supabase DB as vezes manda '0.3' kg
        let rawWeight = orderData.peso || 300;
        let weightGrams = 300;
        if (typeof rawWeight === 'string' && rawWeight.includes('.')) {
             weightGrams = Math.round(parseFloat(rawWeight) * 1000);
        } else if (typeof rawWeight === 'string') {
             weightGrams = parseInt(rawWeight, 10);
        } else if (typeof rawWeight === 'number') {
             weightGrams = rawWeight < 10 ? Math.round(rawWeight * 1000) : rawWeight;
        }
        
        // Valor Declarado (R$ 26.00 padrão para SUPLEMENTOS)
        const valorDeclarado = 26.00;

        // Formato explicito dd/MM/yyyy para evitar diferenças entre Deno e Node
        const now = new Date();
        const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

        // ====================================================
        // LOG DIAGNÓSTICO — Dimensões reais enviadas à API
        // ====================================================
        const dimComprimento = orderData.comprimento || "20";
        const dimLargura = orderData.largura || "16";
        const dimAltura = orderData.altura || "4";
        const dimPeso = String(weightGrams);
        console.log(`[correios-labels] 📦 DIMENSÕES ENVIADAS À API CORREIOS: comprimento=${dimComprimento} largura=${dimLargura} altura=${dimAltura} peso=${dimPeso}g CEP destino=${cleanCep}`);
        
        let ultimoErro = "";

        // Correios API parallel quotes
        const quotePromises = servicos.map(async (servico) => {
            // Mini Envios = formato Envelope (tpObjeto "1")
            // PAC / SEDEX = formato Caixa (tpObjeto "2")
            const tipoObjeto = servico.codigo === '04227' ? "1" : "2";

            const precoPayload = {
                idLote: "1",
                parametrosProduto: [
                    {
                        coProduto: servico.codigo,
                        nuRequisicao: "1",
                        nuContrato: "9912699626", // From n8n
                        nuDR: 36,
                        cepOrigem: "13339010", // Constant from n8n
                        psObjeto: dimPeso, // weight in grams (variável calculada)
                        nuUnidade: "",
                        tpObjeto: tipoObjeto,
                        comprimento: dimComprimento,
                        largura: dimLargura,
                        altura: dimAltura,
                        diametro: "0",
                        psCubico: "0",
                        criterios: [""],
                        dtEvento: today,
                        coUnidadeOrigem: "",
                        dtArmazenagem: "",
                        vlRemessa: "",
                        cepDestino: cleanCep
                    }
                ]
            };

            try {
                const precoResp = await fetchWithTimeout('https://api.correios.com.br/preco/v1/nacional', {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'Authorization': `Bearer ${bearerToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(precoPayload)
                }, 4000);

                if (precoResp.ok) {
                    const pData = await precoResp.json();
                    console.log(`[correios-labels] ${servico.nome} (${servico.codigo}): HTTP ${precoResp.status}`, JSON.stringify(pData).substring(0, 200));
                    
                    let priceStr = null;
                    if (Array.isArray(pData) && pData.length > 0) {
                        priceStr = pData[0].pcFinal || pData[0].pcBaseGeral || pData[0].pcBase;
                        if (pData[0].txErro) {
                            console.log(`[correios-labels] ${servico.nome} txErro: ${pData[0].txErro}`);
                            return { error: pData[0].txErro, servico };
                        }
                    }

                    if (priceStr) {
                        const priceNum = parseFloat(priceStr.replace(',', '.'));
                        if (priceNum > 0) {
                            console.log(`[correios-labels] ${servico.nome} adicionado: R$ ${priceNum}`);
                            return {
                                provider: 'Correios',
                                nome: servico.nome,
                                codigo: servico.codigo,
                                rawPrice: priceStr,
                                price: priceNum
                            };
                        }
                    }
                } else {
                    const errText = await precoResp.text();
                    console.log(`[correios-labels] ${servico.nome} (${servico.codigo}): HTTP ${precoResp.status} FAILED:`, errText.substring(0, 200));
                    return { error: `HTTP ${precoResp.status} - ${errText}`, servico };
                }
            } catch (e) {
                console.error(`[correios-labels] ${servico.nome} parse/network error:`, e);
                return { error: String(e), servico };
            }
            return null;
        });

        const quotesResults = await Promise.all(quotePromises);
        
        const todosErros: string[] = [];
        
        for (const res of quotesResults) {
            if (res && !res.error && res.price) {
                cotacoes.push(res);
            } else if (res && res.error) {
                todosErros.push(`[${res.servico?.nome}] ${res.error}`);
                console.log(`[correios-labels] ${res.servico?.nome} erro: ${res.error}`);
            }
        }

        if (cotacoes.length === 0) {
            const erroFinal = todosErros.length > 0 ? todosErros.join(' | ') : 'Verifique o CEP';
            throw new Error(`Correios recusou a cotação: ${erroFinal}`);
        }

        // Sort by cheapest
        cotacoes.sort((a, b) => a.price - b.price);
        const melhorServico = cotacoes[0];
        console.log(`[correios-labels] Melhor serviço escolhido: ${melhorServico.nome} (${melhorServico.codigo}) por R$ ${melhorServico.price}`);

        // ============================================
        // 3. GENERATE LABEL (MEUS CORREIOS APP APP)
        // ============================================
        console.log(`[correios-labels] Generating label via MeusCorreiosApp for service: ${melhorServico.nome}...`);

        const labelPayload = {
            parmIn: {
                Token: MEUSCORREIOS_TOKEN,
                dstxrmtcod: "1",
                dstxcar: "0079253997",
                dstnom: firstName,
                dstnom2: "",
                dstend: street,
                dstendnum: number,
                dstcpl: comp,
                dstbai: district,
                dstcid: city,
                dstest: state,
                dstxcep: cleanCep,
                dstxemail: email,
                dstxcel: cell || "0",
                dstxcpfcnpj: cpfStr,
                dstcpfcnpj: cpfStr,
                dstxdoc: cpfStr,
                dstcpf: cpfStr.length === 11 ? cpfStr : "",
                dstcnpj: cpfStr.length === 14 ? cpfStr : "",
                dstxnfi: "00100005555",
                impetq: "B2W",
                // MeusCorreios falha com "Mini Envios". Sempre mapear para PAC ou SEDEX.
                servicos: [
                    { 
                        servico: melhorServico.nome.toUpperCase().includes('MINI') ? 'PAC' : melhorServico.nome.toUpperCase()
                    }
                ],
                objetos: [
                    {
                        dstxItem: 1,
                        dstxobs: `${orderData.produto_nome || 'Produto'}`,
                        dstxvd: 26.00
                    }
                ],
                ctu: [
                    {
                        ctuQua: 1,
                        ctuDes: `Suplementos - ${orderData.produto_nome || 'Produto'}`,
                        ctuPes: parseInt(dimPeso) || 300,
                        ctuVal: 1.00
                    }
                ],
                det: [
                    { detParm: "PLATAFORMA", detParmVal: "GERACAO_NATIVA" },
                    { detParm: "ORDERID", detParmVal: orderData.id }
                ]
            }
        };

        const labelReq = await fetchWithTimeout('http://meuscorreios.app/rest/apimccriprepos', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Authorization': MEUSCORREIOS_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(labelPayload)
        }, 6000);

        if (!labelReq.ok) {
            const lblErr = await labelReq.text();
            throw new Error(`MeusCorreiosApp Erro: HTTP ${labelReq.status} ${lblErr}`);
        }

        const labelRes = await labelReq.json();
        console.log(`[correios-labels] MeusCorreios FULL response:`, JSON.stringify(labelRes));

        // Verifica erro no retorno do MeusCorreios
        if (labelRes?.parmOut?.erro) {
            throw new Error(`MeusCorreios: ${labelRes.parmOut.erro}`);
        }

        const prepos = labelRes?.parmOut?.prepos;
        if (!prepos || prepos.length === 0) {
            throw new Error('MeusCorreios não retornou dados de pré-postagem.');
        }

        const preposItem = prepos[0];
        console.log(`[correios-labels] MEUSCORREIOS ITEM RESPONSE:`, JSON.stringify(preposItem));

        // 1. Verificar erro específico do item primeiro
        if (preposItem.erroItem && String(preposItem.erroItem).trim().length > 0 && preposItem.erroItem !== "0") {
             throw new Error(`Erro do Correios (no item): ${preposItem.erroItem}`);
        }

        // 2. Busca o código de rastreio em múltiplos campos possíveis
        const trackingRaw =
            preposItem.dstxetq ||        // Campo padrão PAC/SEDEX
            preposItem.codectcod ||       // Código da Etiqueta (comum em contratos novos)
            preposItem.etqCodigo ||       // Possível campo Mini Envios
            preposItem.codigoObjeto ||    // Alternativo
            preposItem.numEtiqueta ||     // Alternativo antigo
            preposItem.nrEtiqueta ||      // Outro possível nome
            preposItem.preItem;           // Algumas APIs raras usam o ID da pré-postagem se for igual ao tracking

        // Limpar o tracking
        let tracking = String(trackingRaw || "").trim();
        
        // Validação básica de formato de rastreio Correios (ex: AA123456789BR)
        if (!tracking || tracking.length < 10) {
            console.warn(`[correios-labels] Tracking não extraído diretamente. TentandoREGEX no link SRO...`);
            
            // Tentar extrair do PDF URL (etqSRO) se nada mais funcionar
            const sroMatch = String(preposItem.etqSRO || "").match(/[A-Z]{2}[0-9]{9}[A-Z]{2}/);
            if (sroMatch) {
                tracking = sroMatch[0];
                console.log(`[correios-labels] Tracking extraído do link SRO via REGEX: ${tracking}`);
            } else {
                throw new Error(`MeusCorreios retornou pré-postagem mas sem código de rastreio válido. Campos disponíveis: ${Object.keys(preposItem).join(', ')}`);
            }
        }

        const pdfUrl = preposItem.etqSRO || preposItem.etqPDF || '';

        // ============================================
        // 4. UPDATE DATABASE
        // ============================================
        console.log(`[correios-labels] Done! Updating order ${orderData.id}...`);

        const { error: dbError } = await supabase
            .from('pedidos_consolidados_v3')
            .update({
                codigo_rastreio: tracking,
                status_envio: 'Label Gerada',
                logistica_etiqueta_url: pdfUrl || null,
                logistica_provider: 'Correios Nativo',
                logistica_servico: melhorServico.nome,
                logistica_valor: melhorServico.price,
                // Novos campos para o frontend
                tipo_envio: melhorServico.nome,
                valor_frete: melhorServico.price,
                error_geracao_etiqueta: false
            })
            .eq('id', orderData.id);

        if (dbError) {
            console.error(`Status DB update failed for ${orderData.id}:`, dbError);
            throw new Error(`A etiqueta foi gerada, mas o banco falhou ao atualizar o pedido: ${dbError.message}`);
        }

        return new Response(JSON.stringify({
            success: true,
            tracking: tracking,
            pdfUrl: pdfUrl
        }), {
            headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
        };

        // Execute the main logic and race against our 9s global timeout
        const finalResponse = await Promise.race([mainExecution(), timeoutPromise]);
        return finalResponse as Response;

    } catch (error: any) {
        // ALWAYS RETURN HTTP 200 WITH JSON ERROR - so the frontend catch logic parses it instead of breaking edge!
        console.error('[correios-labels] Ocorreu um erro gerado nativamente:', error.message || error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || "Ocorreu um erro desconhecido na geração nativa."
        }), {
            headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
            status: 200, // Returning 200 so JS fetch can parse the JSON error body
        });
    }
});
