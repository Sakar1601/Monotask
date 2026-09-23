export function oauthRedirectUriFor({
  appOrigin,
  oauthCallbackUrl,
  supabaseUrl,
}: {
  appOrigin?: string | null;
  oauthCallbackUrl?: string | null;
  supabaseUrl: string;
}): string {
  if (oauthCallbackUrl) return oauthCallbackUrl;
  if (appOrigin) return `${appOrigin.replace(/\/+$/, "")}/oauth/callback`;
  return `${supabaseUrl}/functions/v1/integration-oauth-callback`;
}

export function isStateOwner({
  stateUserId,
  authenticatedUserId,
}: {
  stateUserId: string;
  authenticatedUserId: string;
}): boolean {
  return stateUserId === authenticatedUserId;
}
