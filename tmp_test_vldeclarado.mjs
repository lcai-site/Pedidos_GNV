const CORREIOS_BASIC_AUTH = 'NDI5MTY3MjIwMDAxMzA6YUNSaHdLeEtFemphMGpsNXNBUE5BZVFROEZJTWNrbnFyWElRVUQxOQ==';

async function test() {
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

    if (!tokenResponse.ok) { console.error("Auth failed"); return; }
    const bearerToken = (await tokenResponse.json()).token;

    const servicos = [
        { nome: 'PAC', codigo: '03298' },
        { nome: 'SEDEX', codigo: '03220' },
        { nome: 'Mini Envios', codigo: '04227' }
    ];

    // Testing with vlDeclarado: "" (like n8n) vs "0" (old code)
    for (const vlDeclarado of ["", "0"]) {
        console.log(`\n========= vlDeclarado = "${vlDeclarado}" =========`);
        for (const servico of servicos) {
            const precoPayload = {
                idLote: "1",
                parametrosProduto: [{
                    coProduto: servico.codigo,
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
                    vlDeclarado: vlDeclarado,
                    dtEvento: new Date().toLocaleDateString('pt-BR'),
                    coUnidadeOrigem: "",
                    dtArmazenagem: "",
                    vlRemessa: "",
                    cepDestino: "88058200"
                }]
            };

            const resp = await fetch('https://api.correios.com.br/preco/v1/nacional', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${bearerToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(precoPayload)
            });

            console.log(`${servico.nome} (${servico.codigo}): HTTP ${resp.status}`);
            const body = await resp.text();
            console.log(body.substring(0, 200));
        }
    }
}
test();
