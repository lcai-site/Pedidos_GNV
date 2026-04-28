import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autenticado", ok: false });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client do usuário requisitante
    const jwt = authHeader.replace("Bearer ", "");
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await client.auth.getUser(jwt);
    if (authError || !user) {
      return jsonResponse({ error: "Token inválido ou expirado", ok: false });
    }

    // Verificar se quem está chamando é um ADM ou Gestor
    const { data: profile } = await client
      .from("profiles")
      .select("role, ativo")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.ativo || (profile.role !== "adm" && profile.role !== "gestor")) {
      return jsonResponse({ error: "Apenas administradores e gestores podem convidar usuários.", ok: false });
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.action) {
      return jsonResponse({ error: "Ação não especificada", ok: false });
    }

    // Client ADMIN com Service Role Key para poder usar admin.inviteUserByEmail
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    if (body.action === "invite") {
      const { email, data } = body;
      
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: data // role, nome_completo, etc
      });

      if (inviteError) {
         if (inviteError.message.includes('already exists') || inviteError.status === 422) {
             return jsonResponse({ error: "Este email já está cadastrado em outra conta.", ok: false });
         }
         return jsonResponse({ error: inviteError.message, ok: false });
      }

      // Após o convite, atualizar a tabela profiles com as roles corretamente
      if (inviteData.user) {
        await adminClient.from('profiles').update({
          nome_completo: data.nome_completo,
          role: data.role,
          vendedora_nome: data.vendedora_nome || null,
          meta_mensal: data.meta_mensal || null,
          ativo: true
        }).eq('id', inviteData.user.id);
      }

      return jsonResponse({ user: inviteData.user, ok: true });
    } 
    else {
      return jsonResponse({ error: `Ação ${body.action} não suportada`, ok: false });
    }

  } catch (err: any) {
    console.error("Erro na edge function admin-users:", err);
    return jsonResponse({ error: err.message, ok: false });
  }
});
