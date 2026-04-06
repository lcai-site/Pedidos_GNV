import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.production' });

const token = process.env.VITE_MELHOR_ENVIO_TOKEN;
const SUPABASE_URL = 'https://cgyxinpejaoadsqrxbhy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const uuid = 'a15e9499-f98d-468e-bf53-4485c47f74ff'; // One of the problem UUIDs

async function check() {
    console.log("Invoking correios-labels for Raquel...");
    
    const payloadData = {
        id: '5f74f95c-f51b-495e-907c-06cc1b2d47df',
        cep: '85642022',
        peso: '300',
        comprimento: '20',
        largura: '16',
        altura: '4',
        nome_cliente: 'Raquel Aline Tavares Nunes',
        cliente_cpf: '08851958920',
        endereco_rua: 'Rua Olavo Bilac',
        endereco_numero: '109',
        endereco_complemento: '',
        endereco_bairro: 'São Francisco',
        endereco_cidade: 'Ampére',
        endereco_estado: 'PR',
        cliente_telefone: '46991243646',
        cliente_email: 'raah.alliny@gmail.com',
        produto_nome: 'DP - Compre 1 Leve 2'
    };

    const { data, error } = await supabase.functions.invoke('correios-labels', {
        body: { orderData: payloadData }
    });
    
    if (error) {
        console.error("Function Error:", error);
    } else {
        console.log("Function Response:", JSON.stringify(data, null, 2));
    }
}

check();
