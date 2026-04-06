import { createClient } from '@supabase/supabase-js';
import { getEnv } from './environments.mjs';

const env = getEnv('production');
const supabase = createClient(env.supabaseUrl, env.serviceKey);

async function verify() {
    console.log("Forçando consolidação no banco de Produção para atualizar a Jéssica...");

    // 1. Roda a consolidação para aplicar a nova regra de OB em Pós Venda
    const { error: rpcError } = await supabase.rpc('consolidar_pedidos_ticto');
    
    if (rpcError) {
        console.error("Erro ao rodar consolidação:", rpcError);
        return;
    }

    // 2. Busca a Jéssica Carolina Jagas da Silva
    const { data: pedidos, error } = await supabase
        .from('pedidos_consolidados_v3')
        .select('nome_cliente, data_venda, nome_oferta, descricao_pacote, codigos_agrupados, dia_despacho')
        .ilike('nome_cliente', '%Jéssica Carolina Jagas da Silva%')
        .order('data_venda', { ascending: false });

    if (error) {
        console.error("Erro ao buscar Jéssica:", error);
        return;
    }

    console.log("\n=== RESULTADO JÉSSICA CAROLINA JAGAS DA SILVA ===");
    pedidos.forEach(p => {
        console.log(`Data Venda : ${p.data_venda}`);
        console.log(`Dia Desp.  : ${p.dia_despacho}`);
        console.log(`Oferta     : ${p.nome_oferta}`);
        console.log(`Descricao  : ${p.descricao_pacote}`);
        console.log(`Codigos    : ${p.codigos_agrupados?.join(', ')}`);
        console.log("------------------------------------------------");
    });
}

verify();
