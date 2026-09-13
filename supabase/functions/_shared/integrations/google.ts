import type { EventChanges, ExternalEvent, ExternalMessage, ExternalTask, IntegrationProvider, TaskChanges, TokenSet } from "./types.ts";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/tasks",
  // Only used for getAccountEmail below (which account is connected, shown
  // in Settings) - not required for any calendar/task sync functionality.
  "https://www.googleapis.com/auth/userinfo.email",
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

interface GoogleCalendarEventPayload {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  htmlLink?: string;
}

interface GoogleTaskPayload {
  id?: string;
  title?: string;
  due?: string;
  status?: string;
  completed?: string;
  webViewLink?: string;
}

export function mapGoogleEvent(item: GoogleCalendarEventPayload): ExternalEvent | null {
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

export function mapGoogleTask(item: GoogleTaskPayload): ExternalTask | null {
  if (!item.id) return null;
  return {
    externalId: item.id,
    title: item.title || "(No title)",
    dueDate: item.due ? item.due.slice(0, 10) : null,
    status: item.status === "completed" ? "completed" : "pending",
    completedAt: item.completed ?? null,
    sourceUrl: item.webViewLink ?? null,
    rawPayload: item,
  };
}

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

export const googleProvider: IntegrationProvider = {
  id: "google",

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
    const events: ExternalEvent[] = [];
    let pageToken: string | undefined;
    let pageCount = 0;
    const MAX_PAGES = 20; // guards against a misbehaving nextPageToken looping forever
    do {
      if (pageToken) params.set("pageToken", pageToken);
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!response.ok) throw new Error(`Google calendar fetch failed: ${response.status} ${await response.text()}`);
      const json = await response.json() as { items?: GoogleCalendarEventPayload[]; nextPageToken?: string };
      events.push(...(json.items ?? []).map(mapGoogleEvent).filter((e): e is ExternalEvent => e !== null));
      pageToken = json.nextPageToken;
      pageCount++;
    } while (pageToken && pageCount < MAX_PAGES);
    return events;
  },

  async fetchTasks(accessToken: string, completedMin: Date): Promise<ExternalTask[]> {
    // showCompleted+showHidden (Google Tasks hides completed tasks by
    // default) makes completion status sync in instead of the task
    // silently vanishing - but combined with unbounded pagination that
    // would import a user's entire completed-task history. completedMin
    // bounds it the same way fetchEvents is windowed, so only tasks
    // completed within the sync window come back; still-open tasks (no
    // completion date) are unaffected by this filter regardless of age.
    const params = new URLSearchParams({
      showCompleted: "true",
      showHidden: "true",
      maxResults: "100",
      completedMin: completedMin.toISOString(),
    });
    const tasks: ExternalTask[] = [];
    let pageToken: string | undefined;
    let pageCount = 0;
    const MAX_PAGES = 20; // 20 * 100 = 2,000 tasks/run ceiling, guards against a misbehaving nextPageToken looping forever
    do {
      if (pageToken) params.set("pageToken", pageToken);
      const response = await fetch(
        `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!response.ok) throw new Error(`Google tasks fetch failed: ${response.status} ${await response.text()}`);
      const json = await response.json() as { items?: GoogleTaskPayload[]; nextPageToken?: string };
      tasks.push(...(json.items ?? []).map(mapGoogleTask).filter((t): t is ExternalTask => t !== null));
      pageToken = json.nextPageToken;
      pageCount++;
    } while (pageToken && pageCount < MAX_PAGES);
    return tasks;
  },

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

  async getAccountEmail(accessToken: string): Promise<string | null> {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      console.error(`Google getAccountEmail failed: ${response.status} ${await response.text()}`);
      return null;
    }
    const json = await response.json() as { email?: string };
    return json.email ?? null;
  },

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
};
