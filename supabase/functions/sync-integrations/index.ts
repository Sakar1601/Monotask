import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { googleProvider } from "../_shared/integrations/google.ts";
import type { ExternalEvent, ExternalTask } from "../_shared/integrations/types.ts";

const WINDOW_DAYS_PAST = 1;
const WINDOW_DAYS_FUTURE = 30;

type Connection = {
  id: string;
  user_id: string;
  provider: "google";
  access_token: string;
  refresh_token: string;
  expires_at: string;
  calendar_sync_enabled: boolean;
};

async function ensureFreshToken(
  adminClient: ReturnType<typeof createClient>,
  connection: Connection,
): Promise<string> {
  const expiresInMs = new Date(connection.expires_at).getTime() - Date.now();
  if (expiresInMs > 60_000) return connection.access_token;

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
  return tokens.accessToken;
}

async function syncConnection(adminClient: ReturnType<typeof createClient>, connection: Connection) {
  try {
    const accessToken = await ensureFreshToken(adminClient, connection);
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_DAYS_PAST * 86_400_000);
    const windowEnd = new Date(now.getTime() + WINDOW_DAYS_FUTURE * 86_400_000);

    const [events, tasks] = await Promise.all([
      googleProvider.fetchEvents(accessToken, windowStart, windowEnd),
      googleProvider.fetchTasks(accessToken),
    ]);

    await upsertEvents(adminClient, connection.id, events);
    await upsertTasks(adminClient, connection.id, tasks);

    await adminClient
      .from("integration_connections")
      .update({ status: "connected", last_synced_at: new Date().toISOString(), last_error: null })
      .eq("id", connection.id);
  } catch (error) {
    console.error(`sync-integrations: connection ${connection.id} failed:`, error);
    await adminClient
      .from("integration_connections")
      .update({ status: "error", last_error: String(error) })
      .eq("id", connection.id);
  }
}

async function upsertEvents(adminClient: ReturnType<typeof createClient>, connectionId: string, events: ExternalEvent[]) {
  const seenIds = events.map((e) => e.externalId);
  if (events.length > 0) {
    const { error } = await adminClient.from("external_events").upsert(
      events.map((e) => ({
        connection_id: connectionId,
        external_id: e.externalId,
        title: e.title,
        start_time: e.startTime,
        end_time: e.endTime,
        meeting_url: e.meetingUrl,
        raw_payload: e.rawPayload,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "connection_id,external_id" },
    );
    if (error) throw error;
  }
  // Delete events for this connection that are no longer in the fetched window.
  let deleteQuery = adminClient.from("external_events").delete().eq("connection_id", connectionId);
  if (seenIds.length > 0) deleteQuery = deleteQuery.not("external_id", "in", `(${seenIds.map((id) => `"${id}"`).join(",")})`);
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;
}

async function upsertTasks(adminClient: ReturnType<typeof createClient>, connectionId: string, tasks: ExternalTask[]) {
  const seenIds = tasks.map((t) => t.externalId);
  if (tasks.length > 0) {
    const { error } = await adminClient.from("external_tasks").upsert(
      tasks.map((t) => ({
        connection_id: connectionId,
        external_id: t.externalId,
        title: t.title,
        due_date: t.dueDate,
        status: t.status,
        source_url: t.sourceUrl,
        raw_payload: t.rawPayload,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "connection_id,external_id" },
    );
    if (error) throw error;
  }
  let deleteQuery = adminClient.from("external_tasks").delete().eq("connection_id", connectionId);
  if (seenIds.length > 0) deleteQuery = deleteQuery.not("external_id", "in", `(${seenIds.map((id) => `"${id}"`).join(",")})`);
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Two legitimate caller types: the pg_cron job (using the service-role
    // key - the system syncing everything) and an end user's own "Sync now"
    // action (using their own session - syncing only their own connection).
    // Unlike the OAuth-callback function (a plain browser redirect with no
    // JWT at all), every real caller here is an API client that can send an
    // Authorization header, so we authenticate it ourselves since the
    // platform's verify_jwt gate is off (see config.toml comment).
    const authHeader = req.headers.get("Authorization");
    let authenticatedUserId: string | null = null;
    if (authHeader === `Bearer ${serviceRoleKey}`) {
      // System/cron caller - no per-user ownership filter needed below.
    } else {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
      authenticatedUserId = user.id;
    }

    let connectionId: string | null = null;
    try {
      const body = await req.json();
      connectionId = body?.connection_id ?? null;
    } catch {
      // No body (e.g. the cron invocation) - sync every active connection.
    }

    let query = adminClient
      .from("integration_connections")
      .select("id, user_id, provider, access_token, refresh_token, expires_at, calendar_sync_enabled")
      .eq("calendar_sync_enabled", true)
      .neq("status", "disconnected");
    if (connectionId) query = query.eq("id", connectionId);
    if (authenticatedUserId) query = query.eq("user_id", authenticatedUserId);

    const { data: connections, error } = await query;
    if (error) throw error;

    for (const connection of (connections ?? []) as Connection[]) {
      await syncConnection(adminClient, connection);
    }

    return new Response(JSON.stringify({ synced: connections?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("sync-integrations error:", error);
    return new Response(JSON.stringify({ error: "Sync failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
