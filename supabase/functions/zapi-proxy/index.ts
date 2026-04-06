import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper: sempre retorna 200 com JSON
// supabase.functions.invoke trata qualquer non-2xx como exceção
function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ==========================================
    // Autenticação manual: verificar se o usuário
    // está logado e é adm (sem depender do JWT gateway)
    // ==========================================
    const authHeader = req.headers.get("Authorization");
    console.log(`[zapi-proxy] Auth header presente: ${!!authHeader}, formato: ${authHeader?.substring(0, 15)}...`);

    if (!authHeader) {
      return jsonResponse({ error: "Não autenticado — header Authorization ausente", ok: false });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Extrair o JWT puro do header "Bearer <token>"
    const jwt = authHeader.replace("Bearer ", "");

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verificar sessão — passar JWT diretamente pois getUser()
    // não lê de global.headers (apenas queries de banco usam isso)
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    console.log(`[zapi-proxy] getUser result: user=${user?.email || 'null'}, error=${authError?.message || 'none'}`);

    if (authError || !user) {
      return jsonResponse({
        error: "Token JWT inválido ou expirado. Faça logout e login novamente.",
        detail: authError?.message || "Usuário não encontrado",
        ok: false,
      });
    }

    // Verificar se é adm (apenas adm pode usar Z-API configurator)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, ativo")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.ativo) {
      return jsonResponse({ error: "Sua conta está inativa.", ok: false });
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return jsonResponse({ error: "Body JSON inválido", ok: false });
    }

    let { action, instance_id, token, client_token, phone, message } = body;

    // Ações administrativas exigem ser ADM
    const adminActions = ['qr-code', 'status', 'disconnect', 'qr-code-image'];
    if (adminActions.includes(action) && profile.role !== "adm") {
      return jsonResponse({ error: "Apenas administradores podem usar esta função config", ok: false });
    }

    // Se instance_id e token não vieram no body (como no caso do Chat de Atendentes),
    // Puxa do banco usando o Service Role ignorando RLS.
    if (!instance_id || !token) {
       const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
       const { data: config } = await serviceClient.from('zapi_config').select('*').limit(1).single();
       if (config) {
          instance_id = config.instance_id;
          token = config.token;
          client_token = config.client_token;
       }
    }

    if (!instance_id || !token) {
      return jsonResponse({ error: "instance_id e token são obrigatórios (ou não configurados no banco)", ok: false });
    }

    if (!action) {
      return jsonResponse({ error: "action é obrigatório", ok: false });
    }

    const baseUrl = `https://api.z-api.io/instances/${instance_id}/token/${token}`;
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (client_token) {
      headers["Client-Token"] = client_token;
    }

    let zapiUrl = "";
    let method = "GET";
    let bodyReq = undefined;

    switch (action) {
      case "qr-code":
        zapiUrl = `${baseUrl}/qr-code`;
        break;
      case "status":
        zapiUrl = `${baseUrl}/status`;
        break;
      case "disconnect":
        zapiUrl = `${baseUrl}/disconnect`;
        break;
      case "qr-code-image":
        zapiUrl = `${baseUrl}/qr-code/image`;
        break;
      case "send-text":
        zapiUrl = `${baseUrl}/send-text`;
        method = "POST";
        bodyReq = JSON.stringify({ phone, message });
        break;
      default:
        return jsonResponse({ error: `Ação '${action}' não suportada`, ok: false });
    }

    console.log(`[zapi-proxy] user=${user.email} action=${action} -> ${zapiUrl}`);

    const response = await fetch(zapiUrl, { method, headers, body: bodyReq });

    console.log(`[zapi-proxy] Z-API respondeu: ${response.status}`);

    // Para imagem: Z-API /qr-code/image retorna base64 como TEXTO,
    // não como binário. Ler como text e usar diretamente.
    if (action === "qr-code-image") {
      const responseText = await response.text().catch(() => "");

      if (!response.ok) {
        console.log(`[zapi-proxy] Erro imagem: ${responseText}`);
        return jsonResponse({
          error: `Z-API retornou ${response.status}`,
          detail: responseText,
          ok: false,
        });
      }

      console.log(`[zapi-proxy] qr-code-image content-type: ${response.headers.get("content-type")}`);
      console.log(`[zapi-proxy] qr-code-image response length: ${responseText.length}`);

      // Verificar se a resposta é JSON (pode indicar erro ou status)
      const trimmed = responseText.trim();
      if (trimmed.startsWith("{")) {
        try {
          const jsonData = JSON.parse(trimmed);
          // Se contém campo de imagem em base64
          if (jsonData.value) {
            return jsonResponse({
              image: jsonData.value.startsWith("data:")
                ? jsonData.value
                : `data:image/png;base64,${jsonData.value}`,
              ok: true,
            });
          }
          // Se indica que já está conectado
          if (jsonData.connected) {
            return jsonResponse({ connected: true, ok: true });
          }
          // Outro JSON — pode ser erro
          return jsonResponse({ ...jsonData, ok: false, error: jsonData.error || "Resposta inesperada da Z-API" });
        } catch {
          // Não é JSON válido, continua como base64
        }
      }

      // Resposta é base64 puro — usar diretamente
      // Remover possíveis quebras de linha/espaços
      const base64Clean = trimmed.replace(/\s/g, "");

      if (!base64Clean) {
        return jsonResponse({ error: "Z-API retornou resposta vazia para QR Code", ok: false });
      }

      // Se já contém o prefixo data:image, usar direto
      const image = base64Clean.startsWith("data:")
        ? base64Clean
        : `data:image/png;base64,${base64Clean}`;

      return jsonResponse({ image, ok: true });
    }

    // Para JSON (status, qr-code, disconnect)
    const responseText = await response.text().catch(() => "{}");
    console.log(`[zapi-proxy] Response: ${responseText.substring(0, 500)}`);

    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    if (!response.ok) {
      return jsonResponse({
        ...data,
        ok: false,
        zapi_status: response.status,
        error: data.error || data.message || `Z-API retornou ${response.status}`,
        // Diagnóstico temporário para debug
        _debug: {
          instance_id_used: instance_id,
          instance_id_length: instance_id.length,
          token_length: token.length,
          client_token_present: !!client_token,
          url_called: zapiUrl,
        },
      });
    }

    return jsonResponse({ ...data, ok: true });

  } catch (error) {
    console.error("[zapi-proxy] Erro:", error);
    return jsonResponse({
      error: error.message || "Erro interno no proxy",
      ok: false,
    });
  }
});
