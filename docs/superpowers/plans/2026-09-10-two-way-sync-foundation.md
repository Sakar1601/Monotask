# Two-Way Sync Foundation (Native Events + Real-Table Migration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the read-only `external_events`/`external_tasks` mirror tables in favor of a native `events` object and sync columns directly on `tasks`, so Google-origin items become genuine, fully-editable Monotask rows — with every existing feature (overdue detection, completion display, filters, exports) applying to them automatically. Sync stays pull-only in this plan (the immediate push-to-Google mechanism is a separate follow-up plan).

**Architecture:** New `events` table plus three new columns on `tasks` (`google_connection_id`, `google_task_id`/`google_event_id`, `synced_at`, `sync_error`). A one-time data migration copies existing mirror-table rows into the real tables, then drops the mirror tables. `sync-integrations` is retargeted to upsert into `tasks`/`events` instead of the mirror tables. A native Events feature (Sidebar entry, list view, create/edit modal, CRUD hook) is built following the exact patterns already established by Tasks. The OAuth scope upgrades from readonly to read+write, with a `needs_reconnect` connection status and Settings banner for the one already-connected account whose old scope no longer suffices.

**Tech Stack:** Supabase (Postgres + Edge Functions, Deno), React + TypeScript + `@tanstack/react-query`, Vitest for pure-function unit tests (this repo's established convention — Edge Functions and components are verified manually, matching every existing one).

**Spec:** `docs/superpowers/specs/2026-09-10-two-way-sync-and-events-design.md`

## Global Constraints

- Sync stays pull-only in this plan. No immediate push, no `push-integration-change` function, no `updated_at`-vs-`synced_at` conflict-skip logic — that's the next plan, layered on top of this one's schema. (Spec: Non-goals / roadmap.)
- Google-origin items must be indistinguishable from native items to every *existing* feature (overdue detection, completion display, filters, search, exports) — no separate code path for them once this plan ships. (Spec: Goals.)
- Sync applies only to Google-origin items. Creating a native task or event never creates anything in Google. (Spec: Goals.)
- `googleProvider`'s scopes change from `calendar.readonly`/`tasks.readonly` to full `calendar`/`tasks`. Existing connections are detected dynamically (by inspecting the stored `scope` column on each sync run, not a one-time migration script) and flagged `needs_reconnect` rather than failing silently. (Spec: Section 2.)
- `fetchTasks` must request `showCompleted=true` (not the previous `false`) as part of this plan's schema retargeting — with `tasks` now the real table, leaving the old `showCompleted=false` behavior would mean completing a task in Google silently *deletes the real task row* on the next sync (the delete-stale logic still fires), which is a regression this foundation must not introduce even though full completion-status *sync* is a later plan's job. Deletion-on-absence stays exactly as before; only what counts as "present" changes.
- **Execution ordering note:** the local `pg_cron` job (`sync-integrations-every-10-min`) stays active throughout this plan's execution. Between Task 2 (drops `external_events`/`external_tasks`) and Task 4 (retargets `sync-integrations` to the new tables), a cron firing would hit the old code referencing now-dropped tables and fail for any connected account — recoverable (the connection's `status` becomes `'error'`, self-heals once Task 4 lands and the next sync succeeds) but worth executing Tasks 2-4 without a long gap between them, and not worth adding extra machinery to prevent given this is pre-production, single-account local development.
- Follow this repo's existing conventions throughout: `corsHeaders` from `supabase/functions/_shared/cors.ts`, RLS scoped by `auth.uid() = user_id` (no new policy shape needed — new columns on already-correctly-scoped tables), React Query hook shape matching `useTasks.tsx` (`useQuery` + `useMutation` + `useQueryClient`, toast on success/error), Tailwind classes matching the light/dark patterns already used in `TaskManager.tsx`/`TagsView.tsx`/`TaskModal.tsx`.

---

## File Structure

**New:**
- `supabase/migrations/20260911120000-events-and-task-sync-columns.sql` — `events` table, sync columns on `tasks`, `needs_reconnect` added to `integration_connections.status`.
- `supabase/migrations/20260911120100-migrate-external-items-and-drop-mirrors.sql` — one-time data copy from `external_events`/`external_tasks` into `events`/`tasks`, then drops both mirror tables.
- `src/hooks/useEvents.tsx` — CRUD hook for `events`, mirroring `useTasks.tsx`.
- `src/components/EventModal.tsx` — create/edit form for an event, mirroring `TaskModal.tsx`.
- `src/components/EventsView.tsx` — list view for events, mirroring `TagsView.tsx`'s structure.

**Modify:**
- `src/hooks/useTasks.tsx` — `Task` interface gains `google_connection_id`, `google_task_id`, `synced_at`, `sync_error` (all optional/nullable; read-only additions, no new mutation logic).
- `src/components/Sidebar.tsx` — add an "Events" nav entry.
- `src/pages/Index.tsx` — add the `'events'` case to `renderCurrentView`.
- `src/components/CalendarView.tsx` — replace `useExternalEvents` + the read-only blue-badge link rendering with `useEvents` + clickable, editable event rendering (opens `EventModal`).
- `src/components/Dashboard.tsx` — remove `useExternalEvents`/`useExternalTasks` and the "From your connected apps" section entirely; Google-origin tasks now appear automatically in the existing Upcoming Tasks / Recently Completed lists since they're real `tasks` rows.
- `src/components/IntegrationsSettings.tsx` — add the `needs_reconnect` banner and reconnect action.
- `src/components/Settings.tsx` — pass `events` into the export functions; CSV export gains an EVENTS section.
- `src/utils/dataPortability.ts` — `ExportedTask` gains `source`; new `ExportedEvent` type; `buildExportData` takes `events` and returns them; import validation updated (backward-compatible — missing `source`/`events` on an older export file is treated as `'monotask'`/`[]`).
- `src/utils/pdfExport.ts` — task lines get a `[Google]` suffix when Google-origin; new Events section.
- `supabase/functions/_shared/integrations/google.ts` — `GOOGLE_SCOPES` upgraded to write scopes; `fetchTasks` requests `showCompleted=true`.
- `supabase/functions/sync-integrations/index.ts` — `upsertEvents`/`upsertTasks` retargeted to the `events`/`tasks` tables (new column names, `user_id` now required); scope-check added to `syncConnection` to set `needs_reconnect`.

**Deleted (as part of Task 2's migration, and Task 11 removing their last references):**
- `src/hooks/useExternalEvents.tsx`, `src/hooks/useExternalTasks.tsx` — retired; nothing reads `external_events`/`external_tasks` after this plan.

---

### Task 1: Schema — `events` table, `tasks` sync columns, `needs_reconnect` status

**Files:**
- Create: `supabase/migrations/20260911120000-events-and-task-sync-columns.sql`

**Interfaces:**
- Produces: table `public.events(id, user_id, title, description, start_time, end_time, location, meeting_url, tag_id, google_connection_id, google_event_id, synced_at, sync_error, created_at, updated_at)`; new columns on `public.tasks`: `google_connection_id`, `google_task_id`, `synced_at`, `sync_error`; `integration_connections.status` check constraint gains `'needs_reconnect'`.

- [ ] **Step 1: Write the migration**

```sql
-- New: native events (Monotask's own object; Google-origin events live here
-- too, distinguished only by google_connection_id/google_event_id being set).
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  description text,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone,
  location text,
  meeting_url text,
  tag_id uuid references public.tags on delete set null,
  -- Sync metadata - all null for a purely-native event.
  google_connection_id uuid references public.integration_connections on delete set null,
  google_event_id text,
  synced_at timestamp with time zone,
  sync_error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (google_connection_id, google_event_id)
);

alter table public.events enable row level security;

create policy "Users can view their own events"
  on public.events for select using (auth.uid() = user_id);
create policy "Users can create their own events"
  on public.events for insert with check (auth.uid() = user_id);
create policy "Users can update their own events"
  on public.events for update using (auth.uid() = user_id);
create policy "Users can delete their own events"
  on public.events for delete using (auth.uid() = user_id);

create index idx_events_user_start on public.events(user_id, start_time);

-- tasks gets the same shape of sync metadata as events, so a Google-origin
-- task and a Google-origin event are handled identically by the sync engine.
alter table public.tasks
  add column google_connection_id uuid references public.integration_connections on delete set null,
  add column google_task_id text,
  add column synced_at timestamp with time zone,
  add column sync_error text;

alter table public.tasks
  add constraint tasks_google_unique unique (google_connection_id, google_task_id);

-- A connection whose granted scope no longer covers what the app needs
-- (the write-scope upgrade in Task 3 makes every currently-connected
-- account's old readonly scope insufficient) is paused here rather than
-- left to fail with a generic "error" - the user gets a clear reconnect
-- prompt instead (Task 10).
alter table public.integration_connections drop constraint integration_connections_status_check;
alter table public.integration_connections
  add constraint integration_connections_status_check
  check (status in ('connected', 'expired', 'error', 'disconnected', 'needs_reconnect'));
```

- [ ] **Step 2: Apply and verify locally**

Run: `supabase db reset` (or, given this repo's known migration-filename/CLI mismatch — see any earlier task's report for the workaround — apply directly: `docker exec -i supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres < supabase/migrations/20260911120000-events-and-task-sync-columns.sql`).
Expected: no errors. Then verify:
```bash
docker exec supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres -c "\d events"
docker exec supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres -c "\d tasks" | grep google
docker exec supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres -c "select conname, pg_get_constraintdef(oid) from pg_constraint where conname = 'integration_connections_status_check';"
```
Expected: `events` table exists with all listed columns; `tasks` shows the four new columns; the status check constraint's definition includes `needs_reconnect`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260911120000-events-and-task-sync-columns.sql
git commit -m "Add events table and sync columns on tasks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Migrate existing mirror-table data, drop `external_events`/`external_tasks`

**Files:**
- Create: `supabase/migrations/20260911120100-migrate-external-items-and-drop-mirrors.sql`

**Interfaces:**
- Consumes: `public.events`, `public.tasks.google_connection_id/google_task_id/synced_at` from Task 1; `public.external_events`, `public.external_tasks` (existing, from the shipped integration).
- Produces: every existing `external_events` row copied into `events`; every existing `external_tasks` row copied into `tasks`; both mirror tables dropped.

- [ ] **Step 1: Write the migration**

```sql
-- One-time copy: external_events -> events. The mirror row's connection_id
-- already carries the owning user indirectly via integration_connections;
-- join to it for user_id since events.user_id is NOT NULL.
insert into public.events (
  user_id, title, start_time, end_time, meeting_url,
  google_connection_id, google_event_id, synced_at, created_at, updated_at
)
select
  c.user_id,
  ee.title,
  ee.start_time,
  ee.end_time,
  ee.meeting_url,
  ee.connection_id,
  ee.external_id,
  ee.updated_at,
  ee.created_at,
  ee.updated_at
from public.external_events ee
join public.integration_connections c on c.id = ee.connection_id;

-- One-time copy: external_tasks -> tasks. priority has no equivalent on the
-- Google side, so every migrated task defaults to 'medium' (matches this
-- plan's default for newly-synced tasks going forward, set in Task 4).
insert into public.tasks (
  user_id, title, due_date, status, priority,
  google_connection_id, google_task_id, synced_at, created_at, updated_at
)
select
  c.user_id,
  et.title,
  et.due_date,
  et.status,
  'medium',
  et.connection_id,
  et.external_id,
  et.updated_at,
  et.created_at,
  et.updated_at
from public.external_tasks et
join public.integration_connections c on c.id = et.connection_id;

drop table public.external_events;
drop table public.external_tasks;
```

- [ ] **Step 2: Apply and verify**

Before applying, capture the pre-migration row counts for comparison:
```bash
docker exec supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres -c "select count(*) from external_events; select count(*) from external_tasks;"
```
Apply the migration (same manual-apply approach as Task 1's Step 2 if `supabase db reset` doesn't pick it up), then verify:
```bash
docker exec supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres -c "select count(*) from events where google_connection_id is not null;"
docker exec supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres -c "select count(*) from tasks where google_connection_id is not null;"
docker exec supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres -c "\dt external_events" 2>&1
```
Expected: the two counts match the pre-migration `external_events`/`external_tasks` counts exactly, and the final `\dt` command reports the table does not exist (confirming the drop).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260911120100-migrate-external-items-and-drop-mirrors.sql
git commit -m "Migrate external_events/external_tasks data into real tables

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Google provider — write scopes and `showCompleted=true`

**Files:**
- Modify: `supabase/functions/_shared/integrations/google.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `googleProvider.getAuthUrl` now requests write-capable scopes; `googleProvider.fetchTasks` returns completed tasks too.

- [ ] **Step 1: Update the scopes**

In `supabase/functions/_shared/integrations/google.ts`, change:
```typescript
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/tasks.readonly",
].join(" ");
```
to:
```typescript
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/tasks",
].join(" ");
```

- [ ] **Step 2: Fetch completed tasks too**

In the same file, in `fetchTasks`, change the request URL from:
```typescript
"https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=false&maxResults=100"
```
to:
```typescript
"https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=true&maxResults=100"
```

- [ ] **Step 3: Manual verification**

Run: `deno check supabase/functions/_shared/integrations/google.ts` if Deno is available in this environment; otherwise, a careful read confirming both string changes are exactly as above is the fallback (this repo has no automated test harness for Edge Functions — matching every other one).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/integrations/google.ts
git commit -m "Upgrade Google scopes to write access; fetch completed tasks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Retarget `sync-integrations` to the real tables

**Files:**
- Modify: `supabase/functions/sync-integrations/index.ts`

**Interfaces:**
- Consumes: `events`/`tasks` sync columns from Task 1; `googleProvider` from Task 3.
- Produces: `upsertEvents`/`upsertTasks` now write to `public.events`/`public.tasks`; `syncConnection` sets `status = 'needs_reconnect'` when the connection's stored `scope` lacks the write scopes, without attempting any Google call.

- [ ] **Step 1: Add a scope check before syncing**

In `supabase/functions/sync-integrations/index.ts`, the `Connection` type needs `scope`:
```typescript
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
```
Add a helper above `syncConnection`:
```typescript
const REQUIRED_SCOPES = ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/tasks"];

function hasWriteScopes(scope: string | null): boolean {
  if (!scope) return false;
  const granted = scope.split(" ");
  return REQUIRED_SCOPES.every((required) => granted.includes(required));
}
```
At the top of `syncConnection`, before `ensureFreshToken` is called:
```typescript
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
    // ... existing body unchanged from here
```
(Keep the existing `try`/`catch` body exactly as-is beneath this new guard — only the guard and the `Connection` type gain the `scope` field.)

- [ ] **Step 2: Select `scope` in the main handler's query**

In the `Deno.serve` handler, change the `.select(...)` call to include `scope`:
```typescript
.select("id, user_id, provider, access_token, refresh_token, expires_at, calendar_sync_enabled, scope")
```

- [ ] **Step 3: Retarget `upsertEvents` to `events`**

Replace the function with:
```typescript
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
```

- [ ] **Step 4: Retarget `upsertTasks` to `tasks`**

Replace the function with:
```typescript
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
```

- [ ] **Step 5: Update the two call sites**

In `syncConnection`, change:
```typescript
await upsertEvents(adminClient, connection.id, events, syncStartedAt);
await upsertTasks(adminClient, connection.id, tasks, syncStartedAt);
```
to:
```typescript
await upsertEvents(adminClient, connection, events, syncStartedAt);
await upsertTasks(adminClient, connection, tasks, syncStartedAt);
```

- [ ] **Step 6: Manual verification**

With a connected test account (or a connection row inserted directly for a real local test user, matching the approach used to verify the original `sync-integrations` function), trigger a sync and confirm:
```bash
curl -X POST http://127.0.0.1:54321/functions/v1/sync-integrations -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -H "Content-Type: application/json" -d '{}'
docker exec supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres -c "select title, google_task_id, priority, status from tasks where google_connection_id is not null;"
docker exec supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres -c "select title, google_event_id, start_time from events where google_connection_id is not null;"
```
Expected: rows appear in the real `tasks`/`events` tables (not `external_tasks`/`external_events`, which no longer exist), with `priority = 'medium'` on synced tasks. Also verify the scope-check guard: manually clear a connection's `scope` column to an old readonly value, re-run the sync, and confirm its `status` becomes `needs_reconnect` without any Google API call being attempted (check the function's logs show no fetch attempt for that connection).

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/sync-integrations/index.ts
git commit -m "Retarget sync-integrations to write into tasks/events

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `useTasks` gains sync metadata fields

**Files:**
- Modify: `src/hooks/useTasks.tsx`

**Interfaces:**
- Produces: `Task` interface gains `google_connection_id?: string | null`, `google_task_id?: string | null`, `synced_at?: string | null`, `sync_error?: string | null`.

- [ ] **Step 1: Extend the `Task` interface**

In `src/hooks/useTasks.tsx`, add to the `Task` interface (after `tags?: { name: string; color: string };`):
```typescript
  google_connection_id?: string | null;
  google_task_id?: string | null;
  synced_at?: string | null;
  sync_error?: string | null;
```

No other change in this file — `select('*')` in the existing query already returns these columns once Task 1's migration has run; `createTaskMutation`'s `Omit<Task, 'id' | 'created_at' | 'updated_at' | 'tags' | 'user_id'>` type still works unchanged since these new fields are optional and a native task creation simply omits them (they default to `null` at the database level).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTasks.tsx
git commit -m "Add sync metadata fields to the Task interface

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `useEvents` hook

**Files:**
- Create: `src/hooks/useEvents.tsx`

**Interfaces:**
- Produces:
```typescript
export interface Event {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  location?: string;
  meeting_url?: string;
  tag_id?: string;
  google_connection_id?: string | null;
  google_event_id?: string | null;
  synced_at?: string | null;
  sync_error?: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  tags?: { name: string; color: string };
}
export const useEvents: () => {
  events: Event[];
  isLoading: boolean;
  error: unknown;
  createEvent: (data: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'tags' | 'user_id'>) => void;
  createEventAsync: (data: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'tags' | 'user_id'>) => Promise<Event>;
  updateEvent: (data: Partial<Event> & { id: string }) => void;
  deleteEvent: (id: string) => void;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
};
```

- [ ] **Step 1: Write the hook**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Event {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  location?: string;
  meeting_url?: string;
  tag_id?: string;
  google_connection_id?: string | null;
  google_event_id?: string | null;
  synced_at?: string | null;
  sync_error?: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  tags?: { name: string; color: string };
}

export const useEvents = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['events', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          tags:tag_id (name, color)
        `)
        .eq('user_id', user.id)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data as Event[];
    },
    enabled: !!user,
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'tags' | 'user_id'>) => {
      if (!user) throw new Error('User not authenticated');

      const processedEventData = {
        ...eventData,
        end_time: eventData.end_time || null,
        location: eventData.location || null,
        meeting_url: eventData.meeting_url || null,
        tag_id: eventData.tag_id || null,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('events')
        .insert([processedEventData])
        .select(`
          *,
          tags:tag_id (name, color)
        `)
        .single();

      if (error) throw error;
      return data as Event;
    },
    onSuccess: (newEvent) => {
      queryClient.setQueryData(['events', user?.id], (oldEvents: Event[] = []) => {
        return [...oldEvents, newEvent].sort((a, b) => a.start_time.localeCompare(b.start_time));
      });
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      toast.success('Event created successfully');
    },
    onError: (error) => {
      console.error('Event creation failed:', error);
      toast.error('Failed to create event');
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, tags, ...updates }: Partial<Event> & { id: string }) => {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          tags:tag_id (name, color)
        `)
        .single();

      if (error) throw error;
      return data as Event;
    },
    onSuccess: (updatedEvent) => {
      queryClient.setQueryData(['events', user?.id], (oldEvents: Event[] = []) => {
        return oldEvents.map((event) => (event.id === updatedEvent.id ? updatedEvent : event));
      });
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      toast.success('Event updated successfully');
    },
    onError: (error) => {
      console.error('Event update failed:', error);
      toast.error('Failed to update event');
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData(['events', user?.id], (oldEvents: Event[] = []) => {
        return oldEvents.filter((event) => event.id !== deletedId);
      });
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      toast.success('Event deleted successfully');
    },
    onError: (error) => {
      console.error('Event deletion failed:', error);
      toast.error('Failed to delete event');
    },
  });

  return {
    events,
    isLoading,
    error,
    createEvent: createEventMutation.mutate,
    createEventAsync: createEventMutation.mutateAsync,
    updateEvent: updateEventMutation.mutate,
    deleteEvent: deleteEventMutation.mutate,
    isCreating: createEventMutation.isPending,
    isUpdating: updateEventMutation.isPending,
    isDeleting: deleteEventMutation.isPending,
  };
};
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — no errors.
Run: `npm test` — 35/35 still passing (this hook has no dedicated test file, matching `useTasks.tsx`'s existing convention).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useEvents.tsx
git commit -m "Add useEvents hook

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `EventModal` component

**Files:**
- Create: `src/components/EventModal.tsx`

**Interfaces:**
- Consumes: `useEvents` from Task 6; `TagSelector` (existing).

- [ ] **Step 1: Write the component**

```tsx
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEvents, Event } from '@/hooks/useEvents';
import TagSelector from './TagSelector';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: Event | null;
  prefilledDate?: string;
}

const toDateTimeLocal = (isoString?: string) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, event, prefilledDate }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    location: '',
    meeting_url: '',
    tag_id: '',
  });

  const { createEvent, updateEvent, isCreating, isUpdating } = useEvents();

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        description: event.description || '',
        start_time: toDateTimeLocal(event.start_time),
        end_time: toDateTimeLocal(event.end_time),
        location: event.location || '',
        meeting_url: event.meeting_url || '',
        tag_id: event.tag_id || '',
      });
    } else if (prefilledDate) {
      setFormData({
        title: '',
        description: '',
        start_time: `${prefilledDate}T09:00`,
        end_time: '',
        location: '',
        meeting_url: '',
        tag_id: '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        location: '',
        meeting_url: '',
        tag_id: '',
      });
    }
  }, [event, prefilledDate, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const eventData = {
      title: formData.title,
      description: formData.description || undefined,
      start_time: new Date(formData.start_time).toISOString(),
      end_time: formData.end_time ? new Date(formData.end_time).toISOString() : undefined,
      location: formData.location || undefined,
      meeting_url: formData.meeting_url || undefined,
      tag_id: formData.tag_id || undefined,
    };

    if (event) {
      updateEvent({ id: event.id, ...eventData });
    } else {
      createEvent(eventData);
    }

    onClose();
  };

  const isGoogleOrigin = !!event?.google_connection_id;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-black dark:text-white">
            {event ? 'Edit Event' : 'Create Event'}
            {isGoogleOrigin && (
              <span className="ml-2 text-xs font-normal text-blue-600 dark:text-blue-400">(from Google)</span>
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              placeholder="Event title"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              required
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-black dark:text-white"
            />
          </div>

          <div>
            <Textarea
              placeholder="Description (optional)"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-black dark:text-white resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start</label>
              <Input
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData((prev) => ({ ...prev, start_time: e.target.value }))}
                required
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-black dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End (optional)</label>
              <Input
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => setFormData((prev) => ({ ...prev, end_time: e.target.value }))}
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-black dark:text-white"
              />
            </div>
          </div>

          <div>
            <Input
              placeholder="Location (optional)"
              value={formData.location}
              onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-black dark:text-white"
            />
          </div>

          <div>
            <Input
              placeholder="Meeting link (optional)"
              value={formData.meeting_url}
              onChange={(e) => setFormData((prev) => ({ ...prev, meeting_url: e.target.value }))}
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-black dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2">Tag</label>
            <TagSelector
              value={formData.tag_id}
              onChange={(value) => setFormData((prev) => ({ ...prev, tag_id: value }))}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-gray-300 dark:border-gray-700 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating || isUpdating}
              className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
            >
              {isCreating || isUpdating ? 'Saving...' : event ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EventModal;
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — no errors.
Run `npm run dev`, open the app, and (once Task 9 wires this modal into a view) confirm it renders both create and edit modes. If Task 9 isn't done yet, temporarily render `<EventModal isOpen={true} onClose={() => {}} />` anywhere to visually check it, then remove the temporary render.

- [ ] **Step 3: Commit**

```bash
git add src/components/EventModal.tsx
git commit -m "Add EventModal component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: `EventsView` component

**Files:**
- Create: `src/components/EventsView.tsx`

**Interfaces:**
- Consumes: `useEvents` from Task 6; `EventModal` from Task 7.

- [ ] **Step 1: Write the component**

```tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Calendar as CalendarIcon, MapPin, Link as LinkIcon, Pencil } from 'lucide-react';
import { useEvents, Event } from '@/hooks/useEvents';
import EventModal from './EventModal';

const EventsView: React.FC = () => {
  const { events, isLoading, deleteEvent, isDeleting } = useEvents();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const handleCreate = () => {
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white mb-2">Events</h1>
          <p className="text-gray-600 dark:text-gray-400">Meetings and calendar events, including ones synced from Google</p>
        </div>
        <Button onClick={handleCreate} className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200">
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
          <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No events yet</p>
          <p className="text-sm">Create one, or connect Google Calendar in Settings</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-start justify-between p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <button type="button" className="flex-1 text-left" onClick={() => handleEdit(event)}>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-black dark:text-white">{event.title}</h3>
                  {event.google_connection_id && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
                      Google
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {new Date(event.start_time).toLocaleString()}
                  {event.end_time && ` – ${new Date(event.end_time).toLocaleString()}`}
                </div>
                {event.location && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {event.location}
                  </div>
                )}
                {event.meeting_url && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                    <LinkIcon className="h-3 w-3" /> {event.meeting_url}
                  </div>
                )}
                {event.tags && (
                  <span
                    className="inline-block mt-2 px-2 py-1 text-xs rounded text-white"
                    style={{ backgroundColor: event.tags.color }}
                  >
                    {event.tags.name}
                  </span>
                )}
              </button>
              <div className="flex items-center gap-2 ml-4">
                <Button variant="outline" size="sm" onClick={() => handleEdit(event)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isDeleting}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 border-gray-300 dark:border-gray-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-black dark:text-white">Delete Event</AlertDialogTitle>
                      <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
                        Are you sure you want to delete "{event.title}"?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-gray-300 dark:border-gray-700 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteEvent(event.id)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Delete Event
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      <EventModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
      />
    </div>
  );
};

export default EventsView;
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/EventsView.tsx
git commit -m "Add EventsView component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Wire Events into the Sidebar and app navigation

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/pages/Index.tsx`

**Interfaces:**
- Consumes: `EventsView` from Task 8.

- [ ] **Step 1: Add the Sidebar entry**

In `src/components/Sidebar.tsx`, add `CalendarClock` (or reuse `Calendar` with a different icon to avoid visual duplication with the existing Calendar entry — use `CalendarClock` from `lucide-react`) to the imports, then add an entry to `menuItems` right after `'calendar'`:
```typescript
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'events', label: 'Events', icon: CalendarClock },
```

- [ ] **Step 2: Wire the view**

In `src/pages/Index.tsx`, add the import:
```typescript
import EventsView from "@/components/EventsView";
```
and add a case to `renderCurrentView`:
```typescript
      case 'events':
        return <EventsView />;
```
(placed alongside the existing `case 'calendar':` line).

- [ ] **Step 3: Manual verification**

Run `npm run dev`, click "Events" in the Sidebar, confirm `EventsView` renders, "Add Event" opens `EventModal`, and creating an event shows it in the list.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx src/pages/Index.tsx
git commit -m "Add Events to Sidebar navigation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: `CalendarView` — replace read-only external events with editable `events`

**Files:**
- Modify: `src/components/CalendarView.tsx`

**Interfaces:**
- Consumes: `useEvents` from Task 6; `EventModal` from Task 7.

- [ ] **Step 1: Replace the import and hook call**

In `src/components/CalendarView.tsx`, replace:
```typescript
import { useExternalEvents } from '@/hooks/useExternalEvents';
```
with:
```typescript
import { useEvents, Event } from '@/hooks/useEvents';
import EventModal from './EventModal';
```
and replace:
```typescript
  const { events: externalEvents } = useExternalEvents();
```
with:
```typescript
  const { events } = useEvents();
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
```

- [ ] **Step 2: Update the date-filter helper's source array**

Change:
```typescript
  const getExternalEventsForDate = (dateString: string) =>
    externalEvents.filter((event) => {
```
to:
```typescript
  const getEventsForDate = (dateString: string) =>
    events.filter((event) => {
```
(keep the body of the function — the local-date comparison logic — exactly as it is; only the function name and source array change). Update the two call sites in `renderWeekView`/`renderMonthView` from `getExternalEventsForDate(dateString)` to `getEventsForDate(dateString)`.

- [ ] **Step 3: Make the rendered event clickable/editable instead of a read-only link**

In both `renderWeekView` and `renderMonthView`, replace the external-event `<a>` block:
```tsx
            {getExternalEventsForDate(dateString).slice(0, 2).map((event) => (
              <a
                key={event.id}
                href={event.meeting_url ?? undefined}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="block text-xs p-1 rounded truncate bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200"
                title={`${event.title} (Google Calendar)`}
              >
                {event.title}
              </a>
            ))}
```
with:
```tsx
            {getEventsForDate(dateString).slice(0, 2).map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingEvent(event);
                  setIsEventModalOpen(true);
                }}
                className="block w-full text-left text-xs p-1 rounded truncate bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200"
                title={event.title}
              >
                {event.title}
              </button>
            ))}
```
(identical in both `renderWeekView` and `renderMonthView` — apply the same replacement in both places.)

- [ ] **Step 4: Render the modal**

Near the existing `<TaskModal .../>` and `<DayTasksModal .../>` at the bottom of the component's JSX, add:
```tsx
      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => {
          setIsEventModalOpen(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
      />
```

- [ ] **Step 5: Manual verification**

Run `npx tsc --noEmit` — no errors. Run `npm test` — 35/35 still passing. Run `npm run dev`, open Calendar view with at least one event (native or Google-origin, from Task 9's manual test), confirm clicking it opens `EventModal` in edit mode (not a new tab), and that `stopPropagation` still prevents the day-cell click handler from also firing (matches the original PR #14 behavior, just with a different action on click).

- [ ] **Step 6: Commit**

```bash
git add src/components/CalendarView.tsx
git commit -m "Make calendar events editable instead of read-only links

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: `Dashboard` — remove the read-only external-items section; retire the two old hooks

**Files:**
- Modify: `src/components/Dashboard.tsx`
- Delete: `src/hooks/useExternalEvents.tsx`, `src/hooks/useExternalTasks.tsx`

**Interfaces:**
- Consumes: nothing new — `tasks` (existing `useTasks`) now includes Google-origin rows automatically.

- [ ] **Step 1: Remove the external-item imports and derived state**

In `src/components/Dashboard.tsx`, remove:
```typescript
import { useExternalEvents } from '@/hooks/useExternalEvents';
import { useExternalTasks } from '@/hooks/useExternalTasks';
```
and remove:
```typescript
  const { events: externalEvents } = useExternalEvents();
  const { externalTasks } = useExternalTasks();
```
and remove:
```typescript
  const upcomingExternalEvents = externalEvents
    .filter((event) => new Date(event.start_time) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .slice(0, 5);
  const upcomingExternalTasks = externalTasks.slice(0, 5);
```

- [ ] **Step 2: Remove the "From your connected apps" section**

Remove the entire block:
```tsx
      {(upcomingExternalEvents.length > 0 || upcomingExternalTasks.length > 0) && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 transition-colors">
          <h2 className="text-lg font-semibold text-black dark:text-white mb-4">From your connected apps</h2>
          ...
        </div>
      )}
```
(the whole block, from the opening `{(upcomingExternalEvents...` condition through its matching closing `)}`). Google-origin tasks now appear automatically in the existing "Upcoming Tasks"/"Recently Completed" sections above, since they're real `tasks` rows — this section's entire purpose (making otherwise-invisible read-only items visible somewhere) no longer applies.

- [ ] **Step 3: Delete the retired hooks**

```bash
rm src/hooks/useExternalEvents.tsx src/hooks/useExternalTasks.tsx
```
Confirm nothing else imports them:
```bash
grep -rn "useExternalEvents\|useExternalTasks" src/
```
Expected: no results (Task 10 already removed `CalendarView.tsx`'s only remaining reference).

- [ ] **Step 4: Manual verification**

Run `npx tsc --noEmit` — no errors (confirms no dangling imports). Run `npm test` — 35/35 passing. Run `npm run dev`, open the Dashboard with a Google-origin task present (e.g. from Task 4's manual sync test or Task 2's migrated data), confirm it appears in "Upcoming Tasks" (if pending with a due date) or "Recently Completed" (if completed) — same as any native task, with no separate "From your connected apps" section anywhere on the page.

- [ ] **Step 5: Commit**

```bash
git add src/components/Dashboard.tsx
git rm src/hooks/useExternalEvents.tsx src/hooks/useExternalTasks.tsx
git commit -m "Remove read-only external-items Dashboard section

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: `needs_reconnect` banner in Settings

**Files:**
- Modify: `src/components/IntegrationsSettings.tsx`

**Interfaces:**
- Consumes: `useIntegrationConnections` (existing, from PR #14) — its `status` field now may also be `'needs_reconnect'`.

- [ ] **Step 1: Add the banner**

In `src/components/IntegrationsSettings.tsx`, the connected-state branch currently reads:
```tsx
      ) : googleConnection ? (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-foreground">Google</h3>
            <p className="text-sm text-muted-foreground">
              {googleConnection.status === 'connected'
                ? googleConnection.last_synced_at
                  ? `Last synced ${new Date(googleConnection.last_synced_at).toLocaleString()}`
                  : 'Connected, not yet synced'
                : `Status: ${googleConnection.status}${googleConnection.last_error ? ` — ${googleConnection.last_error}` : ''}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={isSyncing} onClick={() => syncNow(googleConnection.id)}>
              {isSyncing ? 'Syncing...' : 'Sync now'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => disconnect(googleConnection.id)}
            >
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
```
Replace it with a version that branches on `needs_reconnect` before the generic connected/error display:
```tsx
      ) : googleConnection?.status === 'needs_reconnect' ? (
        <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-md">
          <div>
            <h3 className="font-medium text-foreground">Google</h3>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Google needs new permissions for two-way sync.
            </p>
          </div>
          <Button size="sm" onClick={connectGoogle} className="bg-amber-600 hover:bg-amber-700 text-white">
            Reconnect
          </Button>
        </div>
      ) : googleConnection ? (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-foreground">Google</h3>
            <p className="text-sm text-muted-foreground">
              {googleConnection.status === 'connected'
                ? googleConnection.last_synced_at
                  ? `Last synced ${new Date(googleConnection.last_synced_at).toLocaleString()}`
                  : 'Connected, not yet synced'
                : `Status: ${googleConnection.status}${googleConnection.last_error ? ` — ${googleConnection.last_error}` : ''}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={isSyncing} onClick={() => syncNow(googleConnection.id)}>
              {isSyncing ? 'Syncing...' : 'Sync now'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => disconnect(googleConnection.id)}
            >
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
```
(The final `: (` "not connected" branch is unchanged — leave it as-is.)

- [ ] **Step 2: Update the `IntegrationConnection` status type**

In `src/hooks/useIntegrationConnections.tsx`, change:
```typescript
  status: 'connected' | 'expired' | 'error' | 'disconnected';
```
to:
```typescript
  status: 'connected' | 'expired' | 'error' | 'disconnected' | 'needs_reconnect';
```

- [ ] **Step 3: Manual verification**

Run `npx tsc --noEmit` — no errors. With a connected test account, manually set its `scope` column back to the old readonly value via `docker exec psql`, trigger a sync (Task 4's scope-check guard sets `status = 'needs_reconnect'`), reload Settings, confirm the amber banner renders with "Reconnect" instead of the normal connected view, and clicking it re-runs the OAuth flow (reuses `connectGoogle`, unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/components/IntegrationsSettings.tsx src/hooks/useIntegrationConnections.tsx
git commit -m "Add needs_reconnect banner to Integrations settings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: Reports/exports — Source column and Events section

**Files:**
- Modify: `src/utils/dataPortability.ts`
- Modify: `src/utils/pdfExport.ts`
- Modify: `src/components/Settings.tsx`
- Test: `src/utils/dataPortability.test.ts`

**Interfaces:**
- Consumes: `Event` from `useEvents` (Task 6).
- Produces: `ExportedTask.source: 'monotask' | 'google'`; new `ExportedEvent` type with the same `source` field; `buildExportData(tasks, habits, tags, events)` now also returns `events: ExportedEvent[]`; `exportToPDF(tasks, habits, logs, events)` includes an Events section.

- [ ] **Step 1: Write the failing test for the `source` derivation**

In `src/utils/dataPortability.test.ts` (existing file — add to it, following its existing test style), add:
```typescript
import { buildExportData } from './dataPortability';

test('buildExportData tags each task and event with its source', () => {
  const tasks = [
    { id: '1', title: 'Native task', description: null, due_date: null, due_time: null, priority: 'low', status: 'pending', repeat_type: 'none', repeat_interval: 1, tag_id: null, created_at: '', updated_at: '', user_id: 'u', google_connection_id: null } as any,
    { id: '2', title: 'Synced task', description: null, due_date: null, due_time: null, priority: 'medium', status: 'pending', repeat_type: 'none', repeat_interval: 1, tag_id: null, created_at: '', updated_at: '', user_id: 'u', google_connection_id: 'conn-1' } as any,
  ];
  const events = [
    { id: '3', title: 'Native event', description: null, start_time: '2026-01-01T00:00:00Z', end_time: null, location: null, meeting_url: null, tag_id: null, created_at: '', updated_at: '', user_id: 'u', google_connection_id: null } as any,
    { id: '4', title: 'Synced event', description: null, start_time: '2026-01-01T00:00:00Z', end_time: null, location: null, meeting_url: null, tag_id: null, created_at: '', updated_at: '', user_id: 'u', google_connection_id: 'conn-1' } as any,
  ];

  const data = buildExportData(tasks, [], [], events);

  expect(data.tasks.find((t) => t.title === 'Native task')?.source).toBe('monotask');
  expect(data.tasks.find((t) => t.title === 'Synced task')?.source).toBe('google');
  expect(data.events?.find((e) => e.title === 'Native event')?.source).toBe('monotask');
  expect(data.events?.find((e) => e.title === 'Synced event')?.source).toBe('google');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- dataPortability`
Expected: FAIL — `buildExportData` doesn't accept a fourth argument yet, and `ExportedTask`/`ExportedEvent` have no `source` field.

- [ ] **Step 3: Update `dataPortability.ts`**

Add `source` to `ExportedTask`:
```typescript
export interface ExportedTask {
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed' | 'cancelled';
  repeat_type: 'none' | 'daily' | 'weekly' | 'monthly';
  repeat_interval: number;
  tag_name: string | null;
  source: 'monotask' | 'google';
}
```
Add a new `ExportedEvent` type:
```typescript
export interface ExportedEvent {
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  location: string | null;
  meeting_url: string | null;
  tag_name: string | null;
  source: 'monotask' | 'google';
}
```
Add `events?: ExportedEvent[]` to `MonotaskExport` (optional — older export files won't have it, and import must tolerate that):
```typescript
export interface MonotaskExport {
  version: number;
  exportedAt: string;
  tags: ExportedTag[];
  tasks: ExportedTask[];
  habits: ExportedHabit[];
  events?: ExportedEvent[];
}
```
Update `buildExportData`'s signature and body:
```typescript
export const buildExportData = (
  tasks: Task[],
  habits: Habit[],
  tags: Tag[],
  events: EventType[] = [],
): MonotaskExport => {
  const tagNameById = new Map(tags.map((tag) => [tag.id, tag.name]));

  return {
    version: MONOTASK_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    tags: tags.map((tag) => ({ name: tag.name, color: tag.color })),
    tasks: tasks.map((task) => ({
      title: task.title,
      description: task.description || null,
      due_date: task.due_date || null,
      due_time: task.due_time || null,
      priority: task.priority,
      status: task.status,
      repeat_type: task.repeat_type || 'none',
      repeat_interval: task.repeat_interval || 1,
      tag_name: task.tag_id ? tagNameById.get(task.tag_id) || null : null,
      source: task.google_connection_id ? 'google' : 'monotask',
    })),
    habits: habits.map((habit) => ({
      name: habit.name,
      description: habit.description || null,
      frequency: habit.frequency,
      frequency_days: habit.frequency_days || null,
      preferred_time: habit.preferred_time || null,
      tag_name: habit.tag_id ? tagNameById.get(habit.tag_id) || null : null,
    })),
    events: events.map((event) => ({
      title: event.title,
      description: event.description || null,
      start_time: event.start_time,
      end_time: event.end_time || null,
      location: event.location || null,
      meeting_url: event.meeting_url || null,
      tag_name: event.tag_id ? tagNameById.get(event.tag_id) || null : null,
      source: event.google_connection_id ? 'google' : 'monotask',
    })),
  };
};
```
Add the import for the `Event` type at the top of the file (aliased to avoid clashing with the DOM `Event` type):
```typescript
import { Event as EventType } from '@/hooks/useEvents';
```
Update `isExportedTask` to also check `source`:
```typescript
const isExportedTask = (v: unknown): v is ExportedTask => {
  if (!v || typeof v !== 'object') return false;
  const t = v as ExportedTask;
  return (
    isString(t.title) &&
    isNullableString(t.description) &&
    isNullableString(t.due_date) &&
    isNullableString(t.due_time) &&
    ['low', 'medium', 'high'].includes(t.priority) &&
    ['pending', 'completed', 'cancelled'].includes(t.status) &&
    ['none', 'daily', 'weekly', 'monthly'].includes(t.repeat_type) &&
    typeof t.repeat_interval === 'number' &&
    isNullableString(t.tag_name) &&
    (t.source === undefined || ['monotask', 'google'].includes(t.source))
  );
};
```
(`t.source === undefined` keeps older, pre-this-plan export files importable — `parseImportFile` doesn't need any other change since `events` on `MonotaskExport` is already optional and nothing currently validates it strictly; importing events isn't part of this plan's scope, only exporting them.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- dataPortability`
Expected: PASS.

- [ ] **Step 5: Update `pdfExport.ts`**

Change the signature to accept events, and add a Source suffix to task lines plus an Events section:
```typescript
import jsPDF from 'jspdf';
import { Task } from '@/hooks/useTasks';
import { Habit, HabitLog } from '@/hooks/useHabits';
import { Event } from '@/hooks/useEvents';

export const exportToPDF = async (
  tasks: Task[],
  habits: Habit[],
  logs: HabitLog[],
  events: Event[] = []
) => {
```
In the task-line rendering loop, change:
```typescript
      const status = task.status === 'completed' ? '✓' : '○';
      const dueDate = task.due_date ? ` (Due: ${task.due_date})` : '';
      const priority = task.priority ? ` [${task.priority.toUpperCase()}]` : '';

      pdf.text(`${status} ${task.title}${priority}${dueDate}`, 25, yPosition);
```
to:
```typescript
      const status = task.status === 'completed' ? '✓' : '○';
      const dueDate = task.due_date ? ` (Due: ${task.due_date})` : '';
      const priority = task.priority ? ` [${task.priority.toUpperCase()}]` : '';
      const source = task.google_connection_id ? ' [Google]' : '';

      pdf.text(`${status} ${task.title}${priority}${dueDate}${source}`, 25, yPosition);
```
After the existing Habits section (once its loop finishes, following the same `checkPageBreak()`/section-header pattern already used for Tasks and Habits in this file), add an Events section:
```typescript
  yPosition += lineHeight;
  checkPageBreak();
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Events', 20, yPosition);
  yPosition += lineHeight;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Total Events: ${events.length}`, 20, yPosition);
  yPosition += lineHeight * 2;

  if (events.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Event Details:', 20, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');

    events.forEach((event) => {
      checkPageBreak();
      const source = event.google_connection_id ? ' [Google]' : '';
      const when = new Date(event.start_time).toLocaleString();
      pdf.text(`${event.title}${source} (${when})`, 25, yPosition);
      yPosition += lineHeight;
    });
  }
```

- [ ] **Step 6: Update `Settings.tsx`**

Add the import and hook call:
```typescript
import { useEvents } from '@/hooks/useEvents';
```
```typescript
  const { events, isLoading: eventsLoading } = useEvents();
```
Add `eventsLoading` to `dataReady`:
```typescript
  const dataReady = !tasksLoading && !habitsLoading && !tagsLoading && !eventsLoading;
```
Update the three export handlers to pass `events` through:
```typescript
  const handleExportPDF = async () => {
    try {
      await exportToPDF(tasks, habits, logs, events);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF. Please try again.');
    }
  };
```
In `handleExportCSV`, after the existing `HABIT LOGS` section, add:
```typescript
    lines.push('');
    lines.push('EVENTS');
    lines.push(toCsvRow(['Title', 'Description', 'Start', 'End', 'Location', 'Meeting URL', 'Source', 'Created At']));
    events.forEach(event => {
      lines.push(toCsvRow([
        event.title,
        event.description || '',
        event.start_time,
        event.end_time || '',
        event.location || '',
        event.meeting_url || '',
        event.google_connection_id ? 'Google' : 'Monotask',
        event.created_at
      ]));
    });
```
And add a `Source` column to the existing TASKS section:
```typescript
    lines.push('TASKS');
    lines.push(toCsvRow(['Title', 'Description', 'Status', 'Priority', 'Due Date', 'Due Time', 'Source', 'Created At']));
    tasks.forEach(task => {
      lines.push(toCsvRow([
        task.title,
        task.description || '',
        task.status || '',
        task.priority || '',
        task.due_date || '',
        task.due_time || '',
        task.google_connection_id ? 'Google' : 'Monotask',
        task.created_at
      ]));
    });
```
In `handleExportJSON`, pass `events` through:
```typescript
  const handleExportJSON = () => {
    const data = buildExportData(tasks, habits, tags, events);
    ...
```

- [ ] **Step 7: Manual verification**

Run `npx tsc --noEmit` — no errors. Run `npm test` — all passing including the new `dataPortability` test. Run `npm run dev`, create at least one native event and (if you have a Google-origin task/event from earlier testing) confirm: PDF export shows an Events section and `[Google]` suffixes on synced items; CSV export has an EVENTS section and a Source column on TASKS; JSON export's `tasks`/`events` entries carry `"source": "monotask"` or `"source": "google"` correctly.

- [ ] **Step 8: Commit**

```bash
git add src/utils/dataPortability.ts src/utils/dataPortability.test.ts src/utils/pdfExport.ts src/components/Settings.tsx
git commit -m "Add Source tagging and Events section to exports

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Post-plan smoke test

Once all 13 tasks are done, run through the full journey once end-to-end:
1. Confirm the Events Sidebar entry works: create a native event, edit it, delete it.
2. Confirm a Google-origin task/event (from a real or manually-inserted connection) appears identically to a native one in Dashboard's Upcoming Tasks, Calendar view (editable), and EventsView.
3. Confirm the old "From your connected apps" Dashboard section is gone.
4. Confirm exports (PDF/CSV/JSON) include both tasks and events with correct Source tagging.
5. Confirm a connection with an outdated (readonly) scope shows the `needs_reconnect` banner in Settings, and reconnecting clears it.

This exercises every Goal from the spec's Section 1 scope (native Events, real-table migration, reconnect flow, export tagging) that this foundation plan covers; the next plan builds the actual two-way push mechanism on top of it.
