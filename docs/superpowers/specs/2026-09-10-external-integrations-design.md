# External App Integrations (Calendar, Tasks & AI Task Detection)

Status: Approved for planning
Date: 2026-09-10

## Problem

Monotask only shows tasks a user creates natively. Users also have meetings
and tasks living in external apps (Google Calendar/Tasks, Microsoft
Outlook/Teams, Slack, and potentially more later), and task-shaped requests
buried inside their chat/email that never become a formal task at all. They
currently have to check each app separately and manually copy anything
actionable into Monotask. This feature connects external accounts so their
meetings and tasks surface inside Monotask, and adds AI detection that
turns task-shaped messages/emails into reviewable task suggestions.

## Goals (v1)

- Users can sign in/sign up with a Google account (Supabase Auth OAuth),
  in addition to existing email/password.
- Users can connect Google and/or Microsoft accounts for calendar/task
  sync, and Google, Microsoft, and/or Slack accounts for message scanning
  — each capability is a separate opt-in toggle per connection.
- Connected calendar/task accounts: upcoming events and open tasks are
  periodically pulled in and shown in Monotask's existing Calendar and
  Task views, visually marked with their source app.
- Connected message-scanning accounts (Gmail/Outlook mail, Slack/Teams
  chat DMs and channels): new messages are periodically scanned by AI;
  ones that look like a task become a **suggestion**, never an
  auto-created task. Suggestions appear in a "Suggested from your apps"
  Dashboard section for the user to accept (creates the task, editable
  first) or dismiss.
- Users can disconnect an account or toggle off either capability at any
  time, which stops that sync/scan and removes its imported data.
- The integration layer is provider-agnostic so a new provider can be
  added later as a new module without touching the sync/scan engines or
  UI merge logic.

## Non-goals (v1)

- Two-way sync. Monotask never writes to a provider's calendar/task/
  message data. Imported events/tasks are read-only with an "open in
  <app>" action instead of edit controls.
- Real-time sync via webhooks/push subscriptions. Freshness is handled by
  periodic polling (both the calendar/task sync and the message scan).
- Auto-creating tasks from detected messages without user confirmation.
  Every AI-detected task is a suggestion the user must accept.
- Any provider beyond Google, Microsoft, and Slack in this release.
- Editing, creating, or deleting external items (events/tasks/messages)
  from within Monotask.
- Conflict resolution, since there's nothing written back to providers.

## Architecture

### 0. Google sign-in

Add Google as a Supabase Auth OAuth provider, surfaced as a "Continue
with Google" button on the existing `Auth.tsx` alongside email/password.
This is authentication only — it does not by itself grant calendar/task/
mail/chat access. A user who signs in with Google still separately
"connects" Google under Integrations if they want calendar/task sync or
mail scanning, using its own consent screen and scopes.

### 1. Connection management

`Settings > Integrations` panel (extends `src/components/Settings.tsx` or
a new `src/components/IntegrationsSettings.tsx`) listing available
providers — Google, Microsoft, Slack — each with:
- "Connect" → OAuth via Edge Function `integration-oauth-start`,
  redirecting to the provider's consent screen.
- Callback handled by `integration-oauth-callback`, exchanging the code
  for tokens, stored server-side only.
- **Two independent toggles per connection** (where the provider
  supports the capability): "Sync calendar & tasks" (Google, Microsoft)
  and "Scan messages for tasks" (Google mail, Microsoft mail+chat,
  Slack). Each toggle requests only the scopes it needs — a user can
  sync calendar without ever granting message access, or vice versa.
- Status per connection: connected/expired/error, last synced/scanned
  time, "Sync now" / "Scan now" buttons, "Disconnect" button.

Scopes requested per capability:
| Provider | Calendar/Task sync | Message scan |
|---|---|---|
| Google | `calendar.readonly`, `tasks.readonly` | `gmail.readonly` |
| Microsoft | `Calendars.Read`, `Tasks.Read` | `Mail.Read`, `Chat.Read`, `ChannelMessage.Read.All` |
| Slack | — (no calendar/task concept) | `channels:history`, `groups:history`, `im:history`, `mpim:history` |

Client code never sees access/refresh tokens — it reads connection
metadata (provider, enabled capabilities, status, last sync/scan times)
via a client-facing view that excludes token columns (see Security).

### 2. Calendar/task sync engine

Unchanged from the original design: Edge Function `sync-integrations`,
run on a cron schedule (every 10 min) plus manual "Sync now", refreshes
tokens, fetches events/tasks in a rolling window, upserts into
`external_events`/`external_tasks` keyed by `(connection_id,
external_id)`, deletes stale rows, updates `last_synced_at`/`status`.
Applies only to connections with the calendar/task capability enabled.

### 3. Message-scanning engine

New Edge Function `scan-messages-for-tasks`, on the same cron cadence,
for connections with the message-scan capability enabled:

1. Fetch only messages/emails newer than the connection's watermark
   (`last_scanned_at` / provider-native cursor) — never rescans the same
   message twice, which bounds both API and AI-call volume.
2. For each new message, run a schema-constrained Claude call (same
   structured-output pattern as the existing `parse-task` function:
   Anthropic JSON Schema output, every field re-validated before use,
   `MODEL = claude-haiku-4-5`) that returns `{ is_task: boolean,
   confidence: number, title, description, due_date, due_time }`.
   Messages below a confidence threshold or with `is_task: false` are
   discarded immediately — no suggestion is written.
3. Hits above threshold are inserted into `suggested_tasks` (never
   directly into `tasks`).
4. Enforce a daily per-user AI-call cap, reusing the existing
   `check_and_increment_ai_usage` mechanism from `parse-task`, shared
   across both AI features so total daily AI usage per user is bounded
   in one place.
5. Advance the watermark only after successful processing of a batch.

This engine is intentionally separate from the calendar/task sync
engine — different data (message content vs. structured events/tasks),
different privacy sensitivity, different failure/backoff behavior (a
single provider's message API failing shouldn't block calendar sync or
other providers' scans).

### 4. Suggestion review flow

Dashboard gains a "Suggested from your apps" section (badge count of
`pending` suggestions), reading from a new `useSuggestedTasks` hook.
Each suggestion shows the parsed title/description/due date, the source
app badge, and a link to the original message/email (`source_url`) for
context. Actions:
- **Accept**: pre-fills the existing `TaskModal` (same "user reviews
  before insert" flow as `parse-task`'s quick-add) with the parsed
  fields; saving creates a real row via the normal `useTasks` create
  path and marks the suggestion `accepted` with `accepted_task_id` set.
- **Dismiss**: marks the suggestion `dismissed`; no task created, and
  that source message is never re-suggested (watermark already
  prevents rescanning it).

### 5. Display layer (calendar/task sync — unchanged)

`CalendarView` merges in `external_events` via `useExternalEvents`
(provider badge, opens `meeting_url` externally instead of the task
modal). `TaskManager`/`Dashboard` merge in `external_tasks` via
`useExternalTasks` (read-only cards, provider badge, opens source app).
Both are additive; native `tasks` data/behavior is unchanged.

### Provider abstraction

```ts
interface IntegrationProvider {
  id: 'google' | 'microsoft' | 'slack';
  capabilities: ('calendar_tasks' | 'message_scan')[];
  getAuthUrl(state: string, capability: string): string;
  exchangeCode(code: string): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
  // calendar_tasks capability
  fetchEvents?(tokens: TokenSet, windowStart: Date, windowEnd: Date): Promise<ExternalEvent[]>;
  fetchTasks?(tokens: TokenSet): Promise<ExternalTask[]>;
  // message_scan capability
  fetchNewMessages?(tokens: TokenSet, sinceWatermark: string): Promise<RawMessage[]>;
}
```

Google and Microsoft implement both capability groups; Slack implements
only `message_scan`. Adding a future provider means implementing this
interface for whichever capabilities it supports.

## Data model

```sql
-- One row per user-provider OAuth connection
create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('google', 'microsoft', 'slack')),
  status text not null default 'connected' check (status in ('connected', 'expired', 'error', 'disconnected')),
  calendar_sync_enabled boolean not null default false,
  message_scan_enabled boolean not null default false,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamp with time zone not null,
  scope text,
  last_synced_at timestamp with time zone,
  last_scanned_at timestamp with time zone,
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

-- AI-detected task suggestions from scanned messages/emails
create table public.suggested_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  connection_id uuid not null references public.integration_connections on delete cascade,
  source_message_id text not null,
  source_excerpt text not null,
  source_url text,
  parsed_title text not null,
  parsed_description text,
  parsed_due_date date,
  parsed_due_time time,
  confidence numeric not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  accepted_task_id uuid references public.tasks on delete set null,
  created_at timestamp with time zone not null default now(),
  unique (connection_id, source_message_id)
);
```

RLS: `integration_connections` and `suggested_tasks` scoped directly by
`user_id = auth.uid()`. `external_events`/`external_tasks` scoped via a
join/subquery to `integration_connections.user_id = auth.uid()`,
matching the existing pattern used for `logs.task_id` joins to
`tasks.user_id`. All writes to these four tables happen only via Edge
Functions using the service role key — client RLS policies are
`select`-only, no client `insert`/`update`/`delete`, except updating a
`suggested_tasks.status` to `dismissed`/`accepted` which the client does
directly (scoped to their own `user_id`, and `accepted_task_id` is set
by a database trigger or a narrowly-scoped RPC rather than trusted from
the client, to prevent linking to another user's task).

## Secrets & security

- OAuth client ID+secret per provider (Google, Microsoft, Slack) stored
  as Supabase Edge Function secrets, never in client env vars.
- Access/refresh tokens stored only in `integration_connections`,
  readable only by the service role. Client reads go through a
  `public.integration_connections_view` that excludes the token columns
  (Postgres RLS is row-level, not column-level, so column exclusion is
  handled via this view rather than a policy).
- Message-scan capability is opt-in per connection and independent of
  calendar/task sync — connecting an account for calendar sync alone
  never grants mail/chat scopes.
- Message content (`source_excerpt`) is stored only long enough to
  support the review UI; excerpts are truncated (e.g. first ~280 chars)
  rather than storing full message bodies, and rows are purged after
  the suggestion is accepted/dismissed for more than 30 days (scheduled
  cleanup, same cron function or a separate lightweight job).
- Disconnecting a provider or turning off a capability: revoke the
  token with the provider where supported, clear the relevant tokens,
  and cascade-delete associated `external_events`/`external_tasks`/
  pending `suggested_tasks` for that connection.

## Error handling

- Token refresh failure → connection `status = 'error'`, `last_error`
  set, surfaced with a "Reconnect" action; both engines skip that
  connection until reconnected.
- Provider API rate limit/5xx → log and skip that connection for this
  run; doesn't fail the whole job for other connections/users.
- Message-scan AI call failure or malformed structured output → skip
  that message (don't advance the watermark past it so it's retried
  next run), don't fail the whole batch.
- Daily AI-usage cap reached → remaining messages in that run are left
  unprocessed (watermark not advanced past them) and picked up on a
  later run once the cap resets.

## Testing

- Unit tests for each `IntegrationProvider` implementation's response
  mapping (provider JSON → `ExternalEvent`/`ExternalTask`/`RawMessage`),
  using recorded fixtures — no live API calls in tests.
- Unit tests for the sync engine's upsert/delete-stale logic and the
  scan engine's watermark-advance/threshold logic, given fixture
  before/after data.
- Unit tests for the message-scan structured-output schema validation,
  mirroring the existing `parse-task` tests (malformed model output
  surfaces cleanly, never silently creates a suggestion from garbage).
- Integration test / manual QA for OAuth start/callback per provider,
  and for the Google sign-in flow.
- New tests for `useExternalEvents`/`useExternalTasks`/
  `useSuggestedTasks` hooks and their read-only/suggestion-review
  rendering. Existing `useTasks`/`CalendarView` tests are unaffected.

## Rollout

1. Migration + RLS for `integration_connections`,
   `external_events`, `external_tasks`, `suggested_tasks`.
2. Google sign-in (Supabase Auth provider + button on `Auth.tsx`).
3. Shared `IntegrationProvider` interface + Google implementation
   (calendar/tasks + gmail) + OAuth start/callback Edge Functions +
   `sync-integrations` (Google only) + cron schedule.
4. Settings UI: connect/disconnect/per-capability toggles/status for
   Google.
5. `useExternalEvents`/`useExternalTasks` hooks + merge into
   `CalendarView`/`TaskManager`/`Dashboard`.
6. `scan-messages-for-tasks` engine (Google mail only) +
   `suggested_tasks` + Dashboard "Suggested from your apps" section +
   accept/dismiss flow.
7. Repeat steps 3–6's provider-specific pieces for Microsoft
   (calendar/tasks/mail/chat).
8. Add Slack as a message-scan-only provider, reusing the scan engine
   and review UI unchanged.
