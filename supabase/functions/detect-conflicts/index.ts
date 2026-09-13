import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.122.0";
import { corsHeaders } from "../_shared/cors.ts";

const DAILY_LIMIT = 10;
const MODEL = "claude-haiku-4-5";
const WINDOW_DAYS_PAST = 1;
const WINDOW_DAYS_FUTURE = 30;

export interface EventForConflictCheck {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
}

export interface ConflictPair {
  eventA: EventForConflictCheck;
  eventB: EventForConflictCheck;
}

// Pure and exported so it can be unit-tested without a database or
// network - see src/utils/detectConflicts.test.ts.
export function findOverlappingPairs(events: EventForConflictCheck[]): ConflictPair[] {
  const pairs: ConflictPair[] = [];
  const sorted = [...events].sort((a, b) => a.start_time.localeCompare(b.start_time));
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const aEnd = a.end_time ?? a.start_time;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      // Sorted by start_time: once b starts at or after a's end, no
      // later event can overlap a either (b.start only increases from
      // here), so it's safe to stop scanning a's inner loop.
      if (b.start_time >= aEnd) break;
      pairs.push({ eventA: a, eventB: b });
    }
  }
  return pairs;
}

interface EventRow extends EventForConflictCheck {
  user_id: string;
}

interface RescheduleSuggestion {
  event_id_to_move: string;
  suggested_start_time: string;
  suggested_end_time: string;
  reasoning: string;
}

const RESCHEDULE_JSON_SCHEMA = {
  type: "object",
  properties: {
    event_id_to_move: { type: "string", description: "id of the event to move - must be exactly one of the two conflicting event ids given" },
    suggested_start_time: { type: "string", description: "ISO 8601 timestamp for the new start time" },
    suggested_end_time: { type: "string", description: "ISO 8601 timestamp for the new end time" },
    reasoning: { type: "string", description: "One sentence explaining the suggestion" },
  },
  required: ["event_id_to_move", "suggested_start_time", "suggested_end_time", "reasoning"],
  additionalProperties: false,
};

async function suggestReschedule(
  anthropic: Anthropic,
  eventA: EventRow,
  eventB: EventRow,
  sameDayEvents: EventRow[],
): Promise<RescheduleSuggestion | null> {
  const context = sameDayEvents
    .map((e) => `- id=${e.id} "${e.title}" ${e.start_time} to ${e.end_time ?? e.start_time}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    system:
      `Two calendar events conflict: id=${eventA.id} "${eventA.title}" (${eventA.start_time} to ${eventA.end_time ?? eventA.start_time}) ` +
      `and id=${eventB.id} "${eventB.title}" (${eventB.start_time} to ${eventB.end_time ?? eventB.start_time}). ` +
      `Suggest moving ONE of these two (event_id_to_move must be exactly "${eventA.id}" or "${eventB.id}") to a new time ` +
      `later or earlier the same day that avoids every event below (the day's full schedule) and no longer conflicts ` +
      `with the other one of the pair.\n${context}`,
    messages: [{ role: "user", content: "Suggest a reschedule." }],
    output_config: { format: { type: "json_schema", schema: RESCHEDULE_JSON_SCHEMA } },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  try {
    const parsed = textBlock?.text ? JSON.parse(textBlock.text) : null;
    if (
      parsed &&
      (parsed.event_id_to_move === eventA.id || parsed.event_id_to_move === eventB.id) &&
      typeof parsed.suggested_start_time === "string" &&
      typeof parsed.suggested_end_time === "string" &&
      !Number.isNaN(new Date(parsed.suggested_start_time).getTime()) &&
      !Number.isNaN(new Date(parsed.suggested_end_time).getTime())
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
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

    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_DAYS_PAST * 86_400_000);
    const windowEnd = new Date(now.getTime() + WINDOW_DAYS_FUTURE * 86_400_000);

    const { data: events, error } = await adminClient
      .from("events")
      .select("id, user_id, title, start_time, end_time")
      .gte("start_time", windowStart.toISOString())
      .lte("start_time", windowEnd.toISOString());
    if (error) throw error;

    const byUser = new Map<string, EventRow[]>();
    for (const e of (events ?? []) as EventRow[]) {
      const list = byUser.get(e.user_id) ?? [];
      list.push(e);
      byUser.set(e.user_id, list);
    }

    let suggestionsCreated = 0;
    for (const [userId, userEvents] of byUser) {
      const pairs = findOverlappingPairs(userEvents);
      if (pairs.length === 0) continue;

      const { data: pending, error: pendingError } = await adminClient
        .from("ai_suggestions")
        .select("payload")
        .eq("user_id", userId)
        .eq("kind", "reschedule")
        .eq("status", "pending");
      if (pendingError) throw pendingError;
      const alreadySuggested = new Set(
        (pending ?? []).map((row) => {
          const p = row.payload as { event_id: string; other_event_id: string };
          return [p.event_id, p.other_event_id].sort().join("|");
        }),
      );

      for (const { eventA, eventB } of pairs) {
        const pairKey = [eventA.id, eventB.id].sort().join("|");
        if (alreadySuggested.has(pairKey)) continue;

        const { data: allowed, error: rateLimitError } = await adminClient.rpc("check_and_increment_ai_usage", {
          p_feature: "detect-conflicts",
          p_daily_limit: DAILY_LIMIT,
          p_user_id: userId,
        });
        if (rateLimitError) throw rateLimitError;
        if (!allowed) break; // out of today's budget for this user - remaining pairs wait for tomorrow

        const eventAFull = userEvents.find((e) => e.id === eventA.id)!;
        const eventBFull = userEvents.find((e) => e.id === eventB.id)!;
        const sameDay = userEvents.filter((e) => e.start_time.slice(0, 10) === eventAFull.start_time.slice(0, 10));

        const suggestion = await suggestReschedule(anthropic, eventAFull, eventBFull, sameDay);
        if (!suggestion) continue;

        const movedEvent = suggestion.event_id_to_move === eventAFull.id ? eventAFull : eventBFull;
        const otherEvent = suggestion.event_id_to_move === eventAFull.id ? eventBFull : eventAFull;

        const { error: insertError } = await adminClient.from("ai_suggestions").insert({
          user_id: userId,
          connection_id: null,
          kind: "reschedule",
          payload: {
            event_id: movedEvent.id,
            other_event_id: otherEvent.id,
            current_start_time: movedEvent.start_time,
            current_end_time: movedEvent.end_time,
            suggested_start_time: suggestion.suggested_start_time,
            suggested_end_time: suggestion.suggested_end_time,
            reasoning: suggestion.reasoning,
          },
        });
        if (insertError) throw insertError;
        suggestionsCreated++;
        alreadySuggested.add(pairKey);
      }
    }

    return new Response(JSON.stringify({ suggestionsCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("detect-conflicts error:", error);
    return new Response(JSON.stringify({ error: "Conflict detection failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
