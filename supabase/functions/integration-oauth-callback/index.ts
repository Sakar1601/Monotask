// supabase/functions/integration-oauth-callback/index.ts
// Called directly by Google's browser redirect, so it never carries a
// Monotask Authorization header - the "state" row from oauth_states is
// what recovers which user started the flow. Runs entirely on the service
// role, since there is no user session to attach to a client.
import { createClient } from "npm:@supabase/supabase-js@2";
import { providers } from "../_shared/integrations/registry.ts";

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
function appRedirect(req: Request, status: "connected" | "error", provider?: string): Response {
  const origin = Deno.env.get("APP_ORIGIN") ?? new URL(req.url).origin;
  const params = new URLSearchParams({ integration: status });
  if (provider) params.set("provider", provider);
  return Response.redirect(`${origin}/app?${params.toString()}`, 302);
}

Deno.serve(async (req: Request) => {
  // Hoisted so the catch block can still name the provider in its error
  // redirect if the failure happened after the state row was resolved.
  let providerId: string | undefined;
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return appRedirect(req, "error");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: stateRow, error: stateError } = await adminClient
      .from("oauth_states")
      .select("user_id, provider, connection_id, requesting_message_scan")
      .eq("state", state)
      .maybeSingle();
    if (stateError || !stateRow) return appRedirect(req, "error");
    providerId = stateRow.provider;

    // Consume the state token so it can't be replayed.
    await adminClient.from("oauth_states").delete().eq("state", state);

    const provider = providers[stateRow.provider];
    if (!provider) return appRedirect(req, "error");

    // Must be byte-identical to the redirect_uri integration-oauth-start sent
    // in the original authorize request - see OAUTH_CALLBACK_URL's doc
    // comment there for why SUPABASE_URL alone isn't safe to use here.
    const redirectUri = Deno.env.get("OAUTH_CALLBACK_URL") ?? `${supabaseUrl}/functions/v1/integration-oauth-callback`;
    const tokens = await provider.exchangeCode(code, redirectUri);

    // Best-effort - shown in Settings so a user can tell which account is
    // connected, but never blocks the connect itself (e.g. a scope that
    // predates this feature, or a transient failure, just means no email
    // shows up for this connection).
    const accountEmail = provider.getAccountEmail
      ? await provider.getAccountEmail(tokens.accessToken).catch(() => null)
      : null;

    // A "Reconnect" flow carries the specific row it's for, so it updates
    // that row in place - a fresh "Connect" (or "Connect another
    // account") has none and always inserts a new row. Multiple accounts
    // per provider means there is no longer a (user_id, provider) key to
    // upsert on for telling these apart.
    const connectionFields = {
      status: "connected",
      calendar_sync_enabled: true,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt,
      scope: tokens.scope,
      // Only set on a successful fetch, so a reconnect that transiently
      // fails to re-fetch it doesn't blank out an email this connection
      // already had on record.
      ...(accountEmail ? { account_email: accountEmail } : {}),
      last_error: null,
      updated_at: new Date().toISOString(),
    };

    // Only flip the toggle on once the actually-granted scope (not just
    // what was requested) contains at least one message-scan scope this
    // provider uses - a user can decline part of a consent screen, and
    // the toggle should reflect reality, not intent. Requiring *every*
    // scope would wrongly block scanning for an account that can only
    // grant part of the set (e.g. a personal Microsoft account has no
    // Teams to grant Chat.Read for, but Mail.Read still works fine) -
    // scan-messages independently checks per-source availability, so
    // partial capability here is a real, useful outcome, not a failure.
    const messageScanGranted =
      stateRow.requesting_message_scan &&
      !!provider.messageScanScopes &&
      provider.messageScanScopes.split(" ").some((s) => (tokens.scope ?? "").split(" ").includes(s));

    if (messageScanGranted) {
      (connectionFields as Record<string, unknown>).message_scan_enabled = true;
    }

    if (stateRow.connection_id) {
      const { error: updateError } = await adminClient
        .from("integration_connections")
        .update(connectionFields)
        .eq("id", stateRow.connection_id)
        .eq("user_id", stateRow.user_id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await adminClient.from("integration_connections").insert({
        user_id: stateRow.user_id,
        provider: stateRow.provider,
        ...connectionFields,
      });
      if (insertError) throw insertError;
    }

    return appRedirect(req, "connected", stateRow.provider);
  } catch (error) {
    console.error("integration-oauth-callback error:", error);
    return appRedirect(req, "error", providerId);
  }
});
