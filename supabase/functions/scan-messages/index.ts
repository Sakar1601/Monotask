// supabase/functions/scan-messages/index.ts
// Anthropic SDK imported via npm:, not esm.sh - see the comment in
// parse-task/index.ts (matches its import) for why: esm.sh's own build
// of this SDK version's type declarations was failing outright, which
// broke the whole worker's boot.
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.122.0";
import { corsHeaders } from "../_shared/cors.ts";
import { providers } from "../_shared/integrations/registry.ts";
import { ensureFreshToken } from "../_shared/integrations/tokenRefresh.ts";
import type { ExternalMessage } from "../_shared/integrations/types.ts";

const DAILY_LIMIT = 20;
const MODEL = "claude-haiku-4-5";
const LOOKBACK_HOURS_FIRST_RUN = 24;

const TASK_CANDIDATES_JSON_SCHEMA = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short task title" },
          description: { type: ["string", "null"], description: "Extra detail beyond the title, or null" },
          due_date: { type: ["string", "null"], description: "ISO date YYYY-MM-DD if a deadline is mentioned, else null" },
          due_time: { type: ["string", "null"], description: "24-hour HH:MM if a specific time is mentioned, else null" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Defaults to medium if not stated" },
        },
        required: ["title", "description", "due_date", "due_time", "priority"],
        additionalProperties: false,
      },
    },
  },
  required: ["candidates"],
  additionalProperties: false,
};

interface TaskCandidate {
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: "low" | "medium" | "high";
}

interface Connection {
  id: string;
  user_id: string;
  provider: "google" | "microsoft";
  access_token: string;
  refresh_token: string;
  expires_at: string;
  last_scanned_at: string | null;
}

function isValidIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00");
  return !Number.isNaN(d.getTime());
}

function isValidTime(value: string | null | undefined): value is string {
  return !!value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

const VALID_PRIORITIES = new Set(["low", "medium", "high"]);

async function extractTaskCandidates(anthropic: Anthropic, messages: ExternalMessage[]): Promise<TaskCandidate[]> {
  if (messages.length === 0) return [];
  const today = new Date().toISOString().split("T")[0];
  const messagesText = messages
    .map((m, i) => `[${i + 1}] From: ${m.sender ?? "unknown"}${m.subject ? ` | Subject: ${m.subject}` : ""}\n${m.snippet}`)
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system:
      `Today's date is ${today}. Below are recent email/chat messages, each numbered. Extract any ` +
      `clear, actionable tasks the recipient needs to do - most messages have none. ` +
      `Never invent information not stated or clearly implied in the text. ` +
      `Return an empty candidates array if nothing is actionable.`,
    messages: [{ role: "user", content: messagesText }],
    output_config: { format: { type: "json_schema", schema: TASK_CANDIDATES_JSON_SCHEMA } },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  try {
    const parsed = textBlock?.text ? JSON.parse(textBlock.text) : null;
    const list = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
    return list.filter(
      (c: unknown): c is TaskCandidate =>
        !!c && typeof (c as TaskCandidate).title === "string" && VALID_PRIORITIES.has((c as TaskCandidate).priority),
    );
  } catch {
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

    const { data: connections, error } = await adminClient
      .from("integration_connections")
      .select("id, user_id, provider, access_token, refresh_token, expires_at, last_scanned_at")
      .eq("message_scan_enabled", true)
      .eq("status", "connected");
    if (error) throw error;

    let scanned = 0;
    for (const connection of (connections ?? []) as Connection[]) {
      const provider = providers[connection.provider];
      if (!provider.fetchMessages && !provider.fetchChatMessages) continue;

      try {
        const accessToken = await ensureFreshToken(adminClient, connection);
        const windowStart = connection.last_scanned_at
          ? new Date(connection.last_scanned_at)
          : new Date(Date.now() - LOOKBACK_HOURS_FIRST_RUN * 60 * 60 * 1000);

        // allSettled, not all: a connection's granted scope can cover only
        // one of these two sources (e.g. a personal Microsoft account has
        // Mail.Read but no Chat.Read to grant, since it has no Teams) -
        // one source rejecting (typically a 401/403 for a scope this
        // connection was never granted) shouldn't blank out messages the
        // other source successfully fetched.
        const [emailResult, chatResult] = await Promise.allSettled([
          provider.fetchMessages ? provider.fetchMessages(accessToken, windowStart) : Promise.resolve([]),
          provider.fetchChatMessages ? provider.fetchChatMessages(accessToken, windowStart) : Promise.resolve([]),
        ]);
        if (emailResult.status === "rejected") {
          console.error(`scan-messages: connection ${connection.id} email fetch failed:`, emailResult.reason);
        }
        if (chatResult.status === "rejected") {
          console.error(`scan-messages: connection ${connection.id} chat fetch failed:`, chatResult.reason);
        }
        const allMessages = [
          ...(emailResult.status === "fulfilled" ? emailResult.value : []),
          ...(chatResult.status === "fulfilled" ? chatResult.value : []),
        ];

        if (allMessages.length > 0) {
          // Quota is spent here, right before the actual Claude call, not
          // up front - a run that fetches nothing worth extracting from
          // (the common case) shouldn't burn a day's-worth of budget on
          // 10-minute cron ticks that never call the model at all.
          const { data: allowed, error: rateLimitError } = await adminClient.rpc("check_and_increment_ai_usage", {
            p_feature: "scan-messages",
            p_daily_limit: DAILY_LIMIT,
            p_user_id: connection.user_id,
          });
          if (rateLimitError) throw rateLimitError;

          if (allowed) {
            const candidates = await extractTaskCandidates(anthropic, allMessages);
            if (candidates.length > 0) {
              const rows = candidates.map((c) => ({
                user_id: connection.user_id,
                connection_id: connection.id,
                kind: "task",
                payload: {
                  title: c.title.slice(0, 200),
                  description: c.description ?? "",
                  due_date: isValidIsoDate(c.due_date) ? c.due_date : null,
                  due_time: isValidTime(c.due_time) ? c.due_time : null,
                  priority: c.priority,
                },
              }));
              const { error: insertError } = await adminClient.from("ai_suggestions").insert(rows);
              if (insertError) throw insertError;
            }
          }
          // Whether or not quota was available, the messages in this
          // window have been accounted for (either processed, or
          // deliberately skipped due to rate limit) - advance the
          // watermark below either way so a rate-limited run doesn't
          // re-fetch the same window forever.
        }

        // Only advance the watermark if both sources actually succeeded -
        // a rejected fetch means this window wasn't really scanned, and
        // advancing anyway would silently lose it forever instead of
        // retrying it on the next run.
        if (emailResult.status !== "rejected" && chatResult.status !== "rejected") {
          await adminClient
            .from("integration_connections")
            .update({ last_scanned_at: new Date().toISOString() })
            .eq("id", connection.id);
        }
        scanned++;
      } catch (connectionError) {
        console.error(`scan-messages: connection ${connection.id} failed:`, connectionError);
      }
    }

    return new Response(JSON.stringify({ scanned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("scan-messages error:", error);
    return new Response(JSON.stringify({ error: "Scan failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
