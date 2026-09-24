// supabase/functions/push-integration-change/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { providers } from "../_shared/integrations/registry.ts";
import type { EventChanges, TaskChanges } from "../_shared/integrations/types.ts";

interface PushBody {
  type: "task" | "event";
  action: "update" | "delete";
  connectionId: string;
  externalId: string;
  changes?: TaskChanges | EventChanges;
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as PushBody;
    if (!body.connectionId || !body.externalId || !body.type || !body.action) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify the connection actually belongs to the caller before ever
    // touching its tokens - this is the one security-critical check here.
    const { data: connection, error: connError } = await adminClient
      .from("integration_connections")
      .select("id, provider, access_token, refresh_token, expires_at, provider_metadata")
      .eq("id", body.connectionId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (connError) throw connError;
    if (!connection) {
      return new Response(JSON.stringify({ error: "Connection not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The token refresh lives inside this try alongside the push itself: a
    // refresh failure (e.g. the user revoked the Google grant) is just as
    // much a "could not sync this change" as a failed PATCH, and must be
    // recorded on the row rather than falling through to a generic 500 that
    // loses the real message.
    try {
      const provider = providers[connection.provider];
      let accessToken = connection.access_token;
      const expiresInMs = new Date(connection.expires_at).getTime() - Date.now();
      if (expiresInMs <= 60_000) {
        const tokens = await provider.refreshToken(connection.refresh_token);
        await adminClient
          .from("integration_connections")
          .update({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken || connection.refresh_token,
            expires_at: tokens.expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);
        accessToken = tokens.accessToken;
      }

      // Same generic, feature-detected resolve-and-cache pattern as
      // sync-integrations - a single failed push must not skip caching this,
      // or every subsequent push for the same connection re-resolves it.
      let providerMetadata = connection.provider_metadata;
      if (provider.resolveProviderMetadata && !providerMetadata) {
        providerMetadata = await provider.resolveProviderMetadata(accessToken);
        await adminClient
          .from("integration_connections")
          .update({ provider_metadata: providerMetadata })
          .eq("id", connection.id);
      }

      if (body.type === "event") {
        if (body.action === "delete") {
          await provider.deleteEvent(accessToken, body.externalId);
        } else {
          await provider.updateEvent(accessToken, body.externalId, (body.changes ?? {}) as EventChanges);
        }
      } else {
        if (body.action === "delete") {
          await provider.deleteTask(accessToken, body.externalId, providerMetadata);
        } else {
          await provider.updateTask(accessToken, body.externalId, (body.changes ?? {}) as TaskChanges, providerMetadata);
        }
      }
    } catch (pushError) {
      // Covers both a token-refresh failure and the push call itself.
      const message = pushError instanceof Error ? pushError.message : String(pushError);
      // Only meaningful to record on the row for "update" - a "delete" has
      // already removed the local row before this function was ever called.
      if (body.action === "update") {
        const table = body.type === "event" ? "events" : "tasks";
        await adminClient
          .from(table)
          .update({ sync_error: message })
          .eq("sync_connection_id", body.connectionId)
          .eq(body.type === "event" ? "external_event_id" : "external_task_id", body.externalId);
      }
      // Provider error text can carry internal detail, so it stays in the
      // logs and the row's sync_error; the caller gets a generic message.
      console.error("push-integration-change provider error:", pushError);
      return new Response(JSON.stringify({ error: "Sync with the provider failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "update") {
      const now = new Date().toISOString();
      const table = body.type === "event" ? "events" : "tasks";
      await adminClient
        .from(table)
        .update({ synced_at: now, last_seen_at: now, sync_error: null })
        .eq("sync_connection_id", body.connectionId)
        .eq(body.type === "event" ? "external_event_id" : "external_task_id", body.externalId);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("push-integration-change error:", error);
    return new Response(JSON.stringify({ error: "Push failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
