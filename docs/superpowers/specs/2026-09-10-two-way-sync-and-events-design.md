# Two-Way Sync (Google) and Native Events

Status: Approved for planning
Date: 2026-09-10

## Problem

The shipped integration (PR #14) is deliberately read-only: Google Calendar
events and Google Tasks are pulled into separate mirror tables
(`external_events`/`external_tasks`) and displayed as non-editable,
distinctly-styled items. In practice this has two problems:

- **Fidelity gaps.** Completing a task in Google makes it silently
  disappear from Monotask (the sync fetches Google Tasks with
  `showCompleted=false`) rather than showing as completed. Overdue synced
  items get no visual treatment. Neither behaves like a real Monotask
  task.
- **No editability.** A synced item can't be completed, edited, or acted
  on from within Monotask at all — you have to leave the app to do
  anything with it, which defeats the point of having it show up here.

This spec upgrades the Google integration to full two-way sync, and adds
a native "Events" object to Monotask (since Google Calendar events don't
fit the existing `tasks` shape — no start/end time, location, or
meeting link) so that Google-origin items become genuinely first-class,
editable Monotask objects rather than a read-only mirror.

## Relationship to the existing spec and roadmap

This does not replace `2026-09-10-external-integrations-design.md` — it
supersedes only that spec's Non-goals entry "No two-way sync" for the
Google provider, and extends its data model. The provider-agnostic
design (`IntegrationProvider` interface) is preserved and extended, not
abandoned: everything here is built so Outlook/Teams (a separate,
already-planned future provider) is "implement the interface again,"
not a redesign.

Roadmap this fits into (agreed during brainstorming):
1. **This spec** — two-way sync + native Events, Google only.
2. Outlook/Teams integration, reusing the same abstraction.
3. AI subsystem: message-scanning for task suggestions (Gmail first,
   expanding by provider) **and** meeting-conflict detection with
   AI-suggested rescheduling, merged into one subsystem since both need
   the same "reason about what's on the calendar" capability.
4. Mobile app, once the web/API surface is stable.

"Production scale" (rate limits, retries, monitoring) is a standing bar
applied to each of the above, not a separate phase.

Explicitly out of scope for *this* spec: Outlook/Teams, AI scanning,
meeting-conflict detection, mobile, and any provider beyond Google.

## Goals

- Google-origin tasks and events become genuine rows in the real
  `tasks` and (new) `events` tables — not a separate mirror — so every
  existing feature that operates on those tables (overdue detection,
  completion display, filters/search, PDF/CSV/JSON export) applies to
  them automatically, with no separate code path.
- Completing, editing, or deleting a Google-origin task/event in
  Monotask pushes that change to Google **immediately** (not on the next
  poll cycle).
- Changes made directly in Google (edit, complete, delete) continue to
  flow in via the existing 10-minute polling sync, now applied to real
  task/event rows instead of a mirror.
- Full field sync: title, description, due date/time (tasks) or
  start/end time (events), location, meeting link, and completion
  status all sync in both directions.
- Sync applies **only to Google-origin items** — creating a plain
  Monotask task or event never creates anything in Google. Scope stays
  narrow; symmetric push-everything-to-Google is not built here.
- Deletion is bidirectional: deleting a Google-origin item in Monotask
  deletes it in Google; deleting it in Google removes it from Monotask.
- Exported reports (PDF/CSV/JSON) mark each task/event's source
  (Monotask vs. Google).
- Existing connections (granted under the old readonly scopes) are
  detected and prompted to reconnect with write scopes, without
  breaking other users' connections or silently failing.

## Non-goals

- Any provider other than Google.
- Symmetric two-way sync for natively-created Monotask items (they stay
  Monotask-only unless a future "push to Google" action is separately
  designed).
- A retry queue or webhook-based push notification system — the
  existing 10-minute cron doubles as the retry mechanism for failed
  immediate pushes.
- Meeting-conflict detection, AI task suggestions, mobile app, and
  additional providers — all separate, already-sequenced future specs.

## Architecture

### 1. Data model

```sql
-- New: native events (Monotask's own object, Google-origin events live here too)
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
  -- Sync metadata (all null for a purely-native event)
  google_connection_id uuid references public.integration_connections on delete set null,
  google_event_id text,
  synced_at timestamp with time zone,
  sync_error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (google_connection_id, google_event_id)
);

-- tasks gets the same three sync columns (migration, not a new table)
alter table public.tasks
  add column google_connection_id uuid references public.integration_connections on delete set null,
  add column google_task_id text,
  add column synced_at timestamp with time zone,
  add column sync_error text;
alter table public.tasks
  add constraint tasks_google_unique unique (google_connection_id, google_task_id);
```

The sync columns are named generically (`google_connection_id`, not
e.g. a provider-specific `source`), and `google_connection_id` is just a
foreign key to `integration_connections` — when Outlook is added later,
those same columns work unchanged as long as the column names stay
provider-neutral in spirit (a future rename to `sync_connection_id`
would be a trivial follow-up migration, not a blocker to building
Outlook support now).

`external_events`/`external_tasks` (from PR #14) are retired: a
one-time data migration copies their rows into `events`/`tasks` with
the new sync columns populated (`synced_at` = the mirror row's
`updated_at`), then both tables are dropped. RLS policies on
`tasks`/`events` are the existing per-user policies already in place —
no new policy shape is needed since these are just new columns on
already-correctly-scoped tables.

### 2. OAuth scope upgrade and reconnect flow

`googleProvider`'s requested scopes change from `calendar.readonly`/
`tasks.readonly` to full `calendar`/`tasks` (read+write).

Detection is dynamic, not a one-time migration script: on every sync
run, `syncConnection` checks whether the connection's stored `scope`
column contains the new write scopes. If not, it skips calling Google
entirely for that connection and sets `status = 'needs_reconnect'` (a
new value added to the existing status check constraint). This
self-corrects for any future scope change too, not just this one
transition, and never touches other users' connections.

`IntegrationsSettings.tsx` shows a distinct banner for
`needs_reconnect`: *"Google needs new permissions for two-way sync —
Reconnect."* Clicking it re-runs the existing `integration-oauth-start`
flow; since `prompt=consent` is already set, Google re-shows the
consent screen with the new scopes, and `integration-oauth-callback`'s
existing upsert naturally overwrites the old token/scope.

### 3. Sync engine: pull, push, and conflict resolution

**Pull** (`sync-integrations`, same 10-minute cadence + manual trigger,
unchanged entry point):
- `fetchTasks` now requests `showCompleted=true` (previously `false`),
  since completed tasks must sync in as completed, not vanish.
- Before overwriting a local row from freshly-fetched Google data:
  if `local.updated_at > local.synced_at` (the row has a local edit
  that hasn't been confirmed pushed yet), **skip overwriting it** —
  this is the conflict case, expected to be rare since pushes are
  immediate; it means a previous push attempt failed or is still
  pending, and the retry mechanism below picks it up.
- If the local row has no pending local edit, overwrite from Google's
  data and bump `synced_at` to now. Conflict resolution is whole-record
  last-write-wins by timestamp comparison, not per-field merging.
- Deletion is bidirectional: a previously-synced item missing from
  Google's fresh fetch gets deleted locally (existing delete-stale
  logic, now also firing on genuine deletes, not just completions,
  since completions no longer cause absence from the fetch).

**Push** (new — immediate, not batched with the cron): a mutation that
edits, completes, or deletes a Google-origin task/event writes to
Postgres first (fast, as today), then fires a call to a new Edge
Function, `push-integration-change`, with `{ type: 'task' | 'event',
id, connection_id, google_task_id | google_event_id, change }`
(the field name matching whichever sync column the row actually has,
per Section 1's schema). That function refreshes the
connection's token if needed, calls Google's update/delete API for that
specific item, and bumps `synced_at` on success. This call does not
block the UI: on failure, the local change is still visible
immediately, a toast notes the push didn't reach Google, and the
row's `sync_error` column records why.

**Retry**: no separate queue. A failed push leaves
`local.updated_at > local.synced_at`, which the next scheduled pull
naturally detects (per the conflict rule above) and retries from the
sync engine itself — self-healing within one 10-minute cycle.

### 4. Native Events UI

- New Sidebar entry, "Events," alongside Tasks/Habits/Tags/Progress.
- `EventsView.tsx` — list view mirroring `TaskManager.tsx`'s shape
  (no recurrence engine needed for events).
- `EventModal.tsx` — create/edit form: title, description, start time,
  end time, location, meeting link, tag.
- `useEvents.tsx` — hook mirroring `useTasks.tsx` (useQuery +
  create/update/delete mutations); the update/delete mutations are
  where the push-to-Google call (Section 3) is triggered for
  Google-origin rows (`google_connection_id is not null`).
- `CalendarView`'s existing read-only blue-badge treatment for external
  events (built in PR #14) is replaced: events now render as real,
  clickable day-cell items opening `EventModal` for editing, the same
  way tasks already do in this view. A small provider badge still marks
  Google-origin events so their source stays visible, but the
  interaction is now edit, not "open in new tab."

### 5. Reports/exports source tagging

`buildExportData`/CSV/PDF export functions in `Settings.tsx` gain a
derived `source` field per task/event (`'monotask'` if
`google_connection_id is null`, else `'google'`). CSV/JSON exports get
a `Source` column; PDF export gets an equivalent small label per row.

## Error handling

- Push failure: local change stays visible immediately; `sync_error`
  column set; a per-row indicator (not a blocking toast) surfaces it in
  the UI; the next pull cycle retries automatically.
- Pull failure: unchanged from PR #14 — existing per-connection
  `status`/`last_error` mechanism, one connection's failure never
  blocks others.
- Scope mismatch: `needs_reconnect` status (Section 2), sync paused for
  that connection only until the user reconnects.
- Google API rate limits/5xx during push: treated as a push failure
  (above) — no bespoke backoff logic beyond the existing 10-minute
  retry cadence.

## Testing

- The conflict-resolution decision (given `updated_at`, `synced_at`,
  and Google's own modified timestamp, decide overwrite-vs-skip) is
  written as a pure function and unit-tested with Vitest, matching this
  repo's existing convention of testing pure logic under `src/**/*.ts`.
- Edge Functions (`push-integration-change`, the modified
  `sync-integrations`) and UI (`EventsView`, `EventModal`, the
  Settings reconnect banner) are manually verified, matching every
  other Edge Function and component in this codebase — no automated
  harness exists for either category here.
- Migration correctness (existing mirror-table rows correctly copied
  into `tasks`/`events` with sync columns populated) is verified by
  inspecting real rows after the migration runs locally, not by an
  automated test.

## Rollout

This replaces already-shipped tables with one already-connected real
account (the developer's own), so rollout order matters:

1. Schema migration: `events` table + sync columns on `tasks`.
   `external_events`/`external_tasks` remain temporarily.
2. One-time data migration: copy existing mirror rows into
   `events`/`tasks` with sync metadata populated.
3. Drop `external_events`/`external_tasks` once the copy is confirmed.
4. OAuth scope upgrade ships; the existing connection is auto-flagged
   `needs_reconnect` on its next sync (old readonly scope) and
   reconnects once via the new Settings banner.
5. `CalendarView`/`Dashboard` switch from the old mirror-table hooks
   (`useExternalEvents`/`useExternalTasks`) to reading `tasks`/`events`
   directly; those two hooks are retired along with the tables they
   read.
6. `push-integration-change` Edge Function ships alongside the mutation
   changes in `useTasks`/`useEvents` that call it.
