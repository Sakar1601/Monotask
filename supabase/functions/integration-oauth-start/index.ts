// supabase/functions/integration-oauth-start/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { googleProvider } from "../_shared/integrations/google.ts";

function redirectUriFor(supabaseUrl: string): string {
  return `${supabaseUrl}/functions/v1/integration-oauth-callback`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { provider } = await req.json();
    if (provider !== "google") {
      return new Response(JSON.stringify({ error: "Unsupported provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client to write oauth_states, which has no client policies.
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const state = crypto.randomUUID();
    const { error: insertError } = await adminClient.from("oauth_states").insert({
      state,
      user_id: user.id,
      provider,
    });
    if (insertError) throw insertError;

    const url = googleProvider.getAuthUrl(state, redirectUriFor(supabaseUrl));

    return new Response(JSON.stringify({ url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("integration-oauth-start error:", error);
    return new Response(JSON.stringify({ error: "Failed to start OAuth flow" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
