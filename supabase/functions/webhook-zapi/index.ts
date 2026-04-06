import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Usamos Service Role pois Webhook não tem JWT local
    )

    // A Z-API manda o payload inteiro no body
    const payload = await req.json()
    console.log("📥 Recebido Z-API Webhook:", JSON.stringify(payload, null, 2))

    // Validar se é uma mensagem viável (ignora recebimentos de status)
    if (!payload.phone || !payload.messageId) {
      return new Response(JSON.stringify({ ok: true, message: 'Not a message event, ignoring.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Limpar o telefone para remover sufixos como @lid, @c.us, @g.us
    const rawPhone = payload.phone || '';
    const phone = rawPhone.split('@')[0];
    const isFromMe = payload.fromMe === true;
    
    // Ignorar eventos que o próprio sistema envia via proxy para evitar loop duplicado
    if (isFromMe) {
         return new Response(JSON.stringify({ ok: true, message: 'Outbound message, ignoring loop.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         })
    }

    // Extrair o conteúdo da mensagem (Texto, Imagem, Audio)
    let tipoMsg = 'text';
    let conteudoMsg = '';

    if (payload.text && typeof payload.text === 'string') {
       tipoMsg = 'text';
       conteudoMsg = payload.text;
    } else if (payload.text && payload.text.message) {
      tipoMsg = 'text';
      conteudoMsg = payload.text.message;
    } else if (payload.message && typeof payload.message === 'string') {
      tipoMsg = 'text';
      conteudoMsg = payload.message;
    } else if (payload.audio && payload.audio.audioUrl) {
      tipoMsg = 'audio';
      conteudoMsg = payload.audio.audioUrl;
    } else if (payload.image && payload.image.imageUrl) {
      tipoMsg = 'image';
      conteudoMsg = payload.image.imageUrl;
    } else if (payload.document && payload.document.documentUrl) {
      tipoMsg = 'document';
      conteudoMsg = payload.document.documentUrl;
    } else if (payload.type === 'Text') {
      tipoMsg = 'text';
      conteudoMsg = JSON.stringify(payload); // Fallback para debug
    } else {
      tipoMsg = 'other';
      conteudoMsg = 'Formato suportado não identificado. Payload: ' + JSON.stringify(payload).substring(0, 100);
    }

    // 1. Procurar atendimento ativo ('novo' ou 'em_andamento') para este número
    let { data: atendimentos, error: findError } = await supabaseClient
      .from('crm_atendimentos')
      .select('id, responsavel_id')
      .eq('telefone', phone)
      .in('status', ['novo', 'em_andamento'])
      .order('ultima_mensagem_em', { ascending: false })
      .limit(1);

    if (findError) throw findError;

    let atendimentoId;

    if (!atendimentos || atendimentos.length === 0) {
      // 2. Não achou ticket ativo? Cria um 'novo'!
      // Vamos tentar buscar o nome se o cliente tiver um pedido anterior (OPCIONAL, podemos melhorar depois)
      let { data: pedidoAnterior } = await supabaseClient
         .from('pedidos_consolidados_v3')
         .select('nome_cliente')
         .eq('telefone', phone)
         .limit(1);
         
      const clienteNome = (pedidoAnterior && pedidoAnterior.length > 0) ? pedidoAnterior[0].nome_cliente : payload.senderName || 'Cliente';

      const { data: novoAtendimento, error: createError } = await supabaseClient
        .from('crm_atendimentos')
        .insert({
          telefone: phone,
          cliente_nome: clienteNome,
          status: 'novo'
        })
        .select('id')
        .single();

      if (createError) throw createError;
      atendimentoId = novoAtendimento.id;
    } else {
      // Usa o ticket ativo
      atendimentoId = atendimentos[0].id;
    }

    // 3. Salvar a Mensagem
    const { error: msgError } = await supabaseClient
      .from('crm_mensagens')
      .insert({
        atendimento_id: atendimentoId,
        zapi_message_id: payload.messageId,
        direcao: 'in',
        tipo: tipoMsg,
        conteudo: conteudoMsg,
        status_envio: 'entregue'
      });

    if (msgError) {
      // Tratar caso seja mensagem duplicada (já salva)
      if (msgError.code === '23505') {
         return new Response(JSON.stringify({ ok: true, message: 'Message already saved.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
      }
      throw msgError;
    }

    return new Response(JSON.stringify({ ok: true, message: 'Z-API Webhook Processed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error("Z-API Webhook Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
