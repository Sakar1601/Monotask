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

export interface ExternalMessage {
  externalId: string;
  source: "email" | "chat";
  subject: string | null; // email only - null for chat
  snippet: string; // short preview text - the only content ever sent to the model or persisted
  sender: string | null;
  receivedAt: string; // ISO timestamp
}

export interface ProviderSnapshot<T> {
  items: T[];
  complete: boolean;
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
  // extraScopes, when provided, is appended to the provider's base
  // scope list for this one authorize request - used only when a user
  // is enabling message-scanning for an existing connection (see
  // messageScanScopes below), never for a fresh connect.
  getAuthUrl(state: string, redirectUri: string, extraScopes?: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
  fetchEvents(accessToken: string, windowStart: Date, windowEnd: Date): Promise<ProviderSnapshot<ExternalEvent>>;
  fetchTasks(accessToken: string, completedMin: Date, providerMetadata?: Record<string, unknown> | null): Promise<ProviderSnapshot<ExternalTask>>;
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
  // Optional: the signed-in account's email, shown in Settings so a user
  // with several Google/Microsoft accounts can tell which one is
  // connected. Best-effort - integration-oauth-callback swallows a
  // failure here rather than blocking the connect on it, since an
  // already-granted token that predates this feature (or one missing the
  // scope this needs) simply won't have it.
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
