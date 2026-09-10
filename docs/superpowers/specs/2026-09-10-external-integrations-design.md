# External App Integrations (Calendar & Tasks)

Status: Approved for planning
Date: 2026-09-10

## Problem

Monotask only shows tasks a user creates natively. Users also have meetings
and tasks living in external apps (Google Calendar/Tasks, Microsoft
Outlook/Teams, and potentially more later). They currently have to check
each app separately. This feature connects external accounts so their
meetings and tasks surface inside Monotask alongside native tasks.

## Goals (v1)

- Users can connect a Google account and/or a Microsoft account via OAuth
  from Settings.
- Once connected, upcoming calendar events (meetings) and open tasks from
  that account are periodically pulled in and shown in Monotask's existing
  Calendar and Task views, visually marked with their source app.
- Users can disconnect an account at any time, which stops syncing and
  removes its imported data.
- The integration layer is provider-agnostic so a third provider (Slack,
  Webex, etc.) can be added later as a new module without touching the
  sync engine or UI merge logic.

## Non-goals (v1)

- Two-way sync. Monotask never writes to the external provider. Completing
  an imported task/meeting in Monotask does not change it in Google/
  Microsoft, and the checkbox/actions on imported items reflect that
  (read-only, "open in <app>" instead).
- Real-time sync via webhooks/push subscriptions. Freshness is handled by
  periodic polling.
- Any provider beyond Google and Microsoft in the first release.
- Editing, creating, or deleting external items from within Monotask.
- Conflict resolution, since there's nothing to write back.

## Architecture

### 1. Connection management

New `Settings > Integrations` panel (extends `src/components/Settings.tsx`
or a new `src/components/IntegrationsSettings.tsx` section) listing
available providers (Google, Microsoft) with:
- "Connect" button → starts OAuth via a Supabase Edge Function
  (`integration-oauth-start`) that redirects to the provider's consent
  screen with the right scopes (`calendar.readonly`,
  `tasks.readonly` for Google; `Calendars.Read`, `Tasks.Read` for
  Microsoft Graph).
- OAuth callback handled by an Edge Function
  (`integration-oauth-callback`) that exchanges the code for
  access/refresh tokens and stores them server-side.
- Per-connection status: connected/expired/error, last synced time,
  "Sync now" button, "Disconnect" button.

Client code never sees access/refresh tokens — it only reads connection
metadata (provider, status, last_synced_at) via a normal RLS-scoped query.

### 2. Sync engine

A new Supabase Edge Function, `sync-integrations`, runs on a schedule
(Supabase's `pg_cron` invoking it every 10 minutes) and can also be
invoked manually from the "Sync now" button. For each active connection
belonging to the calling user (or, for the cron path, all active
connections):

1. If `expires_at` is near/past, refresh the access token using the
   stored refresh token; update `integration_connections`.
2. Call the provider's calendar API for events in a rolling window
   (e.g. now − 1 day to now + 30 days) and the provider's tasks API for
   open (non-completed) tasks.
3. Upsert results into `external_events` / `external_tasks`, keyed on
   `(connection_id, external_id)`, so re-syncs update in place rather
   than duplicating.
4. Delete rows for external ids no longer returned by the provider
   within the sync window (handles deleted/completed-upstream items).
5. Update `integration_connections.last_synced_at` and `status`.

Provider-specific logic lives behind a shared interface so adding a
provider later means implementing this interface, not touching the
engine:

```ts
interface IntegrationProvider {
  id: 'google' | 'microsoft';
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
  fetchEvents(tokens: TokenSet, windowStart: Date, windowEnd: Date): Promise<ExternalEvent[]>;
  fetchTasks(tokens: TokenSet): Promise<ExternalTask[]>;
}
```

Google and Microsoft each get a module implementing this
(`supabase/functions/_shared/integrations/google.ts`,
`.../microsoft.ts`).

### 3. Display layer

- `CalendarView` queries `external_events` alongside `tasks` (a new
  `useExternalEvents` hook mirroring `useTasks`) and renders them with a
  small provider badge/icon and a "meeting" visual treatment distinct
  from tasks. Clicking opens the event's `meeting_url` (or provider web
  link) in a new tab instead of the task edit modal.
- `TaskManager` / `Dashboard` merge in `external_tasks` (via a new
  `useExternalTasks` hook) as read-only cards: checkbox disabled/replaced
  with a provider badge, clicking opens the item in the source app.
- Both hooks are additive — native `tasks` behavior and data model are
  unchanged.

## Data model

```sql
-- One row per user-provider OAuth connection
create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  status text not null default 'connected' check (status in ('connected', 'expired', 'error', 'disconnected')),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamp with time zone not null,
  scope text,
  last_synced_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_id, provider)
);

-- Imported calendar events (read-only mirror)
create table public.external_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections on delete cascade,
  external_id text not null,
  title text not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone,
  meeting_url text,
  raw_payload jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (connection_id, external_id)
);

-- Imported tasks (read-only mirror)
create table public.external_tasks (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections on delete cascade,
  external_id text not null,
  title text not null,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  source_url text,
  raw_payload jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (connection_id, external_id)
);
```

RLS: `integration_connections` scoped directly by `user_id = auth.uid()`.
`external_events`/`external_tasks` scoped via a join/subquery to
`integration_connections.user_id = auth.uid()`, matching the existing
pattern used for `logs.task_id` joins to `tasks.user_id` in the current
schema. All writes to these three tables happen only via the Edge
Functions using the service role key — the client has read-only RLS
policies (`select` only) and no `insert`/`update`/`delete` policies.

## Secrets & security

- Google/Microsoft OAuth client ID+secret stored as Supabase Edge
  Function secrets, never in client env vars.
- Access/refresh tokens stored only in `integration_connections`,
  readable only by the service role (no client `select` on those two
  token columns — expose the rest of the row via a view or by excluding
  those columns in the client-facing query, since Postgres RLS is
  row-level not column-level; simplest: a `public.integration_connections_view`
  without token columns for client reads).
- Disconnecting a provider: mark `status = 'disconnected'`, revoke the
  token with the provider if their API supports it, delete the row's
  tokens, and cascade-delete associated `external_events`/`external_tasks`.

## Error handling

- Token refresh failure → connection `status = 'error'`, `last_error`
  set, surfaced in the Integrations panel with a "Reconnect" action.
  Sync engine skips that connection on subsequent runs until reconnected.
- Provider API rate limit/5xx → log and skip this connection for this
  run; don't fail the whole sync job for other users' connections.
- Partial fetch failure (events succeed, tasks fail) → still commit the
  events that succeeded; record the task-fetch error separately.

## Testing

- Unit tests for each `IntegrationProvider` implementation's response
  mapping (provider JSON → `ExternalEvent`/`ExternalTask`), using
  recorded fixture responses — no live API calls in tests.
- Unit tests for the upsert/delete-stale logic in the sync engine given
  a fixture "before" and "after" provider response set.
- Integration test (or manual QA) for the OAuth start/callback flow
  against each provider's sandbox/test app.
- Existing `useTasks`/`CalendarView` tests should be unaffected since
  native task behavior doesn't change; add new tests for
  `useExternalEvents`/`useExternalTasks` hooks and their rendering as
  read-only, badge-marked items.

## Rollout

1. Migration + RLS for the three new tables.
2. Shared `IntegrationProvider` interface + Google implementation +
   OAuth start/callback Edge Functions + `sync-integrations` Edge
   Function (Google only) + cron schedule.
3. Settings UI: connect/disconnect/status for Google.
4. `useExternalEvents`/`useExternalTasks` hooks + merge into
   `CalendarView`/`TaskManager`/`Dashboard`.
5. Repeat steps 2–4's provider-specific pieces for Microsoft, reusing
   the same engine/UI.
6. (Future, out of scope now) Add Slack/Webex/others as additional
   provider modules.
