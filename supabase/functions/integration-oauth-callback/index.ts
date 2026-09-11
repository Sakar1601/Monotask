// supabase/functions/integration-oauth-callback/index.ts
// Called directly by Google's browser redirect, so it never carries a
// Monotask Authorization header - the "state" row from oauth_states is
// what recovers which user started the flow. Runs entirely on the service
// role, since there is no user session to attach to a client.
import { createClient } from "npm:@supabase/supabase-js@2";
import { googleProvider } from "../_shared/integrations/google.ts";

// REQUIRED SECRET: APP_ORIGIN
//
// Set this in EVERY deployed environment to the origin of the Monotask web
// app, with no trailing slash - e.g.
//
//   supabase secrets set APP_ORIGIN=https://yourapp.com
//
// It is where the user is sent after Google OAuth consent. If it is unset,
// the fallback below uses this Edge Function's own origin, so a successful
// connect redirects to https://<project>.supabase.co/app - a 404. The
// fallback exists only so quick local testing works without configuration,
// where landing on a 404 after consent is harmless.
function appRedirect(req: Request, status: "connected" | "error"): Response {
  const origin = Deno.env.get("APP_ORIGIN") ?? new URL(req.url).origin;
  return Response.redirect(`${origin}/app?integration=${status}`, 302);
}

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return appRedirect(req, "error");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: stateRow, error: stateError } = await adminClient
      .from("oauth_states")
      .select("user_id, provider")
      .eq("state", state)
      .maybeSingle();
    if (stateError || !stateRow) return appRedirect(req, "error");

    // Consume the state token so it can't be replayed.
    await adminClient.from("oauth_states").delete().eq("state", state);

    if (stateRow.provider !== "google") return appRedirect(req, "error");

    const redirectUri = `${supabaseUrl}/functions/v1/integration-oauth-callback`;
    const tokens = await googleProvider.exchangeCode(code, redirectUri);

    const { error: upsertError } = await adminClient.from("integration_connections").upsert(
      {
        user_id: stateRow.user_id,
        provider: "google",
        status: "connected",
        calendar_sync_enabled: true,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt,
        scope: tokens.scope,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );
    if (upsertError) throw upsertError;

    return appRedirect(req, "connected");
  } catch (error) {
    console.error("integration-oauth-callback error:", error);
    return appRedirect(req, "error");
  }
});
