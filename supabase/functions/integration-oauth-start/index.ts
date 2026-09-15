// supabase/functions/integration-oauth-start/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { providers } from "../_shared/integrations/registry.ts";
import { oauthRedirectUriFor } from "../integration-oauth-callback/oauthCallbackSecurity.ts";

// OAuth should redirect to the browser app, not directly to the Edge Function:
// the app then calls integration-oauth-callback with the current Monotask JWT.
// That binds completion to the user who is actually signed in, preventing a
// transferred attacker-owned authorize URL from attaching a victim provider
// account to the attacker's tenant.
function redirectUriFor(supabaseUrl: string): string {
  return oauthRedirectUriFor({
    appOrigin: Deno.env.get("APP_ORIGIN"),
    oauthCallbackUrl: Deno.env.get("OAUTH_CALLBACK_URL"),
    supabaseUrl,
  });
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

    const { provider, connectionId, requestMessageScanScopes } = await req.json();
    if (!providers[provider]) {
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

    // "Reconnect" on an existing connection passes its id, so the callback
    // updates that exact row instead of inserting a new one - verify it's
    // actually this user's own connection (and this provider's) before
    // trusting it, since a forged id would otherwise let a caller attach
    // their new tokens to someone else's connection row.
    let verifiedConnectionId: string | null = null;
    if (connectionId) {
      const { data: existing } = await adminClient
        .from("integration_connections")
        .select("id")
        .eq("id", connectionId)
        .eq("user_id", user.id)
        .eq("provider", provider)
        .maybeSingle();
      verifiedConnectionId = existing?.id ?? null;
    }

    // requestMessageScanScopes is only meaningful alongside a
    // connectionId - enabling scanning is a toggle on an existing
    // connection, never part of creating a new one. If a caller sends
    // it without a verified connectionId, it's silently ignored rather
    // than requesting scopes with nowhere to attach the result.
    const extraScopes =
      requestMessageScanScopes && verifiedConnectionId
        ? providers[provider].messageScanScopes
        : undefined;

    const state = crypto.randomUUID();
    const { error: insertError } = await adminClient.from("oauth_states").insert({
      state,
      user_id: user.id,
      provider,
      connection_id: verifiedConnectionId,
      requesting_message_scan: !!extraScopes,
    });
    if (insertError) throw insertError;

    const url = providers[provider].getAuthUrl(state, redirectUriFor(supabaseUrl), extraScopes);

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
