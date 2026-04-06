import https from 'https';

const CORREIOS_BASIC_AUTH = 'NDI5MTY3MjIwMDAxMzA6YUNSaHdLeEtFemphMGpsNXNBUE5BZVFROEZJTWNrbnFyWElRVUQxOQ==';

async function test() {
    try {
        console.log("1. Authenticating...");
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
            console.error("Auth failed", await tokenResponse.text());
            return;
        }
        const tokenData = await tokenResponse.json();
        const bearerToken = tokenData.token;
        console.log("Token obtained:", bearerToken.substring(0, 10) + "...");

        console.log("2. Quoting...");
        const today = new Date().toLocaleDateString('pt-BR');
        const precoPayload = {
            idLote: "1",
            parametrosProduto: [
                {
                    coProduto: "03298", // PAC
                    nuRequisicao: "1",
                    nuContrato: "9912699626",
                    nuDR: 36,
                    cepOrigem: "13339010",
                    psObjeto: "300",
                    nuUnidade: "",
                    tpObjeto: "2",
                    comprimento: "20",
                    largura: "16",
                    altura: "4",
                    diametro: "",
                    psCubico: "",
                    servicosAdicionais: [],
                    criterios: [""],
                    vlDeclarado: "",
                    dtEvento: today,
                    coUnidadeOrigem: "",
                    dtArmazenagem: "",
                    vlRemessa: "",
                    cepDestino: "88058200"
                }
            ]
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

        const pData = await precoResp.json();
        console.log("Response:", JSON.stringify(pData, null, 2));

    } catch (e) {
        console.error(e);
    }
}

test();
