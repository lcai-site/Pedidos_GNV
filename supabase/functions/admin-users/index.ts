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

function normalizeEmail(email: unknown) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Nao autenticado", ok: false });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const jwt = authHeader.replace("Bearer ", "");
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await client.auth.getUser(jwt);
    if (authError || !user) {
      return jsonResponse({ error: "Token invalido ou expirado", ok: false });
    }

    const { data: profile } = await client
      .from("profiles")
      .select("role, ativo")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.ativo || (profile.role !== "adm" && profile.role !== "gestor")) {
      return jsonResponse({ error: "Apenas administradores e gestores podem gerenciar usuarios.", ok: false });
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.action) {
      return jsonResponse({ error: "Acao nao especificada", ok: false });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    if (body.action === "invite") {
      const email = normalizeEmail(body.email);
      const data = body.data || {};

      if (!email) {
        return jsonResponse({ error: "Email invalido.", ok: false });
      }

      if (!data.nome_completo || !data.role) {
        return jsonResponse({ error: "Nome e cargo sao obrigatorios.", ok: false });
      }

      if (!["atendente", "gestor", "adm"].includes(data.role)) {
        return jsonResponse({ error: "Cargo invalido.", ok: false });
      }

      if (profile.role !== "adm" && data.role === "adm") {
        return jsonResponse({ error: "Apenas administradores podem criar outros administradores.", ok: false });
      }

      const origin = req.headers.get("Origin") || undefined;
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data,
        redirectTo: origin,
      });

      if (inviteError) {
        if (inviteError.message.includes("already exists") || inviteError.status === 422) {
          return jsonResponse({ error: "Este email ja esta cadastrado em outra conta.", ok: false });
        }

        return jsonResponse({ error: inviteError.message, ok: false });
      }

      if (inviteData.user) {
        await adminClient
          .from("profiles")
          .delete()
          .eq("email", email)
          .neq("id", inviteData.user.id);

        const { error: profileError } = await adminClient.from("profiles").upsert({
          id: inviteData.user.id,
          email,
          nome_completo: data.nome_completo,
          role: data.role,
          vendedora_nome: data.vendedora_nome || null,
          meta_mensal: data.meta_mensal || null,
          ativo: true,
        });

        if (profileError) {
          return jsonResponse({ error: profileError.message, ok: false });
        }
      }

      return jsonResponse({ user: inviteData.user, ok: true });
    }

    if (body.action === "delete") {
      if (profile.role !== "adm") {
        return jsonResponse({ error: "Apenas administradores podem excluir usuarios.", ok: false });
      }

      const userId = typeof body.userId === "string" ? body.userId : "";
      if (!userId) {
        return jsonResponse({ error: "Usuario nao informado.", ok: false });
      }

      if (userId === user.id) {
        return jsonResponse({ error: "Nao e possivel excluir o proprio usuario.", ok: false });
      }

      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteAuthError && deleteAuthError.status !== 404) {
        return jsonResponse({ error: deleteAuthError.message, ok: false });
      }

      const { error: deleteProfileError } = await adminClient
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (deleteProfileError) {
        return jsonResponse({ error: deleteProfileError.message, ok: false });
      }

      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: `Acao ${body.action} nao suportada`, ok: false });
  } catch (err: any) {
    console.error("Erro na edge function admin-users:", err);
    return jsonResponse({ error: err.message, ok: false });
  }
});
