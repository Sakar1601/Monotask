import type { EventChanges, ExternalEvent, ExternalMessage, ExternalTask, IntegrationProvider, ProviderSnapshot, TaskChanges, TokenSet } from "./types.ts";
import { providerHttpError } from "./providerErrors.ts";

// User.Read is a default permission on every app registration, but that
// only means Azure lets an app request it without extra admin consent -
// it still has to be listed here explicitly, or the issued token's scope
// won't include it and /me (getAccountEmail) 401s.
const MICROSOFT_SCOPES = "offline_access Calendars.ReadWrite Tasks.ReadWrite User.Read";

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

  getAuthUrl(state: string, redirectUri: string, extraScopes?: string): string {
    const params = new URLSearchParams({
      client_id: Deno.env.get("MICROSOFT_CLIENT_ID")!,
      redirect_uri: redirectUri,
      response_type: "code",
      response_mode: "query",
      scope: extraScopes ? `${MICROSOFT_SCOPES} ${extraScopes}` : MICROSOFT_SCOPES,
      state,
      // Without this, Microsoft's login page silently reuses whatever
      // account session is already cached in the browser, making it
      // impossible to pick a different account without manually clearing
      // cookies or using a private window.
      prompt: "select_account",
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
      }),
    });
    if (!response.ok) throw providerHttpError("Microsoft", "token exchange", response);
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
        // No scope param - same reasoning as exchangeCode above: sending a
        // static base scope list here would narrow the refreshed token
        // away from whatever extra scopes (e.g. Mail.Read/Chat.Read from
        // enabling message-scanning) were actually granted, silently
        // breaking that feature ~hourly once the token first refreshes.
      }),
    });
    if (!response.ok) throw providerHttpError("Microsoft", "token refresh", response);
    return tokenSetFromResponse(await response.json(), refreshToken);
  },

  async fetchEvents(accessToken: string, windowStart: Date, windowEnd: Date): Promise<ProviderSnapshot<ExternalEvent>> {
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
      if (!response.ok) throw providerHttpError("Microsoft", "calendar fetch", response);
      const json = await response.json() as { value?: GraphEventPayload[]; "@odata.nextLink"?: string };
      events.push(...(json.value ?? []).map(mapMicrosoftEvent).filter((e): e is ExternalEvent => e !== null));
      url = json["@odata.nextLink"];
      pageCount++;
    }
    return { items: events, complete: !url };
  },

  async resolveProviderMetadata(accessToken: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${GRAPH_BASE}/me/todo/lists`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw providerHttpError("Microsoft", "To Do lists fetch", response);
    const json = await response.json() as { value?: GraphTaskList[] };
    const defaultList = (json.value ?? []).find((list) => list.wellknownListName === "defaultList");
    if (!defaultList) throw new Error("Could not find Microsoft To Do's default task list");
    return { taskListId: defaultList.id };
  },

  async fetchTasks(accessToken: string, _completedMin: Date, providerMetadata?: Record<string, unknown> | null): Promise<ProviderSnapshot<ExternalTask>> {
    const taskListId = requireTaskListId(providerMetadata);
    const params = new URLSearchParams({ $top: "100" });
    const tasks: ExternalTask[] = [];
    let url: string | undefined = `${GRAPH_BASE}/me/todo/lists/${encodeURIComponent(taskListId)}/tasks?${params.toString()}`;
    let pageCount = 0;
    const MAX_PAGES = 20; // 20 * 100 = 2,000 tasks/run ceiling, matches google.ts
    while (url && pageCount < MAX_PAGES) {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw providerHttpError("Microsoft", "tasks fetch", response);
      const json = await response.json() as { value?: GraphTaskPayload[]; "@odata.nextLink"?: string };
      tasks.push(...(json.value ?? []).map(mapMicrosoftTask).filter((t): t is ExternalTask => t !== null));
      url = json["@odata.nextLink"];
      pageCount++;
    }
    return { items: tasks, complete: !url };
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
    if (!response.ok) throw providerHttpError("Microsoft", "event update", response);
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
      throw providerHttpError("Microsoft", "event delete", response);
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
    if (!response.ok) throw providerHttpError("Microsoft", "task update", response);
  },

  async deleteTask(accessToken: string, externalTaskId: string, providerMetadata?: Record<string, unknown> | null): Promise<void> {
    const taskListId = requireTaskListId(providerMetadata);
    const response = await fetch(
      `${GRAPH_BASE}/me/todo/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(externalTaskId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok && response.status !== 404) {
      throw providerHttpError("Microsoft", "task delete", response);
    }
  },

  async getAccountEmail(accessToken: string): Promise<string | null> {
    // User.Read is granted by default to every app registration, so this
    // needs no scope beyond what MICROSOFT_SCOPES already requests.
    const response = await fetch(`${GRAPH_BASE}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      console.error(providerHttpError("Microsoft", "getAccountEmail", response).message);
      return null;
    }
    const json = await response.json() as { mail?: string; userPrincipalName?: string };
    return json.mail ?? json.userPrincipalName ?? null;
  },

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
      if (!response.ok) throw providerHttpError("Outlook", "mail fetch", response);
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
      if (!response.ok) throw providerHttpError("Teams", "chat fetch", response);
      const json = await response.json() as { value?: GraphChatMessage[]; "@odata.nextLink"?: string };
      messages.push(...(json.value ?? []).map(mapTeamsChatMessage).filter((m): m is ExternalMessage => m !== null));
      url = json["@odata.nextLink"];
      pageCount++;
    }
    return messages;
  },
};
