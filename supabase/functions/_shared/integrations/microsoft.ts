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

// Graph's dateTimeTimeZone.dateTime must be a bare, offset-free literal -
// the timeZone field is the only place the zone is conveyed. Our own
// timestamps come from Postgres with a numeric offset (e.g. "+00:00") or
// a trailing "Z", either of which must be stripped before sending, or
// Graph may reject/misinterpret the value (see updateTask, which builds
// its own bare literal for the same reason).
function toGraphLocalDateTime(isoDateTime: string): string {
  return isoDateTime.replace(/(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/, "");
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
    if (changes.startTime !== undefined) body.start = { dateTime: toGraphLocalDateTime(changes.startTime), timeZone: "UTC" };
    if (changes.endTime !== undefined) body.end = changes.endTime ? { dateTime: toGraphLocalDateTime(changes.endTime), timeZone: "UTC" } : null;
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
