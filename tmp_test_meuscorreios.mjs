const MEUSCORREIOS_TOKEN = 'Dp4GDpoF03LVIkuIWOJ4Tl4prxeCbArIZ/+Tf60D4Ho=';

async function testLabel() {
    console.log("3. Generating label via MeusCorreiosApp...");

    const cleanCep = "13339010"; // Origem
    const destCep = "88058200"; // Test Destino

    const labelPayload = {
        parmIn: {
            Token: MEUSCORREIOS_TOKEN,
            dstxrmtcod: "1",
            dstxcar: "0079253997",
            dstnom: "Consumidor Teste",
            dstnom2: "",
            dstend: "Rua Teste",
            dstendnum: "123",
            dstcpl: "",
            dstbai: "Centro",
            dstcid: "Sao Paulo",
            dstest: "SP",
            dstxcep: destCep,
            dstxemail: "teste@teste.com",
            dstxcel: "0",
            dstxnfi: "00100005555",
            impetq: "B2W",
            servicos: [
                { servico: "PAC" }
            ],
            objetos: [
                {
                    dstxItem: 1,
                    dstxobs: "DP - Produto",
                    dstxvd: 1.00
                }
            ],
            det: [
                { detParm: "PLATAFORMA", detParmVal: "GERACAO_NATIVA" },
                { detParm: "ORDERID", detParmVal: "test-id-123" }
            ]
        }
    };

    console.log(JSON.stringify(labelPayload, null, 2));

    const labelReq = await fetch('http://meuscorreios.app/rest/apimccriprepos', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'Authorization': MEUSCORREIOS_TOKEN,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(labelPayload)
    });

    if (!labelReq.ok) {
        const lblErr = await labelReq.text();
        console.error(`Erro: HTTP ${labelReq.status} ${lblErr}`);
        return;
    }

    const labelRes = await labelReq.json();
    console.log("Label Response:");
    console.log(JSON.stringify(labelRes, null, 2));
}

testLabel();
