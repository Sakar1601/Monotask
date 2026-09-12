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
  completedAt: string | null;
  sourceUrl: string | null;
  rawPayload: unknown;
}

export interface EventChanges {
  title?: string;
  description?: string | null;
  startTime?: string;
  endTime?: string | null;
  location?: string | null;
}

export interface TaskChanges {
  title?: string;
  dueDate?: string | null; // YYYY-MM-DD
  status?: "pending" | "completed";
}

export interface IntegrationProvider {
  id: "google";
  getAuthUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
  fetchEvents(accessToken: string, windowStart: Date, windowEnd: Date): Promise<ExternalEvent[]>;
  fetchTasks(accessToken: string, completedMin: Date): Promise<ExternalTask[]>;
  updateEvent(accessToken: string, googleEventId: string, changes: EventChanges): Promise<void>;
  deleteEvent(accessToken: string, googleEventId: string): Promise<void>;
  updateTask(accessToken: string, googleTaskId: string, changes: TaskChanges): Promise<void>;
  deleteTask(accessToken: string, googleTaskId: string): Promise<void>;
}
