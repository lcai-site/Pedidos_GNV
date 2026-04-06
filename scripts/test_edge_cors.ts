import handler from '../api/melhor-envio/[...path]';

async function testOptionsRequest() {
    console.log('Testando requisição OPTIONS...');
    const req = new Request('http://localhost:3000/api/melhor-envio/me/shipment/calculate', {
        method: 'OPTIONS',
        headers: new Headers({
            'Origin': 'https://meudominio.com',
            'Access-Control-Request-Method': 'POST'
        })
    });

    try {
        const response = await handler(req);
        console.log('Status HTTP:', response.status);

        let headersStr = '';
        response.headers.forEach((val, key) => {
            headersStr += `  ${key}: ${val}\n`;
        });
        console.log('Headers Retornados:\n' + headersStr);

        if (response.status === 200 && response.headers.get('Access-Control-Allow-Origin')) {
            console.log('✅ TESTE PASSOU: O preflight do CORS está sendo interceptado com sucesso!');
        } else {
            console.error('❌ TESTE FALHOU: O preflight não retornou as configs corretas.');
        }

    } catch (e) {
        console.error('Erro ao executar handler:', e);
    }
}

testOptionsRequest();
