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
