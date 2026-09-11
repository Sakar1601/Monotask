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
