# AI Subsystem: Message-Scanning Task Suggestions + Meeting-Conflict Detection

Status: Approved for planning
Date: 2026-09-13

## Problem

Monotask now has two-way sync with both Google and Microsoft: calendar
events and tasks flow in as real, editable rows, and local edits push
back out. This spec is Plan 3 on the previously agreed roadmap: Google
two-way sync (done) → Microsoft integration (done) → **AI subsystem
(this spec)** → mobile app.

Two related capabilities are merged into one subsystem because both
need the same underlying skill — reasoning about what's on a user's
calendar and in their inbox/chats using an LLM, and turning that
reasoning into something the user reviews and acts on, never something
that silently rewrites their data:

1. **Message-scanning for task suggestions** — scan a connected
   account's email (and, for Microsoft, Teams chat) for action items
   the user hasn't already captured as a task, and suggest them.
2. **Meeting-conflict detection** — notice when two calendar events
   overlap and suggest a new time for one of them.

Monotask already has a working AI pattern to build on: `parse-task`
(natural-language quick-add) uses the Anthropic SDK with
schema-constrained structured output and a server-side daily rate
limit (`check_and_increment_ai_usage`). This spec reuses that pattern
rather than inventing a new one. It also reuses the `connectionId`-aware
OAuth reconnect flow built for multi-account support (a `connection_id`
on `oauth_states` lets a re-auth target one specific connection) to
request additional scopes only when a user actually opts into
scanning.

`message_scan_enabled` and `last_scanned_at` have existed as unused
columns on `integration_connections` since the very first migration —
this spec is what finally uses them.

## Goals

- A user can opt in, per connection, to have that account's email (and
  Teams chat, for Microsoft) scanned for task-shaped action items.
  Scanning is off by default and requires a separate, explicit toggle
  from the base connect flow — reading message content is a bigger
  privacy step than reading a calendar, and deserves its own consent
  moment rather than being bundled into "Connect Google."
- Detected action items appear as reviewable suggestions, never as
  auto-created tasks. The user accepts (optionally editing first),
  edits, or dismisses each one.
- Monotask never retains a message's raw content or a reference back
  to it. A message is fetched, sent to the model, and discarded — only
  the model's extracted suggestion (a title/description/date, not a
  quote) is persisted.
- Overlapping events on a user's calendar (native or synced, from
  either provider) are detected automatically and produce a suggested
  new time with reasoning, reviewed the same way as a task suggestion.
  Accepting a reschedule suggestion updates the real event, which — if
  that event is synced — pushes to Google/Microsoft through the
  existing `push-integration-change` path, unchanged.
- Both features are cost-bounded server-side via the existing
  `check_and_increment_ai_usage` daily-cap mechanism, under new feature
  keys, independent of `parse-task`'s own cap.

## Non-goals

- Telegram, WhatsApp, or any other message source outside Gmail,
  Outlook Mail, and Teams. Both would need a fundamentally different
  integration model (bot tokens/webhooks for Telegram; Meta business
  verification for WhatsApp) rather than "implement `IntegrationProvider`
  again" — a separately-sequenced future spec once there's real demand,
  the same way this integration followed Google's.
- Auto-creating tasks or auto-rescheduling events without user review.
  Revisit only if the review queue proves to be pure friction in
  practice, as its own explicit follow-up decision — not a fallback
  built in from day one.
- Scanning message sources the user hasn't connected an account for.
  There is no separate "connect email/chat" flow — it rides entirely
  on the existing Google/Microsoft `integration_connections`.
- A retry queue or webhook-driven scanning. Same as the sync engine:
  the 10-minute cron is the retry mechanism for a failed scan.
- Editing an accepted suggestion's payload after the fact from a
  history view — accepted suggestions become ordinary tasks/events and
  are edited as such; dismissed ones are simply gone.

## Architecture

### 1. Data model

One table holds both kinds of suggestion, since they share an
identical review lifecycle and UI despite being produced by unrelated
code paths:

```sql
create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  -- Null for a 'reschedule' suggestion: conflict detection reasons over
  -- the user's own events regardless of which provider (or no
  -- provider) they came from, so it isn't tied to one connection.
  connection_id uuid references public.integration_connections on delete cascade,
  kind text not null check (kind in ('task', 'reschedule')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  -- 'task': { title, description, due_date, due_time, priority }
  -- 'reschedule': { event_id, other_event_id, current_start_time,
  --                 current_end_time, suggested_start_time,
  --                 suggested_end_time, reasoning } - other_event_id is
  --                 the conflicting event NOT being moved, so the pair
  --                 can be deduped regardless of which one the model
  --                 picks to move on a later run (see section 4).
  -- A jsonb payload (rather than a column per possible field across
  -- both kinds) keeps the schema honest about the two kinds having
  -- almost nothing in common beyond id/status/timestamps.
  payload jsonb not null,
  created_at timestamp with time zone not null default now()
);

alter table public.ai_suggestions enable row level security;

create policy "Users can view their own suggestions"
  on public.ai_suggestions for select using (auth.uid() = user_id);
create policy "Users can update their own suggestions"
  on public.ai_suggestions for update using (auth.uid() = user_id);
-- No insert/delete policy for clients: scan-messages and
-- detect-conflicts write via the service role; a user "dismisses" or
-- "accepts" by updating status, never by deleting the row (keeps a
-- lightweight history of what's been surfaced without a separate log).
```

`integration_connections` gains no new columns — `message_scan_enabled`
and `last_scanned_at` already exist and are exactly what this needs.

### 2. Provider extensions and the incremental-scope reconnect

`IntegrationProvider` gains two optional methods, following the same
feature-detection pattern `resolveProviderMetadata` already
established (a function never checks `provider.id === "google"` by
name):

```ts
interface ExternalMessage {
  externalId: string;
  source: "email" | "chat";
  subject: string | null; // email only
  snippet: string;         // short preview text - what actually gets sent to the model
  sender: string | null;
  receivedAt: string; // ISO timestamp
}

interface IntegrationProvider {
  // ...existing members...
  fetchMessages?(accessToken: string, windowStart: Date): Promise<ExternalMessage[]>;
  fetchChatMessages?(accessToken: string, windowStart: Date): Promise<ExternalMessage[]>;
}
```

- `googleProvider.fetchMessages` calls the Gmail API's
  `messages.list` + `messages.get` (format `metadata`, which returns
  headers and snippet without the full body — sufficient for
  extraction and keeps payload size down).
- `microsoftProvider.fetchMessages` calls Graph
  `/me/mailFolders/inbox/messages` (`subject`, `bodyPreview`, `from`,
  `receivedDateTime`).
- `microsoftProvider.fetchChatMessages` calls Graph
  `/me/chats/getAllMessages` (`body.content`, `from`,
  `createdDateTime`). Google has no chat surface in this spec, so it
  simply omits this method — `scan-messages` calls it only where
  present, exactly like the existing `resolveProviderMetadata`
  feature-detection.

New scopes: `https://www.googleapis.com/auth/gmail.readonly` (Google),
`Mail.Read` and `Chat.Read` (Microsoft) — all read-only, no write
capability requested since scanning never modifies a message.

These are requested only when a user turns on message-scanning for a
specific connection, not at initial connect — asking for "read your
email" up front, before anyone has opted into scanning, is exactly the
kind of over-broad consent screen this data deliberately avoids by
keeping the toggle separate. The toggle reuses the reconnect flow built
for multi-account support: flipping `message_scan_enabled` on calls
`integration-oauth-start` with that connection's id, requesting the
union of its existing scopes plus the new message scopes;
`integration-oauth-callback` already knows how to update a specific
connection by id rather than inserting a new one. `message_scan_enabled`
itself only flips to `true` after that reconnect succeeds — the toggle
in Settings reflects the actual granted scope, not just intent.

### 3. `scan-messages` (task suggestions)

New edge function, structured like `sync-integrations`: iterate every
connection with `message_scan_enabled = true`, `ensureFreshToken`
(reusing the same helper), then per connection:

1. `fetchMessages` (and `fetchChatMessages` where present) since
   `last_scanned_at` (first run: a bounded lookback, e.g. 24 hours —
   not the account's entire history).
2. Send the batch's `subject`/`snippet`/`sender`/`receivedAt` to Claude
   (`claude-haiku-4-5`, matching `parse-task`) with a JSON-schema
   output listing zero or more task candidates: `{ title, description,
   due_date, due_time, priority, source_message_snippet_excerpt }` —
   the model may quote a short excerpt in its reasoning, but only the
   structured title/description fields are persisted; the excerpt is
   discarded along with everything else about the source message the
   moment this function returns.
3. Insert one `ai_suggestions` row (`kind: 'task'`) per candidate,
   `connection_id` set to this connection.
4. Update `last_scanned_at` to now, regardless of whether any
   candidates were found (mirrors `last_synced_at`'s behavior in
   `sync-integrations` — a clean run advances the watermark).

Gated by `check_and_increment_ai_usage('scan-messages', DAILY_LIMIT)`
per user before step 2 runs for a given connection — a user with two
connections scanning heavily can still exhaust the cap partway through
a run; the remaining connections are simply skipped until the next
scheduled run, same as any other rate-limited AI feature.

### 4. `detect-conflicts` (reschedule suggestions)

A second, independent function, invoked by the same 10-minute cron
right after `sync-integrations` (so it reasons over freshly-pulled
events), but with no dependency on message-scanning or on any
particular provider — it only reads `events`:

1. For each user with at least one event in the near-term window
   (reuses `sync-integrations`' pull window: 1 day past, 30 days
   future), find pairs of events whose time ranges overlap.
2. For each overlapping pair not already covered by a `pending`
   `reschedule` suggestion for the same unordered pair of event ids
   (checked against both `payload->>'event_id'` and
   `payload->>'other_event_id'` in either order — prevents
   re-suggesting the same conflict every 10 minutes while the first
   suggestion is still awaiting review, regardless of which of the two
   events the model picks to move this time), send both events plus
   the rest of that day's events (for context — a proposed new time
   still shouldn't collide with a third event) to Claude, asking which
   of the two to move and to what time, with reasoning.
3. Insert an `ai_suggestions` row (`kind: 'reschedule'`, `connection_id:
   null`).

Gated by `check_and_increment_ai_usage('detect-conflicts',
DAILY_LIMIT)`, same pattern.

### 5. Settings UI

Each connected account in `IntegrationsSettings.tsx` gains a
"Scan messages for task suggestions" toggle beneath its existing
Sync now/Disconnect controls. Turning it on triggers the incremental
reconnect (window navigation to the provider's consent screen, same as
"Reconnect" today); turning it off simply updates
`message_scan_enabled` to `false` (no scope revocation call — the
still-broader-than-needed grant is harmless since nothing scans while
the flag is off, and revoking would need a reconnect of its own to
narrow back down, which isn't worth the complexity for a rarely-used
path).

### 6. Suggestions review UI

A new sidebar entry, "Suggestions," with a badge showing the pending
count (a `useAiSuggestions` hook, same shape as `useIntegrationConnections`
— a query keyed on `status = 'pending'`, plus `accept`/`dismiss`
mutations). Each row renders per `kind`:

- **`task`**: shows the extracted title/description/due date; Accept
  opens the existing `TaskModal` pre-filled from the payload (identical
  pattern to `parse-task`'s quick-add — the user still sees and can
  edit it before it's saved, never a silent insert), Dismiss sets
  `status = 'dismissed'`.
- **`reschedule`**: shows both events' current times, the suggested new
  time, and the model's reasoning; Accept updates the moved event's
  `start_time`/`end_time` via the existing `updateEvent` mutation
  (which already pushes to Google/Microsoft if synced), Dismiss sets
  `status = 'dismissed'`.

## Testing

- Unit tests for `googleProvider.fetchMessages` /
  `microsoftProvider.fetchMessages` / `fetchChatMessages` mapping
  functions, mirroring the existing `googleIntegration.test.ts` /
  `microsoftIntegration.test.ts` pattern (mock `fetch`, assert mapped
  shape).
- Unit tests for the conflict-pair-detection logic in isolation (given
  a list of events, which pairs overlap) — pure function, no network,
  easy to exhaustively test edge cases (back-to-back events that touch
  but don't overlap, all-day events, three-way overlaps).
- Integration-style test of `scan-messages`' rate-limit gating and
  `last_scanned_at` advancement, following the existing
  `sync-integrations` test conventions if any exist, or established
  fresh if not.
- Manual verification against a real connected account for each
  provider (Gmail, Outlook Mail, Teams), since message content and
  model output quality can't be meaningfully asserted in a unit test.

## Rollout

1. Migration: `ai_suggestions` table + RLS policies.
2. `IntegrationProvider` interface + Google/Microsoft
   `fetchMessages`/`fetchChatMessages` implementations and new scopes.
3. `integration-oauth-start`/`callback` already support targeting a
   specific connection (built for multi-account support) — confirm the
   incremental-scope request path works for "add scopes to an existing
   connection" specifically, not just "reconnect with the same scopes."
4. `scan-messages` edge function + cron entry.
5. `detect-conflicts` edge function + cron entry.
6. Settings UI: per-connection scan toggle.
7. Suggestions review UI: sidebar entry, `useAiSuggestions` hook,
   accept/dismiss flows for both kinds.
8. Secrets/config: no new secrets — reuses `ANTHROPIC_API_KEY`, already
   set for `parse-task`.
