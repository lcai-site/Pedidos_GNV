import { createClient } from '@supabase/supabase-js';
import { format, getDay, addDays } from 'date-fns';

const supabaseUrl = 'https://cgyxinpejaoadsqrxbhy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneXhpbnBlamFvYWRzcXJ4Ymh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAwMjkzOCwiZXhwIjoyMDgzNTc4OTM4fQ.efSSvLn_WaZi-J9PUXmX3qLlVtgTskkzDNTLp4hKjcc';
const supabase = createClient(supabaseUrl, supabaseKey);

function formatarDataBR(dateStr) {
    if (!dateStr) return '';
    try {
        const localDateStr = dateStr.split('T')[0];
        const [yyyy, mm, dd] = localDateStr.split('-');
        return `${dd}/${mm}`;
    } catch {
        return '';
    }
}

function getProximoDiaUtil(dateStr) {
    const localDateStr = dateStr.split('T')[0];
    const [yyyy, mm, dd] = localDateStr.split('-');
    let d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), 12, 0, 0);
    
    d = addDays(d, 1);
    while (getDay(d) === 0 || getDay(d) === 6) {
        d = addDays(d, 1);
    }
    return d;
}

async function run() {
    console.log("Fetching orders for today...");
    const hojeBrTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const diaDespacho = format(hojeBrTime, 'yyyy-MM-dd');
    const diaEnvioFormatado = format(hojeBrTime, 'dd/MM');

    const { data: pedidos_unificados, error } = await supabase
        .from('pedidos_consolidados_v3')
        .select('*')
        .eq('dia_despacho', diaDespacho);

    if (error) { console.error(error); return; }
    console.log(`Found ${pedidos_unificados.length} orders.`);

    let totalPais = 0;
    let totalOB = 0;
    let totalUP = 0;
    let totalPV = 0;

    const counts = {
        'DP': { totalPais: 0, ob: 0, up: 0, pv_bf: 0, pv_bl: 0, pv_dp: 0 },
        'BF': { totalPais: 0, ob: 0, up: 0, pv_bf: 0, pv_bl: 0, pv_dp: 0 },
        'BL': { totalPais: 0, ob: 0, up: 0, pv_bf: 0, pv_bl: 0, pv_dp: 0 },
        'OUTRO': { totalPais: 0, ob: 0, up: 0, pv_bf: 0, pv_bl: 0, pv_dp: 0 },
    };

    const datasVendas = new Set();
    const datasPV = new Set();

    pedidos_unificados.forEach(p => {
        totalPais++;

        if (p.data_venda) {
            const diaVendaFormat = formatarDataBR(p.data_venda);
            if (diaVendaFormat) datasVendas.add(diaVendaFormat);

            const nextBusinessDay = getProximoDiaUtil(p.data_venda);
            const diaPVFormat = format(nextBusinessDay, "dd/MM");
            datasPV.add(diaPVFormat);
        }

        const mainProduct = p.produto_principal || 'OUTRO';
        if (!counts[mainProduct]) {
            counts[mainProduct] = { totalPais: 0, ob: 0, up: 0, pv_bf: 0, pv_bl: 0, pv_dp: 0 };
        }

        counts[mainProduct].totalPais += 1;

        if (p.order_bumps && Array.isArray(p.order_bumps)) {
            const count = p.order_bumps.length;
            counts[mainProduct].ob += count;
            totalOB += count;
        }

        if (p.upsells && Array.isArray(p.upsells)) {
            const count = p.upsells.length;
            counts[mainProduct].up += count;
            totalUP += count;
        }

        if (p.pos_vendas && Array.isArray(p.pos_vendas)) {
            const count = p.pos_vendas.length;
            totalPV += count;
            p.pos_vendas.forEach(pvStr => {
                const upStr = pvStr.toUpperCase();
                if (upStr.startsWith('BF:')) counts[mainProduct].pv_bf += 1;
                else if (upStr.startsWith('BL:')) counts[mainProduct].pv_bl += 1;
                else if (upStr.startsWith('DP:')) counts[mainProduct].pv_dp += 1;
            });
        }
    });

    const pedidoBruto = totalPais + totalOB + totalUP + totalPV;

    const vendasStr = Array.from(datasVendas).sort().join(', ');
    const pvStr = Array.from(datasPV).sort().join(', ');

    let msg = `*Vendas:* ${vendasStr || 'N/A'}\n`;
    msg += `*Pós vendas:* ${pvStr || 'N/A'}\n`;
    msg += `*Envio:* ${diaEnvioFormatado}\n\n`;

    msg += `*PEDIDO BRUTO:* ${pedidoBruto}\n`;

    let unicosDetalhes = [];
    if (totalOB > 0) unicosDetalhes.push(`${totalOB} OB`);
    if (totalUP > 0) unicosDetalhes.push(`${totalUP} US`);
    if (totalPV > 0) unicosDetalhes.push(`${totalPV} PV`);
    
    const unicosExtra = unicosDetalhes.length > 0 ? ` + (${unicosDetalhes.join(' + ')})` : '';
    msg += `*PEDIDOS ÚNICOS:* ${totalPais}${unicosExtra}\n\n`;

    ['DP', 'BF', 'BL', 'OUTRO'].forEach(prod => {
        const s = counts[prod];
        if (s.totalPais > 0) {
            let parts = [];
            if (s.ob > 0) parts.push(`${s.ob} OB`);
            if (s.up > 0) parts.push(`${s.up} US`);
            if (s.pv_bf > 0) parts.push(`${s.pv_bf} BF`);
            if (s.pv_bl > 0) parts.push(`${s.pv_bl} BL`);
            if (s.pv_dp > 0) parts.push(`${s.pv_dp} DP`);

            const det = parts.length > 0 ? ` + ${parts.join(' + ')}` : '';
            msg += `${prod}: ${s.totalPais}${det}\n`;
        }
    });

    console.log("FINAL MESSAGE:");
    console.log(msg);
}

run();
