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
  scope: string | null;
};

const REQUIRED_SCOPES = ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/tasks"];

function hasWriteScopes(scope: string | null): boolean {
  if (!scope) return false;
  const granted = scope.split(" ");
  return REQUIRED_SCOPES.every((required) => granted.includes(required));
}

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
  if (!hasWriteScopes(connection.scope)) {
    await adminClient
      .from("integration_connections")
      .update({ status: "needs_reconnect" })
      .eq("id", connection.id);
    return;
  }
  // Stamped onto every row this run touches, and used as the cutoff for
  // deleting rows the run did NOT touch (i.e. items no longer in Google).
  const syncStartedAt = new Date().toISOString();
  try {
    const accessToken = await ensureFreshToken(adminClient, connection);
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_DAYS_PAST * 86_400_000);
    const windowEnd = new Date(now.getTime() + WINDOW_DAYS_FUTURE * 86_400_000);

    const [events, tasks] = await Promise.all([
      googleProvider.fetchEvents(accessToken, windowStart, windowEnd),
      googleProvider.fetchTasks(accessToken),
    ]);

    await upsertEvents(adminClient, connection, events, syncStartedAt);
    await upsertTasks(adminClient, connection, tasks, syncStartedAt);

    await adminClient
      .from("integration_connections")
      .update({ status: "connected", last_synced_at: new Date().toISOString(), last_error: null })
      .eq("id", connection.id);
  } catch (error) {
    console.error(`sync-integrations: connection ${connection.id} failed:`, error);
    await adminClient
      .from("integration_connections")
      .update({
        status: "error",
        last_error: error instanceof Error ? error.message : JSON.stringify(error),
      })
      .eq("id", connection.id);
  }
}

async function upsertEvents(
  adminClient: ReturnType<typeof createClient>,
  connection: Connection,
  events: ExternalEvent[],
  syncStartedAt: string,
) {
  if (events.length > 0) {
    const { error } = await adminClient.from("events").upsert(
      events.map((e) => ({
        user_id: connection.user_id,
        google_connection_id: connection.id,
        google_event_id: e.externalId,
        title: e.title,
        start_time: e.startTime,
        end_time: e.endTime,
        meeting_url: e.meetingUrl,
        synced_at: syncStartedAt,
        updated_at: syncStartedAt,
      })),
      { onConflict: "google_connection_id,google_event_id" },
    );
    if (error) throw error;
  }
  // Same timestamp-cutoff stale delete as before the retarget - anything
  // for this connection not touched by the upsert above is gone from
  // Google. If `events` is empty nothing was stamped, so this correctly
  // clears every previously-synced event for this connection.
  const { error: deleteError } = await adminClient
    .from("events")
    .delete()
    .eq("google_connection_id", connection.id)
    .lt("updated_at", syncStartedAt);
  if (deleteError) throw deleteError;
}

async function upsertTasks(
  adminClient: ReturnType<typeof createClient>,
  connection: Connection,
  tasks: ExternalTask[],
  syncStartedAt: string,
) {
  if (tasks.length > 0) {
    const { error } = await adminClient.from("tasks").upsert(
      tasks.map((t) => ({
        user_id: connection.user_id,
        google_connection_id: connection.id,
        google_task_id: t.externalId,
        title: t.title,
        due_date: t.dueDate,
        status: t.status,
        priority: "medium",
        synced_at: syncStartedAt,
        updated_at: syncStartedAt,
      })),
      { onConflict: "google_connection_id,google_task_id" },
    );
    if (error) throw error;
  }
  // Same timestamp-cutoff stale delete pattern as upsertEvents. Because
  // fetchTasks now requests showCompleted=true (Task 3), a task completed
  // in Google still appears in this run's fetch (status: 'completed') and
  // is NOT deleted here - only a task actually removed/unshared in Google
  // is now absent and gets cleaned up.
  const { error: deleteError } = await adminClient
    .from("tasks")
    .delete()
    .eq("google_connection_id", connection.id)
    .lt("updated_at", syncStartedAt);
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
      .select("id, user_id, provider, access_token, refresh_token, expires_at, calendar_sync_enabled, scope")
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
