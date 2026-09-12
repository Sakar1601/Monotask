# Two-Way Sync Push Mechanism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make editing, completing, or deleting a Google-origin task/event in Monotask push that change to Google immediately, while the existing 10-minute pull cycle stops clobbering unsynced local edits and self-heals any push that failed.

**Architecture:** A new `push-integration-change` Edge Function pushes a single task/event change to Google (update or delete), called fire-and-forget from `useTasks`/`useEvents` mutations right after the local write succeeds. `sync-integrations`'s pull logic gains a conflict check: a row with a pending local edit (`updated_at > synced_at`) is skipped rather than overwritten. A new `last_seen_at` column (separate from `synced_at`) is what the delete-stale logic keys off, since `updated_at` can no longer double as "touched by the sync engine this run" now that local edits also bump it.

**Tech Stack:** Supabase (Postgres + Edge Functions, Deno), React + TypeScript + `@tanstack/react-query`, Vitest for pure-function unit tests.

**Spec:** `docs/superpowers/specs/2026-09-10-two-way-sync-and-events-design.md` (Section 3), building on `docs/superpowers/plans/2026-09-10-two-way-sync-foundation.md` (already implemented and merged).

## Global Constraints

- Sync applies only to Google-origin items (`google_connection_id is not null`). Native tasks/events never call the push function. (Spec: Goals.)
- Conflict resolution is whole-record last-write-wins by timestamp, not per-field merging. (Spec: Section 3.)
- A failed push must not be a dead end: it self-heals via the next scheduled pull, with no separate retry queue. (Spec: Section 3.)
- A push failure must never block the UI — the local change is already visible; only a toast/indicator surfaces the failure. (Spec: Section 3, "Error handling".)
- **Design refinement beyond the spec's literal text, needed for correctness:** the spec's pull-conflict rule ("skip overwriting a row with pending local edits") interacts with the existing delete-stale mechanism in a way the spec didn't fully resolve. Before this plan, `updated_at` was safe to use as "did the sync engine touch this row this run" because nothing else ever changed it. Now that local edits also bump `updated_at` (to make the conflict check possible at all), `updated_at` can no longer double as the delete-stale signal — a skipped (locally-dirty) row's `updated_at` would look stale and get incorrectly deleted. This plan adds a `last_seen_at` column (Task 1) used only for the delete-stale check; `synced_at` continues to mean "content confirmed to match Google," bumped by both a successful pull-overwrite and a successful push.
- Follow this repo's existing Edge Function conventions (`corsHeaders`, `verify_jwt = false` + self-auth via `getUser()`, `Deno.env.get(...)!`) and hook conventions (`useMutation` + `onMutate`/`onSuccess` + toast, matching `useTasks.tsx`/`useEvents.tsx`'s existing shape).

---

## File Structure

**New:**
- `supabase/migrations/20260912120000-add-last-seen-at.sql` — `last_seen_at` column on `tasks`/`events`, backfilled from `synced_at`.
- `supabase/functions/push-integration-change/index.ts` — pushes one task/event change to Google.

**Modify:**
- `supabase/functions/_shared/integrations/types.ts` — `IntegrationProvider` gains `updateEvent`/`deleteEvent`/`updateTask`/`deleteTask`; new `EventChanges`/`TaskChanges` types.
- `supabase/functions/_shared/integrations/google.ts` — implements the four new methods.
- `supabase/functions/sync-integrations/index.ts` — `upsertEvents`/`upsertTasks` gain the conflict-skip check and switch their delete-stale cutoff from `updated_at` to `last_seen_at`.
- `supabase/config.toml` — add `[functions.push-integration-change] verify_jwt = false`.
- `src/hooks/useTasks.tsx` — `updateTaskMutation`/`deleteTaskMutation` fire the push call for Google-origin rows.
- `src/hooks/useEvents.tsx` — same for `updateEventMutation`/`deleteEventMutation`.
- `src/components/TaskManager.tsx` — `TaskCard` gets a small sync-error indicator.
- `src/components/EventsView.tsx` — event cards get a small sync-error indicator alongside the existing Google badge.
- `src/components/CalendarView.tsx` — the blue event badges get a small sync-error indicator.

No changes are needed to any component's *call sites* for delete (`TaskManager.tsx`, `DayTasksModal.tsx`, `EventsView.tsx` all still call `deleteTask(id)`/`deleteEvent(id)` exactly as today) — the push wiring reads the row's Google fields from the React Query cache via `onMutate`, entirely inside the two hooks.

---

### Task 1: `last_seen_at` column

**Files:**
- Create: `supabase/migrations/20260912120000-add-last-seen-at.sql`

**Interfaces:**
- Produces: `tasks.last_seen_at`, `events.last_seen_at` (timestamp with time zone, nullable).

- [ ] **Step 1: Write the migration**

```sql
-- Separate from synced_at (which means "content confirmed to match
-- Google") - last_seen_at means "this row was present in the most
-- recent successful fetch from Google", and is what the delete-stale
-- check in sync-integrations keys off. They diverge exactly when a row
-- has a pending local edit: the pull still confirms the row is present
-- in Google (last_seen_at bumps) without overwriting its content
-- (synced_at does NOT bump, since the local edit hasn't been confirmed
-- pushed yet).
alter table public.tasks add column last_seen_at timestamp with time zone;
alter table public.events add column last_seen_at timestamp with time zone;

update public.tasks set last_seen_at = synced_at where google_connection_id is not null;
update public.events set last_seen_at = synced_at where google_connection_id is not null;
```

- [ ] **Step 2: Apply and verify**

Apply via the repo's known manual-apply workaround (`supabase db reset` silently skips every migration due to the pre-existing, out-of-scope filename-convention mismatch documented in earlier plans):
```bash
docker exec -i supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres < supabase/migrations/20260912120000-add-last-seen-at.sql
docker exec supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres -c "\d tasks" | grep last_seen_at
docker exec supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres -c "\d events" | grep last_seen_at
```
Expected: both `\d` outputs show the new column.

- [ ] **Step 3: Regenerate Supabase types**

Run: `supabase gen types typescript --local > src/integrations/supabase/types.ts` (if this doesn't pick up the new column locally due to the same CLI/migration-naming issue, apply the migration via the manual method above first, then regenerate — matching how the foundation plan's Task 8 handled this).
Run: `npx tsc --noEmit` — no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260912120000-add-last-seen-at.sql src/integrations/supabase/types.ts
git commit -m "Add last_seen_at column for pull-side conflict resolution

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Google provider — write methods

**Files:**
- Modify: `supabase/functions/_shared/integrations/types.ts`
- Modify: `supabase/functions/_shared/integrations/google.ts`

**Interfaces:**
- Produces:
```typescript
export interface EventChanges {
  title?: string;
  description?: string | null;
  startTime?: string;
  endTime?: string | null;
  location?: string | null;
}
export interface TaskChanges {
  title?: string;
  dueDate?: string | null; // YYYY-MM-DD
  status?: "pending" | "completed";
}
// Added to IntegrationProvider:
updateEvent(accessToken: string, googleEventId: string, changes: EventChanges): Promise<void>;
deleteEvent(accessToken: string, googleEventId: string): Promise<void>;
updateTask(accessToken: string, googleTaskId: string, changes: TaskChanges): Promise<void>;
deleteTask(accessToken: string, googleTaskId: string): Promise<void>;
```

- [ ] **Step 1: Add the types**

In `supabase/functions/_shared/integrations/types.ts`, add:
```typescript
export interface EventChanges {
  title?: string;
  description?: string | null;
  startTime?: string;
  endTime?: string | null;
  location?: string | null;
}

export interface TaskChanges {
  title?: string;
  dueDate?: string | null; // YYYY-MM-DD
  status?: "pending" | "completed";
}
```
and add to `IntegrationProvider`:
```typescript
  updateEvent(accessToken: string, googleEventId: string, changes: EventChanges): Promise<void>;
  deleteEvent(accessToken: string, googleEventId: string): Promise<void>;
  updateTask(accessToken: string, googleTaskId: string, changes: TaskChanges): Promise<void>;
  deleteTask(accessToken: string, googleTaskId: string): Promise<void>;
```

- [ ] **Step 2: Implement in `google.ts`**

Add the import:
```typescript
import type { EventChanges, ExternalEvent, ExternalTask, IntegrationProvider, TaskChanges, TokenSet } from "./types.ts";
```
(replacing the existing import line that lists `ExternalEvent, ExternalTask, IntegrationProvider, TokenSet`).

Add the four methods to the `googleProvider` object, after `fetchTasks`:
```typescript
  async updateEvent(accessToken: string, googleEventId: string, changes: EventChanges): Promise<void> {
    const body: Record<string, unknown> = {};
    if (changes.title !== undefined) body.summary = changes.title;
    if (changes.description !== undefined) body.description = changes.description;
    if (changes.startTime !== undefined) body.start = { dateTime: changes.startTime };
    if (changes.endTime !== undefined) body.end = changes.endTime ? { dateTime: changes.endTime } : null;
    if (changes.location !== undefined) body.location = changes.location;

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) throw new Error(`Google event update failed: ${response.status} ${await response.text()}`);
  },

  async deleteEvent(accessToken: string, googleEventId: string): Promise<void> {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
    );
    // Google returns 410 Gone if the event was already deleted on their side -
    // treat that the same as success, since the end state (gone) matches.
    if (!response.ok && response.status !== 410) {
      throw new Error(`Google event delete failed: ${response.status} ${await response.text()}`);
    }
  },

  async updateTask(accessToken: string, googleTaskId: string, changes: TaskChanges): Promise<void> {
    const body: Record<string, unknown> = {};
    if (changes.title !== undefined) body.title = changes.title;
    if (changes.dueDate !== undefined) body.due = changes.dueDate ? `${changes.dueDate}T00:00:00.000Z` : null;
    if (changes.status !== undefined) body.status = changes.status === "completed" ? "completed" : "needsAction";

    const response = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${encodeURIComponent(googleTaskId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) throw new Error(`Google task update failed: ${response.status} ${await response.text()}`);
  },

  async deleteTask(accessToken: string, googleTaskId: string): Promise<void> {
    const response = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${encodeURIComponent(googleTaskId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok && response.status !== 410) {
      throw new Error(`Google task delete failed: ${response.status} ${await response.text()}`);
    }
  },
```

(Meeting location/URL: Calendar's `hangoutLink` is server-generated and not directly settable via this PATCH shape, so `meeting_url` edits made in Monotask are not pushed to Google in this plan — only `title`/`description`/`start`/`end`/`location` for events. This is a known, acceptable gap: `meeting_url` still displays correctly from whatever Google last set it to, it just can't be pushed back.)

- [ ] **Step 3: Write a test for the request shapes**

In `src/utils/googleIntegration.test.ts` (existing file from the foundation plan), add:
```typescript
describe('Google push mechanism', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends only the changed fields on task update, mapping status correctly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await googleProvider.updateTask('token', 'task-1', { status: 'completed' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/tasks/task-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ status: 'completed' });
  });

  it('treats a 410 on delete as success (already gone in Google)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 410 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(googleProvider.deleteTask('token', 'task-1')).resolves.toBeUndefined();
  });

  it('throws on a real delete failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('server error', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(googleProvider.deleteTask('token', 'task-1')).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npm test -- googleIntegration`
Expected: PASS (all three new tests, plus the existing ones in this file).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/integrations/types.ts supabase/functions/_shared/integrations/google.ts src/utils/googleIntegration.test.ts
git commit -m "Add Google Calendar/Tasks write methods to the provider

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `push-integration-change` Edge Function

**Files:**
- Create: `supabase/functions/push-integration-change/index.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: `googleProvider.updateEvent/deleteEvent/updateTask/deleteTask` from Task 2.
- Produces: `POST /functions/v1/push-integration-change` with body `{ type: "task" | "event", action: "update" | "delete", connectionId: string, externalId: string, changes?: TaskChanges | EventChanges }` (requires the caller's own `Authorization` header). On successful `update`, also updates the local row's `synced_at`/`last_seen_at`/`sync_error`.

- [ ] **Step 1: Write the function**

```typescript
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
```

- [ ] **Step 2: Update `supabase/config.toml`**

Add, alongside the other function entries:
```toml
# Invoked from the browser via supabase.functions.invoke(), which triggers
# a CORS preflight; the function does its own supabase.auth.getUser() check
# internally (same reasoning as integration-oauth-start).
[functions.push-integration-change]
verify_jwt = false
```

- [ ] **Step 3: Manual verification**

With a connected test account and a real synced task (from earlier testing), get a real user access token (same signup-curl recipe used in prior tasks), then:
```bash
curl -X POST http://127.0.0.1:54321/functions/v1/push-integration-change \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"type":"task","action":"update","connectionId":"<connection-id>","externalId":"<google-task-id>","changes":{"status":"completed"}}'
```
Expected: `{"success":true}`, and checking Google Tasks directly (or via a subsequent `fetchTasks` call) confirms the task shows completed there. Then verify ownership enforcement: repeat with a `connectionId` that doesn't belong to the test user (e.g. a random UUID) and confirm a 404, not a 200 or a crash.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/push-integration-change/index.ts supabase/config.toml
git commit -m "Add push-integration-change Edge Function

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Pull-side conflict resolution in `sync-integrations`

**Files:**
- Modify: `supabase/functions/sync-integrations/index.ts`

**Interfaces:**
- Consumes: `last_seen_at` from Task 1.
- Produces: `upsertEvents`/`upsertTasks` skip overwriting any row with `updated_at > synced_at` (a pending local edit), stamping `last_seen_at` on it anyway so it isn't deleted as stale; delete-stale now keys off `last_seen_at`, not `updated_at`.

- [ ] **Step 1: Update `upsertEvents`**

Replace the function with:
```typescript
async function upsertEvents(
  adminClient: ReturnType<typeof createClient>,
  connection: Connection,
  events: ExternalEvent[],
  syncStartedAt: string,
) {
  // Load existing rows for this connection to decide, per fetched event,
  // whether it has an unconfirmed local edit that should block overwrite.
  const { data: existingRows, error: existingError } = await adminClient
    .from("events")
    .select("google_event_id, updated_at, synced_at")
    .eq("google_connection_id", connection.id);
  if (existingError) throw existingError;
  const existingByExternalId = new Map((existingRows ?? []).map((r) => [r.google_event_id, r]));

  const toUpsert: Record<string, unknown>[] = [];
  const toTouch: string[] = []; // google_event_ids present in Google but skipped (pending local edit)

  for (const e of events) {
    const existing = existingByExternalId.get(e.externalId);
    const hasPendingLocalEdit = existing && existing.synced_at && new Date(existing.updated_at) > new Date(existing.synced_at);
    if (hasPendingLocalEdit) {
      toTouch.push(e.externalId);
      continue;
    }
    toUpsert.push({
      user_id: connection.user_id,
      google_connection_id: connection.id,
      google_event_id: e.externalId,
      title: e.title,
      start_time: e.startTime,
      end_time: e.endTime,
      meeting_url: e.meetingUrl,
      synced_at: syncStartedAt,
      last_seen_at: syncStartedAt,
      updated_at: syncStartedAt,
    });
  }

  if (toUpsert.length > 0) {
    const { error } = await adminClient.from("events").upsert(toUpsert, { onConflict: "google_connection_id,google_event_id" });
    if (error) throw error;
  }
  if (toTouch.length > 0) {
    // Confirm these rows are still present in Google (protects them from
    // the delete-stale check below) WITHOUT touching their content or
    // updated_at - only last_seen_at moves, so the pending-edit signal
    // (updated_at > synced_at) survives for the retry on the next pull.
    const { error } = await adminClient
      .from("events")
      .update({ last_seen_at: syncStartedAt })
      .eq("google_connection_id", connection.id)
      .in("google_event_id", toTouch);
    if (error) throw error;
  }

  // Anything for this connection not confirmed present in Google this run
  // (neither upserted nor touched above) is gone from Google.
  const { error: deleteError } = await adminClient
    .from("events")
    .delete()
    .eq("google_connection_id", connection.id)
    .or(`last_seen_at.is.null,last_seen_at.lt.${syncStartedAt}`);
  if (deleteError) throw deleteError;
}
```

- [ ] **Step 2: Update `upsertTasks`**

Replace the function with (keeping the existing priority-preservation lookup, extended to also read `updated_at`/`synced_at`):
```typescript
async function upsertTasks(
  adminClient: ReturnType<typeof createClient>,
  connection: Connection,
  tasks: ExternalTask[],
  syncStartedAt: string,
) {
  const existingByExternalId = new Map<string, { priority: string; updated_at: string; synced_at: string | null }>();
  const pageSize = 1_000;
  let offset = 0;
  while (true) {
    const { data: existingTasks, error: existingError } = await adminClient
      .from("tasks")
      .select("google_task_id, priority, updated_at, synced_at")
      .eq("google_connection_id", connection.id)
      .order("google_task_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (existingError) throw existingError;
    for (const task of existingTasks ?? []) {
      if (task.google_task_id) {
        existingByExternalId.set(task.google_task_id, {
          priority: task.priority,
          updated_at: task.updated_at,
          synced_at: task.synced_at,
        });
      }
    }
    if ((existingTasks?.length ?? 0) < pageSize) break;
    offset += pageSize;
  }

  const toUpsert: Record<string, unknown>[] = [];
  const toTouch: string[] = [];

  for (const t of tasks) {
    const existing = existingByExternalId.get(t.externalId);
    const hasPendingLocalEdit = existing?.synced_at && new Date(existing.updated_at) > new Date(existing.synced_at);
    if (hasPendingLocalEdit) {
      toTouch.push(t.externalId);
      continue;
    }
    toUpsert.push({
      user_id: connection.user_id,
      google_connection_id: connection.id,
      google_task_id: t.externalId,
      title: t.title,
      due_date: t.dueDate,
      status: t.status,
      completed_at: t.status === "completed" ? (t.completedAt ?? syncStartedAt) : null,
      priority: existing?.priority ?? "medium",
      synced_at: syncStartedAt,
      last_seen_at: syncStartedAt,
      updated_at: syncStartedAt,
    });
  }

  if (toUpsert.length > 0) {
    const { error } = await adminClient.from("tasks").upsert(toUpsert, { onConflict: "google_connection_id,google_task_id" });
    if (error) throw error;
  }
  if (toTouch.length > 0) {
    const { error } = await adminClient
      .from("tasks")
      .update({ last_seen_at: syncStartedAt })
      .eq("google_connection_id", connection.id)
      .in("google_task_id", toTouch);
    if (error) throw error;
  }

  const { error: deleteError } = await adminClient
    .from("tasks")
    .delete()
    .eq("google_connection_id", connection.id)
    .or(`last_seen_at.is.null,last_seen_at.lt.${syncStartedAt}`);
  if (deleteError) throw deleteError;
}
```

- [ ] **Step 3: Manual verification — the three cases that matter**

With a connected test account and a real synced task:
1. **Clean pull (no local edit):** trigger a sync twice in a row with no local changes in between. Confirm the task's `synced_at`/`last_seen_at`/`updated_at` all advance normally each time (unchanged behavior from before this task).
2. **Pending local edit blocks overwrite:** manually update the task's title directly in Postgres (`update tasks set title = 'local edit', updated_at = now() set ... ` — leave `synced_at` at its old value so `updated_at > synced_at` holds), then trigger a sync. Confirm the title is NOT reverted to Google's version, but `last_seen_at` DID advance to the new sync time (query `last_seen_at` before/after). Confirm the task was NOT deleted.
3. **Self-heal:** with the same locally-edited row from step 2, manually set `synced_at` to match `updated_at` (simulating a successful push, since Task 3's function isn't wired to the frontend yet in this task) and trigger another sync. Confirm the row IS now overwritten from Google's data (the pending-edit condition no longer holds).

```bash
docker exec supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres -c "select title, updated_at, synced_at, last_seen_at from tasks where google_connection_id is not null;"
```

Run `npx tsc --noEmit` — no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-integrations/index.ts
git commit -m "Add pull-side conflict resolution to sync-integrations

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Wire immediate push into `useTasks`

**Files:**
- Modify: `src/hooks/useTasks.tsx`

**Interfaces:**
- Consumes: `push-integration-change` from Task 3.

- [ ] **Step 1: Wire the update mutation**

In `src/hooks/useTasks.tsx`, in `updateTaskMutation`'s `onSuccess`, after the existing cache-update/invalidate/toast logic, add:
```typescript
      if (updatedTask.google_connection_id && updatedTask.google_task_id) {
        supabase.functions
          .invoke('push-integration-change', {
            body: {
              type: 'task',
              action: 'update',
              connectionId: updatedTask.google_connection_id,
              externalId: updatedTask.google_task_id,
              changes: {
                title: updatedTask.title,
                dueDate: updatedTask.due_date ?? null,
                status: updatedTask.status === 'completed' ? 'completed' : 'pending',
              },
            },
          })
          .then(({ error }) => {
            if (error) toast.error('Saved locally, but could not sync the change to Google');
          });
      }
```
(This is fire-and-forget — no `await`, and it runs after the success toast/cache update already happened, so the local UI never waits on it.)

- [ ] **Step 2: Wire the delete mutation**

Replace `deleteTaskMutation` with a version that snapshots the task's Google fields before the row is gone, via `onMutate`:
```typescript
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;
      return id;
    },
    onMutate: async (id: string) => {
      const existing = queryClient.getQueryData<Task[]>(['tasks', user?.id]);
      return { deletedTaskSnapshot: existing?.find((t) => t.id === id) };
    },
    onSuccess: (deletedId, _variables, context) => {
      queryClient.setQueryData(['tasks', user?.id], (oldTasks: Task[] = []) => {
        return oldTasks.filter(task => task.id !== deletedId);
      });

      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
      toast.success('Task deleted successfully');

      const snapshot = context?.deletedTaskSnapshot;
      if (snapshot?.google_connection_id && snapshot?.google_task_id) {
        supabase.functions
          .invoke('push-integration-change', {
            body: {
              type: 'task',
              action: 'delete',
              connectionId: snapshot.google_connection_id,
              externalId: snapshot.google_task_id,
            },
          })
          .then(({ error }) => {
            if (error) toast.error('Deleted locally, but could not delete it in Google');
          });
      }
    },
    onError: (error) => {
      console.error('Task deletion failed:', error);
      toast.error('Failed to delete task');
    },
  });
```
(No change to the mutation's public call signature — `deleteTask(id)` still takes just an id, so `TaskManager.tsx` and `DayTasksModal.tsx` need no changes at all.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — no errors.
Run: `npm test` — passing (this hook has no dedicated test file, matching its existing convention).

- [ ] **Step 3: Manual verification**

With a connected test account and a real synced task, run `npm run dev`, edit the task's title in TaskManager, save, and confirm (via `fetchTasks`/checking Google directly, or by re-triggering a sync and confirming the title stays as edited rather than reverting) that the push actually reached Google. Then delete a different synced task and confirm it's removed from Google too.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTasks.tsx
git commit -m "Push Google-origin task edits/deletes immediately

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Wire immediate push into `useEvents`

**Files:**
- Modify: `src/hooks/useEvents.tsx`

**Interfaces:**
- Consumes: `push-integration-change` from Task 3.

- [ ] **Step 1: Wire the update mutation**

In `updateEventMutation`'s `onSuccess`, after the existing cache-update/invalidate/toast logic, add:
```typescript
      if (updatedEvent.google_connection_id && updatedEvent.google_event_id) {
        supabase.functions
          .invoke('push-integration-change', {
            body: {
              type: 'event',
              action: 'update',
              connectionId: updatedEvent.google_connection_id,
              externalId: updatedEvent.google_event_id,
              changes: {
                title: updatedEvent.title,
                description: updatedEvent.description ?? null,
                startTime: updatedEvent.start_time,
                endTime: updatedEvent.end_time ?? null,
                location: updatedEvent.location ?? null,
              },
            },
          })
          .then(({ error }) => {
            if (error) toast.error('Saved locally, but could not sync the change to Google');
          });
      }
```

- [ ] **Step 2: Wire the delete mutation**

Replace `deleteEventMutation` with:
```typescript
  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id: string) => {
      const existing = queryClient.getQueryData<Event[]>(['events', user?.id]);
      return { deletedEventSnapshot: existing?.find((e) => e.id === id) };
    },
    onSuccess: (deletedId, _variables, context) => {
      queryClient.setQueryData(['events', user?.id], (oldEvents: Event[] = []) => {
        return oldEvents.filter((event) => event.id !== deletedId);
      });
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      toast.success('Event deleted successfully');

      const snapshot = context?.deletedEventSnapshot;
      if (snapshot?.google_connection_id && snapshot?.google_event_id) {
        supabase.functions
          .invoke('push-integration-change', {
            body: {
              type: 'event',
              action: 'delete',
              connectionId: snapshot.google_connection_id,
              externalId: snapshot.google_event_id,
            },
          })
          .then(({ error }) => {
            if (error) toast.error('Deleted locally, but could not delete it in Google');
          });
      }
    },
    onError: (error) => {
      console.error('Event deletion failed:', error);
      toast.error('Failed to delete event');
    },
  });
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — no errors. Run: `npm test` — passing.

- [ ] **Step 4: Manual verification**

Same pattern as Task 5: edit a synced event's title via `EventModal`, confirm it reaches Google; delete a synced event, confirm it's removed from Google too.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useEvents.tsx
git commit -m "Push Google-origin event edits/deletes immediately

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Sync-error indicator — `TaskManager`

**Files:**
- Modify: `src/components/TaskManager.tsx`

- [ ] **Step 1: Add the indicator**

In `TaskCard`'s JSX (inside `src/components/TaskManager.tsx`), in the badges row (the `<div className="flex items-center gap-3 mt-2 text-xs">` block that already renders priority/tag badges), add, right after the existing tag `Badge`:
```tsx
                {task.sync_error && (
                  <Badge
                    variant="outline"
                    className="text-xs border-red-300 text-red-700 dark:border-red-800 dark:text-red-300"
                    title={task.sync_error}
                  >
                    Sync failed
                  </Badge>
                )}
```

- [ ] **Step 2: Manual verification**

With a real synced task, manually set its `sync_error` column via `docker exec psql` (`update tasks set sync_error = 'Google API error: 403' where id = '<id>';`), reload TaskManager, confirm the red "Sync failed" badge renders with the error as a tooltip (hover title), and that it doesn't render for tasks with no `sync_error`.

- [ ] **Step 3: Commit**

```bash
git add src/components/TaskManager.tsx
git commit -m "Show a sync-failed indicator on task cards

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Sync-error indicator — `EventsView`

**Files:**
- Modify: `src/components/EventsView.tsx`

- [ ] **Step 1: Add the indicator**

In `src/components/EventsView.tsx`, right after the existing Google badge (`{event.google_connection_id && (...)}`), add:
```tsx
                  {event.sync_error && (
                    <span
                      className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200"
                      title={event.sync_error}
                    >
                      Sync failed
                    </span>
                  )}
```

- [ ] **Step 2: Manual verification**

Same pattern as Task 7: set `sync_error` on a real synced event, reload EventsView, confirm the badge appears.

- [ ] **Step 3: Commit**

```bash
git add src/components/EventsView.tsx
git commit -m "Show a sync-failed indicator on event cards

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Sync-error indicator — `CalendarView`

**Files:**
- Modify: `src/components/CalendarView.tsx`

- [ ] **Step 1: Add the indicator**

In both `renderWeekView` and `renderMonthView`, the event badge currently reads:
```tsx
                className="block w-full text-left text-xs p-1 rounded truncate bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200"
                title={event.title}
```
Change the `className` to conditionally add a red border when `event.sync_error` is set, and enrich the `title` tooltip:
```tsx
                className={`block w-full text-left text-xs p-1 rounded truncate bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 ${
                  event.sync_error ? 'ring-1 ring-red-500' : ''
                }`}
                title={event.sync_error ? `${event.title} (sync failed: ${event.sync_error})` : event.title}
```
(Apply this identical change in both `renderWeekView` and `renderMonthView`.)

- [ ] **Step 2: Manual verification**

Set `sync_error` on a real synced event via `docker exec psql`, open Calendar view, confirm the event badge shows a red ring and the tooltip includes the error text.

- [ ] **Step 3: Commit**

```bash
git add src/components/CalendarView.tsx
git commit -m "Show a sync-failed indicator on calendar event badges

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Post-plan smoke test

Once all 9 tasks are done, run through the full loop once end-to-end:
1. Edit a Google-origin task's title in TaskManager. Confirm it updates in Google (check directly, or via a manual sync showing no revert).
2. Complete a Google-origin task in Monotask. Confirm it shows completed in Google.
3. Delete a Google-origin event in Monotask. Confirm it's gone from Google Calendar.
4. Edit something directly in Google (e.g. a task's due date) and confirm the next 10-minute pull brings the change into Monotask, unless you also edited that same item locally in the meantime — in which case confirm the local edit wins (isn't overwritten) until it's successfully pushed.
5. Force a push failure (e.g. temporarily revoke the connection's access by clearing its `access_token` to garbage) and confirm: the local edit still shows immediately, a "Sync failed" indicator appears on the item, and restoring the connection then triggering a sync brings the local edit's content back in sync (the self-heal path).

This exercises every piece of the spec's Section 3 that this plan covers.
