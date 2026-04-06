import { createClient } from '@supabase/supabase-js';
import { getEnv } from './environments.mjs';

const env = getEnv('production');
const supabase = createClient(env.supabaseUrl, env.serviceKey);

async function testEdge() {
    console.log("Teste Edge Function - Invalid CEP");

    const payload = {
        orderData: {
            id: '12345',
            cep: '01001000', // Valid CEP
            nome_cliente: 'Test Client',
            cliente_cpf: '12345678901',
            peso: 300,
            comprimento: 20,
            largura: 16,
            altura: 4,
            endereco_rua: 'Rua Teste',
            endereco_numero: '', // Empty number
            endereco_bairro: 'Centro',
            endereco_cidade: 'São Paulo',
            endereco_estado: 'SP'
        }
    };

    try {
        const { data, error } = await supabase.functions.invoke('correios-labels', {
            body: payload
        });

        console.log("Data:", data);
        console.log("Error:", error);
    } catch (e) {
        console.error("Exception:", e);
    }
}

testEdge();
