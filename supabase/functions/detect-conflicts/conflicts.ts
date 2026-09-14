// Pure conflict-detection and reschedule-validation logic, with no
// dependency on the Anthropic SDK, Deno.serve, or any network/database
// call - kept in its own file so it can be unit-tested (see
// src/utils/detectConflicts.test.ts) without pulling in index.ts's
// npm:@anthropic-ai/sdk import, which Vitest/Node cannot resolve (that
// specifier only works under Deno's own module resolution).

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
