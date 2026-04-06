import { createClient } from '@supabase/supabase-js';
import { getEnv } from './environments.mjs';

const prodEnv = getEnv('production');
const supabase = createClient(prodEnv.supabaseUrl, prodEnv.serviceKey);

async function checkMissingOrders() {
    console.log("=========================================\n🔎 VERIFICAÇÃO DE PEDIDOS DO DIA 02/03\n=========================================\n");

    // 1. Quantas compras brutas foram feitas no dia 02/03?
    const { data: rawOrders, error: rawErr } = await supabase
        .from('ticto_pedidos')
        .select('transaction_hash, product_name, status, paid_amount, created_at, customer_email, customer_name')
        .gte('created_at', '2026-03-02T00:00:00Z')
        .lt('created_at', '2026-03-03T00:00:00Z');

    if (rawErr) { console.error(rawErr); return; }

    const rawAprovados = rawOrders.filter(o => ['approved', 'aprovado', 'pago', 'completed', 'succeeded', 'authorized'].includes(o.status?.toLowerCase()));
    console.log(`\n📦 TICTO BRUTO (02/03):`);
    console.log(`  Totais: ${rawOrders.length}`);
    console.log(`  Aprovados: ${rawAprovados.length}`);

    // Separar Pais, Order Bumps e Upsells
    const pais = rawAprovados.filter(o => !o.product_name?.includes('Order Bump') && !o.product_name?.includes('UPSELL') && !o.product_name?.match(/-(BF|BL|DP|CC)$/i));
    const obs = rawAprovados.filter(o => o.product_name?.includes('Order Bump'));
    const ups = rawAprovados.filter(o => o.product_name?.includes('UPSELL'));
    const pvs = rawAprovados.filter(o => o.product_name?.match(/-(BF|BL|DP|CC)$/i));

    console.log(`\n  Destes Aprovados:`);
    console.log(`  - Pais Mães (Ofertas Principais): ${pais.length}`);
    console.log(`  - Order Bumps: ${obs.length}`);
    console.log(`  - UPSELLS: ${ups.length}`);
    console.log(`  - Pós-Vendas: ${pvs.length}`);
    console.log(`  Total Matemático esperado de envios físicos (Mães): ${pais.length}`);

    console.log("\n-----------------------------------------");

    // 2. Quantos pacotes consolidados preveem despacho no dia 04/03 (Hoje)?
    // O sistema de regras (migration 057) estipula: compras de sex (após 14h), sáb e dom despacham na terça.
    // E pedidos aprovados segunda-feira (02/03) despacham na quarta-feira (04/03).
    const { data: envios, error: envErr } = await supabase
        .from('pedidos_consolidados_v3')
        .select('codigo_transacao, nome_cliente, dia_despacho, data_venda, fraude_endereco, email, cpf, codigos_agrupados, order_bumps, upsells, pos_vendas')
        .eq('dia_despacho', '2026-03-04'); // Hoje

    if (envErr) { console.error(envErr); return; }

    const validos = envios.filter(e => e.fraude_endereco !== true);
    const fraudes = envios.filter(e => e.fraude_endereco === true);

    console.log(`\n🚚 PACOTES CONSOLIDADOS (Despacho 04/03):`);
    console.log(`  Totais Gerados na Aplicação: ${envios.length}`);
    console.log(`  Validos Exibidos na Tela: ${validos.length}`);
    console.log(`  Fraudes Ocultadas na Tela: ${fraudes.length}`);

    // Vamos cruzar agora!
    console.log("\n-----------------------------------------");
    console.log("🕵️ CAÇA AOS DESAPARECIDOS:");

    // Quais Pedidos Pais brutos aprovados do dia 02 não estão aparecendo nos envios de 04/03?
    const transactionIdConsolidados = new Set(envios.map(e => e.codigo_transacao));

    const missingPais = pais.filter(p => !transactionIdConsolidados.has(p.transaction_hash));

    if (missingPais.length > 0) {
        console.log(`\nEncontramos ${missingPais.length} pedido(s) principal(is) do dia 02/03 que não viraram um pacote para envio em 04/03!`);
        missingPais.forEach(m => {
            console.log(`  -> ${m.transaction_hash} | ${m.customer_name} | ${m.product_name} | Data: ${m.created_at}`);
        });

        // Ver onde eles foram parar! Foram jogados para outro dia de despacho?
        const missingTransacionIds = missingPais.map(m => m.transaction_hash);
        const { data: missingFound } = await supabase.from('pedidos_consolidados_v3').select('codigo_transacao, dia_despacho').in('codigo_transacao', missingTransacionIds);

        if (missingFound && missingFound.length > 0) {
            console.log("\nEstes pedidos não sumiram, eles foram alocados para outros dias de despacho:");
            missingFound.forEach(f => {
                console.log(`  -> ${f.codigo_transacao} está agendado para o dia: ${f.dia_despacho}`);
            });
        } else {
            console.log("\nEstes pedidos não estão na tabela de consolidados DE JEITO NENHUM.");
        }

    } else {
        console.log(`\nTodos os ${pais.length} pedidos pais brutos do dia 02/03 geraram pacotes de envio.`);
    }

    if (fraudes.length > 0) {
        console.log(`\nLembrete de Fraudes (Eles existem no banco, mas a UI esconde da contagem):`);
        fraudes.forEach(f => {
            console.log(`  -> ${f.codigo_transacao} | ${f.nome_cliente}`);
        });
    }

}

checkMissingOrders();
