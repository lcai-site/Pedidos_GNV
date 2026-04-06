import { createClient } from '@supabase/supabase-js';
import { getEnv } from './environments.mjs';

const env = getEnv('production');
const supabase = createClient(env.supabaseUrl, env.serviceKey);

async function inspectErrors() {
    console.log("Buscando últimos pedidos com logistica_provider = Correios Nativo ou tentativas de geração > 0");

    const { data: pedidos, error } = await supabase
        .from('pedidos_consolidados_v3')
        .select('id, nome_cliente, cpf, observacao, status_envio, codigo_rastreio, cep')
        .order('updated_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error("Erro ao buscar:", error);
        return;
    }

    pedidos.forEach(p => {
        if (!p.codigo_rastreio || p.observacao) {
            console.log(`[Pedido] ${p.nome_cliente} (CEP: ${p.cep})`);
            console.log(` - Status: ${p.status_envio}`);
            console.log(` - Rastreio: ${p.codigo_rastreio}`);
            console.log(` - Observação: ${p.observacao}`);
            console.log(` - Tentativas: ${p.tentativas_geracao}`);
            console.log("-------------------------------------------------");
        }
    });
}

inspectErrors();
