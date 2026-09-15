import { corsHeaders } from "./cors.ts";

function jsonError(error: string, status: number, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, "Content-Type": "application/json" },
  });
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index++) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

export function authorizeScheduledRequest(request: Request, expectedToken: string | undefined): Response | null {
  if (request.method !== "POST") {
    return jsonError("Method not allowed", 405, { Allow: "POST, OPTIONS" });
  }

  if (!expectedToken) {
    return jsonError("Server configuration error", 500);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  if (!constantTimeEqual(authorization, `Bearer ${expectedToken}`)) {
    return jsonError("Not authenticated", 401);
  }

  return null;
}
