/**
 * Script para diagnosticar por que o pedido do josigodoy644@gmail.com
 * está na aba PÓS VENDAS enquanto outros 11 pedidos similares estão em ENVIOS
 */
import { createClient } from '@supabase/supabase-js';
import { addDays, getDay, format } from 'date-fns';

const SUPABASE_URL = 'https://cgyxinpejaoadsqrxbhy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneHhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMDI5MzgsImV4cCI6MjA4MzU3ODkzOH0.RWzmWALEDjEn-1abD-IIFB30hIJViDm662kKj6rnzwA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Replicar funções do frontend
const getSafeShipDate = (dateStr) => {
    const d = new Date(dateStr);
    const dayOfWeek = getDay(d);
    if (dayOfWeek === 4 || dayOfWeek === 5) return addDays(d, 4);
    return addDays(d, 2);
};

const getPostSaleDate = (dateStr) => {
    const d = new Date(dateStr);
    const dayOfWeek = getDay(d);
    if (dayOfWeek === 5) return addDays(d, 3);
    if (dayOfWeek === 6) return addDays(d, 2);
    if (dayOfWeek === 0) return addDays(d, 1);
    return addDays(d, 1);
};

// Replicar lógica exata de categorização do Logistics.tsx (linha 601+)
const categorizeOrder = (order, todayStr, refDateStr) => {
    // Se já foi postado
    if (order.data_postagem || order.status_envio === 'Postado') return 'sent';

    // Se tem etiqueta mas não postado
    if (order.codigo_rastreio && !order.data_postagem) return 'labeled';

    // Pedido manual
    if (order.metadata?.tipo === 'manual') return 'ready';

    const dataReferencia = order.status_date || order.data_venda || order.created_at;
    const diaDespachoStr = order.dia_despacho ? order.dia_despacho : format(getSafeShipDate(dataReferencia), 'yyyy-MM-dd');
    const diaPVStr = format(getPostSaleDate(dataReferencia), 'yyyy-MM-dd');
    const isPostSaleDue = diaPVStr === todayStr || diaPVStr < todayStr;

    // Prioridade 0: despacho manual
    const hasManualDispatch = !!order.dia_despacho;
    if (hasManualDispatch && (diaDespachoStr === refDateStr || diaDespachoStr < refDateStr)) return 'ready';

    // Prioridade 1: Pós-Venda
    if (isPostSaleDue && !order.pv_realizado) return 'postSale';

    // Prioridade 2: PV Realizado
    if (order.pv_realizado) {
        if (diaDespachoStr === refDateStr || diaDespachoStr < refDateStr) return 'ready';
        return 'pvDone';
    }

    // Prioridade 3: Envios (Fluxo Automático)
    if (diaDespachoStr === refDateStr || diaDespachoStr < refDateStr) return 'ready';

    // Prioridade 4: Vendas
    return 'sales';
};

async function main() {
    console.log('=== DIAGNÓSTICO - PEDIDO josigodoy644@gmail.com ===\n');

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const refDateStr = todayStr;

    console.log(`Data de referência (hoje): ${todayStr}\n`);

    // Buscar TODOS os pedidos com todos os campos relevantes
    const { data: allOrders, error } = await supabase
        .from('pedidos_consolidados_v3')
        .select('*')
        .order('data_venda', { ascending: false })
        .limit(5000);

    if (error) {
        console.error('Erro ao buscar pedidos:', error.message);
        process.exit(1);
    }

    // Encontrar o pedido do josigodoy644@gmail.com
    const targetOrder = allOrders.find(o => o.email === 'josigodoy644@gmail.com');

    if (!targetOrder) {
        console.log('❌ Pedido não encontrado com email josigodoy644@gmail.com');
        process.exit(1);
    }

    console.log('📦 PEDIDO ALVO ENCONTRADO:');
    console.log('─'.repeat(80));
    console.log(`  ID:                  ${targetOrder.id}`);
    console.log(`  Código Transação:    ${targetOrder.codigo_transacao}`);
    console.log(`  Cliente:             ${targetOrder.nome_cliente}`);
    console.log(`  Email:               ${targetOrder.email}`);
    console.log(`  CPF:                 ${targetOrder.cpf}`);
    console.log(`  Produto:             ${targetOrder.produto_principal}`);
    console.log(`  Oferta:              ${targetOrder.nome_oferta}`);
    console.log(`  Data Venda:          ${targetOrder.data_venda}`);
    console.log(`  Status Date:         ${targetOrder.status_date}`);
    console.log(`  Created At:          ${targetOrder.created_at}`);
    console.log(`  Status Aprovação:    ${targetOrder.status_aprovacao}`);
    console.log(`  Status Envio:        ${targetOrder.status_envio}`);
    console.log(`  Data Postagem:       ${targetOrder.data_postagem}`);
    console.log(`  Código Rastreio:     ${targetOrder.codigo_rastreio}`);
    console.log(`  Dia Despacho:        ${targetOrder.dia_despacho}`);
    console.log(`  Data Envio:          ${targetOrder.data_envio}`);
    console.log(`  PV Realizado:        ${targetOrder.pv_realizado}`);
    console.log(`  PV Realizado At:     ${targetOrder.pv_realizado_at}`);
    console.log(`  Corte PV:            ${targetOrder.corte_pv}`);
    console.log(`  Metadata:            ${JSON.stringify(targetOrder.metadata)}`);

    // Calcular datas
    const dataReferencia = targetOrder.status_date || targetOrder.data_venda || targetOrder.created_at;
    const diaDespachoStr = targetOrder.dia_despacho ? targetOrder.dia_despacho : format(getSafeShipDate(dataReferencia), 'yyyy-MM-dd');
    const diaPVStr = format(getPostSaleDate(dataReferencia), 'yyyy-MM-dd');
    const isPostSaleDue = diaPVStr === todayStr || diaPVStr < todayStr;

    console.log(`\n  CÁLCULOS:`);
    console.log(`  ─ Data Referência:     ${dataReferencia}`);
    console.log(`  ─ Dia Despacho Calc:   ${diaDespachoStr}`);
    console.log(`  ─ Dia PV Calc:         ${diaPVStr}`);
    console.log(`  ─ IsPostSaleDue:       ${isPostSaleDue}`);

    const targetTab = categorizeOrder(targetOrder, todayStr, refDateStr);
    console.log(`\n  ➡️  ABA CALCULADA:      ${targetTab}`);
    console.log('─'.repeat(80));

    // Agora buscar pedidos similares (mesmo produto, mesma data, etc) que estão em ENVIOS
    console.log('\n\n🔍 BUSCANDO PEDIDOS SIMILARES QUE ESTÃO EM ENVIOS (ready)...');
    console.log('─'.repeat(80));

    const similarOrders = allOrders.filter(o => {
        // Mesma data de venda (01/04)
        if (!o.data_venda || !o.data_venda.startsWith('2025-04-01')) return false;
        // Mesmo produto principal
        if (o.produto_principal !== targetOrder.produto_principal) return false;
        // Não é o pedido alvo
        if (o.id === targetOrder.id) return false;
        return true;
    });

    console.log(`\nEncontrados ${similarOrders.length} pedidos similares em 01/04 com mesmo produto.\n`);

    // Classificar todos
    const readyOrders = [];
    const postSaleOrders = [];

    for (const order of similarOrders) {
        const tab = categorizeOrder(order, todayStr, refDateStr);
        if (tab === 'ready') readyOrders.push(order);
        else if (tab === 'postSale') postSaleOrders.push(order);
    }

    console.log(`  ✅ Em ENVIOS (ready):    ${readyOrders.length}`);
    console.log(`  ⏳ Em PÓS VENDAS:        ${postSaleOrders.length}`);

    // Analizar diferenças
    if (readyOrders.length > 0) {
        console.log('\n\n📊 COMPARAÇÃO: Pedido Alvo vs Pedidos em ENVIOS');
        console.log('═'.repeat(80));

        // Verificar campos chave
        const fieldsToCompare = [
            'dia_despacho', 'pv_realizado', 'status_envio', 'data_postagem',
            'codigo_rastreio', 'data_envio', 'status_date', 'corte_pv', 'metadata'
        ];

        console.log('\nCAMPOS CRÍTICOS:');
        console.log('─'.repeat(80));
        console.log(`  Campo                | ALVO (PÓS VENDAS)        | EXEMPLO ENVIOS`);
        console.log('─'.repeat(80));

        for (const field of fieldsToCompare) {
            const targetVal = targetOrder[field];
            const exampleVal = readyOrders[0][field];
            const isDifferent = JSON.stringify(targetVal) !== JSON.stringify(exampleVal);
            const marker = isDifferent ? ' ⚠️' : ' ✅';
            console.log(`  ${field.padEnd(20)} | ${String(targetVal).padEnd(24)} | ${String(exampleVal).padEnd(24)}${marker}`);
        }

        // Mostrar por que os pedidos em ENVIOS estão lá
        console.log('\n\n✅ POR QUE ESTES PEDIDOS ESTÃO EM ENVIOS:');
        for (const order of readyOrders.slice(0, 5)) {
            console.log(`\n  📦 ${order.codigo_transacao} | ${order.nome_cliente} | ${order.email}`);
            console.log(`     dia_despacho: ${order.dia_despacho} | pv_realizado: ${order.pv_realizado} | status_envio: ${order.status_envio}`);
            console.log(`     codigo_rastreio: ${order.codigo_rastreio ? 'SIM' : 'NÃO'} | data_postagem: ${order.data_postagem || 'N/A'}`);

            const dataRef = order.status_date || order.data_venda || order.created_at;
            const diaDesp = order.dia_despacho ? order.dia_despacho : format(getSafeShipDate(dataRef), 'yyyy-MM-dd');
            const diaPV = format(getPostSaleDate(dataRef), 'yyyy-MM-dd');
            console.log(`     dataRef: ${dataRef} | diaDespacho: ${diaDesp} | diaPV: ${diaPV}`);
        }

        // Analisar por que o alvo está em PÓS VENDAS
        console.log('\n\n❌ POR QUE O PEDIDO ALVO ESTÁ EM PÓS VENDAS:');
        if (targetOrder.pv_realizado === false && (diaPVStr === todayStr || diaPVStr < todayStr)) {
            console.log(`   → pv_realizado = FALSE`);
            console.log(`   → diaPV (${diaPVStr}) <= hoje (${todayStr})`);
            console.log(`   → Condição: isPostSaleDue = true && !pv_realizado = true`);
            console.log(`   → Resultado: vai para PÓS VENDAS`);

            // Verificar se tem dia_despacho manual
            if (!targetOrder.dia_despacho) {
                console.log(`\n   ⚠️  DIFERENÇA CHAVE: dia_despacho está NULL`);
                console.log(`   → Sem dia_despacho manual, o sistema usa cálculo automático`);
                console.log(`   → A Prioridade 0 (despacho manual) NÃO se aplica`);
                console.log(`   → Cai na Prioridade 1 (Pós-Venda) porque isPostSaleDue = true`);
            }
        }

        // Verificar se pedidos em ENVIOS têm pv_realizado = true ou dia_despacho manual
        const readyWithPv = readyOrders.filter(o => o.pv_realizado === true);
        const readyWithManualDispatch = readyOrders.filter(o => o.dia_despacho !== null && o.dia_despacho !== undefined);
        const readyWithTracking = readyOrders.filter(o => o.codigo_rastreio !== null && o.codigo_rastreio !== undefined);
        const readyWithPostagem = readyOrders.filter(o => o.data_postagem !== null && o.data_postagem !== undefined);

        console.log('\n\n📈 ESTATÍSTICAS DOS PEDIDOS EM ENVIOS:');
        console.log(`   Com pv_realizado=true:          ${readyWithPv.length}/${readyOrders.length}`);
        console.log(`   Com dia_despacho manual:        ${readyWithManualDispatch.length}/${readyOrders.length}`);
        console.log(`   Com codigo_rastreio:            ${readyWithTracking.length}/${readyOrders.length}`);
        console.log(`   Com data_postagem:              ${readyWithPostagem.length}/${readyOrders.length}`);
    }

    console.log('\n=== FIM DO DIAGNÓSTICO ===');
}

main().catch(console.error);
