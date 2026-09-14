import { providers } from "./registry.ts";

interface RefreshableConnection {
  id: string;
  provider: "google" | "microsoft";
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

// A minimal structural type for exactly the one query shape this function
// uses, rather than the real SupabaseClient's generic type (createClient's
// default Database generic makes ReturnType<typeof createClient> resolve
// query builder methods to `never` without an explicit schema type
// argument supplied at every call site - narrower and simpler than
// fighting that here).
interface MinimalSupabaseClient {
  from(table: string): {
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): Promise<unknown>;
    };
  };
}

export async function ensureFreshToken(
  adminClient: MinimalSupabaseClient,
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
