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
      const bEnd = b.end_time ?? b.start_time;
      // Sorted by start_time: once b starts at or after a's end, no
      // later event can overlap a either (b.start only increases from
      // here), so it's safe to stop scanning a's inner loop.
      if (b.start_time >= aEnd) break;
      if (
        a.start_time < aEnd &&
        b.start_time < bEnd &&
        a.start_time < bEnd &&
        b.start_time < aEnd
      ) {
        pairs.push({ eventA: a, eventB: b });
      }
    }
  }
  return pairs;
}

interface EventRow extends EventForConflictCheck {
  user_id: string;
}

export interface RescheduleSuggestion {
  event_id_to_move: string;
  suggested_start_time: string;
  suggested_end_time: string;
  reasoning: string;
}

const ISO_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function isStrictIsoTimestamp(value: string): boolean {
  const match = value.match(ISO_TIMESTAMP);
  if (!match || Number.isNaN(new Date(value).getTime())) return false;

  const localTime = new Date(`${match[1]}Z`);
  if (Number.isNaN(localTime.getTime()) || localTime.toISOString().slice(0, 19) !== match[1]) return false;

  if (match[2] === "Z") return true;
  const [hours, minutes] = match[2].slice(1).split(":").map(Number);
  return hours <= 23 && minutes <= 59;
}

function overlapsScheduledEvent(startTime: string, endTime: string, event: EventForConflictCheck): boolean {
  const proposedStart = new Date(startTime).getTime();
  const proposedEnd = new Date(endTime).getTime();
  const eventStart = new Date(event.start_time).getTime();
  const eventEnd = new Date(event.end_time ?? event.start_time).getTime();
  return (
    proposedStart < proposedEnd &&
    eventStart < eventEnd &&
    proposedStart < eventEnd &&
    eventStart < proposedEnd
  );
}

export function isValidRescheduleSuggestion(
  suggestion: unknown,
  eventA: EventForConflictCheck,
  eventB: EventForConflictCheck,
  sameDayEvents: EventForConflictCheck[],
): suggestion is RescheduleSuggestion {
  if (!suggestion || typeof suggestion !== "object") return false;

  const candidate = suggestion as Partial<RescheduleSuggestion>;
  if (
    (candidate.event_id_to_move !== eventA.id && candidate.event_id_to_move !== eventB.id) ||
    typeof candidate.suggested_start_time !== "string" ||
    typeof candidate.suggested_end_time !== "string" ||
    typeof candidate.reasoning !== "string" ||
    !isStrictIsoTimestamp(candidate.suggested_start_time) ||
    !isStrictIsoTimestamp(candidate.suggested_end_time) ||
    new Date(candidate.suggested_end_time).getTime() <= new Date(candidate.suggested_start_time).getTime()
  ) {
    return false;
  }

  return !sameDayEvents.some(
    (event) =>
      event.id !== candidate.event_id_to_move &&
      overlapsScheduledEvent(candidate.suggested_start_time, candidate.suggested_end_time, event),
  );
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
    if (isValidRescheduleSuggestion(parsed, eventA, eventB, sameDayEvents)) {
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
