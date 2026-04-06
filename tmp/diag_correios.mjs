import fetch from 'node-fetch';

const CORREIOS_BASIC_AUTH = 'NDI5MTY3MjIwMDAxMzA6YUNSaHdLeEtFemphMGpsNXNBUE5BZVFROEZJTWNrbnFyWElRVUQxOQ==';
const NUMERO_POSTAGEM = "0079253997";
const CONTRATO = "9912699626";
const DR = "36";
const CEP_ORIGEM = "13339010"; // Indaiatuba, SP

async function getQuote(bearerToken, cepDestino, peso, servicoCode, tpObjeto = "2") {
    const today = new Date().toLocaleDateString('pt-BR');
    const precoPayload = {
        idLote: "1",
        parametrosProduto: [{
            coProduto: servicoCode,
            nuRequisicao: "1",
            nuContrato: CONTRATO,
            nuDR: DR,
            cepOrigem: CEP_ORIGEM,
            psObjeto: String(peso),
            tpObjeto: tpObjeto,
            comprimento: "20",
            largura: "16",
            altura: "4",
            cepDestino: cepDestino,
            dtEvento: today
        }]
    };

    const response = await fetch('https://api.correios.com.br/preco/v1/nacional', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(precoPayload)
    });

    return await response.json();
}

async function runDiag() {
    try {
        console.log("--- Diagnóstico Correios (Mini Envios) ---");
        
        // 1. Auth
        const tokenResponse = await fetch('https://api.correios.com.br/token/v1/autentica/cartaopostagem', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Authorization': `Basic ${CORREIOS_BASIC_AUTH}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ numero: NUMERO_POSTAGEM })
        });

        if (!tokenResponse.ok) {
            console.error("Erro na autenticação:", await tokenResponse.text());
            return;
        }

        const { token } = await tokenResponse.json();
        console.log("Autenticado com sucesso.\n");

        const testCases = [
            { name: "Box 300g", cep: "01001000", tp: "2", peso: 300 },
            { name: "Box 301g", cep: "01001000", tp: "2", peso: 301 },
            { name: "Envelope 300g", cep: "01001000", tp: "1", peso: 300 },
            { name: "Box 300g Florianópolis", cep: "88058200", tp: "2", peso: 300 }
        ];

        for (const tc of testCases) {
            console.log(`Testando: ${tc.name} - CEP: ${tc.cep}, Tipo: ${tc.tp}, Peso: ${tc.peso}`);
            const res = await getQuote(token, tc.cep, tc.peso, "04227", tc.tp); // Mini Envios
            
            if (Array.isArray(res) && res.length > 0) {
                const item = res[0];
                if (item.txErro) {
                    console.log(`❌ Mini Envios INDISPONÍVEL: ${item.txErro}`);
                } else {
                    console.log(`✅ Mini Envios DISPONÍVEL: R$ ${item.pcFinal}`);
                }
            } else {
                console.log("Result:", JSON.stringify(res));
            }
            console.log("----------------------------------\n");
        }

    } catch (err) {
        console.error("Erro no diagnóstico:", err);
    }
}

runDiag();
