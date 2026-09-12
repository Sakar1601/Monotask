# Microsoft (Outlook Calendar/Tasks + Teams) Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Microsoft as a second `IntegrationProvider` — Outlook Calendar/Tasks two-way sync plus Teams meeting links riding on synced events — reusing the exact sync/push/conflict-resolution mechanism already shipped for Google, proving the abstraction generalizes.

**Architecture:** A new `microsoft.ts` provider module implements the full `IntegrationProvider` interface against Microsoft Graph. The four existing Edge Functions (`integration-oauth-start`, `integration-oauth-callback`, `sync-integrations`, `push-integration-change`) stop hardcoding `googleProvider` and instead look up the connection's/request's provider in a new `registry.ts`. Ahead of that, the `google_connection_id`/`google_task_id`/`google_event_id` columns are renamed to provider-neutral names and a `sync_provider` column is added, across every already-shipped Google code path, so the rename lands as one clean, behavior-preserving step before any Microsoft-specific code exists.

**Tech Stack:** Supabase (Postgres + Edge Functions, Deno), React + TypeScript + `@tanstack/react-query`, Vitest for pure-function unit tests.

**Spec:** `docs/superpowers/specs/2026-09-12-microsoft-outlook-teams-integration-design.md`, building on `docs/superpowers/plans/2026-09-10-two-way-sync-foundation.md` and `docs/superpowers/plans/2026-09-12-two-way-sync-push-mechanism.md` (both already implemented and merged).

## Global Constraints

- No "Continue with Microsoft" sign-in — connect-for-sync only. (Spec: Non-goals.)
- No Teams chat, no Teams data beyond the meeting join link already present on a synced Outlook Calendar event. (Spec: Non-goals.)
- The conflict-resolution mechanism itself (whole-record last-write-wins, `last_seen_at`/`synced_at` split, retry-on-next-pull) is reused unchanged via the registry — no changes to that logic in this plan. (Spec: Non-goals.)
- Only the `common` Microsoft OAuth tenant endpoint is used; no per-account-type (personal vs. work/school) behavior differences. (Spec: Non-goals.)
- The `google_connection_id`/`google_task_id`/`google_event_id` → `sync_connection_id`/`external_task_id`/`external_event_id` rename is identifier-only — no behavior change to any existing Google code path's logic. (Spec: Architecture §1.)
- `sync_provider` is denormalized onto `tasks`/`events` so the UI/export code can label a row's source without a join. (Spec: Architecture §1.)
- Follow this repo's existing Edge Function conventions (`corsHeaders`, `verify_jwt = false` + self-auth via `getUser()`, `Deno.env.get(...)!`) and hook conventions (`useMutation` + `onMutate`/`onSuccess` + toast).
- **Design refinement beyond the spec's literal text, needed for correctness:** the spec's migration SQL (Architecture §1) widens `integration_connections`'s provider check constraint but does not mention `oauth_states`, which has its own, separate `check (provider in ('google'))` constraint from the original OAuth-foundation migration. Left unchanged, the very first Microsoft connect attempt would fail at `integration-oauth-start`'s `insert into oauth_states` with a Postgres check-constraint violation. Task 1's migration widens this constraint too.
- **Design refinement beyond the spec's literal text, needed for correctness:** the spec describes resolving Microsoft's default task-list id and "caching it in the connection's `provider_metadata`" but does not specify the interface mechanism. This plan adds one optional method to `IntegrationProvider`, `resolveProviderMetadata?(accessToken): Promise<Record<string, unknown>>`, and one optional 3rd/4th parameter (`providerMetadata`) on `fetchTasks`/`updateTask`/`deleteTask`. Google's implementation ignores both — it has no provider metadata to resolve — keeping `sync-integrations`/`push-integration-change` entirely provider-agnostic (they call `resolveProviderMetadata` generically for whichever provider defines it, rather than special-casing Microsoft by name).

---

## File Structure

**New:**
- `supabase/migrations/20260913120000-microsoft-provider-support.sql` — column renames, `sync_provider`/`provider_metadata` columns, widened check constraints (`integration_connections`, `oauth_states`).
- `supabase/functions/_shared/integrations/microsoft.ts` — full `IntegrationProvider` implementation for Microsoft Graph.
- `supabase/functions/_shared/integrations/registry.ts` — `Record<string, IntegrationProvider>` lookup.
- `src/utils/microsoftIntegration.test.ts` — request-shape tests mirroring `googleIntegration.test.ts`.

**Modify:**
- `supabase/functions/_shared/integrations/types.ts` — `IntegrationProvider.id` widens to `"google" | "microsoft"`; `fetchTasks`/`updateTask`/`deleteTask` gain an optional `providerMetadata` parameter; new optional `resolveProviderMetadata` method.
- `supabase/functions/sync-integrations/index.ts` — column rename, registry routing, per-provider `REQUIRED_SCOPES`, provider-metadata resolve-and-cache.
- `supabase/functions/push-integration-change/index.ts` — column rename, registry routing, provider-metadata resolve-and-cache.
- `supabase/functions/integration-oauth-start/index.ts` — registry routing, accepts `"microsoft"`.
- `supabase/functions/integration-oauth-callback/index.ts` — registry routing.
- `src/hooks/useTasks.tsx` — column rename (`Task` interface + push payload).
- `src/hooks/useEvents.tsx` — column rename (`Event` interface + push payload).
- `src/hooks/useIntegrationConnections.tsx` — `provider` type widens; new `connectMicrosoft`.
- `src/components/EventsView.tsx` — column rename; badge label reads `sync_provider`.
- `src/components/EventModal.tsx` — column rename; "(from Google)" label reads `sync_provider`.
- `src/components/IntegrationsSettings.tsx` — extracted `ProviderConnectionRow`, used for both Google and Microsoft.
- `src/utils/dataPortability.ts` — column rename; `source` union widens to `'monotask' | 'google' | 'microsoft'`, driven by `sync_provider`.
- `src/utils/dataPortability.test.ts` — updated fixtures for the rename.
- `src/utils/pdfExport.ts` — column rename; `[Google]`/`[Outlook]` label driven by `sync_provider`.
- `src/components/Settings.tsx` — CSV export column rename; `Source` column driven by `sync_provider`.
- `src/integrations/supabase/types.ts` — regenerated after the migration.

**Unchanged (verified, not touched by this plan):**
- `src/components/TaskManager.tsx` and `src/components/CalendarView.tsx` reference only `sync_error`, never `google_connection_id`/`google_task_id`/`google_event_id` — no rename needed there.
- `src/components/Dashboard.tsx` has no source-of-origin label of any kind today — nothing for `sync_provider` to plug into, so it is out of scope for this plan (the spec's mention of it was aspirational; there is no existing display logic to widen).
- `supabase/functions/_shared/integrations/google.ts` needs no changes — it never references the `google_connection_id`/`google_task_id`/`google_event_id` Postgres column names (those are only touched by the Edge Functions doing DB reads/writes), and its `id: "google"` literal narrows into the widened `"google" | "microsoft"` union without any edit.
- `supabase/config.toml` needs no new entries — this plan reuses the four existing Edge Function names; none are new.

---

### Task 1: Provider-neutral schema rename

**Files:**
- Create: `supabase/migrations/20260913120000-microsoft-provider-support.sql`
- Modify: `supabase/functions/sync-integrations/index.ts`
- Modify: `supabase/functions/push-integration-change/index.ts`
- Modify: `src/hooks/useTasks.tsx`
- Modify: `src/hooks/useEvents.tsx`
- Modify: `src/components/EventsView.tsx`
- Modify: `src/components/EventModal.tsx`
- Modify: `src/utils/dataPortability.ts`
- Modify: `src/utils/dataPortability.test.ts`
- Modify: `src/utils/pdfExport.ts`
- Modify: `src/components/Settings.tsx`
- Modify: `src/integrations/supabase/types.ts` (regenerated)

**Interfaces:**
- Produces: `tasks.sync_connection_id`, `tasks.external_task_id`, `tasks.sync_provider`, `events.sync_connection_id`, `events.external_event_id`, `events.sync_provider`, `integration_connections.provider_metadata` (jsonb, nullable). Every later task in this plan reads/writes these names, never the old `google_*` names.

This task is a single mechanical rename — no behavior change anywhere. It intentionally does the *entire* rename (schema + every consumer) in one task rather than splitting it, because a partial rename would leave the repo in a state that doesn't compile.

- [ ] **Step 1: Write the migration**

```sql
-- Provider-neutral renames: a second provider (Microsoft) makes the
-- google_* names on tasks/events permanently misleading if not fixed now.
-- Identifier-only change - no behavior change to any existing Google code
-- path's logic (every call site is updated in this same commit).
alter table public.tasks rename column google_connection_id to sync_connection_id;
alter table public.tasks rename column google_task_id to external_task_id;
alter table public.events rename column google_connection_id to sync_connection_id;
alter table public.events rename column google_event_id to external_event_id;

-- Denormalized so the UI/export code can label a row's source without a
-- join back to integration_connections on every render.
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

-- oauth_states has its own, separate provider check constraint (not
-- covered by the spec's SQL) - without widening it too, the very first
-- Microsoft connect attempt fails at integration-oauth-start's insert.
alter table public.oauth_states drop constraint oauth_states_provider_check;
alter table public.oauth_states
  add constraint oauth_states_provider_check
  check (provider in ('google', 'microsoft'));
```

- [ ] **Step 2: Apply and verify**

```bash
docker exec -i supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres < supabase/migrations/20260913120000-microsoft-provider-support.sql
docker exec supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres -c "\d tasks" | grep -E "sync_connection_id|external_task_id|sync_provider"
docker exec supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres -c "\d events" | grep -E "sync_connection_id|external_event_id|sync_provider"
docker exec supabase_db_masofmjpnpnxjooqdajl psql -U postgres -d postgres -c "\d integration_connections" | grep provider_metadata
```
Expected: every grep prints a matching line; none of the old `google_*` column names remain.

- [ ] **Step 3: Rename every reference in `sync-integrations/index.ts`**

In `supabase/functions/sync-integrations/index.ts`, replace every occurrence of `google_connection_id` with `sync_connection_id`, `google_event_id` with `external_event_id`, and `google_task_id` with `external_task_id`. This touches:
- The `.select(...)` string in `upsertEvents`'s existing-row lookup (`"google_event_id, updated_at, synced_at"` → `"external_event_id, updated_at, synced_at"`), its `.eq("google_connection_id", ...)`, the `existingByExternalId` population (`row.google_event_id`), the upsert payload object's `google_connection_id`/`google_event_id` keys, the `onConflict` string (`"google_connection_id,google_event_id"` → `"sync_connection_id,external_event_id"`), the `toTouch`/pending-rows `.select`/`.eq`/`.in` calls, and the final delete-stale `.eq("google_connection_id", ...)`.
- The identical set of call sites in `upsertTasks` (with `external_task_id` in place of `external_event_id`).

Do not change any logic, field ordering, or comments beyond the identifier text itself.

- [ ] **Step 4: Rename every reference in `push-integration-change/index.ts`**

In `supabase/functions/push-integration-change/index.ts`, the two `sync_error`/`synced_at` update blocks currently read:

```ts
      if (body.action === "update") {
        const table = body.type === "event" ? "events" : "tasks";
        await adminClient
          .from(table)
          .update({ sync_error: message })
          .eq("google_connection_id", body.connectionId)
          .eq(body.type === "event" ? "google_event_id" : "google_task_id", body.externalId);
      }
```
and
```ts
    if (body.action === "update") {
      const now = new Date().toISOString();
      const table = body.type === "event" ? "events" : "tasks";
      await adminClient
        .from(table)
        .update({ synced_at: now, last_seen_at: now, sync_error: null })
        .eq("google_connection_id", body.connectionId)
        .eq(body.type === "event" ? "google_event_id" : "google_task_id", body.externalId);
    }
```

Change both `.eq("google_connection_id", body.connectionId)` to `.eq("sync_connection_id", body.connectionId)`, and both `body.type === "event" ? "google_event_id" : "google_task_id"` to `body.type === "event" ? "external_event_id" : "external_task_id"`. No other logic changes.

- [ ] **Step 5: Rename in `useTasks.tsx`**

In `src/hooks/useTasks.tsx`, change the `Task` interface:

```ts
  google_connection_id?: string | null;
  google_task_id?: string | null;
```
to
```ts
  sync_connection_id?: string | null;
  external_task_id?: string | null;
  sync_provider?: 'google' | 'microsoft' | null;
```

(`sync_provider` is added here now, read-only, so Task 9's export/label work has it on the type; nothing in this task writes to it from the client.)

In `updateTaskMutation`'s `onSuccess`, change:
```ts
      if (updatedTask.google_connection_id && updatedTask.google_task_id) {
        supabase.functions
          .invoke('push-integration-change', {
            body: {
              type: 'task',
              action: 'update',
              connectionId: updatedTask.google_connection_id,
              externalId: updatedTask.google_task_id,
```
to
```ts
      if (updatedTask.sync_connection_id && updatedTask.external_task_id) {
        supabase.functions
          .invoke('push-integration-change', {
            body: {
              type: 'task',
              action: 'update',
              connectionId: updatedTask.sync_connection_id,
              externalId: updatedTask.external_task_id,
```

In `deleteTaskMutation`'s `onSuccess`, change:
```ts
      if (snapshot?.google_connection_id && snapshot?.google_task_id) {
        supabase.functions
          .invoke('push-integration-change', {
            body: {
              type: 'task',
              action: 'delete',
              connectionId: snapshot.google_connection_id,
              externalId: snapshot.google_task_id,
```
to
```ts
      if (snapshot?.sync_connection_id && snapshot?.external_task_id) {
        supabase.functions
          .invoke('push-integration-change', {
            body: {
              type: 'task',
              action: 'delete',
              connectionId: snapshot.sync_connection_id,
              externalId: snapshot.external_task_id,
```

- [ ] **Step 6: Rename in `useEvents.tsx`**

In `src/hooks/useEvents.tsx`, change the `Event` interface:
```ts
  google_connection_id?: string | null;
  google_event_id?: string | null;
```
to
```ts
  sync_connection_id?: string | null;
  external_event_id?: string | null;
  sync_provider?: 'google' | 'microsoft' | null;
```

In `updateEventMutation`'s `onSuccess`, change:
```ts
      if (updatedEvent.google_connection_id && updatedEvent.google_event_id) {
        supabase.functions
          .invoke('push-integration-change', {
            body: {
              type: 'event',
              action: 'update',
              connectionId: updatedEvent.google_connection_id,
              externalId: updatedEvent.google_event_id,
```
to
```ts
      if (updatedEvent.sync_connection_id && updatedEvent.external_event_id) {
        supabase.functions
          .invoke('push-integration-change', {
            body: {
              type: 'event',
              action: 'update',
              connectionId: updatedEvent.sync_connection_id,
              externalId: updatedEvent.external_event_id,
```

In `deleteEventMutation`'s `onSuccess`, change:
```ts
      if (snapshot?.google_connection_id && snapshot?.google_event_id) {
        supabase.functions
          .invoke('push-integration-change', {
            body: {
              type: 'event',
              action: 'delete',
              connectionId: snapshot.google_connection_id,
              externalId: snapshot.google_event_id,
```
to
```ts
      if (snapshot?.sync_connection_id && snapshot?.external_event_id) {
        supabase.functions
          .invoke('push-integration-change', {
            body: {
              type: 'event',
              action: 'delete',
              connectionId: snapshot.sync_connection_id,
              externalId: snapshot.external_event_id,
```

- [ ] **Step 7: Rename in `EventsView.tsx`**

In `src/components/EventsView.tsx`, change:
```tsx
                  {event.google_connection_id && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
                      Google
                    </span>
                  )}
```
to
```tsx
                  {event.sync_connection_id && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
                      Google
                    </span>
                  )}
```

(The badge still hardcodes "Google" for now, preserving identical behavior — Task 10 makes this label dynamic via `sync_provider`.)

- [ ] **Step 8: Rename in `EventModal.tsx`**

In `src/components/EventModal.tsx`, change:
```ts
  const isGoogleOrigin = !!event?.google_connection_id;
```
to
```ts
  const isGoogleOrigin = !!event?.sync_connection_id;
```

(Still named `isGoogleOrigin` and still renders "(from Google)" — Task 10 generalizes this.)

- [ ] **Step 9: Rename in `dataPortability.ts`**

In `src/utils/dataPortability.ts`, change the two `source` computations:
```ts
      source: task.google_connection_id ? 'google' : 'monotask',
```
to
```ts
      source: task.sync_connection_id ? 'google' : 'monotask',
```
and
```ts
      source: event.google_connection_id ? 'google' : 'monotask',
```
to
```ts
      source: event.sync_connection_id ? 'google' : 'monotask',
```

(Still hardcodes `'google'` for now — Task 10 makes this read `sync_provider`.)

- [ ] **Step 10: Rename in `dataPortability.test.ts`**

In `src/utils/dataPortability.test.ts`, in the `'buildExportData tags each task and event with its source'` test, change:
```ts
    { id: '1', title: 'Native task', priority: 'low', status: 'pending', created_at: '', updated_at: '', user_id: 'u', google_connection_id: null },
    { id: '2', title: 'Synced task', priority: 'medium', status: 'pending', created_at: '', updated_at: '', user_id: 'u', google_connection_id: 'conn-1' },
  ];
  const events: Event[] = [
    { id: '3', title: 'Native event', start_time: '2026-01-01T00:00:00Z', created_at: '', updated_at: '', user_id: 'u', google_connection_id: null },
    { id: '4', title: 'Synced event', start_time: '2026-01-01T00:00:00Z', created_at: '', updated_at: '', user_id: 'u', google_connection_id: 'conn-1' },
```
to
```ts
    { id: '1', title: 'Native task', priority: 'low', status: 'pending', created_at: '', updated_at: '', user_id: 'u', sync_connection_id: null },
    { id: '2', title: 'Synced task', priority: 'medium', status: 'pending', created_at: '', updated_at: '', user_id: 'u', sync_connection_id: 'conn-1' },
  ];
  const events: Event[] = [
    { id: '3', title: 'Native event', start_time: '2026-01-01T00:00:00Z', created_at: '', updated_at: '', user_id: 'u', sync_connection_id: null },
    { id: '4', title: 'Synced event', start_time: '2026-01-01T00:00:00Z', created_at: '', updated_at: '', user_id: 'u', sync_connection_id: 'conn-1' },
```

- [ ] **Step 11: Rename in `pdfExport.ts`**

In `src/utils/pdfExport.ts`, change:
```ts
      const source = task.google_connection_id ? ' [Google]' : '';
```
to
```ts
      const source = task.sync_connection_id ? ' [Google]' : '';
```
and
```ts
      const source = event.google_connection_id ? ' [Google]' : '';
```
to
```ts
      const source = event.sync_connection_id ? ' [Google]' : '';
```

- [ ] **Step 12: Rename in `Settings.tsx`**

In `src/components/Settings.tsx`, in `handleExportCSV`, change:
```ts
        task.google_connection_id ? 'Google' : 'Monotask',
```
to
```ts
        task.sync_connection_id ? 'Google' : 'Monotask',
```
and
```ts
        event.google_connection_id ? 'Google' : 'Monotask',
```
to
```ts
        event.sync_connection_id ? 'Google' : 'Monotask',
```

- [ ] **Step 13: Regenerate Supabase types**

Run: `supabase gen types typescript --local > src/integrations/supabase/types.ts` (if this doesn't pick up the migration locally, re-apply it via Step 2's manual method first, then regenerate — same workaround used in every prior plan).

- [ ] **Step 14: Verify the whole repo compiles and existing tests still pass**

Run: `npx tsc --noEmit` — no errors.
Run: `npm test` — passing (this covers `googleIntegration.test.ts` and `dataPortability.test.ts`, both of which exercise the renamed fields).

- [ ] **Step 15: Commit**

```bash
git add supabase/migrations/20260913120000-microsoft-provider-support.sql \
  supabase/functions/sync-integrations/index.ts \
  supabase/functions/push-integration-change/index.ts \
  src/hooks/useTasks.tsx src/hooks/useEvents.tsx \
  src/components/EventsView.tsx src/components/EventModal.tsx src/components/Settings.tsx \
  src/utils/dataPortability.ts src/utils/dataPortability.test.ts src/utils/pdfExport.ts \
  src/integrations/supabase/types.ts
git commit -m "Rename Google-specific sync columns to provider-neutral names

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Widen the `IntegrationProvider` interface

**Files:**
- Modify: `supabase/functions/_shared/integrations/types.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `IntegrationProvider.id: "google" | "microsoft"`; `fetchTasks(accessToken, completedMin, providerMetadata?)`; `updateTask(accessToken, externalTaskId, changes, providerMetadata?)`; `deleteTask(accessToken, externalTaskId, providerMetadata?)`; optional `resolveProviderMetadata?(accessToken): Promise<Record<string, unknown>>`. Task 3 (Microsoft provider) and Task 7/8 (sync/push routing) both depend on these exact signatures.

- [ ] **Step 1: Update the interface**

Replace the `IntegrationProvider` interface in `supabase/functions/_shared/integrations/types.ts`:

```ts
export interface IntegrationProvider {
  id: "google" | "microsoft";
  getAuthUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
  fetchEvents(accessToken: string, windowStart: Date, windowEnd: Date): Promise<ExternalEvent[]>;
  fetchTasks(accessToken: string, completedMin: Date, providerMetadata?: Record<string, unknown> | null): Promise<ExternalTask[]>;
  updateEvent(accessToken: string, externalEventId: string, changes: EventChanges): Promise<void>;
  deleteEvent(accessToken: string, externalEventId: string): Promise<void>;
  updateTask(accessToken: string, externalTaskId: string, changes: TaskChanges, providerMetadata?: Record<string, unknown> | null): Promise<void>;
  deleteTask(accessToken: string, externalTaskId: string, providerMetadata?: Record<string, unknown> | null): Promise<void>;
  // Optional: providers with extra per-connection state to resolve once and
  // cache (e.g. Microsoft's default task-list id) implement this. Providers
  // without any such state (Google) simply omit it - sync-integrations and
  // push-integration-change call it generically, by feature-detection, so
  // neither function ever special-cases a provider by name.
  resolveProviderMetadata?(accessToken: string): Promise<Record<string, unknown>>;
}
```

This is the only change in this file — `TokenSet`, `ExternalEvent`, `ExternalTask`, `EventChanges`, `TaskChanges` are unchanged.

- [ ] **Step 2: Verify `google.ts` still satisfies the interface**

Run: `npx tsc --noEmit` — no errors. `googleProvider`'s `id: "google"` literal narrows fine into the widened union, and its `fetchTasks`/`updateTask`/`deleteTask` implementations simply don't declare the new optional 3rd parameter (TypeScript allows an implementation to accept fewer parameters than the interface signature specifies for optional trailing parameters).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/integrations/types.ts
git commit -m "Widen IntegrationProvider for a second (Microsoft) implementation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Microsoft provider module + registry

**Files:**
- Create: `supabase/functions/_shared/integrations/microsoft.ts`
- Create: `supabase/functions/_shared/integrations/registry.ts`
- Create: `src/utils/microsoftIntegration.test.ts`

**Interfaces:**
- Consumes: `IntegrationProvider`, `EventChanges`, `ExternalEvent`, `ExternalTask`, `TaskChanges`, `TokenSet` from `./types.ts` (Task 2).
- Produces: `microsoftProvider: IntegrationProvider` (exported from `microsoft.ts`); `mapMicrosoftEvent`, `mapMicrosoftTask` (exported for the test file); `providers: Record<string, IntegrationProvider>` (exported from `registry.ts`), keyed `"google"` and `"microsoft"`. Tasks 5-8 import `providers` from this file instead of importing `googleProvider` directly.

- [ ] **Step 1: Write `microsoft.ts`**

```ts
import type { EventChanges, ExternalEvent, ExternalTask, IntegrationProvider, TaskChanges, TokenSet } from "./types.ts";

const MICROSOFT_SCOPES = "offline_access Calendars.ReadWrite Tasks.ReadWrite";

// The `common` tenant endpoint accepts both personal Microsoft accounts and
// work/school (Azure AD) accounts through the same authorize/token URLs -
// no per-account-type branching needed (spec Non-goals).
const AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function tokenSetFromResponse(json: Record<string, unknown>, fallbackRefreshToken?: string): TokenSet {
  const expiresInSeconds = typeof json.expires_in === "number" ? json.expires_in : 3600;
  return {
    accessToken: json.access_token as string,
    refreshToken: (json.refresh_token as string) ?? fallbackRefreshToken ?? "",
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    scope: (json.scope as string) ?? MICROSOFT_SCOPES,
  };
}

interface GraphDateTime {
  dateTime?: string;
  timeZone?: string;
}

interface GraphEventPayload {
  id?: string;
  subject?: string;
  start?: GraphDateTime;
  end?: GraphDateTime;
  isOnlineMeeting?: boolean;
  onlineMeeting?: { joinUrl?: string };
  webLink?: string;
}

interface GraphTaskPayload {
  id?: string;
  title?: string;
  status?: string;
  dueDateTime?: GraphDateTime;
  completedDateTime?: GraphDateTime;
}

interface GraphTaskList {
  id: string;
  wellknownListName?: string;
}

// Graph's calendarView/todo dateTime strings carry no offset - they are
// local to whatever timezone the request specified. This provider never
// sends a "Prefer: outlook.timezone" header, so Graph defaults to UTC,
// making a trailing "Z" always correct to append.
function asUtcIso(dateTime?: string): string | null {
  if (!dateTime) return null;
  return dateTime.endsWith("Z") ? dateTime : `${dateTime}Z`;
}

export function mapMicrosoftEvent(item: GraphEventPayload): ExternalEvent | null {
  const start = asUtcIso(item.start?.dateTime);
  if (!item.id || !start) return null;
  return {
    externalId: item.id,
    title: item.subject || "(No title)",
    startTime: start,
    endTime: asUtcIso(item.end?.dateTime),
    meetingUrl: item.onlineMeeting?.joinUrl ?? item.webLink ?? null,
    rawPayload: item,
  };
}

export function mapMicrosoftTask(item: GraphTaskPayload): ExternalTask | null {
  if (!item.id) return null;
  return {
    externalId: item.id,
    title: item.title || "(No title)",
    dueDate: item.dueDateTime?.dateTime ? item.dueDateTime.dateTime.slice(0, 10) : null,
    status: item.status === "completed" ? "completed" : "pending",
    completedAt: asUtcIso(item.completedDateTime?.dateTime),
    // Microsoft Graph's To Do task resource has no equivalent of Google
    // Tasks' webViewLink - there is no single-task deep link to expose.
    sourceUrl: null,
    rawPayload: item,
  };
}

function requireTaskListId(providerMetadata?: Record<string, unknown> | null): string {
  const taskListId = (providerMetadata as { taskListId?: string } | null | undefined)?.taskListId;
  if (!taskListId) {
    throw new Error("Microsoft task operation requires a resolved taskListId in providerMetadata");
  }
  return taskListId;
}

export const microsoftProvider: IntegrationProvider = {
  id: "microsoft",

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: Deno.env.get("MICROSOFT_CLIENT_ID")!,
      redirect_uri: redirectUri,
      response_type: "code",
      response_mode: "query",
      scope: MICROSOFT_SCOPES,
      state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get("MICROSOFT_CLIENT_ID")!,
        client_secret: Deno.env.get("MICROSOFT_CLIENT_SECRET")!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: MICROSOFT_SCOPES,
      }),
    });
    if (!response.ok) throw new Error(`Microsoft token exchange failed: ${response.status} ${await response.text()}`);
    return tokenSetFromResponse(await response.json());
  },

  async refreshToken(refreshToken: string): Promise<TokenSet> {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: Deno.env.get("MICROSOFT_CLIENT_ID")!,
        client_secret: Deno.env.get("MICROSOFT_CLIENT_SECRET")!,
        grant_type: "refresh_token",
        scope: MICROSOFT_SCOPES,
      }),
    });
    if (!response.ok) throw new Error(`Microsoft token refresh failed: ${response.status} ${await response.text()}`);
    return tokenSetFromResponse(await response.json(), refreshToken);
  },

  async fetchEvents(accessToken: string, windowStart: Date, windowEnd: Date): Promise<ExternalEvent[]> {
    const params = new URLSearchParams({
      startDateTime: windowStart.toISOString(),
      endDateTime: windowEnd.toISOString(),
      $top: "250",
      $orderby: "start/dateTime",
    });
    const events: ExternalEvent[] = [];
    let url: string | undefined = `${GRAPH_BASE}/me/calendarView?${params.toString()}`;
    let pageCount = 0;
    const MAX_PAGES = 20; // matches google.ts's page-count ceiling pattern
    while (url && pageCount < MAX_PAGES) {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error(`Microsoft calendar fetch failed: ${response.status} ${await response.text()}`);
      const json = await response.json() as { value?: GraphEventPayload[]; "@odata.nextLink"?: string };
      events.push(...(json.value ?? []).map(mapMicrosoftEvent).filter((e): e is ExternalEvent => e !== null));
      url = json["@odata.nextLink"];
      pageCount++;
    }
    return events;
  },

  async resolveProviderMetadata(accessToken: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${GRAPH_BASE}/me/todo/lists`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error(`Microsoft To Do lists fetch failed: ${response.status} ${await response.text()}`);
    const json = await response.json() as { value?: GraphTaskList[] };
    const defaultList = (json.value ?? []).find((list) => list.wellknownListName === "defaultList");
    if (!defaultList) throw new Error("Could not find Microsoft To Do's default task list");
    return { taskListId: defaultList.id };
  },

  async fetchTasks(accessToken: string, _completedMin: Date, providerMetadata?: Record<string, unknown> | null): Promise<ExternalTask[]> {
    const taskListId = requireTaskListId(providerMetadata);
    const params = new URLSearchParams({ $top: "100" });
    const tasks: ExternalTask[] = [];
    let url: string | undefined = `${GRAPH_BASE}/me/todo/lists/${encodeURIComponent(taskListId)}/tasks?${params.toString()}`;
    let pageCount = 0;
    const MAX_PAGES = 20; // 20 * 100 = 2,000 tasks/run ceiling, matches google.ts
    while (url && pageCount < MAX_PAGES) {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error(`Microsoft tasks fetch failed: ${response.status} ${await response.text()}`);
      const json = await response.json() as { value?: GraphTaskPayload[]; "@odata.nextLink"?: string };
      tasks.push(...(json.value ?? []).map(mapMicrosoftTask).filter((t): t is ExternalTask => t !== null));
      url = json["@odata.nextLink"];
      pageCount++;
    }
    return tasks;
  },

  async updateEvent(accessToken: string, externalEventId: string, changes: EventChanges): Promise<void> {
    const body: Record<string, unknown> = {};
    if (changes.title !== undefined) body.subject = changes.title;
    if (changes.description !== undefined) {
      body.body = changes.description === null ? null : { contentType: "text", content: changes.description };
    }
    if (changes.startTime !== undefined) body.start = { dateTime: changes.startTime, timeZone: "UTC" };
    if (changes.endTime !== undefined) body.end = changes.endTime ? { dateTime: changes.endTime, timeZone: "UTC" } : null;
    if (changes.location !== undefined) body.location = changes.location === null ? null : { displayName: changes.location };

    const response = await fetch(`${GRAPH_BASE}/me/events/${encodeURIComponent(externalEventId)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Microsoft event update failed: ${response.status} ${await response.text()}`);
  },

  async deleteEvent(accessToken: string, externalEventId: string): Promise<void> {
    const response = await fetch(`${GRAPH_BASE}/me/events/${encodeURIComponent(externalEventId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // Graph returns 404 if the event was already deleted on their side -
    // treat that the same as success, since the end state (gone) matches
    // (Google's equivalent is a 410; Graph doesn't use 410 for this case).
    if (!response.ok && response.status !== 404) {
      throw new Error(`Microsoft event delete failed: ${response.status} ${await response.text()}`);
    }
  },

  async updateTask(accessToken: string, externalTaskId: string, changes: TaskChanges, providerMetadata?: Record<string, unknown> | null): Promise<void> {
    const taskListId = requireTaskListId(providerMetadata);
    const body: Record<string, unknown> = {};
    if (changes.title !== undefined) body.title = changes.title;
    if (changes.dueDate !== undefined) {
      body.dueDateTime = changes.dueDate ? { dateTime: `${changes.dueDate}T00:00:00.0000000`, timeZone: "UTC" } : null;
    }
    if (changes.status !== undefined) body.status = changes.status === "completed" ? "completed" : "notStarted";

    const response = await fetch(
      `${GRAPH_BASE}/me/todo/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(externalTaskId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) throw new Error(`Microsoft task update failed: ${response.status} ${await response.text()}`);
  },

  async deleteTask(accessToken: string, externalTaskId: string, providerMetadata?: Record<string, unknown> | null): Promise<void> {
    const taskListId = requireTaskListId(providerMetadata);
    const response = await fetch(
      `${GRAPH_BASE}/me/todo/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(externalTaskId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok && response.status !== 404) {
      throw new Error(`Microsoft task delete failed: ${response.status} ${await response.text()}`);
    }
  },
};
```

- [ ] **Step 2: Write `registry.ts`**

```ts
import { googleProvider } from "./google.ts";
import { microsoftProvider } from "./microsoft.ts";
import type { IntegrationProvider } from "./types.ts";

export const providers: Record<string, IntegrationProvider> = {
  google: googleProvider,
  microsoft: microsoftProvider,
};
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit` — no errors. This is the point where `microsoftProvider: IntegrationProvider` is checked against the full interface for the first time (all methods present, including the required ones), and where `registry.ts`'s `Record<string, IntegrationProvider>` literal type-checks both entries.

- [ ] **Step 4: Write `microsoftIntegration.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapMicrosoftEvent, mapMicrosoftTask, microsoftProvider } from '../../supabase/functions/_shared/integrations/microsoft.ts';

declare global {
  const Deno: { env: { get(name: string): string | undefined } };
}

describe('Microsoft mapping', () => {
  it('maps a Graph event, defaulting to UTC when no offset is present', () => {
    expect(mapMicrosoftEvent({
      id: 'evt-1',
      subject: 'Standup',
      start: { dateTime: '2026-09-15T09:00:00.0000000' },
      end: { dateTime: '2026-09-15T09:30:00.0000000' },
      onlineMeeting: { joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc' },
    })).toMatchObject({
      externalId: 'evt-1',
      title: 'Standup',
      startTime: '2026-09-15T09:00:00.0000000Z',
      endTime: '2026-09-15T09:30:00.0000000Z',
      meetingUrl: 'https://teams.microsoft.com/l/meetup-join/abc',
    });
  });

  it('returns null for an event with no id or no start time', () => {
    expect(mapMicrosoftEvent({ subject: 'No id' })).toBeNull();
    expect(mapMicrosoftEvent({ id: 'evt-2' })).toBeNull();
  });

  it('maps Graph task completion status and timestamps', () => {
    expect(mapMicrosoftTask({ id: 'task-1', status: 'completed', completedDateTime: { dateTime: '2026-09-11T12:00:00.0000000' } }))
      .toMatchObject({ status: 'completed', completedAt: '2026-09-11T12:00:00.0000000Z' });
    expect(mapMicrosoftTask({ id: 'task-2', status: 'notStarted' }))
      .toMatchObject({ status: 'pending', completedAt: null });
  });
});

describe('Microsoft fetch pagination', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('follows @odata.nextLink across pages for events', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [{ id: 'evt-1', subject: 'First', start: { dateTime: '2026-09-15T09:00:00.0000000' } }],
        '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/calendarView?$skip=250',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [{ id: 'evt-2', subject: 'Second', start: { dateTime: '2026-09-16T09:00:00.0000000' } }],
      })));
    vi.stubGlobal('fetch', fetchMock);

    const events = await microsoftProvider.fetchEvents('token', new Date('2026-09-01'), new Date('2026-09-30'));

    expect(events.map((e) => e.externalId)).toEqual(['evt-1', 'evt-2']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://graph.microsoft.com/v1.0/me/calendarView?$skip=250');
  });

  it('resolves the default task list id from /me/todo/lists', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      value: [
        { id: 'list-other', wellknownListName: 'flaggedEmails' },
        { id: 'list-default', wellknownListName: 'defaultList' },
      ],
    })));
    vi.stubGlobal('fetch', fetchMock);

    const metadata = await microsoftProvider.resolveProviderMetadata!('token');

    expect(metadata).toEqual({ taskListId: 'list-default' });
  });

  it('throws a clear error when fetchTasks is called without a resolved taskListId', async () => {
    await expect(microsoftProvider.fetchTasks('token', new Date(), null)).rejects.toThrow(/taskListId/);
  });
});

describe('Microsoft push mechanism', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends only the changed fields on task update, mapping status correctly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await microsoftProvider.updateTask('token', 'task-1', { status: 'completed' }, { taskListId: 'list-1' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/todo/lists/list-1/tasks/task-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ status: 'completed' });
  });

  it('treats a 404 on task delete as success (already gone in Microsoft)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(microsoftProvider.deleteTask('token', 'task-1', { taskListId: 'list-1' })).resolves.toBeUndefined();
  });

  it('sends only the changed fields on event update, including a null end time when explicitly cleared', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await microsoftProvider.updateEvent('token', 'event-1', { title: 'New title', endTime: null });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/events/event-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ subject: 'New title', end: null });
  });

  it('treats a 404 on event delete as success (already gone in Microsoft)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(microsoftProvider.deleteEvent('token', 'event-1')).resolves.toBeUndefined();
  });

  it('throws on a real delete failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('server error', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(microsoftProvider.deleteTask('token', 'task-1', { taskListId: 'list-1' })).rejects.toThrow(/500/);
  });

  it('throws a clear error when updateTask/deleteTask are called without a resolved taskListId', async () => {
    await expect(microsoftProvider.updateTask('token', 'task-1', { status: 'completed' }, null)).rejects.toThrow(/taskListId/);
    await expect(microsoftProvider.deleteTask('token', 'task-1', undefined)).rejects.toThrow(/taskListId/);
  });
});
```

- [ ] **Step 5: Run the new tests**

Run: `npx vitest run src/utils/microsoftIntegration.test.ts` — all passing.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/integrations/microsoft.ts \
  supabase/functions/_shared/integrations/registry.ts \
  src/utils/microsoftIntegration.test.ts
git commit -m "Add Microsoft Graph provider implementation and provider registry

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `integration-oauth-start` — registry routing

**Files:**
- Modify: `supabase/functions/integration-oauth-start/index.ts`

**Interfaces:**
- Consumes: `providers` from `../_shared/integrations/registry.ts` (Task 3).

- [ ] **Step 1: Route through the registry**

In `supabase/functions/integration-oauth-start/index.ts`, replace the import:
```ts
import { googleProvider } from "../_shared/integrations/google.ts";
```
with:
```ts
import { providers } from "../_shared/integrations/registry.ts";
```

Replace:
```ts
    const { provider } = await req.json();
    if (provider !== "google") {
      return new Response(JSON.stringify({ error: "Unsupported provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
```
with:
```ts
    const { provider } = await req.json();
    if (!providers[provider]) {
      return new Response(JSON.stringify({ error: "Unsupported provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
```

Replace:
```ts
    const url = googleProvider.getAuthUrl(state, redirectUriFor(supabaseUrl));
```
with:
```ts
    const url = providers[provider].getAuthUrl(state, redirectUriFor(supabaseUrl));
```

No other lines change — the `oauth_states` insert already stores whatever `provider` string was passed, unchanged.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/integration-oauth-start/index.ts
git commit -m "Route integration-oauth-start through the provider registry

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `integration-oauth-callback` — registry routing

**Files:**
- Modify: `supabase/functions/integration-oauth-callback/index.ts`

**Interfaces:**
- Consumes: `providers` from `../_shared/integrations/registry.ts` (Task 3).

- [ ] **Step 1: Route through the registry**

In `supabase/functions/integration-oauth-callback/index.ts`, replace the import:
```ts
import { googleProvider } from "../_shared/integrations/google.ts";
```
with:
```ts
import { providers } from "../_shared/integrations/registry.ts";
```

Replace:
```ts
    if (stateRow.provider !== "google") return appRedirect(req, "error");

    // Must be byte-identical to the redirect_uri integration-oauth-start sent
    // Google in the original authorize request - see OAUTH_CALLBACK_URL's
    // doc comment there for why SUPABASE_URL alone isn't safe to use here.
    const redirectUri = Deno.env.get("OAUTH_CALLBACK_URL") ?? `${supabaseUrl}/functions/v1/integration-oauth-callback`;
    const tokens = await googleProvider.exchangeCode(code, redirectUri);
```
with:
```ts
    const provider = providers[stateRow.provider];
    if (!provider) return appRedirect(req, "error");

    // Must be byte-identical to the redirect_uri integration-oauth-start sent
    // in the original authorize request - see OAUTH_CALLBACK_URL's doc
    // comment there for why SUPABASE_URL alone isn't safe to use here.
    const redirectUri = Deno.env.get("OAUTH_CALLBACK_URL") ?? `${supabaseUrl}/functions/v1/integration-oauth-callback`;
    const tokens = await provider.exchangeCode(code, redirectUri);
```

Replace:
```ts
    const { error: upsertError } = await adminClient.from("integration_connections").upsert(
      {
        user_id: stateRow.user_id,
        provider: "google",
        status: "connected",
```
with:
```ts
    const { error: upsertError } = await adminClient.from("integration_connections").upsert(
      {
        user_id: stateRow.user_id,
        provider: stateRow.provider,
        status: "connected",
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/integration-oauth-callback/index.ts
git commit -m "Route integration-oauth-callback through the provider registry

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `sync-integrations` — registry routing, per-provider scopes, provider metadata

**Files:**
- Modify: `supabase/functions/sync-integrations/index.ts`

**Interfaces:**
- Consumes: `providers` from `../_shared/integrations/registry.ts` (Task 3); `resolveProviderMetadata?`, widened `fetchTasks`/`updateTask` signatures from `types.ts` (Task 2).

- [ ] **Step 1: Route the import and widen the `Connection` type**

Replace:
```ts
import { googleProvider } from "../_shared/integrations/google.ts";
```
with:
```ts
import { providers } from "../_shared/integrations/registry.ts";
```

Replace:
```ts
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
with:
```ts
type Connection = {
  id: string;
  user_id: string;
  provider: "google" | "microsoft";
  access_token: string;
  refresh_token: string;
  expires_at: string;
  calendar_sync_enabled: boolean;
  scope: string | null;
  provider_metadata: Record<string, unknown> | null;
};
```

- [ ] **Step 2: Make `REQUIRED_SCOPES`/`hasWriteScopes` per-provider**

Replace:
```ts
const REQUIRED_SCOPES = ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/tasks"];

function hasWriteScopes(scope: string | null): boolean {
  if (!scope) return false;
  const granted = scope.split(" ");
  return REQUIRED_SCOPES.every((required) => granted.includes(required));
}
```
with:
```ts
const REQUIRED_SCOPES: Record<Connection["provider"], string[]> = {
  google: ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/tasks"],
  microsoft: ["Calendars.ReadWrite", "Tasks.ReadWrite"],
};

function hasWriteScopes(provider: Connection["provider"], scope: string | null): boolean {
  if (!scope) return false;
  const granted = scope.split(" ");
  return REQUIRED_SCOPES[provider].every((required) => granted.includes(required));
}
```

Update the one call site in `syncConnection`:
```ts
  if (!hasWriteScopes(connection.scope)) {
```
to:
```ts
  if (!hasWriteScopes(connection.provider, connection.scope)) {
```

- [ ] **Step 3: Route `ensureFreshToken` through the registry**

Replace:
```ts
async function ensureFreshToken(
  adminClient: ReturnType<typeof createClient>,
  connection: Connection,
): Promise<string> {
  const expiresInMs = new Date(connection.expires_at).getTime() - Date.now();
  if (expiresInMs > 60_000) return connection.access_token;

  const tokens = await googleProvider.refreshToken(connection.refresh_token);
```
with:
```ts
async function ensureFreshToken(
  adminClient: ReturnType<typeof createClient>,
  connection: Connection,
): Promise<string> {
  const expiresInMs = new Date(connection.expires_at).getTime() - Date.now();
  if (expiresInMs > 60_000) return connection.access_token;

  const tokens = await providers[connection.provider].refreshToken(connection.refresh_token);
```

- [ ] **Step 4: Resolve and cache provider metadata, then route fetch calls**

Replace `syncConnection`'s body from the `try` block's start through the `upsertTasks` call:
```ts
  try {
    const accessToken = await ensureFreshToken(adminClient, connection);
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_DAYS_PAST * 86_400_000);
    const windowEnd = new Date(now.getTime() + WINDOW_DAYS_FUTURE * 86_400_000);

    const [events, tasks] = await Promise.all([
      googleProvider.fetchEvents(accessToken, windowStart, windowEnd),
      googleProvider.fetchTasks(accessToken, windowStart),
    ]);

    await upsertEvents(adminClient, connection, accessToken, events, syncStartedAt);
    await upsertTasks(adminClient, connection, accessToken, tasks, syncStartedAt);
```
with:
```ts
  try {
    const provider = providers[connection.provider];
    const accessToken = await ensureFreshToken(adminClient, connection);

    // Providers with extra per-connection state to resolve once (Microsoft's
    // default task-list id) resolve and cache it here, generically - this
    // function never checks connection.provider === "microsoft" by name.
    let providerMetadata = connection.provider_metadata;
    if (provider.resolveProviderMetadata && !providerMetadata) {
      providerMetadata = await provider.resolveProviderMetadata(accessToken);
      await adminClient
        .from("integration_connections")
        .update({ provider_metadata: providerMetadata })
        .eq("id", connection.id);
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_DAYS_PAST * 86_400_000);
    const windowEnd = new Date(now.getTime() + WINDOW_DAYS_FUTURE * 86_400_000);

    const [events, tasks] = await Promise.all([
      provider.fetchEvents(accessToken, windowStart, windowEnd),
      provider.fetchTasks(accessToken, windowStart, providerMetadata),
    ]);

    await upsertEvents(adminClient, connection, accessToken, events, syncStartedAt);
    await upsertTasks(adminClient, connection, accessToken, tasks, syncStartedAt, providerMetadata);
```

- [ ] **Step 5: Rename columns and route the retry-push call in `upsertEvents`**

Replace every `google_connection_id`/`google_event_id` in `upsertEvents` with `sync_connection_id`/`external_event_id` (the `.select()` string, `.eq()`/`.in()` calls, the upsert payload object's keys, and the `onConflict` string `"google_connection_id,google_event_id"` → `"sync_connection_id,external_event_id"`). The upsert payload also gains `sync_provider`:

```ts
    toUpsert.push({
      user_id: connection.user_id,
      sync_connection_id: connection.id,
      external_event_id: e.externalId,
      sync_provider: connection.provider,
      title: e.title,
      start_time: e.startTime,
      end_time: e.endTime,
      meeting_url: e.meetingUrl,
      synced_at: syncStartedAt,
      last_seen_at: syncStartedAt,
      updated_at: syncStartedAt,
    });
```

In the retry-push block, replace:
```ts
      try {
        await googleProvider.updateEvent(accessToken, row.google_event_id, {
```
with:
```ts
      try {
        await providers[connection.provider].updateEvent(accessToken, row.external_event_id, {
```
(and rename `row.google_event_id`/`row.external_event_id` consistently in the surrounding `.select()` string and the `if (!row.google_event_id) continue;` guard.)

- [ ] **Step 6: Rename columns and route the retry-push call in `upsertTasks`**

`upsertTasks` gains a `providerMetadata` parameter (used only for the retry-push call to `updateTask`, which needs it for Microsoft):

```ts
async function upsertTasks(
  adminClient: ReturnType<typeof createClient>,
  connection: Connection,
  accessToken: string,
  tasks: ExternalTask[],
  syncStartedAt: string,
  providerMetadata: Record<string, unknown> | null,
) {
```

Replace every `google_connection_id`/`google_task_id` with `sync_connection_id`/`external_task_id` (the `.select()` string, `.eq()`/`.in()` calls, the `onConflict` string `"google_connection_id,google_task_id"` → `"sync_connection_id,external_task_id"`). The upsert payload gains `sync_provider`:

```ts
    toUpsert.push({
      user_id: connection.user_id,
      sync_connection_id: connection.id,
      external_task_id: t.externalId,
      sync_provider: connection.provider,
      title: t.title,
      due_date: t.dueDate,
      status: t.status,
      completed_at: t.status === "completed" ? (t.completedAt ?? syncStartedAt) : null,
      priority: existing?.priority ?? "medium",
      synced_at: syncStartedAt,
      last_seen_at: syncStartedAt,
      updated_at: syncStartedAt,
    });
```

In the retry-push block, replace:
```ts
      try {
        await googleProvider.updateTask(accessToken, row.google_task_id, {
          title: row.title,
          dueDate: row.due_date,
          status: row.status === "completed" ? "completed" : "pending",
        });
```
with:
```ts
      try {
        await providers[connection.provider].updateTask(accessToken, row.external_task_id, {
          title: row.title,
          dueDate: row.due_date,
          status: row.status === "completed" ? "completed" : "pending",
        }, providerMetadata);
```
(and rename `row.google_task_id`/`row.external_task_id` consistently in the surrounding `.select()` string and guard.)

- [ ] **Step 7: Update the main handler's `.select()`**

Replace:
```ts
      .select("id, user_id, provider, access_token, refresh_token, expires_at, calendar_sync_enabled, scope")
```
with:
```ts
      .select("id, user_id, provider, access_token, refresh_token, expires_at, calendar_sync_enabled, scope, provider_metadata")
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit` — no errors.
Run: `npm test` — passing.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/sync-integrations/index.ts
git commit -m "Route sync-integrations through the provider registry

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `push-integration-change` — registry routing, provider metadata

**Files:**
- Modify: `supabase/functions/push-integration-change/index.ts`

**Interfaces:**
- Consumes: `providers` from `../_shared/integrations/registry.ts` (Task 3); widened `updateTask`/`deleteTask` signatures from `types.ts` (Task 2).

- [ ] **Step 1: Route the import and widen the connection select**

Replace:
```ts
import { googleProvider } from "../_shared/integrations/google.ts";
```
with:
```ts
import { providers } from "../_shared/integrations/registry.ts";
```

Replace:
```ts
    const { data: connection, error: connError } = await adminClient
      .from("integration_connections")
      .select("id, access_token, refresh_token, expires_at")
      .eq("id", body.connectionId)
      .eq("user_id", user.id)
      .maybeSingle();
```
with:
```ts
    const { data: connection, error: connError } = await adminClient
      .from("integration_connections")
      .select("id, provider, access_token, refresh_token, expires_at, provider_metadata")
      .eq("id", body.connectionId)
      .eq("user_id", user.id)
      .maybeSingle();
```

- [ ] **Step 2: Resolve provider metadata and route the refresh/push calls**

Replace:
```ts
    try {
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
```
with:
```ts
    try {
      const provider = providers[connection.provider];
      let accessToken = connection.access_token;
      const expiresInMs = new Date(connection.expires_at).getTime() - Date.now();
      if (expiresInMs <= 60_000) {
        const tokens = await provider.refreshToken(connection.refresh_token);
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

      // Same generic, feature-detected resolve-and-cache pattern as
      // sync-integrations - a single failed push must not skip caching this,
      // or every subsequent push for the same connection re-resolves it.
      let providerMetadata = connection.provider_metadata;
      if (provider.resolveProviderMetadata && !providerMetadata) {
        providerMetadata = await provider.resolveProviderMetadata(accessToken);
        await adminClient
          .from("integration_connections")
          .update({ provider_metadata: providerMetadata })
          .eq("id", connection.id);
      }

      if (body.type === "event") {
        if (body.action === "delete") {
          await provider.deleteEvent(accessToken, body.externalId);
        } else {
          await provider.updateEvent(accessToken, body.externalId, (body.changes ?? {}) as EventChanges);
        }
      } else {
        if (body.action === "delete") {
          await provider.deleteTask(accessToken, body.externalId, providerMetadata);
        } else {
          await provider.updateTask(accessToken, body.externalId, (body.changes ?? {}) as TaskChanges, providerMetadata);
        }
      }
    } catch (pushError) {
```

- [ ] **Step 3: Rename the `sync_error`/`synced_at` update columns**

Replace:
```ts
          .eq("google_connection_id", body.connectionId)
          .eq(body.type === "event" ? "google_event_id" : "google_task_id", body.externalId);
      }
      return new Response(JSON.stringify({ error: message }), {
```
with:
```ts
          .eq("sync_connection_id", body.connectionId)
          .eq(body.type === "event" ? "external_event_id" : "external_task_id", body.externalId);
      }
      return new Response(JSON.stringify({ error: message }), {
```
and:
```ts
        .eq("google_connection_id", body.connectionId)
        .eq(body.type === "event" ? "google_event_id" : "google_task_id", body.externalId);
    }
```
with:
```ts
        .eq("sync_connection_id", body.connectionId)
        .eq(body.type === "event" ? "external_event_id" : "external_task_id", body.externalId);
    }
```

(These are the same renames Task 1 already applied elsewhere in this file — Task 1 covered the two `sync_error`/`synced_at` update blocks specifically. If Task 1 already renamed them, this step is a no-op; leave a note in the report either way so the reviewer can confirm which state the file was in.)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/push-integration-change/index.ts
git commit -m "Route push-integration-change through the provider registry

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Settings UI — `ProviderConnectionRow` + connect Microsoft

**Files:**
- Modify: `src/hooks/useIntegrationConnections.tsx`
- Modify: `src/components/IntegrationsSettings.tsx`

**Interfaces:**
- Consumes: `integration_connections_view.provider` (now `'google' | 'microsoft'`).
- Produces: `useIntegrationConnections().connectMicrosoft`, alongside the existing `connectGoogle`.

- [ ] **Step 1: Widen `IntegrationConnection.provider` and add `connectMicrosoft`**

In `src/hooks/useIntegrationConnections.tsx`, change:
```ts
export interface IntegrationConnection {
  id: string;
  provider: 'google';
```
to:
```ts
export interface IntegrationConnection {
  id: string;
  provider: 'google' | 'microsoft';
```

Replace:
```ts
  const connectGoogle = async () => {
    const { data, error } = await supabase.functions.invoke('integration-oauth-start', {
      body: { provider: 'google' },
    });
    if (error) {
      toast.error('Could not start Google connection');
      return;
    }
    window.location.href = data.url;
  };
```
with:
```ts
  const startOAuth = async (provider: 'google' | 'microsoft', errorMessage: string) => {
    const { data, error } = await supabase.functions.invoke('integration-oauth-start', {
      body: { provider },
    });
    if (error) {
      toast.error(errorMessage);
      return;
    }
    window.location.href = data.url;
  };

  const connectGoogle = () => startOAuth('google', 'Could not start Google connection');
  const connectMicrosoft = () => startOAuth('microsoft', 'Could not start Microsoft connection');
```

Update the return statement:
```ts
  return {
    connections,
    isLoading,
    connectGoogle,
    disconnect: disconnectMutation.mutate,
    syncNow: syncNowMutation.mutate,
    isSyncing: syncNowMutation.isPending,
  };
```
to:
```ts
  return {
    connections,
    isLoading,
    connectGoogle,
    connectMicrosoft,
    disconnect: disconnectMutation.mutate,
    syncNow: syncNowMutation.mutate,
    isSyncing: syncNowMutation.isPending,
  };
```

- [ ] **Step 2: Extract `ProviderConnectionRow` in `IntegrationsSettings.tsx`**

Replace the entire file content with:

```tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { useIntegrationConnections, IntegrationConnection } from '@/hooks/useIntegrationConnections';

const PROVIDER_LABELS: Record<'google' | 'microsoft', string> = { google: 'Google', microsoft: 'Microsoft' };

interface ProviderConnectionRowProps {
  provider: 'google' | 'microsoft';
  connection: IntegrationConnection | undefined;
  isSyncing: boolean;
  onConnect: () => void;
  onSync: (id: string) => void;
  onDisconnect: (id: string) => void;
}

const ProviderConnectionRow: React.FC<ProviderConnectionRowProps> = ({
  provider,
  connection,
  isSyncing,
  onConnect,
  onSync,
  onDisconnect,
}) => {
  const label = PROVIDER_LABELS[provider];

  if (connection?.status === 'needs_reconnect') {
    return (
      <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-md">
        <div>
          <h3 className="font-medium text-foreground">{label}</h3>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {label} needs new permissions for two-way sync.
          </p>
        </div>
        <Button size="sm" onClick={onConnect} className="bg-amber-600 hover:bg-amber-700 text-white">
          Reconnect
        </Button>
      </div>
    );
  }

  if (connection) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-foreground">{label}</h3>
          <p className="text-sm text-muted-foreground">
            {connection.status === 'connected'
              ? connection.last_synced_at
                ? `Last synced ${new Date(connection.last_synced_at).toLocaleString()}`
                : 'Connected, not yet synced'
              : `Status: ${connection.status}${connection.last_error ? ` — ${connection.last_error}` : ''}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={isSyncing} onClick={() => onSync(connection.id)}>
            {isSyncing ? 'Syncing...' : 'Sync now'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => onDisconnect(connection.id)}
          >
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-medium text-foreground">{label}</h3>
        <p className="text-sm text-muted-foreground">Not connected</p>
      </div>
      <Button onClick={onConnect}>Connect {label}</Button>
    </div>
  );
};

const IntegrationsSettings: React.FC = () => {
  const { connections, isLoading, connectGoogle, connectMicrosoft, disconnect, syncNow, isSyncing } = useIntegrationConnections();
  const googleConnection = connections.find((c) => c.provider === 'google');
  const microsoftConnection = connections.find((c) => c.provider === 'microsoft');

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Integrations</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Connect your Google or Microsoft account to bring its calendar events and tasks into Monotask, fully editable here.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-4">
          <ProviderConnectionRow
            provider="google"
            connection={googleConnection}
            isSyncing={isSyncing}
            onConnect={connectGoogle}
            onSync={syncNow}
            onDisconnect={disconnect}
          />
          <div className="border-t border-border pt-4">
            <ProviderConnectionRow
              provider="microsoft"
              connection={microsoftConnection}
              isSyncing={isSyncing}
              onConnect={connectMicrosoft}
              onSync={syncNow}
              onDisconnect={disconnect}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrationsSettings;
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — no errors.
Run `npm run dev` and visually confirm Settings → Integrations shows both a Google row and a Microsoft row, each independently showing "Not connected" / "Connect Microsoft" until a real Azure AD app registration exists to test against (live OAuth verification is a manual step — see Task 3's spec-mirrored tests for the parts that are automatable).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useIntegrationConnections.tsx src/components/IntegrationsSettings.tsx
git commit -m "Add Microsoft connection row to Integrations settings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Display layer — dynamic provider labels

**Files:**
- Modify: `src/components/EventsView.tsx`
- Modify: `src/components/EventModal.tsx`
- Modify: `src/utils/dataPortability.ts`
- Modify: `src/utils/dataPortability.test.ts`
- Modify: `src/utils/pdfExport.ts`
- Modify: `src/components/Settings.tsx`

**Interfaces:**
- Consumes: `Task.sync_provider`/`Event.sync_provider` (added to the hooks' interfaces in Task 1).

- [ ] **Step 1: `EventsView.tsx` — dynamic badge label**

Replace:
```tsx
                  {event.sync_connection_id && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
                      Google
                    </span>
                  )}
```
with:
```tsx
                  {event.sync_connection_id && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
                      {event.sync_provider === 'microsoft' ? 'Outlook' : 'Google'}
                    </span>
                  )}
```

- [ ] **Step 2: `EventModal.tsx` — dynamic origin label**

Replace:
```ts
  const isGoogleOrigin = !!event?.sync_connection_id;
```
with:
```ts
  const syncedFromLabel = event?.sync_connection_id ? (event.sync_provider === 'microsoft' ? 'Outlook' : 'Google') : null;
```

Replace:
```tsx
            {event ? 'Edit Event' : 'Create Event'}
            {isGoogleOrigin && (
              <span className="ml-2 text-xs font-normal text-blue-600 dark:text-blue-400">(from Google)</span>
            )}
```
with:
```tsx
            {event ? 'Edit Event' : 'Create Event'}
            {syncedFromLabel && (
              <span className="ml-2 text-xs font-normal text-blue-600 dark:text-blue-400">(from {syncedFromLabel})</span>
            )}
```

- [ ] **Step 3: `dataPortability.ts` — dynamic `source`**

Change the `ExportedTask`/`ExportedEvent` interfaces:
```ts
  source: 'monotask' | 'google';
```
(in both interfaces) to:
```ts
  source: 'monotask' | 'google' | 'microsoft';
```

Change:
```ts
      source: task.sync_connection_id ? 'google' : 'monotask',
```
to:
```ts
      source: task.sync_connection_id ? (task.sync_provider ?? 'google') : 'monotask',
```
and:
```ts
      source: event.sync_connection_id ? 'google' : 'monotask',
```
to:
```ts
      source: event.sync_connection_id ? (event.sync_provider ?? 'google') : 'monotask',
```

Update `isExportedTask`'s validation:
```ts
    (t.source === undefined || ['monotask', 'google'].includes(t.source))
```
to:
```ts
    (t.source === undefined || ['monotask', 'google', 'microsoft'].includes(t.source))
```

- [ ] **Step 4: Update `dataPortability.test.ts` for the widened `source`**

The existing `'buildExportData tags each task and event with its source'` test only exercises Google-origin rows and stays valid as-is (a row with `sync_connection_id` set but no `sync_provider` falls back to `'google'`, preserving today's behavior for the test's fixtures, which predate `sync_provider`). Add one new test case immediately after it:

```ts
test('buildExportData labels a Microsoft-origin task and event with source "microsoft"', () => {
  const tasks: Task[] = [
    { id: '5', title: 'Outlook task', priority: 'low', status: 'pending', created_at: '', updated_at: '', user_id: 'u', sync_connection_id: 'conn-2', sync_provider: 'microsoft' },
  ];
  const events: Event[] = [
    { id: '6', title: 'Outlook event', start_time: '2026-01-01T00:00:00Z', created_at: '', updated_at: '', user_id: 'u', sync_connection_id: 'conn-2', sync_provider: 'microsoft' },
  ];

  const data = buildExportData(tasks, [], [], events);

  expect(data.tasks.find((t) => t.title === 'Outlook task')?.source).toBe('microsoft');
  expect(data.events?.find((e) => e.title === 'Outlook event')?.source).toBe('microsoft');
});
```

- [ ] **Step 5: `pdfExport.ts` — dynamic `[Google]`/`[Outlook]` label**

Replace:
```ts
      const source = task.sync_connection_id ? ' [Google]' : '';
```
with:
```ts
      const source = task.sync_connection_id ? (task.sync_provider === 'microsoft' ? ' [Outlook]' : ' [Google]') : '';
```
and:
```ts
      const source = event.sync_connection_id ? ' [Google]' : '';
```
with:
```ts
      const source = event.sync_connection_id ? (event.sync_provider === 'microsoft' ? ' [Outlook]' : ' [Google]') : '';
```

- [ ] **Step 6: `Settings.tsx` — dynamic CSV `Source` column**

Replace:
```ts
        task.sync_connection_id ? 'Google' : 'Monotask',
```
with:
```ts
        task.sync_connection_id ? (task.sync_provider === 'microsoft' ? 'Outlook' : 'Google') : 'Monotask',
```
and:
```ts
        event.sync_connection_id ? 'Google' : 'Monotask',
```
with:
```ts
        event.sync_connection_id ? (event.sync_provider === 'microsoft' ? 'Outlook' : 'Google') : 'Monotask',
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit` — no errors.
Run: `npm test` — passing (including the new dataPortability test case).

- [ ] **Step 8: Commit**

```bash
git add src/components/EventsView.tsx src/components/EventModal.tsx \
  src/utils/dataPortability.ts src/utils/dataPortability.test.ts \
  src/utils/pdfExport.ts src/components/Settings.tsx
git commit -m "Label synced tasks/events by their actual sync_provider

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Secrets documentation

**Files:**
- Modify: `supabase/functions/.env`

**Interfaces:**
- Consumes: nothing (documentation/config only).

- [ ] **Step 1: Add the Microsoft secret placeholders**

`supabase/functions/.env` currently has:
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APP_ORIGIN=
OAUTH_CALLBACK_URL=
```

Add two lines:
```
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
```

This file is local-only (gitignored dev secrets); it is not committed. For a deployed environment, this plan's equivalent of the foundation plan's `supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...` step is:
```bash
supabase secrets set MICROSOFT_CLIENT_ID=<your-azure-app-client-id> MICROSOFT_CLIENT_SECRET=<your-azure-app-client-secret>
```
`MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET` come from registering an application in Azure AD (portal.azure.com → App registrations → New registration), with a Web platform redirect URI matching whatever `OAUTH_CALLBACK_URL` (or the deployed project's `SUPABASE_URL`) resolves to, and the `Calendars.ReadWrite`/`Tasks.ReadWrite`/`offline_access` delegated Microsoft Graph permissions granted.

- [ ] **Step 2: No commit**

`supabase/functions/.env` is gitignored — confirm with `git status` that it does not appear as a new/modified tracked file. This step exists so a human operator following the plan doesn't skip adding the local placeholders, not to produce a commit.

---

## Manual Verification (human step — no automated agent can complete this)

1. Register an Azure AD application, set its redirect URI, grant the three delegated Graph permissions above, and fill in `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET` (Task 10).
2. `npm run dev`, open Settings → Integrations, click "Connect Microsoft", complete the real Microsoft consent screen.
3. Confirm a `connected` row appears in `integration_connections` with `provider = 'microsoft'`.
4. Trigger a sync ("Sync now") and confirm Outlook Calendar events and Microsoft To Do tasks appear in Monotask's Events/Tasks views, an Outlook event with an attached Teams meeting shows its join link, and the "Outlook"/"Microsoft" labels render correctly (not "Google").
5. Edit a synced task/event's title in Monotask and confirm it pushes through to Outlook/To Do (check directly in Outlook, or via a re-sync that shows the edited title stays rather than reverting).
6. Delete a synced item in Monotask and confirm it is removed in Outlook/To Do too.
