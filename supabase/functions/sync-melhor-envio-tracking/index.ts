import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const melhorEnvioToken = Deno.env.get("MELHOR_ENVIO_TOKEN");
        const userAgent = Deno.env.get("MELHOR_ENVIO_USER_AGENT") || "N8N_GNV default@email.com"; // Fallback para dev

        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Variáveis de ambiente do Supabase ausentes.");
        }

        if (!melhorEnvioToken) {
            throw new Error("Variável MELHOR_ENVIO_TOKEN ausente. Configure no backend do Supabase.");
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        let reqBody: any = null;
        try {
            if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
                reqBody = await req.json();
            }
        } catch (e) {
            // Ignora silenciosamente, pode não ter body (via CRON)
        }

        // 1. Buscar pedidos "Melhor Envio" que têm código_rastreio que parece UUID (36 chars)
        let query = supabase
            .from("pedidos_consolidados_v3")
            .select("id, codigo_rastreio, melhor_envio_id, status_envio, logistica_provider")
            .eq("logistica_provider", "Melhor Envio")
            .in("status_envio", ["Processando", "Etiquetado", "Pago", "Etiqueta Gerada", "Postado"]); // Incluído 'Postado' para corrigir itens que o webhook marcou mas sem trocar o código

        if (reqBody && Array.isArray(reqBody.order_ids) && reqBody.order_ids.length > 0) {
            query = query.in("id", reqBody.order_ids);
        } else {
            // Regra do CRON: pegar todos os pendentes e etiquetados 
            query = query.or("status_envio.eq.Processando,status_envio.eq.Etiquetado,codigo_rastreio.not.is.null");
        }

        const { data: pedidosPendentes, error: dbError } = await query;

        if (dbError) throw dbError;

        if (!pedidosPendentes || pedidosPendentes.length === 0) {
            return new Response(JSON.stringify({ success: true, message: "Aviso: Nenhum UUID de Melhor Envio pendente encontrado no banco." }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // Filtra apenas pedidos cujo codigo_rastreio tem 36 caracteres (indício de UUID do carrinho/ordem do ME)
        let pedidosParaChecar = pedidosPendentes.filter(p => 
            p.codigo_rastreio && p.codigo_rastreio.length === 36
        );

        // Se não houver order_ids no corpo da requisição (CRON), aplica filtro adicional por status
        if (pedidosParaChecar.length > 0 && !reqBody?.order_ids?.length) {
            pedidosParaChecar = pedidosParaChecar.filter(p =>
                ['Processando', 'Etiquetado', 'Pago', 'Etiqueta Gerada', 'Postado'].includes(p.status_envio as string)
            );
            console.log('Pedidos filtrados por status:', pedidosParaChecar.length);
        }

        if (pedidosParaChecar.length === 0) {
             return new Response(JSON.stringify({ success: true, message: "Aviso: Nenhum código de rastreio pendente (UUID válido) encontrado." }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        const cartIds = pedidosParaChecar.map(p => p.codigo_rastreio);

        console.log(`Verificando rastreio para ${cartIds.length} pedidos. UUIDs: ${cartIds.join(", ")}`);

        // 2. Fazer request em massa para a API do Melhor Envio
        const meResponse = await fetch("https://www.melhorenvio.com.br/api/v2/me/shipment/tracking", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${melhorEnvioToken}`,
                "User-Agent": userAgent
            },
            body: JSON.stringify({
                orders: cartIds
            })
        });

        if (!meResponse.ok) {
            const errorText = await meResponse.text();
            throw new Error(`Erro na API do Melhor Envio: ${meResponse.status} - ${errorText}`);
        }

        const trackingData = await meResponse.json();
        console.log("ME API Tracking Data Received:", JSON.stringify(trackingData));
        
        let atualizados = 0;
        const detalhesAtualizacao = [];

        // trackingData pode ser um objeto { "uuid1": {...}, "uuid2": {...} } ou Array de objetos
        const registros = Array.isArray(trackingData) ? trackingData : [trackingData];

        for (const obj of registros) {
            for (const uuid of Object.keys(obj)) {
                const info = obj[uuid];

                // Caso 1: Temos o código de rastreio final (tracking)
                if (info && typeof info === 'object' && info.tracking && info.tracking !== uuid && info.tracking.length > 5) {
                    const pedido = pedidosParaChecar.find(p => p.codigo_rastreio === uuid);
                    
                    if (pedido) {
                        const updateData = {
                            codigo_rastreio: info.tracking, // Ex: LGI-ME2625R0XQ5BR
                            melhor_envio_id: uuid,          // Salva o UUID original para referência
                            status_envio: 'Postado',        // Isso moverá para a aba ENVIADOS (regra do sistema)
                            data_postagem: info.posted_at || new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };

                        const { error: updateError } = await supabase
                            .from('pedidos_consolidados_v3')
                            .update(updateData)
                            .eq('id', pedido.id);

                        if (updateError) {
                            throw new Error(`Erro ao atualizar pedido ${pedido.id}: ${updateError.message}`);
                        } else {
                            atualizados++;
                            detalhesAtualizacao.push({
                                pedido_id: pedido.id,
                                uuid: uuid,
                                novo_codigo: info.tracking,
                                status: 'Postado/Trackeado'
                            });
                        }
                    }
                } 
                // Caso 2: Ordem paga (released) mas ainda sem código de rastreio final
                else if (info && info.status === 'released' && (!info.tracking || info.tracking === uuid)) {
                    const pedido = pedidosParaChecar.find(p => p.codigo_rastreio === uuid);
                    if (pedido && pedido.status_envio !== 'Pago') {
                         await supabase
                            .from('pedidos_consolidados_v3')
                            .update({ 
                                status_envio: 'Pago',
                                observacao: `Etiqueta já paga, aguardando geração na Melhor Envio.`,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', pedido.id);
                        
                        detalhesAtualizacao.push({
                            pedido_id: pedido.id,
                            uuid: uuid,
                            status: 'Aguardando Geração (Pago)'
                        });
                    }
                }
                // Caso 3: Ordem ainda no carrinho ou pendente
                else {
                    detalhesAtualizacao.push({
                        uuid: uuid,
                        status: info?.status || 'Não iniciado/Pendente no ME'
                    });
                }
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Verificação concluída. ${atualizados} pedidos transferidos para 'Enviados'.`,
            pedidos_atualizados: atualizados,
            detalhes: detalhesAtualizacao
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        console.error("Erro no cron sync-melhor-envio-tracking:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            message: error.message || "Erro desconhecido na execução da rotina" 
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200, // Alterado para 200 para permitir leitura do erro do frontend
        });
    }
});
