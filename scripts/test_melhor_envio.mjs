import { config } from 'dotenv';

config({ path: '.env.development' });

const TOKEN = process.env.VITE_MELHOR_ENVIO_TOKEN;
const USER_AGENT = process.env.VITE_MELHOR_ENVIO_USER_AGENT;

const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`,
    'User-Agent': USER_AGENT
};

async function testar() {
    console.log('Testando cálculo de frete...');
    try {
        const response = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                from: { postal_code: '13339010' },
                to: { postal_code: '01001000' }, // Cep Sé, SP
                package: { weight: 1, width: 20, height: 10, length: 20 }
            })
        });

        console.log('Status HTTP:', response.status, response.statusText);
        const data = await response.json();

        if (!response.ok) {
            console.error('Erro na resposta:', data);
        } else {
            console.log('Sucesso! Recebido:', data.length, 'cotações');
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
    }
}

testar();
