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
