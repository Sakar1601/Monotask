# AI Subsystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add message-scanning task suggestions (Gmail, Outlook Mail, Teams) and meeting-conflict detection with AI-suggested rescheduling, both reviewed by the user before anything is created or changed.

**Architecture:** Two new cron-driven Edge Functions (`scan-messages`, `detect-conflicts`) extend the existing `IntegrationProvider`/sync-engine pattern. Both write into one new `ai_suggestions` table; a new Suggestions UI reviews and accepts/dismisses rows of either kind, routing accepted suggestions through the existing `TaskModal` (task) or `updateEvent` mutation (reschedule) — never inserting/updating directly from AI output.

**Tech Stack:** Deno Edge Functions, Anthropic SDK (`claude-haiku-4-5`, schema-constrained structured output), Supabase Postgres + RLS + pg_cron, React/TanStack Query.

**Spec:** `docs/superpowers/specs/2026-09-13-ai-subsystem-design.md`

## Global Constraints

- Never persist a message's raw content or a reference back to it — only the model's extracted suggestion fields.
- Message-scanning is off by default per connection; enabling it requires an incremental OAuth reconnect for that specific connection, not a new connection.
- No suggestion (task or reschedule) is ever auto-applied. The user always reviews before a task is created or an event's time changes.
- Reuse `check_and_increment_ai_usage` for rate-limiting, under new feature keys (`scan-messages`, `detect-conflicts`), independent of `parse-task`'s cap.
- Model: `claude-haiku-4-5`, matching `parse-task`. No new secrets — reuses `ANTHROPIC_API_KEY`.
- Follow the existing provider-agnostic pattern: `scan-messages`/`detect-conflicts` never branch on `connection.provider === "google"` by name — new `IntegrationProvider` members are optional and feature-detected, exactly like `resolveProviderMetadata`.

---

### Task 1: Data model — `ai_suggestions`, rate-limit fix, and incremental-scope tracking

**Files:**
- Create: `supabase/migrations/20260914120000-ai-suggestions-and-scan-infra.sql`

**Interfaces:**
- Consumes: nothing (schema-only).
- Produces: table `public.ai_suggestions(id, user_id, connection_id, kind, status, payload, created_at)`; function `public.check_and_increment_ai_usage(p_feature text, p_daily_limit int, p_user_id uuid default auth.uid())` returning boolean; column `public.oauth_states.requesting_message_scan boolean`.

This task also fixes a real gap the spec didn't call out: `check_and_increment_ai_usage` (added for `parse-task`) reads `auth.uid()` internally, which only works when the caller carries a specific user's JWT. `scan-messages` and `detect-conflicts` run as service-role cron jobs iterating *other users'* connections — there is no single "current user" for `auth.uid()` to resolve. Adding an optional `p_user_id` parameter (defaulting to `auth.uid()`) keeps `parse-task`'s existing call (which passes no such argument) working unchanged, while letting the new service-role callers pass the target user's id explicitly.

- [ ] **Step 1: Write the migration file**

```sql
-- One row per AI-generated suggestion, of either kind, reviewed by the
-- user before it becomes a real task or changes a real event. Never
-- holds raw message content - only the model's extracted fields.
create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  -- Null for 'reschedule': conflict detection reasons over the user's
  -- own events regardless of provider, so it isn't tied to one connection.
  connection_id uuid references public.integration_connections on delete cascade,
  kind text not null check (kind in ('task', 'reschedule')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  -- 'task': { title, description, due_date, due_time, priority }
  -- 'reschedule': { event_id, other_event_id, current_start_time,
  --                 current_end_time, suggested_start_time,
  --                 suggested_end_time, reasoning }
  payload jsonb not null,
  created_at timestamp with time zone not null default now()
);

alter table public.ai_suggestions enable row level security;

create policy "Users can view their own suggestions"
  on public.ai_suggestions for select using (auth.uid() = user_id);

create policy "Users can update their own suggestions"
  on public.ai_suggestions for update using (auth.uid() = user_id);

-- No secret columns on this table (unlike integration_connections), so a
-- plain table-level grant is safe - no column-level restriction needed.
grant select, update on public.ai_suggestions to authenticated;

-- Backward-compatible: p_user_id defaults to auth.uid(), so parse-task's
-- existing two-argument call keeps working unchanged. scan-messages and
-- detect-conflicts (service-role, no single "current user") pass the
-- target connection/event's user_id explicitly.
CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage(
  p_feature TEXT,
  p_daily_limit INTEGER,
  p_user_id UUID DEFAULT auth.uid()
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.ai_usage (user_id, feature, usage_date, call_count)
  VALUES (p_user_id, p_feature, CURRENT_DATE, 0)
  ON CONFLICT (user_id, feature, usage_date) DO NOTHING;

  UPDATE public.ai_usage
  SET call_count = call_count + 1,
      updated_at = now()
  WHERE user_id = p_user_id
    AND feature = p_feature
    AND usage_date = CURRENT_DATE
    AND call_count < p_daily_limit
  RETURNING call_count INTO v_count;

  RETURN v_count IS NOT NULL;
END;
$$;

-- Carries whether an OAuth round-trip is "enable message scanning for
-- this connection" (vs. a plain reconnect) through to the callback, so
-- it knows whether to flip message_scan_enabled on once the extra
-- scopes are confirmed granted. Always paired with a non-null
-- connection_id in practice (scanning is a toggle on an existing
-- connection, never part of creating a new one).
alter table public.oauth_states add column requesting_message_scan boolean not null default false;
```

- [ ] **Step 2: Apply it to the local database and verify**

```bash
docker exec -i supabase_db_$(supabase status -o json | python3 -c "import json,sys; print(json.load(sys.stdin)['linked_project']['project_ref'])") \
  psql -U postgres -d postgres < supabase/migrations/20260914120000-ai-suggestions-and-scan-infra.sql
```

Expected: `CREATE TABLE`, `ALTER TABLE` (x2), `CREATE POLICY` (x2), `GRANT`, `CREATE FUNCTION` printed, no errors.

Then confirm the function signature has three parameters and `ai_suggestions` exists:

```bash
docker exec -i supabase_db_$(supabase status -o json | python3 -c "import json,sys; print(json.load(sys.stdin)['linked_project']['project_ref'])") \
  psql -U postgres -d postgres -c "\df check_and_increment_ai_usage" -c "\d public.ai_suggestions"
```

Expected: the function row shows `p_feature text, p_daily_limit integer, p_user_id uuid DEFAULT auth.uid()`; the table description lists all six columns.

- [ ] **Step 3: Regenerate Supabase TypeScript types**

```bash
supabase gen types typescript --local > /tmp/new_types.ts
grep -v "^Connecting to db\|^A new version of Supabase CLI\|^We recommend updating regularly" /tmp/new_types.ts > src/integrations/supabase/types.ts
```

Expected: `git diff src/integrations/supabase/types.ts` shows only additions for `ai_suggestions`, the updated `check_and_increment_ai_usage` signature, and `oauth_states.requesting_message_scan` — nothing removed.

- [ ] **Step 4: Verify the rest of the app still builds**

Run: `npx tsc --noEmit && npm test`
Expected: no errors, all existing tests still pass (this task touches no application code, only schema).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260914120000-ai-suggestions-and-scan-infra.sql src/integrations/supabase/types.ts
git commit -m "Add ai_suggestions table, per-user AI rate-limit param, and scan-scope OAuth state"
```

---

### Task 2: Extract `ensureFreshToken` into a shared module

**Files:**
- Create: `supabase/functions/_shared/integrations/tokenRefresh.ts`
- Modify: `supabase/functions/sync-integrations/index.ts` (remove the local `ensureFreshToken`, import the shared one)
- Test: `src/utils/tokenRefresh.test.ts`

**Interfaces:**
- Consumes: `providers` from `../_shared/integrations/registry.ts`.
- Produces: `ensureFreshToken(adminClient: SupabaseClient, connection: { id: string; provider: "google" | "microsoft"; access_token: string; refresh_token: string; expires_at: string }): Promise<string>` — used by both `sync-integrations` (Task 2 onward) and `scan-messages` (Task 5).

`sync-integrations` currently defines `ensureFreshToken` as a private, unexported function. `scan-messages` (Task 5) needs the identical logic. Extracting it now (before a second copy gets written) is the DRY move the codebase's existing patterns favor.

- [ ] **Step 1: Write the failing test**

```typescript
// src/utils/tokenRefresh.test.ts
import { describe, expect, it, vi } from 'vitest';
import '../types/deno';
import { ensureFreshToken } from '../../supabase/functions/_shared/integrations/tokenRefresh.ts';

describe('ensureFreshToken', () => {
  it('returns the existing access token unchanged when it is not close to expiring', async () => {
    const updateMock = vi.fn();
    const adminClient = {
      from: () => ({ update: updateMock, eq: () => ({}) }),
    } as unknown as Parameters<typeof ensureFreshToken>[0];

    const connection = {
      id: 'conn-1',
      provider: 'google' as const,
      access_token: 'still-valid-token',
      refresh_token: 'refresh-1',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };

    const token = await ensureFreshToken(adminClient, connection);

    expect(token).toBe('still-valid-token');
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('refreshes and persists a new token when the current one is expired', async () => {
    const eqMock = vi.fn();
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const adminClient = {
      from: () => ({ update: updateMock }),
    } as unknown as Parameters<typeof ensureFreshToken>[0];

    vi.doMock('../../supabase/functions/_shared/integrations/registry.ts', () => ({
      providers: {
        google: {
          refreshToken: vi.fn().mockResolvedValue({
            accessToken: 'new-token',
            refreshToken: '',
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
            scope: 'https://www.googleapis.com/auth/calendar',
          }),
        },
      },
    }));

    const connection = {
      id: 'conn-1',
      provider: 'google' as const,
      access_token: 'expired-token',
      refresh_token: 'refresh-1',
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    };

    const token = await ensureFreshToken(adminClient, connection);

    expect(token).toBe('new-token');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: 'new-token' }),
    );
    expect(eqMock).toHaveBeenCalledWith('id', 'conn-1');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tokenRefresh`
Expected: FAIL — `Cannot find module '../../supabase/functions/_shared/integrations/tokenRefresh.ts'`.

- [ ] **Step 3: Create the shared module**

```typescript
// supabase/functions/_shared/integrations/tokenRefresh.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { providers } from "./registry.ts";

interface RefreshableConnection {
  id: string;
  provider: "google" | "microsoft";
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export async function ensureFreshToken(
  adminClient: ReturnType<typeof createClient>,
  connection: RefreshableConnection,
): Promise<string> {
  const expiresInMs = new Date(connection.expires_at).getTime() - Date.now();
  if (expiresInMs > 60_000) return connection.access_token;

  const tokens = await providers[connection.provider].refreshToken(connection.refresh_token);
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- tokenRefresh`
Expected: PASS (2 tests).

- [ ] **Step 5: Update `sync-integrations` to use the shared function**

In `supabase/functions/sync-integrations/index.ts`:
1. Delete the local `async function ensureFreshToken(...)` definition entirely.
2. Add `import { ensureFreshToken } from "../_shared/integrations/tokenRefresh.ts";` near the top with the other imports.

- [ ] **Step 6: Run the full suite and verify nothing broke**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors, all tests pass (including the two new ones).

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/integrations/tokenRefresh.ts supabase/functions/sync-integrations/index.ts src/utils/tokenRefresh.test.ts
git commit -m "Extract ensureFreshToken into a shared module for reuse by scan-messages"
```

---

### Task 3: `IntegrationProvider` interface additions

**Files:**
- Modify: `supabase/functions/_shared/integrations/types.ts`

**Interfaces:**
- Produces: `ExternalMessage { externalId, source: "email" | "chat", subject: string | null, snippet: string, sender: string | null, receivedAt: string }`; `IntegrationProvider.fetchMessages?(accessToken, windowStart): Promise<ExternalMessage[]>`; `IntegrationProvider.fetchChatMessages?(accessToken, windowStart): Promise<ExternalMessage[]>`; `IntegrationProvider.messageScanScopes?: string`; widened `getAuthUrl(state, redirectUri, extraScopes?: string): string`.

No test for this task alone — it's a pure interface change with no behavior; Tasks 4 and 5 exercise it.

- [ ] **Step 1: Add `ExternalMessage` and widen the interface**

In `supabase/functions/_shared/integrations/types.ts`, add after `ExternalTask`:

```typescript
export interface ExternalMessage {
  externalId: string;
  source: "email" | "chat";
  subject: string | null; // email only - null for chat
  snippet: string; // short preview text - the only content ever sent to the model or persisted
  sender: string | null;
  receivedAt: string; // ISO timestamp
}
```

Then change the `getAuthUrl` line and add two new optional members inside `IntegrationProvider`:

```typescript
export interface IntegrationProvider {
  id: "google" | "microsoft";
  // extraScopes, when provided, is appended to the provider's base
  // scope list for this one authorize request - used only when a user
  // is enabling message-scanning for an existing connection (see
  // messageScanScopes below), never for a fresh connect.
  getAuthUrl(state: string, redirectUri: string, extraScopes?: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
  fetchEvents(accessToken: string, windowStart: Date, windowEnd: Date): Promise<ExternalEvent[]>;
  fetchTasks(accessToken: string, completedMin: Date, providerMetadata?: Record<string, unknown> | null): Promise<ExternalTask[]>;
  updateEvent(accessToken: string, externalEventId: string, changes: EventChanges): Promise<void>;
  deleteEvent(accessToken: string, externalEventId: string): Promise<void>;
  updateTask(accessToken: string, externalTaskId: string, changes: TaskChanges, providerMetadata?: Record<string, unknown> | null): Promise<void>;
  deleteTask(accessToken: string, externalTaskId: string, providerMetadata?: Record<string, unknown> | null): Promise<void>;
  resolveProviderMetadata?(accessToken: string): Promise<Record<string, unknown>>;
  getAccountEmail?(accessToken: string): Promise<string | null>;
  // Optional: providers with a message source to scan implement one or
  // both. Google has email only; Microsoft has both. scan-messages
  // feature-detects these exactly like resolveProviderMetadata - it
  // never checks provider.id by name.
  fetchMessages?(accessToken: string, windowStart: Date): Promise<ExternalMessage[]>;
  fetchChatMessages?(accessToken: string, windowStart: Date): Promise<ExternalMessage[]>;
  // The extra OAuth scope(s) (space-separated, same format as the base
  // scope constants) needed for fetchMessages/fetchChatMessages to
  // work. Present exactly when at least one of those methods is.
  messageScanScopes?: string;
}
```

- [ ] **Step 2: Verify the codebase still compiles**

Run: `npx tsc --noEmit`
Expected: no errors — every existing call to `getAuthUrl(state, redirectUri)` (two positional args) remains valid since `extraScopes` is optional.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/integrations/types.ts
git commit -m "Widen IntegrationProvider for message-scanning and incremental OAuth scopes"
```

---

### Task 4: Google — Gmail message fetching

**Files:**
- Modify: `supabase/functions/_shared/integrations/google.ts`
- Test: `src/utils/googleIntegration.test.ts`

**Interfaces:**
- Consumes: `ExternalMessage` from `./types.ts` (Task 3).
- Produces: `googleProvider.messageScanScopes`, `googleProvider.fetchMessages(accessToken, windowStart)`, `googleProvider.getAuthUrl(state, redirectUri, extraScopes?)`; exported `mapGmailMessage(detail: GmailMessageDetail): ExternalMessage | null` for testing.

- [ ] **Step 1: Write the failing tests**

Add to `src/utils/googleIntegration.test.ts`:

```typescript
import { mapGmailMessage, googleProvider } from '../../supabase/functions/_shared/integrations/google.ts';

describe('Gmail message mapping', () => {
  it('maps a Gmail message detail, preferring the snippet field over a full body fetch', () => {
    expect(mapGmailMessage({
      id: 'msg-1',
      snippet: 'Can you send the report by Friday?',
      internalDate: '1700000000000',
      payload: { headers: [
        { name: 'Subject', value: 'Report needed' },
        { name: 'From', value: 'boss@example.com' },
      ] },
    })).toEqual({
      externalId: 'msg-1',
      source: 'email',
      subject: 'Report needed',
      snippet: 'Can you send the report by Friday?',
      sender: 'boss@example.com',
      receivedAt: new Date(1700000000000).toISOString(),
    });
  });

  it('returns null for a message with no id', () => {
    expect(mapGmailMessage({ snippet: 'no id here' })).toBeNull();
  });

  it('appends extraScopes to the authorize URL when provided', () => {
    const url = googleProvider.getAuthUrl('state-1', 'https://example.com/callback', 'https://www.googleapis.com/auth/gmail.readonly');
    const scope = new URL(url).searchParams.get('scope')!;
    expect(scope).toContain('https://www.googleapis.com/auth/gmail.readonly');
    expect(scope).toContain('https://www.googleapis.com/auth/calendar');
  });

  it('omits extraScopes from the authorize URL when not provided', () => {
    const url = googleProvider.getAuthUrl('state-1', 'https://example.com/callback');
    const scope = new URL(url).searchParams.get('scope')!;
    expect(scope).not.toContain('gmail.readonly');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- googleIntegration`
Expected: FAIL — `mapGmailMessage` is not exported / does not exist.

- [ ] **Step 3: Implement in `google.ts`**

Change the scope constant and `getAuthUrl` signature:

```typescript
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");
```

(unchanged from before this task)

```typescript
  getAuthUrl(state: string, redirectUri: string, extraScopes?: string): string {
    const params = new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: extraScopes ? `${GOOGLE_SCOPES} ${extraScopes}` : GOOGLE_SCOPES,
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },
```

Add near the other mapping functions (`mapGoogleEvent`, `mapGoogleTask`):

```typescript
interface GmailMessageDetail {
  id?: string;
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: { name: string; value: string }[] };
}

export function mapGmailMessage(detail: GmailMessageDetail): ExternalMessage | null {
  if (!detail.id) return null;
  const headers = detail.payload?.headers ?? [];
  const subject = headers.find((h) => h.name === "Subject")?.value ?? null;
  const from = headers.find((h) => h.name === "From")?.value ?? null;
  return {
    externalId: detail.id,
    source: "email",
    subject,
    snippet: detail.snippet ?? "",
    sender: from,
    receivedAt: detail.internalDate ? new Date(Number(detail.internalDate)).toISOString() : new Date().toISOString(),
  };
}
```

Add `ExternalMessage` to the import line at the top of the file:

```typescript
import type { EventChanges, ExternalEvent, ExternalMessage, ExternalTask, IntegrationProvider, TaskChanges, TokenSet } from "./types.ts";
```

Add `messageScanScopes` and `fetchMessages` to the `googleProvider` object (after `getAccountEmail`, before the closing `};`):

```typescript
  messageScanScopes: "https://www.googleapis.com/auth/gmail.readonly",

  async fetchMessages(accessToken: string, windowStart: Date): Promise<ExternalMessage[]> {
    const afterSeconds = Math.floor(windowStart.getTime() / 1000);
    const listParams = new URLSearchParams({ q: `after:${afterSeconds}`, maxResults: "50" });
    const messages: ExternalMessage[] = [];
    let pageToken: string | undefined;
    let pageCount = 0;
    // Much lower than fetchEvents/fetchTasks's 20-page ceiling: each
    // message here costs an extra per-message detail fetch below, and
    // message-scanning is meant to look at recent activity, not a
    // account's entire history.
    const MAX_PAGES = 5;
    do {
      if (pageToken) listParams.set("pageToken", pageToken);
      const listResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${listParams.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!listResponse.ok) throw new Error(`Gmail message list failed: ${listResponse.status} ${await listResponse.text()}`);
      const listJson = await listResponse.json() as { messages?: { id: string }[]; nextPageToken?: string };

      for (const { id } of listJson.messages ?? []) {
        const detailParams = new URLSearchParams({ format: "metadata" });
        detailParams.append("metadataHeaders", "Subject");
        detailParams.append("metadataHeaders", "From");
        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?${detailParams.toString()}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!detailResponse.ok) throw new Error(`Gmail message fetch failed: ${detailResponse.status} ${await detailResponse.text()}`);
        const mapped = mapGmailMessage(await detailResponse.json());
        if (mapped) messages.push(mapped);
      }
      pageToken = listJson.nextPageToken;
      pageCount++;
    } while (pageToken && pageCount < MAX_PAGES);
    return messages;
  },
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- googleIntegration`
Expected: PASS.

- [ ] **Step 5: Type-check and full test run**

Run: `npx tsc --noEmit && npm test`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/integrations/google.ts src/utils/googleIntegration.test.ts
git commit -m "Add Gmail message fetching for the AI subsystem's message-scanning"
```

---

### Task 5: Microsoft — Outlook Mail and Teams chat message fetching

**Files:**
- Modify: `supabase/functions/_shared/integrations/microsoft.ts`
- Test: `src/utils/microsoftIntegration.test.ts`

**Interfaces:**
- Consumes: `ExternalMessage` from `./types.ts` (Task 3).
- Produces: `microsoftProvider.messageScanScopes`, `microsoftProvider.fetchMessages`, `microsoftProvider.fetchChatMessages`, `microsoftProvider.getAuthUrl(state, redirectUri, extraScopes?)`; exported `mapOutlookMessage`, `mapTeamsChatMessage` for testing.

- [ ] **Step 1: Write the failing tests**

Add to `src/utils/microsoftIntegration.test.ts`:

```typescript
import { mapOutlookMessage, mapTeamsChatMessage, microsoftProvider } from '../../supabase/functions/_shared/integrations/microsoft.ts';

describe('Microsoft message mapping', () => {
  it('maps an Outlook mail message', () => {
    expect(mapOutlookMessage({
      id: 'mail-1',
      subject: 'Report needed',
      bodyPreview: 'Can you send the report by Friday?',
      from: { emailAddress: { address: 'boss@example.com', name: 'Boss' } },
      receivedDateTime: '2026-09-15T09:00:00Z',
    })).toEqual({
      externalId: 'mail-1',
      source: 'email',
      subject: 'Report needed',
      snippet: 'Can you send the report by Friday?',
      sender: 'boss@example.com',
      receivedAt: '2026-09-15T09:00:00Z',
    });
  });

  it('strips HTML from a Teams chat message body', () => {
    expect(mapTeamsChatMessage({
      id: 'chat-1',
      from: { user: { displayName: 'Alex' } },
      body: { content: '<p>Can you <b>review</b> the PR?</p>', contentType: 'html' },
      createdDateTime: '2026-09-15T09:00:00Z',
    })).toEqual({
      externalId: 'chat-1',
      source: 'chat',
      subject: null,
      snippet: 'Can you review the PR?',
      sender: 'Alex',
      receivedAt: '2026-09-15T09:00:00Z',
    });
  });

  it('returns null for a message with no id', () => {
    expect(mapOutlookMessage({ subject: 'no id' })).toBeNull();
    expect(mapTeamsChatMessage({ body: { content: 'no id' } })).toBeNull();
  });

  it('appends extraScopes to the authorize URL when provided', () => {
    const url = microsoftProvider.getAuthUrl('state-1', 'https://example.com/callback', 'Mail.Read Chat.Read');
    const scope = new URL(url).searchParams.get('scope')!;
    expect(scope).toContain('Mail.Read');
    expect(scope).toContain('Chat.Read');
    expect(scope).toContain('Calendars.ReadWrite');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- microsoftIntegration`
Expected: FAIL — `mapOutlookMessage`/`mapTeamsChatMessage` not exported.

- [ ] **Step 3: Implement in `microsoft.ts`**

Add `ExternalMessage` to the top import:

```typescript
import type { EventChanges, ExternalEvent, ExternalMessage, ExternalTask, IntegrationProvider, TaskChanges, TokenSet } from "./types.ts";
```

Change `getAuthUrl`:

```typescript
  getAuthUrl(state: string, redirectUri: string, extraScopes?: string): string {
    const params = new URLSearchParams({
      client_id: Deno.env.get("MICROSOFT_CLIENT_ID")!,
      redirect_uri: redirectUri,
      response_type: "code",
      response_mode: "query",
      scope: extraScopes ? `${MICROSOFT_SCOPES} ${extraScopes}` : MICROSOFT_SCOPES,
      state,
      prompt: "select_account",
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },
```

Add near `mapMicrosoftEvent`/`mapMicrosoftTask`:

```typescript
interface GraphMailMessage {
  id?: string;
  subject?: string;
  bodyPreview?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  receivedDateTime?: string;
}

interface GraphChatMessage {
  id?: string;
  from?: { user?: { displayName?: string } };
  body?: { content?: string; contentType?: string };
  createdDateTime?: string;
}

// Chat message bodies can be HTML - strips tags for a plain-text
// snippet. Deliberately simple (no HTML entity decoding beyond the
// handful Teams commonly emits) since this text is discarded
// immediately after the AI call, never displayed to the user verbatim.
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapOutlookMessage(item: GraphMailMessage): ExternalMessage | null {
  if (!item.id) return null;
  return {
    externalId: item.id,
    source: "email",
    subject: item.subject ?? null,
    snippet: item.bodyPreview ?? "",
    sender: item.from?.emailAddress?.address ?? null,
    receivedAt: item.receivedDateTime ?? new Date().toISOString(),
  };
}

export function mapTeamsChatMessage(item: GraphChatMessage): ExternalMessage | null {
  if (!item.id) return null;
  const rawContent = item.body?.content ?? "";
  return {
    externalId: item.id,
    source: "chat",
    subject: null,
    snippet: item.body?.contentType === "html" ? stripHtml(rawContent) : rawContent,
    sender: item.from?.user?.displayName ?? null,
    receivedAt: item.createdDateTime ?? new Date().toISOString(),
  };
}
```

Add `messageScanScopes`, `fetchMessages`, `fetchChatMessages` to the `microsoftProvider` object (after `getAccountEmail`, before the closing `};`):

```typescript
  messageScanScopes: "Mail.Read Chat.Read",

  async fetchMessages(accessToken: string, windowStart: Date): Promise<ExternalMessage[]> {
    const params = new URLSearchParams({
      $filter: `receivedDateTime ge ${windowStart.toISOString()}`,
      $select: "id,subject,bodyPreview,from,receivedDateTime",
      $top: "50",
    });
    const messages: ExternalMessage[] = [];
    let url: string | undefined = `${GRAPH_BASE}/me/mailFolders/inbox/messages?${params.toString()}`;
    let pageCount = 0;
    const MAX_PAGES = 5; // matches google.ts's message-scanning ceiling
    while (url && pageCount < MAX_PAGES) {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error(`Outlook mail fetch failed: ${response.status} ${await response.text()}`);
      const json = await response.json() as { value?: GraphMailMessage[]; "@odata.nextLink"?: string };
      messages.push(...(json.value ?? []).map(mapOutlookMessage).filter((m): m is ExternalMessage => m !== null));
      url = json["@odata.nextLink"];
      pageCount++;
    }
    return messages;
  },

  async fetchChatMessages(accessToken: string, windowStart: Date): Promise<ExternalMessage[]> {
    const params = new URLSearchParams({
      $filter: `lastModifiedDateTime gt ${windowStart.toISOString()}`,
      $top: "50",
    });
    const messages: ExternalMessage[] = [];
    let url: string | undefined = `${GRAPH_BASE}/me/chats/getAllMessages?${params.toString()}`;
    let pageCount = 0;
    const MAX_PAGES = 5;
    while (url && pageCount < MAX_PAGES) {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error(`Teams chat fetch failed: ${response.status} ${await response.text()}`);
      const json = await response.json() as { value?: GraphChatMessage[]; "@odata.nextLink"?: string };
      messages.push(...(json.value ?? []).map(mapTeamsChatMessage).filter((m): m is ExternalMessage => m !== null));
      url = json["@odata.nextLink"];
      pageCount++;
    }
    return messages;
  },
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- microsoftIntegration`
Expected: PASS.

- [ ] **Step 5: Type-check and full test run**

Run: `npx tsc --noEmit && npm test`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/integrations/microsoft.ts src/utils/microsoftIntegration.test.ts
git commit -m "Add Outlook Mail and Teams chat message fetching for the AI subsystem"
```

---

### Task 6: `scan-messages` Edge Function

**Files:**
- Create: `supabase/functions/scan-messages/index.ts`

**Interfaces:**
- Consumes: `providers` (registry), `ensureFreshToken` (Task 2), `ExternalMessage` (Task 3), `googleProvider`/`microsoftProvider.fetchMessages`/`fetchChatMessages`/`messageScanScopes` (Tasks 4-5).
- Produces: an HTTP endpoint `POST /functions/v1/scan-messages` returning `{ scanned: number }`; rows in `ai_suggestions` with `kind: 'task'`.

No unit test for this task — like `sync-integrations`, it's an orchestration function whose correctness is verified by manual invocation (Step 3) rather than a mocked unit test, since the interesting logic (mapping, rate-limit param passing) is already covered in Tasks 2/4/5.

- [ ] **Step 1: Write the function**

```typescript
// supabase/functions/scan-messages/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.122.0";
import { corsHeaders } from "../_shared/cors.ts";
import { providers } from "../_shared/integrations/registry.ts";
import { ensureFreshToken } from "../_shared/integrations/tokenRefresh.ts";
import type { ExternalMessage } from "../_shared/integrations/types.ts";

const DAILY_LIMIT = 20;
const MODEL = "claude-haiku-4-5";
const LOOKBACK_HOURS_FIRST_RUN = 24;

const TASK_CANDIDATES_JSON_SCHEMA = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short task title" },
          description: { type: ["string", "null"], description: "Extra detail beyond the title, or null" },
          due_date: { type: ["string", "null"], description: "ISO date YYYY-MM-DD if a deadline is mentioned, else null" },
          due_time: { type: ["string", "null"], description: "24-hour HH:MM if a specific time is mentioned, else null" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Defaults to medium if not stated" },
        },
        required: ["title", "description", "due_date", "due_time", "priority"],
        additionalProperties: false,
      },
    },
  },
  required: ["candidates"],
  additionalProperties: false,
};

interface TaskCandidate {
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: "low" | "medium" | "high";
}

interface Connection {
  id: string;
  user_id: string;
  provider: "google" | "microsoft";
  access_token: string;
  refresh_token: string;
  expires_at: string;
  last_scanned_at: string | null;
}

function isValidIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00");
  return !Number.isNaN(d.getTime());
}

function isValidTime(value: string | null | undefined): value is string {
  return !!value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

const VALID_PRIORITIES = new Set(["low", "medium", "high"]);

async function extractTaskCandidates(anthropic: Anthropic, messages: ExternalMessage[]): Promise<TaskCandidate[]> {
  if (messages.length === 0) return [];
  const today = new Date().toISOString().split("T")[0];
  const messagesText = messages
    .map((m, i) => `[${i + 1}] From: ${m.sender ?? "unknown"}${m.subject ? ` | Subject: ${m.subject}` : ""}\n${m.snippet}`)
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system:
      `Today's date is ${today}. Below are recent email/chat messages, each numbered. Extract any ` +
      `clear, actionable tasks the recipient needs to do - most messages have none. ` +
      `Never invent information not stated or clearly implied in the text. ` +
      `Return an empty candidates array if nothing is actionable.`,
    messages: [{ role: "user", content: messagesText }],
    output_config: { format: { type: "json_schema", schema: TASK_CANDIDATES_JSON_SCHEMA } },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  try {
    const parsed = textBlock?.text ? JSON.parse(textBlock.text) : null;
    const list = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
    return list.filter(
      (c: unknown): c is TaskCandidate =>
        !!c && typeof (c as TaskCandidate).title === "string" && VALID_PRIORITIES.has((c as TaskCandidate).priority),
    );
  } catch {
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

    const { data: connections, error } = await adminClient
      .from("integration_connections")
      .select("id, user_id, provider, access_token, refresh_token, expires_at, last_scanned_at")
      .eq("message_scan_enabled", true)
      .eq("status", "connected");
    if (error) throw error;

    let scanned = 0;
    for (const connection of (connections ?? []) as Connection[]) {
      const provider = providers[connection.provider];
      if (!provider.fetchMessages && !provider.fetchChatMessages) continue;

      try {
        const { data: allowed, error: rateLimitError } = await adminClient.rpc("check_and_increment_ai_usage", {
          p_feature: "scan-messages",
          p_daily_limit: DAILY_LIMIT,
          p_user_id: connection.user_id,
        });
        if (rateLimitError) throw rateLimitError;
        if (!allowed) continue;

        const accessToken = await ensureFreshToken(adminClient, connection);
        const windowStart = connection.last_scanned_at
          ? new Date(connection.last_scanned_at)
          : new Date(Date.now() - LOOKBACK_HOURS_FIRST_RUN * 60 * 60 * 1000);

        const [emailMessages, chatMessages] = await Promise.all([
          provider.fetchMessages ? provider.fetchMessages(accessToken, windowStart) : Promise.resolve([]),
          provider.fetchChatMessages ? provider.fetchChatMessages(accessToken, windowStart) : Promise.resolve([]),
        ]);
        const allMessages = [...emailMessages, ...chatMessages];

        if (allMessages.length > 0) {
          const candidates = await extractTaskCandidates(anthropic, allMessages);
          if (candidates.length > 0) {
            const rows = candidates.map((c) => ({
              user_id: connection.user_id,
              connection_id: connection.id,
              kind: "task",
              payload: {
                title: c.title.slice(0, 200),
                description: c.description ?? "",
                due_date: isValidIsoDate(c.due_date) ? c.due_date : null,
                due_time: isValidTime(c.due_time) ? c.due_time : null,
                priority: c.priority,
              },
            }));
            const { error: insertError } = await adminClient.from("ai_suggestions").insert(rows);
            if (insertError) throw insertError;
          }
        }

        await adminClient
          .from("integration_connections")
          .update({ last_scanned_at: new Date().toISOString() })
          .eq("id", connection.id);
        scanned++;
      } catch (connectionError) {
        console.error(`scan-messages: connection ${connection.id} failed:`, connectionError);
      }
    }

    return new Response(JSON.stringify({ scanned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("scan-messages error:", error);
    return new Response(JSON.stringify({ error: "Scan failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (This file is Deno-targeted and won't be included in the Vite/tsc project the same way edge functions generally aren't — confirm by checking it doesn't introduce new errors to the existing `tsc --noEmit` output, matching how `sync-integrations/index.ts` is already excluded/tolerated today.)

- [ ] **Step 3: Manual local verification**

With the local Supabase stack running (`supabase start`) and at least one connection with `message_scan_enabled = true` (set manually for this test: `update integration_connections set message_scan_enabled = true where id = '<a connected id>';`), invoke it directly:

```bash
SERVICE_KEY=$(supabase status -o json | python3 -c "import json,sys; print(json.load(sys.stdin)['SERVICE_ROLE_KEY'])")
curl -s -X POST "http://127.0.0.1:54321/functions/v1/scan-messages" \
  -H "Authorization: Bearer $SERVICE_KEY" -H "apikey: $SERVICE_KEY" -H "Content-Type: application/json" -d '{}'
```

Expected: `{"scanned":1}` (or however many eligible connections exist), and `select * from ai_suggestions;` shows zero or more new `kind: 'task'` rows depending on whether that account's recent messages actually contained anything actionable.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/scan-messages/index.ts
git commit -m "Add scan-messages Edge Function for AI task suggestions from email/chat"
```

---

### Task 7: `detect-conflicts` Edge Function

**Files:**
- Create: `supabase/functions/detect-conflicts/index.ts`
- Test: `src/utils/detectConflicts.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks beyond `ai_suggestions`/`check_and_increment_ai_usage` (Task 1) — this function is provider-agnostic and touches only `events`.
- Produces: an HTTP endpoint `POST /functions/v1/detect-conflicts` returning `{ suggestionsCreated: number }`; rows in `ai_suggestions` with `kind: 'reschedule'`; exported, unit-tested `findOverlappingPairs(events): ConflictPair[]`.

- [ ] **Step 1: Write the failing test for the pure overlap-detection logic**

```typescript
// src/utils/detectConflicts.test.ts
import { describe, expect, it } from 'vitest';
import { findOverlappingPairs, type EventForConflictCheck } from '../../supabase/functions/detect-conflicts/index.ts';

const event = (id: string, start: string, end: string | null): EventForConflictCheck => ({
  id,
  title: id,
  start_time: start,
  end_time: end,
});

describe('findOverlappingPairs', () => {
  it('flags two events whose time ranges overlap', () => {
    const pairs = findOverlappingPairs([
      event('a', '2026-09-15T09:00:00Z', '2026-09-15T10:00:00Z'),
      event('b', '2026-09-15T09:30:00Z', '2026-09-15T10:30:00Z'),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].eventA.id).toBe('a');
    expect(pairs[0].eventB.id).toBe('b');
  });

  it('does not flag back-to-back events that touch but do not overlap', () => {
    const pairs = findOverlappingPairs([
      event('a', '2026-09-15T09:00:00Z', '2026-09-15T10:00:00Z'),
      event('b', '2026-09-15T10:00:00Z', '2026-09-15T11:00:00Z'),
    ]);
    expect(pairs).toHaveLength(0);
  });

  it('does not flag two events on entirely different days', () => {
    const pairs = findOverlappingPairs([
      event('a', '2026-09-15T09:00:00Z', '2026-09-15T10:00:00Z'),
      event('b', '2026-09-16T09:00:00Z', '2026-09-16T10:00:00Z'),
    ]);
    expect(pairs).toHaveLength(0);
  });

  it('treats a null end_time as a zero-duration point in time', () => {
    const pairs = findOverlappingPairs([
      event('a', '2026-09-15T09:00:00Z', null),
      event('b', '2026-09-15T09:00:00Z', '2026-09-15T10:00:00Z'),
    ]);
    // a's "end" is its own start (09:00), and b starts exactly at 09:00,
    // not before it - so this does not count as an overlap either.
    expect(pairs).toHaveLength(0);
  });

  it('flags all three pairs in a three-way overlap', () => {
    const pairs = findOverlappingPairs([
      event('a', '2026-09-15T09:00:00Z', '2026-09-15T11:00:00Z'),
      event('b', '2026-09-15T10:00:00Z', '2026-09-15T12:00:00Z'),
      event('c', '2026-09-15T10:30:00Z', '2026-09-15T11:30:00Z'),
    ]);
    expect(pairs).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- detectConflicts`
Expected: FAIL — `supabase/functions/detect-conflicts/index.ts` does not exist.

- [ ] **Step 3: Write the function**

```typescript
// supabase/functions/detect-conflicts/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.122.0";
import { corsHeaders } from "../_shared/cors.ts";

const DAILY_LIMIT = 10;
const MODEL = "claude-haiku-4-5";
const WINDOW_DAYS_PAST = 1;
const WINDOW_DAYS_FUTURE = 30;

export interface EventForConflictCheck {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
}

export interface ConflictPair {
  eventA: EventForConflictCheck;
  eventB: EventForConflictCheck;
}

// Pure and exported so it can be unit-tested without a database or
// network - see src/utils/detectConflicts.test.ts.
export function findOverlappingPairs(events: EventForConflictCheck[]): ConflictPair[] {
  const pairs: ConflictPair[] = [];
  const sorted = [...events].sort((a, b) => a.start_time.localeCompare(b.start_time));
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const aEnd = a.end_time ?? a.start_time;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      // Sorted by start_time: once b starts at or after a's end, no
      // later event can overlap a either (b.start only increases from
      // here), so it's safe to stop scanning a's inner loop.
      if (b.start_time >= aEnd) break;
      pairs.push({ eventA: a, eventB: b });
    }
  }
  return pairs;
}

interface EventRow extends EventForConflictCheck {
  user_id: string;
}

interface RescheduleSuggestion {
  event_id_to_move: string;
  suggested_start_time: string;
  suggested_end_time: string;
  reasoning: string;
}

const RESCHEDULE_JSON_SCHEMA = {
  type: "object",
  properties: {
    event_id_to_move: { type: "string", description: "id of the event to move - must be exactly one of the two conflicting event ids given" },
    suggested_start_time: { type: "string", description: "ISO 8601 timestamp for the new start time" },
    suggested_end_time: { type: "string", description: "ISO 8601 timestamp for the new end time" },
    reasoning: { type: "string", description: "One sentence explaining the suggestion" },
  },
  required: ["event_id_to_move", "suggested_start_time", "suggested_end_time", "reasoning"],
  additionalProperties: false,
};

async function suggestReschedule(
  anthropic: Anthropic,
  eventA: EventRow,
  eventB: EventRow,
  sameDayEvents: EventRow[],
): Promise<RescheduleSuggestion | null> {
  const context = sameDayEvents
    .map((e) => `- id=${e.id} "${e.title}" ${e.start_time} to ${e.end_time ?? e.start_time}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    system:
      `Two calendar events conflict: id=${eventA.id} "${eventA.title}" (${eventA.start_time} to ${eventA.end_time ?? eventA.start_time}) ` +
      `and id=${eventB.id} "${eventB.title}" (${eventB.start_time} to ${eventB.end_time ?? eventB.start_time}). ` +
      `Suggest moving ONE of these two (event_id_to_move must be exactly "${eventA.id}" or "${eventB.id}") to a new time ` +
      `later or earlier the same day that avoids every event below (the day's full schedule) and no longer conflicts ` +
      `with the other one of the pair.\n${context}`,
    messages: [{ role: "user", content: "Suggest a reschedule." }],
    output_config: { format: { type: "json_schema", schema: RESCHEDULE_JSON_SCHEMA } },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  try {
    const parsed = textBlock?.text ? JSON.parse(textBlock.text) : null;
    if (
      parsed &&
      (parsed.event_id_to_move === eventA.id || parsed.event_id_to_move === eventB.id) &&
      typeof parsed.suggested_start_time === "string" &&
      typeof parsed.suggested_end_time === "string" &&
      !Number.isNaN(new Date(parsed.suggested_start_time).getTime()) &&
      !Number.isNaN(new Date(parsed.suggested_end_time).getTime())
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_DAYS_PAST * 86_400_000);
    const windowEnd = new Date(now.getTime() + WINDOW_DAYS_FUTURE * 86_400_000);

    const { data: events, error } = await adminClient
      .from("events")
      .select("id, user_id, title, start_time, end_time")
      .gte("start_time", windowStart.toISOString())
      .lte("start_time", windowEnd.toISOString());
    if (error) throw error;

    const byUser = new Map<string, EventRow[]>();
    for (const e of (events ?? []) as EventRow[]) {
      const list = byUser.get(e.user_id) ?? [];
      list.push(e);
      byUser.set(e.user_id, list);
    }

    let suggestionsCreated = 0;
    for (const [userId, userEvents] of byUser) {
      const pairs = findOverlappingPairs(userEvents);
      if (pairs.length === 0) continue;

      const { data: pending, error: pendingError } = await adminClient
        .from("ai_suggestions")
        .select("payload")
        .eq("user_id", userId)
        .eq("kind", "reschedule")
        .eq("status", "pending");
      if (pendingError) throw pendingError;
      const alreadySuggested = new Set(
        (pending ?? []).map((row) => {
          const p = row.payload as { event_id: string; other_event_id: string };
          return [p.event_id, p.other_event_id].sort().join("|");
        }),
      );

      for (const { eventA, eventB } of pairs) {
        const pairKey = [eventA.id, eventB.id].sort().join("|");
        if (alreadySuggested.has(pairKey)) continue;

        const { data: allowed, error: rateLimitError } = await adminClient.rpc("check_and_increment_ai_usage", {
          p_feature: "detect-conflicts",
          p_daily_limit: DAILY_LIMIT,
          p_user_id: userId,
        });
        if (rateLimitError) throw rateLimitError;
        if (!allowed) break; // out of today's budget for this user - remaining pairs wait for tomorrow

        const eventAFull = userEvents.find((e) => e.id === eventA.id)!;
        const eventBFull = userEvents.find((e) => e.id === eventB.id)!;
        const sameDay = userEvents.filter((e) => e.start_time.slice(0, 10) === eventAFull.start_time.slice(0, 10));

        const suggestion = await suggestReschedule(anthropic, eventAFull, eventBFull, sameDay);
        if (!suggestion) continue;

        const movedEvent = suggestion.event_id_to_move === eventAFull.id ? eventAFull : eventBFull;
        const otherEvent = suggestion.event_id_to_move === eventAFull.id ? eventBFull : eventAFull;

        const { error: insertError } = await adminClient.from("ai_suggestions").insert({
          user_id: userId,
          connection_id: null,
          kind: "reschedule",
          payload: {
            event_id: movedEvent.id,
            other_event_id: otherEvent.id,
            current_start_time: movedEvent.start_time,
            current_end_time: movedEvent.end_time,
            suggested_start_time: suggestion.suggested_start_time,
            suggested_end_time: suggestion.suggested_end_time,
            reasoning: suggestion.reasoning,
          },
        });
        if (insertError) throw insertError;
        suggestionsCreated++;
        alreadySuggested.add(pairKey);
      }
    }

    return new Response(JSON.stringify({ suggestionsCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("detect-conflicts error:", error);
    return new Response(JSON.stringify({ error: "Conflict detection failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 4: Run it to verify the unit tests pass**

Run: `npm test -- detectConflicts`
Expected: PASS (5 tests).

- [ ] **Step 5: Type-check and full test run**

Run: `npx tsc --noEmit && npm test`
Expected: no errors, all tests pass.

- [ ] **Step 6: Manual local verification**

With two overlapping events already in the local database for your own user (create them via the app's Events view if needed), invoke it directly:

```bash
SERVICE_KEY=$(supabase status -o json | python3 -c "import json,sys; print(json.load(sys.stdin)['SERVICE_ROLE_KEY'])")
curl -s -X POST "http://127.0.0.1:54321/functions/v1/detect-conflicts" \
  -H "Authorization: Bearer $SERVICE_KEY" -H "apikey: $SERVICE_KEY" -H "Content-Type: application/json" -d '{}'
```

Expected: `{"suggestionsCreated":1}` (or more, depending on how many overlapping pairs exist), and `select * from ai_suggestions where kind = 'reschedule';` shows the new row with a plausible `suggested_start_time` that doesn't collide with the day's other events.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/detect-conflicts/index.ts src/utils/detectConflicts.test.ts
git commit -m "Add detect-conflicts Edge Function for AI-suggested meeting rescheduling"
```

---

### Task 8: Schedule both functions on the existing cron cadence

**Files:**
- Create: `supabase/migrations/20260914140000-schedule-ai-subsystem.sql`

**Interfaces:**
- Consumes: `vault.decrypted_secrets` (`service_role_key`, already created per-environment for `sync-integrations`' own cron entry).
- Produces: two `cron.schedule` jobs, `scan-messages-every-10-min` and `detect-conflicts-every-10-min`.

- [ ] **Step 1: Write the migration**

```sql
-- Same pattern as 20260910120200-schedule-sync-integrations.sql: reads
-- the service-role key back from Vault at call time. Assumes
-- vault.create_secret('<service-role-key>', 'service_role_key') has
-- already been run once per environment (it was, for sync-integrations'
-- own schedule) - no new Vault setup needed here.
select cron.schedule(
  'scan-messages-every-10-min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://masofmjpnpnxjooqdajl.supabase.co/functions/v1/scan-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Scheduled independently of scan-messages (not chained) so a slow or
-- failing message scan never delays conflict detection, and vice versa
-- - pg_cron runs both on the same cadence, not one after the other.
select cron.schedule(
  'detect-conflicts-every-10-min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://masofmjpnpnxjooqdajl.supabase.co/functions/v1/detect-conflicts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 2: Apply it locally and verify**

```bash
docker exec -i supabase_db_$(supabase status -o json | python3 -c "import json,sys; print(json.load(sys.stdin)['linked_project']['project_ref'])") \
  psql -U postgres -d postgres < supabase/migrations/20260914140000-schedule-ai-subsystem.sql
docker exec -i supabase_db_$(supabase status -o json | python3 -c "import json,sys; print(json.load(sys.stdin)['linked_project']['project_ref'])") \
  psql -U postgres -d postgres -c "select jobname, schedule from cron.job where jobname like '%-every-10-min';"
```

Expected: three rows — the pre-existing `sync-integrations-every-10-min` plus the two new ones, all with `*/10 * * * *`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260914140000-schedule-ai-subsystem.sql
git commit -m "Schedule scan-messages and detect-conflicts on the existing 10-minute cron cadence"
```

---

### Task 9: Incremental-scope OAuth flow for enabling message scanning

**Files:**
- Modify: `supabase/functions/integration-oauth-start/index.ts`
- Modify: `supabase/functions/integration-oauth-callback/index.ts`

**Interfaces:**
- Consumes: `providers[provider].messageScanScopes` (Tasks 4-5), `oauth_states.requesting_message_scan` (Task 1), the existing `connectionId` verification path (already present from multi-account support).
- Produces: `integration-oauth-start` accepts `{ provider, connectionId?, requestMessageScanScopes? }` in its request body; `integration-oauth-callback` sets `message_scan_enabled: true` on a reconnected row only once the granted scope actually contains the requested message-scan scopes.

- [ ] **Step 1: Update `integration-oauth-start`**

In `supabase/functions/integration-oauth-start/index.ts`, change the destructure and add the scope-selection logic before building the authorize URL:

```typescript
    const { provider, connectionId, requestMessageScanScopes } = await req.json();
```

Then, replacing the existing `const url = providers[provider].getAuthUrl(...)` line:

```typescript
    // requestMessageScanScopes is only meaningful alongside a
    // connectionId - enabling scanning is a toggle on an existing
    // connection, never part of creating a new one. If a caller sends
    // it without a verified connectionId, it's silently ignored rather
    // than requesting scopes with nowhere to attach the result.
    const extraScopes =
      requestMessageScanScopes && verifiedConnectionId
        ? providers[provider].messageScanScopes
        : undefined;
    const url = providers[provider].getAuthUrl(state, redirectUriFor(supabaseUrl), extraScopes);
```

And add `requesting_message_scan` to the `oauth_states` insert:

```typescript
    const { error: insertError } = await adminClient.from("oauth_states").insert({
      state,
      user_id: user.id,
      provider,
      connection_id: verifiedConnectionId,
      requesting_message_scan: !!extraScopes,
    });
```

- [ ] **Step 2: Update `integration-oauth-callback`**

In `supabase/functions/integration-oauth-callback/index.ts`, add `requesting_message_scan` to the `oauth_states` select:

```typescript
    const { data: stateRow, error: stateError } = await adminClient
      .from("oauth_states")
      .select("user_id, provider, connection_id, requesting_message_scan")
      .eq("state", state)
      .maybeSingle();
```

Then, after computing `connectionFields` (which includes `scope: tokens.scope`) and before the `if (stateRow.connection_id) { ... } else { ... }` branch, add:

```typescript
    // Only flip the toggle on once the actually-granted scope (not just
    // what was requested) contains every message-scan scope this
    // provider needs - a user can decline part of a consent screen, and
    // the toggle should reflect reality, not intent.
    const messageScanGranted =
      stateRow.requesting_message_scan &&
      !!provider.messageScanScopes &&
      provider.messageScanScopes.split(" ").every((s) => (tokens.scope ?? "").split(" ").includes(s));

    if (messageScanGranted) {
      (connectionFields as Record<string, unknown>).message_scan_enabled = true;
    }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification against the local stack**

Simulate the flow with `curl`, using a real user session token and an existing connection id (substitute your own local values, obtained the same way as in prior manual-testing sessions for this project):

```bash
curl -s -X POST "http://127.0.0.1:54321/functions/v1/integration-oauth-start" \
  -H "Authorization: Bearer <a real user JWT>" -H "apikey: <local anon key>" -H "Content-Type: application/json" \
  -d '{"provider":"google","connectionId":"<an existing google connection id>","requestMessageScanScopes":true}'
```

Expected: a `{"url": "https://accounts.google.com/o/oauth2/v2/auth?..."}` response whose `scope` query parameter contains both the base Calendar/Tasks scopes and `https://www.googleapis.com/auth/gmail.readonly`. Completing that consent flow in a browser should leave `message_scan_enabled = true` on that connection's row afterward (verify with `select message_scan_enabled, scope from integration_connections where id = '<that id>';`).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/integration-oauth-start/index.ts supabase/functions/integration-oauth-callback/index.ts
git commit -m "Wire incremental OAuth scope requests for enabling message scanning"
```

---

### Task 10: Settings UI — per-connection message-scan toggle

**Files:**
- Modify: `src/hooks/useIntegrationConnections.tsx`
- Modify: `src/components/IntegrationsSettings.tsx`

**Interfaces:**
- Consumes: `IntegrationConnection.message_scan_enabled` (already exists on the type from before this plan).
- Produces: `useIntegrationConnections().toggleMessageScan(connection: IntegrationConnection): void`.

- [ ] **Step 1: Add `toggleMessageScan` to the hook**

In `src/hooks/useIntegrationConnections.tsx`, widen `startOAuth`'s signature and add the new function. Replace the existing `startOAuth`/`connectGoogle`/`connectMicrosoft`/`reconnect` block with:

```typescript
  const startOAuth = async (
    provider: 'google' | 'microsoft',
    errorMessage: string,
    connectionId?: string,
    requestMessageScanScopes?: boolean,
  ) => {
    const { data, error } = await supabase.functions.invoke('integration-oauth-start', {
      body: { provider, connectionId, requestMessageScanScopes },
    });
    if (error) {
      toast.error(errorMessage);
      return;
    }
    window.location.href = data.url;
  };

  const connectGoogle = () => startOAuth('google', 'Could not start Google connection');
  const connectMicrosoft = () => startOAuth('microsoft', 'Could not start Microsoft connection');
  const reconnect = (provider: 'google' | 'microsoft', connectionId: string) =>
    startOAuth(provider, `Could not reconnect ${provider === 'microsoft' ? 'Microsoft' : 'Google'}`, connectionId);

  // Turning scanning ON requires re-consenting with the extra scope, so
  // it goes through the same OAuth round-trip as reconnect - the
  // callback flips message_scan_enabled itself once that scope is
  // actually granted (see integration-oauth-callback). Turning it OFF
  // needs no reconnect: it's just narrowing what Monotask *uses* the
  // existing grant for, not revoking anything.
  const toggleMessageScan = (connection: IntegrationConnection) => {
    if (connection.message_scan_enabled) {
      supabase
        .from('integration_connections')
        .update({ message_scan_enabled: false })
        .eq('id', connection.id)
        .then(({ error }) => {
          if (error) {
            toast.error('Could not disable message scanning');
            return;
          }
          queryClient.invalidateQueries({ queryKey: ['integration-connections', user?.id] });
        });
    } else {
      startOAuth(
        connection.provider,
        `Could not enable message scanning for ${connection.provider === 'microsoft' ? 'Microsoft' : 'Google'}`,
        connection.id,
        true,
      );
    }
  };
```

Add `toggleMessageScan` to the hook's return object, alongside `reconnect`:

```typescript
    connectGoogle,
    connectMicrosoft,
    reconnect,
    toggleMessageScan,
    disconnect: disconnectMutation.mutate,
```

- [ ] **Step 2: Add the toggle to `IntegrationsSettings.tsx`**

In `ConnectionRow` (in `src/components/IntegrationsSettings.tsx`), add an `onToggleMessageScan` prop and render a toggle beneath the existing status line, inside the non-`needs_reconnect` branch:

```typescript
interface ConnectionRowProps {
  label: string;
  connection: IntegrationConnection;
  isSyncing: boolean;
  onReconnect: (id: string) => void;
  onSync: (id: string) => void;
  onDisconnect: (id: string) => void;
  onToggleMessageScan: (connection: IntegrationConnection) => void;
}
```

```typescript
const ConnectionRow: React.FC<ConnectionRowProps> = ({
  label,
  connection,
  isSyncing,
  onReconnect,
  onSync,
  onDisconnect,
  onToggleMessageScan,
}) => {
```

Inside the `connected`-state render (the second `return`, after the `needs_reconnect` early return), add beneath the existing status `<p>`:

```typescript
        <p className="text-sm text-muted-foreground">
          {connection.status === 'connected'
            ? connection.last_synced_at
              ? `Last synced ${new Date(connection.last_synced_at).toLocaleString()}`
              : 'Connected, not yet synced'
            : `Status: ${connection.status}${connection.last_error ? ` — ${connection.last_error}` : ''}`}
        </p>
        <label className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={connection.message_scan_enabled}
            onChange={() => onToggleMessageScan(connection)}
            className="h-4 w-4"
          />
          Scan messages for task suggestions
        </label>
```

Update `ProviderSection` and `IntegrationsSettings` to thread the new prop through, following the exact pattern `onReconnect`/`onSync`/`onDisconnect` already use — add `onToggleMessageScan` to `ProviderSectionProps`, pass it to each `<ConnectionRow>`, and in `IntegrationsSettings`, destructure `toggleMessageScan` from `useIntegrationConnections()` and pass `onToggleMessageScan={toggleMessageScan}` to both `<ProviderSection>` elements.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open Settings → Integrations, and confirm each connected account now shows a "Scan messages for task suggestions" checkbox, unchecked by default, and clicking it on a connection navigates to that provider's consent screen (Task 9's flow).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useIntegrationConnections.tsx src/components/IntegrationsSettings.tsx
git commit -m "Add per-connection message-scanning toggle to Settings"
```

---

### Task 11: `useAiSuggestions` hook

**Files:**
- Create: `src/hooks/useAiSuggestions.tsx`

**Interfaces:**
- Consumes: `supabase` client, `useAuth`.
- Produces: `useAiSuggestions(): { suggestions: AiSuggestion[]; isLoading: boolean; accept: (id: string) => void; dismiss: (id: string) => void; pendingCount: number }`; type `AiSuggestion { id, kind: 'task' | 'reschedule', payload: TaskSuggestionPayload | RescheduleSuggestionPayload, created_at }`.

- [ ] **Step 1: Write the hook**

```typescript
// src/hooks/useAiSuggestions.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface TaskSuggestionPayload {
  title: string;
  description: string;
  due_date: string | null;
  due_time: string | null;
  priority: 'low' | 'medium' | 'high';
}

export interface RescheduleSuggestionPayload {
  event_id: string;
  other_event_id: string;
  current_start_time: string;
  current_end_time: string | null;
  suggested_start_time: string;
  suggested_end_time: string;
  reasoning: string;
}

export interface AiSuggestion {
  id: string;
  kind: 'task' | 'reschedule';
  payload: TaskSuggestionPayload | RescheduleSuggestionPayload;
  created_at: string;
}

export const useAiSuggestions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['ai-suggestions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('ai_suggestions')
        .select('id, kind, payload, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AiSuggestion[];
    },
    enabled: !!user,
  });

  const setStatus = (id: string, status: 'accepted' | 'dismissed') =>
    supabase.from('ai_suggestions').update({ status }).eq('id', id);

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await setStatus(id, 'dismissed');
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-suggestions', user?.id] }),
    onError: () => toast.error('Could not dismiss suggestion'),
  });

  // "Accept" only marks the suggestion accepted here - the caller
  // (SuggestionsView) is responsible for actually creating the task or
  // updating the event first, through the existing task/event mutations,
  // exactly as parse-task's quick-add flow does. This hook never writes
  // to tasks/events itself.
  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await setStatus(id, 'accepted');
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-suggestions', user?.id] }),
    onError: () => toast.error('Could not accept suggestion'),
  });

  return {
    suggestions,
    isLoading,
    accept: acceptMutation.mutate,
    dismiss: dismissMutation.mutate,
    pendingCount: suggestions.length,
  };
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAiSuggestions.tsx
git commit -m "Add useAiSuggestions hook"
```

---

### Task 12: Suggestions review UI

**Files:**
- Create: `src/components/SuggestionsView.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/pages/Index.tsx`

**Interfaces:**
- Consumes: `useAiSuggestions` (Task 11), `TaskModal`/`ParsedTaskDraft` (existing, from `useTaskParser`), `useEvents().updateEvent` (existing).
- Produces: a routed `suggestions` view; `Sidebar` gains an optional `badgeCount` prop for the new nav item.

- [ ] **Step 1: Add a badge to `Sidebar`**

In `src/components/Sidebar.tsx`, add a `badges` prop and use it for the new menu item. Change the props interface:

```typescript
interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  badges?: Record<string, number>;
}
```

```typescript
const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, isOpen = false, onClose, badges = {} }) => {
```

Add `Sparkles` to the lucide-react import and a new menu item after `'progress'`:

```typescript
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  CalendarClock,
  BarChart3,
  Settings,
  Repeat,
  LogOut,
  Tag,
  Sparkles,
  X
} from 'lucide-react';
```

```typescript
    { id: 'progress', label: 'Progress', icon: BarChart3 },
    { id: 'suggestions', label: 'Suggestions', icon: Sparkles },
    { id: 'settings', label: 'Settings', icon: Settings },
```

Inside the `menuItems.map` render, add the badge next to the label:

```typescript
                    <span className="font-medium">{item.label}</span>
                    {!!badges[item.id] && (
                      <span className="ml-auto mr-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-semibold rounded-full bg-primary text-primary-foreground">
                        {badges[item.id]}
                      </span>
                    )}
                    {isActive && <div className="ml-auto w-1 h-1 bg-background rounded-full" />}
```

- [ ] **Step 2: Write `SuggestionsView`**

```typescript
// src/components/SuggestionsView.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAiSuggestions, TaskSuggestionPayload, RescheduleSuggestionPayload } from '@/hooks/useAiSuggestions';
import { useEvents } from '@/hooks/useEvents';
import TaskModal from './TaskModal';
import type { ParsedTaskDraft } from '@/hooks/useTaskParser';

const SuggestionsView: React.FC = () => {
  const { suggestions, isLoading, accept, dismiss } = useAiSuggestions();
  const { updateEvent } = useEvents();
  const [taskDraft, setTaskDraft] = useState<{ suggestionId: string; draft: ParsedTaskDraft } | null>(null);

  const acceptTask = (suggestionId: string, payload: TaskSuggestionPayload) => {
    setTaskDraft({ suggestionId, draft: payload });
  };

  const acceptReschedule = (suggestionId: string, payload: RescheduleSuggestionPayload) => {
    updateEvent({
      id: payload.event_id,
      start_time: payload.suggested_start_time,
      end_time: payload.suggested_end_time,
    });
    accept(suggestionId);
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Suggestions</h2>
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending suggestions.</p>
      ) : (
        suggestions.map((s) => (
          <div key={s.id} className="bg-card border border-border rounded-lg p-4">
            {s.kind === 'task' ? (
              (() => {
                const payload = s.payload as TaskSuggestionPayload;
                return (
                  <>
                    <p className="font-medium text-foreground">{payload.title}</p>
                    {payload.description && <p className="text-sm text-muted-foreground mt-1">{payload.description}</p>}
                    {payload.due_date && (
                      <p className="text-sm text-muted-foreground mt-1">Due {payload.due_date}{payload.due_time ? ` ${payload.due_time}` : ''}</p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={() => acceptTask(s.id, payload)}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => dismiss(s.id)}>Dismiss</Button>
                    </div>
                  </>
                );
              })()
            ) : (
              (() => {
                const payload = s.payload as RescheduleSuggestionPayload;
                return (
                  <>
                    <p className="font-medium text-foreground">Reschedule suggestion</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Move from {new Date(payload.current_start_time).toLocaleString()} to {new Date(payload.suggested_start_time).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{payload.reasoning}</p>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={() => acceptReschedule(s.id, payload)}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => dismiss(s.id)}>Dismiss</Button>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        ))
      )}
      <TaskModal
        isOpen={!!taskDraft}
        onClose={() => {
          if (taskDraft) accept(taskDraft.suggestionId);
          setTaskDraft(null);
        }}
        draft={taskDraft?.draft ?? null}
      />
    </div>
  );
};

export default SuggestionsView;
```

Note: closing `TaskModal` (whether the user saved the task or cancelled the dialog) marks the suggestion `accepted` — same "you reviewed it, it's handled" semantics `dismiss` has for a suggestion the user didn't want, since there's no third "edited but didn't save" state worth tracking separately.

- [ ] **Step 3: Wire the view into `Index.tsx`**

Add the import:

```typescript
import SuggestionsView from '@/components/SuggestionsView';
import { useAiSuggestions } from '@/hooks/useAiSuggestions';
```

Add a call to the hook near the top of the component body (alongside other hooks) and pass its count to `Sidebar`:

```typescript
  const { pendingCount } = useAiSuggestions();
```

Add the case to `renderCurrentView`:

```typescript
      case 'suggestions':
        return <SuggestionsView />;
```

Pass the badge to `Sidebar`:

```typescript
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        badges={{ suggestions: pendingCount }}
      />
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. With at least one row in `ai_suggestions` (insert one manually for this check if none exist yet, e.g. `insert into ai_suggestions (user_id, kind, payload) values ('<your user id>', 'task', '{"title":"Test suggestion","description":"","due_date":null,"due_time":null,"priority":"medium"}');`), confirm:
- The Sidebar shows a "Suggestions" item with a badge count of 1.
- Opening it shows the suggestion with Accept/Dismiss buttons.
- Accept opens `TaskModal` pre-filled with the title; saving it creates a real task and the suggestion disappears from the list (badge decrements).
- Dismiss on a second test suggestion removes it without creating anything.

- [ ] **Step 6: Commit**

```bash
git add src/components/SuggestionsView.tsx src/components/Sidebar.tsx src/pages/Index.tsx
git commit -m "Add Suggestions review UI for AI task and reschedule suggestions"
```

---

## Post-plan verification

Run the full suite once more after all tasks are complete:

```bash
npx tsc --noEmit && npm test && npm run build
```

Expected: no type errors, all tests pass (existing + every test added in this plan), and the production build succeeds.
