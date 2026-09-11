import type { ExternalEvent, ExternalTask, IntegrationProvider, TokenSet } from "./types.ts";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/tasks",
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
      "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=true&maxResults=100",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) throw new Error(`Google tasks fetch failed: ${response.status} ${await response.text()}`);
    const json = await response.json();
    return (json.items ?? []).map(mapGoogleTask).filter((t: ExternalTask | null): t is ExternalTask => t !== null);
  },
};
