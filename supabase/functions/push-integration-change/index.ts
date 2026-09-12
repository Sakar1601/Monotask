// supabase/functions/push-integration-change/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { googleProvider } from "../_shared/integrations/google.ts";
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
      .select("id, access_token, refresh_token, expires_at")
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

    let accessToken = connection.access_token;
    const expiresInMs = new Date(connection.expires_at).getTime() - Date.now();
    if (expiresInMs <= 60_000) {
      const tokens = await googleProvider.refreshToken(connection.refresh_token);
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

    try {
      if (body.type === "event") {
        if (body.action === "delete") {
          await googleProvider.deleteEvent(accessToken, body.externalId);
        } else {
          await googleProvider.updateEvent(accessToken, body.externalId, (body.changes ?? {}) as EventChanges);
        }
      } else {
        if (body.action === "delete") {
          await googleProvider.deleteTask(accessToken, body.externalId);
        } else {
          await googleProvider.updateTask(accessToken, body.externalId, (body.changes ?? {}) as TaskChanges);
        }
      }
    } catch (pushError) {
      const message = pushError instanceof Error ? pushError.message : String(pushError);
      // Only meaningful to record on the row for "update" - a "delete" has
      // already removed the local row before this function was ever called.
      if (body.action === "update") {
        const table = body.type === "event" ? "events" : "tasks";
        await adminClient
          .from(table)
          .update({ sync_error: message })
          .eq("google_connection_id", body.connectionId)
          .eq(body.type === "event" ? "google_event_id" : "google_task_id", body.externalId);
      }
      return new Response(JSON.stringify({ error: message }), {
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
        .eq("google_connection_id", body.connectionId)
        .eq(body.type === "event" ? "google_event_id" : "google_task_id", body.externalId);
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
