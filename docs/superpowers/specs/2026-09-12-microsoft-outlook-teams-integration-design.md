# Microsoft (Outlook Calendar/Tasks + Teams) Integration

Status: Approved for planning
Date: 2026-09-12

## Problem

Monotask's Google integration (shipped, verified live) proves the
`IntegrationProvider` abstraction: a provider-agnostic sync engine,
push mechanism, and display layer sitting behind a single interface
implemented once for Google. This spec adds the second implementation
— Microsoft, covering Outlook Calendar, Outlook/Microsoft To Do tasks,
and Teams meeting links (which ride along on Outlook Calendar events,
not as a separate integration surface) — and, in doing so, is the
first real test that the abstraction actually generalizes rather than
being Google-shaped in disguise.

This is Plan 2 on the previously agreed roadmap: Google two-way sync
(done) → **Microsoft (this spec)** → AI subsystem (message-scanning +
meeting-conflict detection) → mobile app.

## Goals

- Microsoft becomes a second provider, offering the exact same
  capability Google has today: OAuth connect (separate from any
  sign-in concern), full two-way sync (pull + immediate push +
  conflict resolution + retry) for calendar events and tasks, and
  reconnect handling for scope changes.
- Outlook Calendar events with an attached Teams meeting show that
  meeting's join link the same way a Google Calendar event shows its
  Meet/Hangout link — no separate Teams API integration.
- The `IntegrationProvider` interface's four Edge Functions
  (`integration-oauth-start`, `integration-oauth-callback`,
  `sync-integrations`, `push-integration-change`) stop hardcoding
  `googleProvider` and route by the connection's/request's `provider`
  field through a small registry — this is the mechanism this spec
  exists to prove, not incidental cleanup.
- The `google_connection_id`/`google_task_id`/`google_event_id`
  columns on `tasks`/`events` are renamed to provider-neutral names
  (`sync_connection_id`/`external_task_id`/`external_event_id`) before
  a second provider makes the misnomer permanent. Every already-shipped
  Google code path is updated mechanically (identifier rename only, no
  behavior change) as part of this work.
- A new denormalized `sync_provider` column lets the UI show the right
  label ("Google Calendar" vs "Outlook Calendar", "Google Tasks" vs
  "Microsoft To Do") without joining back to `integration_connections`
  on every render.

## Non-goals

- No "Continue with Microsoft" sign-in option — this is connect-for-sync
  only, matching the actual need (Google's sign-in option was a
  separate, smaller ask that doesn't repeat here).
- No Teams chat, no Teams-specific data beyond the meeting join link
  already present on a synced Outlook Calendar event. Teams chat
  scanning is Plan 3's concern (AI message-scanning), not this one.
- No changes to the conflict-resolution mechanism itself (whole-record
  last-write-wins, `last_seen_at`/`synced_at` split, retry-on-next-pull)
  — Microsoft reuses it unchanged via the provider registry. If a
  Microsoft-specific limitation is discovered during implementation
  that the mechanism can't handle, that's new information requiring a
  ruling, not something pre-solved here.
- No support for Microsoft's `Personal` vs `Work/School` account
  distinction beyond using the `common` OAuth tenant endpoint (which
  already covers both) — no per-account-type behavior differences.

## Architecture

### 1. Data model

```sql
-- Rename for provider-neutrality (identifier-only change, no behavior
-- change to any existing Google code path's logic).
alter table public.tasks rename column google_connection_id to sync_connection_id;
alter table public.tasks rename column google_task_id to external_task_id;
alter table public.events rename column google_connection_id to sync_connection_id;
alter table public.events rename column google_event_id to external_event_id;

-- Denormalized so the UI can label a row's source without a join.
alter table public.tasks add column sync_provider text check (sync_provider in ('google', 'microsoft'));
alter table public.events add column sync_provider text check (sync_provider in ('google', 'microsoft'));
update public.tasks set sync_provider = 'google' where sync_connection_id is not null;
update public.events set sync_provider = 'google' where sync_connection_id is not null;

-- Provider-specific extra state that doesn't belong on every connection
-- row's own columns (Microsoft's resolved default-task-list id is the
-- first user; unused/null for Google).
alter table public.integration_connections add column provider_metadata jsonb;

alter table public.integration_connections drop constraint integration_connections_provider_check;
alter table public.integration_connections
  add constraint integration_connections_provider_check
  check (provider in ('google', 'microsoft'));
```

Every reference to the old column names across the already-shipped
Google code (`sync-integrations`, `push-integration-change`,
`useTasks.tsx`, `useEvents.tsx`, `TaskManager.tsx`, `EventsView.tsx`,
`CalendarView.tsx`, the export utilities) is updated mechanically to
the new names — a rename, not a redesign.

### 2. Provider registry (the mechanism this spec proves)

`integration-oauth-start`, `integration-oauth-callback`,
`sync-integrations`, and `push-integration-change` currently import and
call `googleProvider` directly. All four switch to a small registry:

```ts
// supabase/functions/_shared/integrations/registry.ts
import { googleProvider } from "./google.ts";
import { microsoftProvider } from "./microsoft.ts";
import type { IntegrationProvider } from "./types.ts";

export const providers: Record<string, IntegrationProvider> = {
  google: googleProvider,
  microsoft: microsoftProvider,
};
```

Each function looks up `providers[body.provider]` (start),
`providers[stateRow.provider]` (callback), or
`providers[connection.provider]` (sync/push) instead of the hardcoded
import. `IntegrationProvider.id`'s type widens from the literal
`"google"` to `"google" | "microsoft"`.

The scope-check (`hasWriteScopes` in `sync-integrations`) becomes
provider-aware: `REQUIRED_SCOPES` becomes a lookup keyed by
`connection.provider`, since Microsoft's required scope strings differ
from Google's.

### 3. Microsoft provider module

New file `supabase/functions/_shared/integrations/microsoft.ts`,
implementing `IntegrationProvider` in full:

- **OAuth**: authorize via
  `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`,
  token exchange/refresh via the matching `/token` endpoint. Scopes:
  `offline_access Calendars.ReadWrite Tasks.ReadWrite`. The `common`
  tenant covers both personal and work/school Microsoft accounts.
- **fetchEvents**: `GET /me/calendarView?startDateTime=...&endDateTime=...`
  (Microsoft Graph's equivalent of Google's `singleEvents=true` —
  `calendarView` already expands recurring events into instances).
  Pagination via Graph's `@odata.nextLink`, with the same page-count
  ceiling pattern Google's provider already uses.
- **fetchTasks**: Microsoft To Do has no `@default` list shorthand like
  Google Tasks does. First call `GET /me/todo/lists`, find the entry
  with `wellknownListName: "defaultList"`, cache its id in the
  connection's `provider_metadata` (`{ "taskListId": "..." }`) so
  subsequent syncs don't re-resolve it every run, then fetch from
  `GET /me/todo/lists/{taskListId}/tasks`.
- **updateEvent/deleteEvent**: `PATCH`/`DELETE /me/events/{id}`.
- **updateTask/deleteTask**: `PATCH`/`DELETE /me/todo/lists/{taskListId}/tasks/{id}`.
- **Teams meeting link**: an event with `isOnlineMeeting: true` carries
  `onlineMeeting.joinUrl`, mapped to the same `meeting_url` field
  Google's `hangoutLink` already populates — no new field, no separate
  API call.
- **Error handling**: Microsoft Graph's error JSON shape differs from
  Google's, but nothing parses it specially — captured as opaque text
  into `sync_error`/`last_error`, exactly like Google's errors today.

### 4. Settings UI

The existing Google connection card in `IntegrationsSettings.tsx`
(connect/disconnect/sync-now/reconnect-banner) is extracted into a
`ProviderConnectionRow` component parameterized by provider id, used
twice — once for Google (unchanged behavior), once for Microsoft. This
avoids duplicating ~40 lines of logic twice while not over-building a
fully generic N-provider list for a third provider that isn't being
built yet.

### 5. Display layer

`Dashboard.tsx`, `EventsView.tsx`, `CalendarView.tsx`, and the export
utilities read the new `sync_provider` column to pick the right label
("Google Calendar"/"Outlook Calendar", "Google Tasks"/"Microsoft To
Do") instead of assuming every synced row is Google's. No other
display logic changes — a synced Microsoft item is exactly as editable,
completable, and deletable as a synced Google item, using the same
`push-integration-change` call already wired into `useTasks`/`useEvents`
(which already reads `sync_provider`/`sync_connection_id` generically
once the rename lands, not anything Google-specific).

## Testing

- `microsoftIntegration.test.ts`, mirroring `googleIntegration.test.ts`'s
  request-shape tests: fetch pagination, the task-list-id resolution
  and caching behavior, update/delete request shapes for both events
  and tasks, 410-as-success on delete.
- Manual verification requires a real Azure AD app registration and a
  real Microsoft account — like Google, completing the actual OAuth
  consent screen is a real-browser step no automated agent can do
  headlessly, so full live verification is a human step.

## Rollout

One plan (not two, unlike Google) — the conflict-resolution mechanism
already exists and is proven; Microsoft only needs to plug into it via
the provider registry, not reinvent it. Rough shape: column
rename/schema widening, provider registry refactor across the four
Edge Functions, the Microsoft provider module (read methods, then
write methods), OAuth start/callback routing, Settings UI, display
layer's `sync_provider` labeling, tests. If task decomposition reveals
this is larger than expected once writing-plans breaks it down, split
then rather than pre-guessing now.
