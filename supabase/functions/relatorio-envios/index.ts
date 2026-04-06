import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { format, getDay, addDays } from "https://esm.sh/date-fns@3.3.0";
import { ptBR } from "https://esm.sh/date-fns@3.3.0/locale";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Retorna data formatada no padrão "17/03" ou "17 fev"
 */
function formatarDataBR(dateStr: string) {
    if (!dateStr) return '';
    try {
        const localDateStr = dateStr.split('T')[0];
        const [yyyy, mm, dd] = localDateStr.split('-');
        const dateObj = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), 12, 0, 0);

        if (dateObj.getMonth() === new Date().getMonth()) {
            return format(dateObj, "dd/MM");
        } else {
            return format(dateObj, "dd MMM", { locale: ptBR });
        }
    } catch {
        return '';
    }
}

/**
 * Retorna o próximo dia útil (Pula sábado, domingo e feriados informados)
 */
function getProximoDiaUtil(dateInput: Date | string, feriados: Set<string>): Date {
    let d: Date;
    if (typeof dateInput === 'string') {
        const localDateStr = dateInput.split('T')[0];
        const [yyyy, mm, dd] = localDateStr.split('-');
        d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), 12, 0, 0);
    } else {
        d = new Date(dateInput.getTime());
    }

    d = addDays(d, 1);
    while (getDay(d) === 0 || getDay(d) === 6 || feriados.has(format(d, "yyyy-MM-dd"))) {
        d = addDays(d, 1);
    }
    return d;
}

/**
 * Retorna o dia útil anterior (Pula sábado, domingo e feriados informados)
 */
function getAnteriorDiaUtil(dateInput: Date | string, feriados: Set<string>): Date {
    let d: Date;
    if (typeof dateInput === 'string') {
        const localDateStr = dateInput.split('T')[0];
        const [yyyy, mm, dd] = localDateStr.split('-');
        d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), 12, 0, 0);
    } else {
        d = new Date(dateInput.getTime());
    }

    d = addDays(d, -1);
    while (getDay(d) === 0 || getDay(d) === 6 || feriados.has(format(d, "yyyy-MM-dd"))) {
        d = addDays(d, -1);
    }
    return d;
}

/**
 * Formata data no padrão dd/MM para o relatório
 */
function formatRel(date: Date) {
    return format(date, "dd/MM");
}

Deno.serve(async (req: Request) => {
    console.log("=== INÍCIO relatorio-envios ===");
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // 1. Contexto Temporal (BRT)
        const hojeBrTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        const diaDespacho = format(hojeBrTime, 'yyyy-MM-dd');
        const diaEnvioFormatado = format(hojeBrTime, 'dd/MM');
        const diaSemana = getDay(hojeBrTime);

        // 2. Payload
        const reqData = await req.json().catch(() => ({}));
        const pedidoIds = reqData.pedidoIds;
        const isAutomated = reqData.automated === true;
        console.log(`Disparo ${isAutomated ? 'Automático' : 'Manual'}. IDs: ${pedidoIds?.length || 0}`);

        // 3. Travas Automáticas
        if (isAutomated && (diaSemana === 0 || diaSemana === 6)) {
            return new Response(JSON.stringify({ message: "Fim de semana", skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 4. Carregar Feriados e Calcular Datas do Cabeçalho
        const [yyyy, mm, dd] = diaDespacho.split('-');
        const dateObj = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), 12, 0, 0);
        const { data: feriadosList } = await supabase.from('feriados').select('data, nome').gte('data', format(addDays(dateObj, -15), 'yyyy-MM-dd')).lte('data', format(addDays(dateObj, 1), 'yyyy-MM-dd'));
        const feriadosSet = new Set(feriadosList?.map(f => f.data) || []);

        if (isAutomated && feriadosSet.has(diaDespacho)) {
            return new Response(JSON.stringify({ message: "Feriado", skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const diaPV = getAnteriorDiaUtil(dateObj, feriadosSet);
        const diaVendasEnd = getAnteriorDiaUtil(diaPV, feriadosSet);
        const rangeVendas: string[] = [];
        let curr = diaVendasEnd;
        const targetEnd = addDays(diaPV, -1);
        while (curr <= targetEnd) {
            rangeVendas.push(format(curr, "dd/MM"));
            curr = addDays(curr, 1);
        }

        // 5. Query de Pedidos
        let query = supabase.from('pedidos_consolidados_v3').select(`
            id, quantidade_pedidos, produto_principal, order_bumps, upsells, pos_vendas,
            codigos_agrupados, email, telefone, foi_editado,
            status_envio, dia_despacho, data_venda, error_geracao_etiqueta,
            status_aprovacao, codigo_rastreio, data_postagem
        `);

        if (pedidoIds?.length) {
            query = query.in('id', pedidoIds);
        } else if (isAutomated) {
            query = query
                .lte('dia_despacho', diaDespacho)
                .neq('status_aprovacao', 'Cancelado')
                .neq('status_aprovacao', 'Unificado')
                .is('data_postagem', null)
                .neq('status_envio', 'Postado')
                .neq('status_envio', 'Enviado');
        } else {
            query = query
                .eq('dia_despacho', diaDespacho)
                .neq('status_aprovacao', 'Cancelado')
                .neq('status_aprovacao', 'Unificado')
                .is('data_postagem', null)
                .neq('status_envio', 'Postado')
                .neq('status_envio', 'Enviado');
        }

        const { data: pedidosRow, error } = await query;
        if (error) throw error;

        // Filtrar pedidos que já têm etiqueta (estes deveriam ir para a aba Etiquetados)
        // Se vieram IDs explícitos do frontend (botão), ignora o filtro e confia no que veio.
        const pedidos = (pedidosRow || []).filter((order: any) => {
            if (pedidoIds?.length) return true;
            if (order.codigo_rastreio && order.codigo_rastreio.trim() !== '') return false;
            return true;
        });

        if (!pedidos || pedidos.length === 0) {
            return new Response(JSON.stringify({ message: "Nenhum pedido para hoje" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 6. Agregação
        let totalPais = 0, totalOB = 0, totalUP = 0, totalPV = 0, totalAtraso = 0;
        const counts: any = {}, countsAtraso: any = {};
        const categorias = ['DP', 'BF', 'BL', 'BH', 'SS', 'ME', 'OUTRO'];
        categorias.forEach(c => {
            counts[c] = { totalPais: 0, ob: 0, up: 0, pv_siglas: {} };
            countsAtraso[c] = { totalPais: 0, ob: 0, up: 0, pv_siglas: {} };
        });

        pedidos.forEach((p: any) => {
            totalPais++;
            const atrasado = p.dia_despacho && p.dia_despacho < diaDespacho;
            if (atrasado) totalAtraso++;

            const target = atrasado ? countsAtraso : counts;
            const cat = p.produto_principal || 'OUTRO';
            if (!target[cat]) target[cat] = { totalPais: 0, ob: 0, up: 0, pv_siglas: {} };
            
            target[cat].totalPais++;
            if (p.order_bumps?.length) { target[cat].ob += p.order_bumps.length; totalOB += p.order_bumps.length; }
            if (p.upsells?.length) { target[cat].up += p.upsells.length; totalUP += p.upsells.length; }
            if (p.pos_vendas?.length) {
                totalPV += p.pos_vendas.length;
                p.pos_vendas.forEach((pv: string) => {
                    const s = pv.toUpperCase().substring(0, 2);
                    target[cat].pv_siglas[s] = (target[cat].pv_siglas[s] || 0) + 1;
                });
            }
        });

        // 7. Mensagem
        let msg = `📦 *RELATÓRIO DIÁRIO DE ENVIOS*\n\n`;
        msg += `🗓️ *Vendas:* ${rangeVendas.join(', ')}\n📞 *Pós vendas:* ${format(diaPV, "dd/MM")}\n🚚 *Envio:* ${diaEnvioFormatado}\n\n`;
        msg += `*--------------------------------*\n\n`;
        msg += `🚀 *PEDIDO BRUTO: ${totalPais + totalOB + totalUP + totalPV}*\n_Total de linhas processadas_\n\n`;
        msg += `🎯 *TOTAL GLOBAL DE ENVIOS: ${totalPais}*\n`;
        
        if (totalOB + totalUP + totalPV > 0) {
            let add = [];
            if (totalOB > 0) add.push(`${totalOB} OB`);
            if (totalUP > 0) add.push(`${totalUP} US`);
            if (totalPV > 0) add.push(`${totalPV} PV`);
            msg += `_Adicionais: ${add.join(' + ')}_\n`;
        }
        msg += `\n📊 *DETALHAMENTO POR PEDIDO*\n\n`;

        const formatName = (s: string) => ({ DP: 'Desejo Proibido', BF: 'Bela Forma', BL: 'Bela Lumi', BH: 'BelaBloom', SS: 'SekaShot', ME: 'Mounjalis' }[s] || 'Outros');

        categorias.forEach(cat => {
            const s = counts[cat];
            if (s.totalPais > 0) {
                msg += `* *${cat}* - ${formatName(cat)}\n└─ *${s.totalPais}* Pedidos`;
                if (s.ob > 0) msg += ` + *${s.ob}* OB`;
                if (s.up > 0) msg += ` + *${s.up}* US`;
                Object.entries(s.pv_siglas).forEach(([sig, qtd]) => {
                    if (qtd > 0) msg += ` + *${qtd}* ${sig}`;
                });
                msg += `\n\n`;
            }
        });

        if (totalAtraso > 0) {
            msg += `🚨 *PEDIDOS COM ENVIO EM ATRASO* 🚨\n\n${totalAtraso}\n\n📊 *ENVIO ATRASADO*\n\n`;
            categorias.forEach(cat => {
                const s = countsAtraso[cat];
                if (s.totalPais > 0) {
                    msg += `* *${cat}* - ${formatName(cat)}\n└─ *${s.totalPais}* Pedidos`;
                    if (s.ob > 0) msg += ` + *${s.ob}* OB`;
                    if (s.up > 0) msg += ` + *${s.up}* US`;
                    Object.entries(s.pv_siglas).forEach(([sig, qtd]) => {
                        if (qtd > 0) msg += ` + *${qtd}* ${sig}`;
                    });
                    msg += `\n\n`;
                }
            });
        }

        // 8. Timeout do Webhook para evitar freezes
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            await fetch('https://webhook.belafit.app/webhook/envios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: msg, automated: isAutomated, dia_envio: diaEnvioFormatado }),
                signal: controller.signal
            });
        } catch (fetchErr) {
            console.error("Aviso: Falha ao contatar webhook do n8n", fetchErr);
        } finally {
            clearTimeout(timeoutId);
        }

        return new Response(JSON.stringify({ success: true, result: msg }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error("Erro:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
