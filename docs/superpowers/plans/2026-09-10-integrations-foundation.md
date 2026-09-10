# Integrations Foundation (Google Connect + Calendar/Task Sync) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user sign in with Google, connect their Google account for calendar/task sync, and see their Google Calendar events and Google Tasks read-only inside Monotask's Dashboard and Calendar views.

**Architecture:** New Postgres tables (`oauth_states`, `integration_connections`, `external_events`, `external_tasks`) behind RLS, three new Supabase Edge Functions (`integration-oauth-start`, `integration-oauth-callback`, `sync-integrations`) implementing a provider-agnostic `IntegrationProvider` interface with a Google implementation, a `pg_cron` schedule that invokes the sync function every 10 minutes, and three new React Query hooks (`useIntegrationConnections`, `useExternalEvents`, `useExternalTasks`) that surface the data in a new Integrations settings panel, the Dashboard, and the Calendar view.

**Tech Stack:** Supabase (Postgres + Edge Functions, Deno), React + TypeScript + `@tanstack/react-query`, Vitest for pure-function unit tests (matching this repo's existing convention of testing `src/**/*.ts` utility functions only — there is no component or Edge Function test harness in this repo today, so UI and Edge Function tasks are verified manually, the same way `parse-task` and `weekly-summary` are).

**Spec:** `docs/superpowers/specs/2026-09-10-external-integrations-design.md`

## Global Constraints

- Read-only: this plan never writes to Google's calendar, tasks, or any other data. (Spec: Non-goals.)
- No two-way sync, no webhooks — periodic polling only, every 10 minutes via `pg_cron`. (Spec: Architecture §2.)
- Access/refresh tokens are stored only in `integration_connections`, readable only by the service role. Client reads go through `integration_connections_view`, which excludes token columns. (Spec: Security.)
- All writes to `integration_connections`, `external_events`, `external_tasks` happen only via Edge Functions using the service role key, except a user disconnecting their own connection. (Spec: Data model.)
- Message-scan capability (Gmail/Slack/Teams scanning, `suggested_tasks`) is explicitly out of scope for this plan — it is Plan 3 in the spec's rollout. This plan only builds the `calendar_tasks` capability for Google.
- Microsoft and Slack providers are out of scope for this plan (Plans 2 and 4).
- **Scoping deviation from the spec's display-layer wording:** the spec's Architecture §5 says external tasks merge into "TaskManager/Dashboard." This plan merges them into Dashboard only (Task 12) and leaves `TaskManager.tsx` untouched. `TaskManager` already carries significant complexity (recurring-instance expansion via `generateRecurringInstances`, multi-field filtering, tabs) that read-only external items don't fit into cleanly without either forcing them into the `RecurringTaskInstance` shape (misrepresenting data that has no recurrence/completion-toggle semantics) or meaningfully restructuring that file — both a larger risk than this foundation plan should take on. If a TaskManager-embedded view of external tasks is wanted later, it should be its own small follow-up plan against the working Dashboard version built here.
- Follow this repo's existing Edge Function conventions: `corsHeaders` from `supabase/functions/_shared/cors.ts`, `verify_jwt = false` in `supabase/config.toml` for any function that must accept unauthenticated requests (the OAuth callback, since Google's redirect carries no Monotask session), Deno `npm:`/`https://esm.sh` imports, `Deno.env.get(...)!` for secrets.

---

## File Structure

**New:**
- `supabase/migrations/20260910120000-integration-oauth-foundation.sql` — `oauth_states`, `integration_connections`, `integration_connections_view`, RLS/grants.
- `supabase/migrations/20260910120100-external-items.sql` — `external_events`, `external_tasks`, RLS.
- `supabase/migrations/20260910120200-schedule-sync-integrations.sql` — `pg_cron` schedule for `sync-integrations`.
- `supabase/functions/_shared/integrations/types.ts` — `IntegrationProvider` interface and shared types.
- `supabase/functions/_shared/integrations/google.ts` — Google provider implementation.
- `supabase/functions/integration-oauth-start/index.ts` — starts the OAuth flow, returns the consent URL.
- `supabase/functions/integration-oauth-callback/index.ts` — handles Google's redirect, exchanges the code, stores the connection.
- `supabase/functions/sync-integrations/index.ts` — cron + manual sync of events/tasks for all active connections.
- `src/hooks/useIntegrationConnections.tsx` — list/connect/disconnect/sync-now for the current user's connections.
- `src/hooks/useExternalEvents.tsx` — read `external_events` for the current user.
- `src/hooks/useExternalTasks.tsx` — read `external_tasks` for the current user.
- `src/components/IntegrationsSettings.tsx` — the Integrations panel UI.

**Modify:**
- `supabase/config.toml` — add `verify_jwt = false` for `integration-oauth-callback` and `sync-integrations`.
- `src/hooks/useAuth.tsx` — add `signInWithGoogle`.
- `src/components/Auth.tsx` — add a "Continue with Google" button.
- `src/components/Settings.tsx` — render `IntegrationsSettings`.
- `src/components/Dashboard.tsx` — add a "From your connected apps" section.
- `src/components/CalendarView.tsx` — show external events as a distinct badge per day.

---

### Task 1: Database schema — OAuth state and connections

**Files:**
- Create: `supabase/migrations/20260910120000-integration-oauth-foundation.sql`

**Interfaces:**
- Produces: table `public.oauth_states(state text pk, user_id uuid, provider text, created_at timestamptz)`; table `public.integration_connections(id uuid pk, user_id uuid, provider text, status text, calendar_sync_enabled boolean, message_scan_enabled boolean, access_token text, refresh_token text, expires_at timestamptz, scope text, last_synced_at timestamptz, last_scanned_at timestamptz, last_error text, created_at timestamptz, updated_at timestamptz)`; view `public.integration_connections_view` (same columns minus `access_token`/`refresh_token`).

- [ ] **Step 1: Write the migration**

```sql
-- Short-lived mapping from an OAuth "state" nonce back to the user who
-- started the flow. Needed because Google's redirect to our callback is a
-- plain browser navigation with no Monotask session/Authorization header.
create table public.oauth_states (
  state text primary key,
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('google')),
  created_at timestamp with time zone not null default now()
);

alter table public.oauth_states enable row level security;
-- No policies: only the service role (Edge Functions) may read/write this table.

-- One row per user-provider OAuth connection.
create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('google')),
  status text not null default 'connected' check (status in ('connected', 'expired', 'error', 'disconnected')),
  calendar_sync_enabled boolean not null default true,
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

alter table public.integration_connections enable row level security;

-- Clients never get SELECT/INSERT/UPDATE on the base table (it holds
-- tokens) - only DELETE, so a user can disconnect their own connection.
-- All reads go through integration_connections_view below; all other
-- writes go through Edge Functions using the service role key.
revoke all on public.integration_connections from authenticated;
grant delete on public.integration_connections to authenticated;

create policy "Users can delete their own connections"
  on public.integration_connections
  for delete
  using (auth.uid() = user_id);

-- Client-facing view: everything except access_token/refresh_token.
-- security_invoker = false (the default for a view owned by the migration
-- role) means the view runs with the view owner's privileges against the
-- base table, bypassing the base table's "no SELECT for authenticated"
-- lockdown, while the "where user_id = auth.uid()" clause below is what
-- actually scopes results to the caller - this is the standard Postgres
-- pattern for exposing a subset of a locked-down table's columns.
create view public.integration_connections_view as
  select
    id, user_id, provider, status, calendar_sync_enabled,
    message_scan_enabled, expires_at, scope, last_synced_at,
    last_scanned_at, last_error, created_at, updated_at
  from public.integration_connections
  where user_id = auth.uid();

grant select on public.integration_connections_view to authenticated;
```

- [ ] **Step 2: Apply and verify locally**

Run: `supabase db reset` (or `supabase migration up` if you don't want to reset local data).
Expected: migration applies with no errors. Then verify the view excludes tokens:

```bash
supabase db execute --sql "select column_name from information_schema.columns where table_name = 'integration_connections_view';"
```
Expected output list does NOT include `access_token` or `refresh_token`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260910120000-integration-oauth-foundation.sql
git commit -m "Add oauth_states and integration_connections schema

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Database schema — external events and tasks

**Files:**
- Create: `supabase/migrations/20260910120100-external-items.sql`

**Interfaces:**
- Consumes: `public.integration_connections(id, user_id)` from Task 1.
- Produces: tables `public.external_events(id, connection_id, external_id, title, start_time, end_time, meeting_url, raw_payload, created_at, updated_at)` and `public.external_tasks(id, connection_id, external_id, title, due_date, status, source_url, raw_payload, created_at, updated_at)`, both `select`-able by their owning user.

- [ ] **Step 1: Write the migration**

```sql
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

alter table public.external_events enable row level security;
alter table public.external_tasks enable row level security;

-- No tokens in these tables, so a straightforward SELECT-only policy via a
-- join back to the owning connection is enough (no view needed).
create policy "Users can view their own external events"
  on public.external_events
  for select
  using (
    exists (
      select 1 from public.integration_connections c
      where c.id = external_events.connection_id and c.user_id = auth.uid()
    )
  );

create policy "Users can view their own external tasks"
  on public.external_tasks
  for select
  using (
    exists (
      select 1 from public.integration_connections c
      where c.id = external_tasks.connection_id and c.user_id = auth.uid()
    )
  );

-- All writes (insert/update/delete) happen via sync-integrations using the
-- service role key, which bypasses RLS - no client write policies needed.
```

- [ ] **Step 2: Apply and verify**

Run: `supabase db reset`
Expected: no errors. Then confirm RLS is enabled: `supabase db execute --sql "select relname, relrowsecurity from pg_class where relname in ('external_events','external_tasks');"` — both rows show `t`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260910120100-external-items.sql
git commit -m "Add external_events and external_tasks tables

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Shared provider interface and Google provider module

**Files:**
- Create: `supabase/functions/_shared/integrations/types.ts`
- Create: `supabase/functions/_shared/integrations/google.ts`

**Interfaces:**
- Produces: `IntegrationProvider` interface; `TokenSet { accessToken: string; refreshToken: string; expiresAt: string; scope: string }`; `ExternalEvent { externalId: string; title: string; startTime: string; endTime: string | null; meetingUrl: string | null; rawPayload: unknown }`; `ExternalTask { externalId: string; title: string; dueDate: string | null; status: 'pending' | 'completed'; sourceUrl: string | null; rawPayload: unknown }`; `googleProvider: IntegrationProvider` implementing `getAuthUrl`, `exchangeCode`, `refreshToken`, `fetchEvents`, `fetchTasks`.

- [ ] **Step 1: Write `types.ts`**

```typescript
// supabase/functions/_shared/integrations/types.ts
export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO timestamp
  scope: string;
}

export interface ExternalEvent {
  externalId: string;
  title: string;
  startTime: string; // ISO timestamp
  endTime: string | null;
  meetingUrl: string | null;
  rawPayload: unknown;
}

export interface ExternalTask {
  externalId: string;
  title: string;
  dueDate: string | null; // YYYY-MM-DD
  status: "pending" | "completed";
  sourceUrl: string | null;
  rawPayload: unknown;
}

export interface IntegrationProvider {
  id: "google";
  getAuthUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
  fetchEvents(accessToken: string, windowStart: Date, windowEnd: Date): Promise<ExternalEvent[]>;
  fetchTasks(accessToken: string): Promise<ExternalTask[]>;
}
```

- [ ] **Step 2: Write `google.ts`**

```typescript
// supabase/functions/_shared/integrations/google.ts
import type { ExternalEvent, ExternalTask, IntegrationProvider, TokenSet } from "./types.ts";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/tasks.readonly",
].join(" ");

function tokenSetFromResponse(json: Record<string, unknown>, fallbackRefreshToken?: string): TokenSet {
  const expiresInSeconds = typeof json.expires_in === "number" ? json.expires_in : 3600;
  return {
    accessToken: json.access_token as string,
    refreshToken: (json.refresh_token as string) ?? fallbackRefreshToken ?? "",
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    scope: (json.scope as string) ?? GOOGLE_SCOPES,
  };
}

export function mapGoogleEvent(item: Record<string, any>): ExternalEvent | null {
  const start = item.start?.dateTime ?? (item.start?.date ? `${item.start.date}T00:00:00Z` : null);
  const end = item.end?.dateTime ?? (item.end?.date ? `${item.end.date}T00:00:00Z` : null);
  if (!item.id || !start) return null;
  return {
    externalId: item.id,
    title: item.summary || "(No title)",
    startTime: start,
    endTime: end,
    meetingUrl: item.hangoutLink ?? item.htmlLink ?? null,
    rawPayload: item,
  };
}

export function mapGoogleTask(item: Record<string, any>): ExternalTask | null {
  if (!item.id) return null;
  return {
    externalId: item.id,
    title: item.title || "(No title)",
    dueDate: item.due ? item.due.slice(0, 10) : null,
    status: item.status === "completed" ? "completed" : "pending",
    sourceUrl: item.webViewLink ?? null,
    rawPayload: item,
  };
}

export const googleProvider: IntegrationProvider = {
  id: "google",

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_SCOPES,
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },

  async exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!response.ok) throw new Error(`Google token exchange failed: ${response.status} ${await response.text()}`);
    return tokenSetFromResponse(await response.json());
  },

  async refreshToken(refreshToken: string): Promise<TokenSet> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
        grant_type: "refresh_token",
      }),
    });
    if (!response.ok) throw new Error(`Google token refresh failed: ${response.status} ${await response.text()}`);
    return tokenSetFromResponse(await response.json(), refreshToken);
  },

  async fetchEvents(accessToken: string, windowStart: Date, windowEnd: Date): Promise<ExternalEvent[]> {
    const params = new URLSearchParams({
      timeMin: windowStart.toISOString(),
      timeMax: windowEnd.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) throw new Error(`Google calendar fetch failed: ${response.status} ${await response.text()}`);
    const json = await response.json();
    return (json.items ?? []).map(mapGoogleEvent).filter((e: ExternalEvent | null): e is ExternalEvent => e !== null);
  },

  async fetchTasks(accessToken: string): Promise<ExternalTask[]> {
    const response = await fetch(
      "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=false&maxResults=100",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) throw new Error(`Google tasks fetch failed: ${response.status} ${await response.text()}`);
    const json = await response.json();
    return (json.items ?? []).map(mapGoogleTask).filter((t: ExternalTask | null): t is ExternalTask => t !== null);
  },
};
```

- [ ] **Step 3: Manual verification (no automated harness for Edge Functions in this repo, matching `parse-task`/`weekly-summary`)**

Run: `deno check supabase/functions/_shared/integrations/google.ts`
Expected: no type errors. (Full behavioral verification happens in Task 6 once `sync-integrations` calls this module against a real connected account.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/integrations/types.ts supabase/functions/_shared/integrations/google.ts
git commit -m "Add IntegrationProvider interface and Google provider

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Edge Function — `integration-oauth-start`

**Files:**
- Create: `supabase/functions/integration-oauth-start/index.ts`

**Interfaces:**
- Consumes: `googleProvider.getAuthUrl` from Task 3.
- Produces: `POST /functions/v1/integration-oauth-start` with body `{ provider: "google" }` (requires `Authorization` header), returns `{ url: string }`.

- [ ] **Step 1: Write the function**

```typescript
// supabase/functions/integration-oauth-start/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { googleProvider } from "../_shared/integrations/google.ts";

function redirectUriFor(supabaseUrl: string): string {
  return `${supabaseUrl}/functions/v1/integration-oauth-callback`;
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

    const { provider } = await req.json();
    if (provider !== "google") {
      return new Response(JSON.stringify({ error: "Unsupported provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client to write oauth_states, which has no client policies.
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const state = crypto.randomUUID();
    const { error: insertError } = await adminClient.from("oauth_states").insert({
      state,
      user_id: user.id,
      provider,
    });
    if (insertError) throw insertError;

    const url = googleProvider.getAuthUrl(state, redirectUriFor(supabaseUrl));

    return new Response(JSON.stringify({ url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("integration-oauth-start error:", error);
    return new Response(JSON.stringify({ error: "Failed to start OAuth flow" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Set required secrets locally**

Run:
```bash
supabase secrets set GOOGLE_CLIENT_ID=<your-oauth-client-id> GOOGLE_CLIENT_SECRET=<your-oauth-client-secret>
```
(These come from a Google Cloud OAuth 2.0 Client ID with the Calendar and Tasks readonly scopes enabled and `<SUPABASE_URL>/functions/v1/integration-oauth-callback` registered as an authorized redirect URI — a one-time manual setup step in the Google Cloud Console, not something this plan can automate.)

- [ ] **Step 3: Manual verification**

Run: `supabase functions serve integration-oauth-start --no-verify-jwt=false`, then in another terminal:
```bash
curl -X POST http://localhost:54321/functions/v1/integration-oauth-start \
  -H "Authorization: Bearer <a-real-user-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"provider":"google"}'
```
Expected: `{"url":"https://accounts.google.com/o/oauth2/v2/auth?..."}` and a new row in `oauth_states` (`supabase db execute --sql "select * from oauth_states;"`).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/integration-oauth-start/index.ts
git commit -m "Add integration-oauth-start Edge Function

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Edge Function — `integration-oauth-callback`

**Files:**
- Create: `supabase/functions/integration-oauth-callback/index.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: `googleProvider.exchangeCode` from Task 3; `oauth_states`/`integration_connections` from Task 1.
- Produces: `GET /functions/v1/integration-oauth-callback?code=...&state=...`, a 302 redirect to `<app origin>/app?integration=connected` or `...&integration=error`.

- [ ] **Step 1: Write the function**

```typescript
// supabase/functions/integration-oauth-callback/index.ts
// Called directly by Google's browser redirect, so it never carries a
// Monotask Authorization header - the "state" row from oauth_states is
// what recovers which user started the flow. Runs entirely on the service
// role, since there is no user session to attach to a client.
import { createClient } from "npm:@supabase/supabase-js@2";
import { googleProvider } from "../_shared/integrations/google.ts";

function appRedirect(req: Request, status: "connected" | "error"): Response {
  const origin = Deno.env.get("APP_ORIGIN") ?? new URL(req.url).origin;
  return Response.redirect(`${origin}/app?integration=${status}`, 302);
}

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return appRedirect(req, "error");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: stateRow, error: stateError } = await adminClient
      .from("oauth_states")
      .select("user_id, provider")
      .eq("state", state)
      .maybeSingle();
    if (stateError || !stateRow) return appRedirect(req, "error");

    // Consume the state token so it can't be replayed.
    await adminClient.from("oauth_states").delete().eq("state", state);

    if (stateRow.provider !== "google") return appRedirect(req, "error");

    const redirectUri = `${supabaseUrl}/functions/v1/integration-oauth-callback`;
    const tokens = await googleProvider.exchangeCode(code, redirectUri);

    const { error: upsertError } = await adminClient.from("integration_connections").upsert(
      {
        user_id: stateRow.user_id,
        provider: "google",
        status: "connected",
        calendar_sync_enabled: true,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt,
        scope: tokens.scope,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );
    if (upsertError) throw upsertError;

    return appRedirect(req, "connected");
  } catch (error) {
    console.error("integration-oauth-callback error:", error);
    return appRedirect(req, "error");
  }
});
```

- [ ] **Step 2: Update `supabase/config.toml`**

```toml
[functions.integration-oauth-callback]
verify_jwt = false
```

(Add this alongside the existing `[functions.weekly-summary]`/`[functions.parse-task]` entries — this function is hit by Google's browser redirect, which carries no JWT at all, so the platform-level JWT gate must be off; there is no user auth check to replace it with since the function authenticates the request via the `state` row instead.)

- [ ] **Step 3: Manual verification**

With `supabase functions serve` running and `oauth_states`/secrets set up from Task 4, drive the flow end-to-end from a browser: call `integration-oauth-start`, follow the returned URL, complete Google's consent screen, and confirm the browser lands back on `/app?integration=connected`. Then check:
```bash
supabase db execute --sql "select provider, status, expires_at from integration_connections;"
```
Expected: one row, `provider = 'google'`, `status = 'connected'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/integration-oauth-callback/index.ts supabase/config.toml
git commit -m "Add integration-oauth-callback Edge Function

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Edge Function — `sync-integrations` (+ cron schedule)

**Files:**
- Create: `supabase/functions/sync-integrations/index.ts`
- Create: `supabase/migrations/20260910120200-schedule-sync-integrations.sql`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: `googleProvider.refreshToken/fetchEvents/fetchTasks` from Task 3.
- Produces: `POST /functions/v1/sync-integrations` with optional body `{ connection_id?: string }` (service-role or user JWT accepted); upserts `external_events`/`external_tasks`; updates `integration_connections.last_synced_at`/`status`/`last_error`.

- [ ] **Step 1: Write the function**

```typescript
// supabase/functions/sync-integrations/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { googleProvider } from "../_shared/integrations/google.ts";
import type { ExternalEvent, ExternalTask } from "../_shared/integrations/types.ts";

const WINDOW_DAYS_PAST = 1;
const WINDOW_DAYS_FUTURE = 30;

type Connection = {
  id: string;
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
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let connectionId: string | null = null;
    try {
      const body = await req.json();
      connectionId = body?.connection_id ?? null;
    } catch {
      // No body (e.g. the cron invocation) - sync every active connection.
    }

    let query = adminClient
      .from("integration_connections")
      .select("id, provider, access_token, refresh_token, expires_at, calendar_sync_enabled")
      .eq("calendar_sync_enabled", true)
      .neq("status", "disconnected");
    if (connectionId) query = query.eq("id", connectionId);

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
```

- [ ] **Step 2: Update `supabase/config.toml`**

```toml
[functions.sync-integrations]
verify_jwt = false
```

(The `pg_cron` invocation added in Step 3 has no user JWT to send; the function only ever touches data via the service role client, so there's nothing for the platform gate to protect that isn't already gated by the service role key itself.)

- [ ] **Step 3: Write the cron migration**

```sql
-- supabase/migrations/20260910120200-schedule-sync-integrations.sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- The service role key can't be committed to a migration file. Run this
-- once per environment (local + each deployed project) via the Supabase
-- SQL editor or `supabase db execute`, substituting the real key:
--   select vault.create_secret('<service-role-key>', 'service_role_key');
-- The schedule below reads it back from Vault at call time so the key
-- itself never appears in source control or migration history.

select cron.schedule(
  'sync-integrations-every-10-min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://masofmjpnpnxjooqdajl.supabase.co/functions/v1/sync-integrations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 4: Manual verification**

After running `vault.create_secret` locally with a real (local) service role key:
```bash
supabase db execute --sql "select cron.schedule as job from cron.job where jobname = 'sync-integrations-every-10-min';"
```
Expected: one row. Then trigger the function directly to verify the sync logic itself (cron timing isn't worth waiting on):
```bash
curl -X POST http://localhost:54321/functions/v1/sync-integrations -H "Content-Type: application/json" -d '{}'
```
Expected: `{"synced":1}` (assuming the Task 5 connection exists), and `external_events`/`external_tasks` now have rows: `supabase db execute --sql "select count(*) from external_events; select count(*) from external_tasks;"`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/sync-integrations/index.ts supabase/migrations/20260910120200-schedule-sync-integrations.sql supabase/config.toml
git commit -m "Add sync-integrations Edge Function and cron schedule

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Google sign-in

**Files:**
- Modify: `src/hooks/useAuth.tsx`
- Modify: `src/components/Auth.tsx`

**Interfaces:**
- Produces: `useAuth().signInWithGoogle(): Promise<{ error: AuthError | null }>`.

- [ ] **Step 1: Add `signInWithGoogle` to `useAuth.tsx`**

In `src/hooks/useAuth.tsx`, add to `AuthContextType`:
```typescript
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
```
and inside `AuthProvider`, alongside `signInAnonymously`:
```typescript
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/app` },
    });
    return { error };
  };
```
and add `signInWithGoogle,` to the `value` object.

- [ ] **Step 2: Add the button to `Auth.tsx`**

In `src/components/Auth.tsx`, destructure `signInWithGoogle` alongside the existing `signIn, signUp, signInAnonymously`, add a `googleLoading` state next to `guestLoading`, and insert a button above the existing "Continue as Guest" button (still inside the `<div className="mt-6">` block, after the `Or` separator):

```tsx
            <Button
              type="button"
              variant="outline"
              className="w-full mt-4"
              disabled={googleLoading}
              onClick={async () => {
                setGoogleLoading(true);
                setError(null);
                try {
                  const { error } = await signInWithGoogle();
                  if (error) setError(error.message);
                } catch {
                  setError('Failed to sign in with Google');
                } finally {
                  setGoogleLoading(false);
                }
              }}
            >
              {googleLoading ? 'Redirecting...' : 'Continue with Google'}
            </Button>
```

(Note: `signInWithOAuth` redirects the browser away immediately on success, so `googleLoading` only ever visibly resolves on the error path — matching how Supabase's OAuth redirect flow behaves elsewhere in the ecosystem.)

- [ ] **Step 3: Enable the provider in Supabase**

In the Supabase Dashboard (or local `supabase/config.toml` `[auth.external.google]` for local dev), enable the Google provider with the same OAuth client credentials configured in Task 4, and add `<SUPABASE_URL>/auth/v1/callback` as an authorized redirect URI in the Google Cloud Console (this is Supabase Auth's own callback, distinct from `integration-oauth-callback` from Task 5, which is only for the calendar/task *connection* flow, not sign-in).

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open the sign-in page, click "Continue with Google", complete consent, and confirm you land on `/app` signed in (`useAuth().user` populated). Check `auth.identities` in Supabase to confirm a `google` identity was created for the user.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAuth.tsx src/components/Auth.tsx
git commit -m "Add Google sign-in option

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: `useIntegrationConnections` hook

**Files:**
- Create: `src/hooks/useIntegrationConnections.tsx`

**Interfaces:**
- Produces:
```typescript
export interface IntegrationConnection {
  id: string;
  provider: 'google';
  status: 'connected' | 'expired' | 'error' | 'disconnected';
  calendar_sync_enabled: boolean;
  message_scan_enabled: boolean;
  last_synced_at: string | null;
  last_scanned_at: string | null;
  last_error: string | null;
}
export const useIntegrationConnections: () => {
  connections: IntegrationConnection[];
  isLoading: boolean;
  connectGoogle: () => Promise<void>;
  disconnect: (id: string) => void;
  syncNow: (id: string) => void;
  isSyncing: boolean;
};
```

- [ ] **Step 1: Write the hook**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface IntegrationConnection {
  id: string;
  provider: 'google';
  status: 'connected' | 'expired' | 'error' | 'disconnected';
  calendar_sync_enabled: boolean;
  message_scan_enabled: boolean;
  last_synced_at: string | null;
  last_scanned_at: string | null;
  last_error: string | null;
}

export const useIntegrationConnections = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['integration-connections', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('integration_connections_view')
        .select('id, provider, status, calendar_sync_enabled, message_scan_enabled, last_synced_at, last_scanned_at, last_error')
        .neq('status', 'disconnected');
      if (error) throw error;
      return data as IntegrationConnection[];
    },
    enabled: !!user,
  });

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

  const disconnectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('integration_connections').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-connections', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['external-events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['external-tasks', user?.id] });
      toast.success('Disconnected');
    },
    onError: () => toast.error('Failed to disconnect'),
  });

  const syncNowMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke('sync-integrations', { body: { connection_id: id } });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-connections', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['external-events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['external-tasks', user?.id] });
      toast.success('Synced');
    },
    onError: () => toast.error('Sync failed'),
  });

  return {
    connections,
    isLoading,
    connectGoogle,
    disconnect: disconnectMutation.mutate,
    syncNow: syncNowMutation.mutate,
    isSyncing: syncNowMutation.isPending,
  };
};
```

- [ ] **Step 2: Regenerate Supabase types**

Run: `supabase gen types typescript --local > src/integrations/supabase/types.ts` (or the project's usual type-gen command) so `integration_connections_view`, `external_events`, and `external_tasks` are typed in the generated `Database` type used by `src/integrations/supabase/client.ts`.
Expected: `npx tsc --noEmit` passes with no type errors referencing these tables.

- [ ] **Step 3: Manual verification**

Temporarily render `useIntegrationConnections().connections` in `IntegrationsSettings` (built next in Task 9) or log it from the browser console after signing in with a connected Google account from Task 5; confirm it returns the one connected row without `access_token`/`refresh_token` fields present.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useIntegrationConnections.tsx src/integrations/supabase/types.ts
git commit -m "Add useIntegrationConnections hook

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Integrations settings panel

**Files:**
- Create: `src/components/IntegrationsSettings.tsx`
- Modify: `src/components/Settings.tsx`

**Interfaces:**
- Consumes: `useIntegrationConnections` from Task 8.

- [ ] **Step 1: Write `IntegrationsSettings.tsx`**

```tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { useIntegrationConnections } from '@/hooks/useIntegrationConnections';

const PROVIDER_LABELS: Record<string, string> = { google: 'Google' };

const IntegrationsSettings: React.FC = () => {
  const { connections, isLoading, connectGoogle, disconnect, syncNow, isSyncing } = useIntegrationConnections();
  const googleConnection = connections.find((c) => c.provider === 'google');

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Integrations</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Connect your Google account to see its calendar events and tasks here, read-only.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
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
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-foreground">Google</h3>
            <p className="text-sm text-muted-foreground">Not connected</p>
          </div>
          <Button onClick={connectGoogle}>Connect {PROVIDER_LABELS.google}</Button>
        </div>
      )}
    </div>
  );
};

export default IntegrationsSettings;
```

- [ ] **Step 2: Wire it into `Settings.tsx`**

Add `import IntegrationsSettings from './IntegrationsSettings';` near the other imports, and render `<IntegrationsSettings />` between the "Theme Settings" and "Data Management" sections (after the closing `</div>` of the Appearance card, before the `{/* Data Management */}` comment).

- [ ] **Step 3: Manual verification**

Run `npm run dev`, navigate to Settings, confirm the Integrations card shows "Not connected", click "Connect Google", complete OAuth, land back on `/app`, revisit Settings and confirm it now shows "Connected"/last-synced info, then click "Sync now" and "Disconnect" and confirm both work (disconnect returns the card to "Not connected" and removes the row from `integration_connections`).

- [ ] **Step 4: Commit**

```bash
git add src/components/IntegrationsSettings.tsx src/components/Settings.tsx
git commit -m "Add Integrations settings panel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: `useExternalEvents` and `useExternalTasks` hooks

**Files:**
- Create: `src/hooks/useExternalEvents.tsx`
- Create: `src/hooks/useExternalTasks.tsx`

**Interfaces:**
- Produces:
```typescript
export interface ExternalEvent {
  id: string; connection_id: string; title: string; start_time: string;
  end_time: string | null; meeting_url: string | null;
}
export const useExternalEvents: () => { events: ExternalEvent[]; isLoading: boolean };

export interface ExternalTask {
  id: string; connection_id: string; title: string; due_date: string | null;
  status: 'pending' | 'completed'; source_url: string | null;
}
export const useExternalTasks: () => { externalTasks: ExternalTask[]; isLoading: boolean };
```

- [ ] **Step 1: Write `useExternalEvents.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ExternalEvent {
  id: string;
  connection_id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  meeting_url: string | null;
}

export const useExternalEvents = () => {
  const { user } = useAuth();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['external-events', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('external_events')
        .select('id, connection_id, title, start_time, end_time, meeting_url')
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data as ExternalEvent[];
    },
    enabled: !!user,
  });

  return { events, isLoading };
};
```

- [ ] **Step 2: Write `useExternalTasks.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ExternalTask {
  id: string;
  connection_id: string;
  title: string;
  due_date: string | null;
  status: 'pending' | 'completed';
  source_url: string | null;
}

export const useExternalTasks = () => {
  const { user } = useAuth();

  const { data: externalTasks = [], isLoading } = useQuery({
    queryKey: ['external-tasks', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('external_tasks')
        .select('id, connection_id, title, due_date, status, source_url')
        .eq('status', 'pending')
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as ExternalTask[];
    },
    enabled: !!user,
  });

  return { externalTasks, isLoading };
};
```

- [ ] **Step 3: Manual verification**

With a connected + synced Google account (from Tasks 5–6), temporarily log `useExternalEvents().events` and `useExternalTasks().externalTasks` from `Dashboard` (removed once Task 11 renders them properly) and confirm real Google Calendar events/tasks come back client-side, scoped to the signed-in user (RLS relies on `external_events`/`external_tasks`' join to `integration_connections.user_id`).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useExternalEvents.tsx src/hooks/useExternalTasks.tsx
git commit -m "Add useExternalEvents and useExternalTasks hooks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Merge external events into `CalendarView`

**Files:**
- Modify: `src/components/CalendarView.tsx`

**Interfaces:**
- Consumes: `useExternalEvents` from Task 10.

- [ ] **Step 1: Import the hook and compute a per-date lookup**

In `src/components/CalendarView.tsx`, add the import:
```typescript
import { useExternalEvents } from '@/hooks/useExternalEvents';
```
Inside the component, alongside the existing `useTasks`/`useTaskInstances` calls:
```typescript
  const { events: externalEvents } = useExternalEvents();

  const getExternalEventsForDate = (dateString: string) =>
    externalEvents.filter((event) => event.start_time.slice(0, 10) === dateString);
```

- [ ] **Step 2: Render them in month view**

In `renderMonthView`, right after the existing `{dayTasks.slice(0, 3).map(...)}` block and before the `{dayTasks.length > 3 && ...}` block, add:
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

- [ ] **Step 3: Render them in week view**

In `renderWeekView`, right after the existing `{dayTasks.map(...)}` block, add the same external-event block (same JSX as Step 2, using the week view's `dateString`).

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open Calendar view for a month/week containing a synced Google Calendar event, confirm it renders with the blue "Google Calendar" styling distinct from native tasks, and that clicking it opens the meeting link in a new tab without opening the day's task modal (verifying `stopPropagation` works).

- [ ] **Step 5: Commit**

```bash
git add src/components/CalendarView.tsx
git commit -m "Show external calendar events in CalendarView

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: "From your connected apps" section on the Dashboard

**Files:**
- Modify: `src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `useExternalEvents`, `useExternalTasks` from Task 10.

- [ ] **Step 1: Import the hooks and derive today's/upcoming external items**

Add imports:
```typescript
import { useExternalEvents } from '@/hooks/useExternalEvents';
import { useExternalTasks } from '@/hooks/useExternalTasks';
```
Inside the component:
```typescript
  const { events: externalEvents } = useExternalEvents();
  const { externalTasks } = useExternalTasks();

  const upcomingExternalEvents = externalEvents
    .filter((event) => new Date(event.start_time) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .slice(0, 5);
  const upcomingExternalTasks = externalTasks.slice(0, 5);
```

- [ ] **Step 2: Render the section**

Add a new section after the "Main Content Grid" `</div>` and before "Quick Stats":
```tsx
      {(upcomingExternalEvents.length > 0 || upcomingExternalTasks.length > 0) && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 transition-colors">
          <h2 className="text-lg font-semibold text-black dark:text-white mb-4">From your connected apps</h2>
          <div className="space-y-3">
            {upcomingExternalEvents.map((event) => (
              <a
                key={event.id}
                href={event.meeting_url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="font-medium text-black dark:text-white">{event.title}</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {new Date(event.start_time).toLocaleString()} · Google Calendar
                </span>
              </a>
            ))}
            {upcomingExternalTasks.map((task) => (
              <a
                key={task.id}
                href={task.source_url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="font-medium text-black dark:text-white">{task.title}</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'} · Google Tasks
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`, open the Dashboard with a connected + synced Google account that has at least one upcoming event and one open task, confirm the new "From your connected apps" section renders both, each linking out to the source app, and that the section is hidden entirely when there are no external items (e.g. after disconnecting).

- [ ] **Step 4: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "Show external events and tasks on the Dashboard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Post-plan smoke test

Once all 12 tasks are done, run through the full user journey once end-to-end:
1. Sign in with Google (Task 7).
2. Go to Settings → Integrations, connect Google for calendar/task sync (Tasks 4, 5, 9).
3. Wait for (or manually trigger) a sync (Task 6).
4. Confirm a real upcoming Google Calendar event and Google Task appear on the Dashboard (Task 12) and the event appears on the correct day in Calendar view (Task 11).
5. Disconnect Google and confirm both disappear everywhere.

This is the spec's Goals section (Google sign-in + connect + read-only display + disconnect) fully exercised.
