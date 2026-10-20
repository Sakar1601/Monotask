// Pure reminder-timing logic for send-reminders - no Deno or Supabase
// imports, so it is unit-tested from src-side vitest like conflicts.ts.

export const EVENT_LEAD_MS = 15 * 60_000;
// Cron runs every 5 minutes; a reminder stays eligible for this long after
// it was due, so one late or skipped run doesn't drop it. sent_reminders
// prevents the overlap from double-sending.
export const GRACE_MS = 20 * 60_000;

export interface Reminder {
  kind: "task" | "event" | "habit";
  itemId: string;
  remindAt: Date;
  title: string;
  body: string;
  url: string;
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Converts a wall-clock date ("YYYY-MM-DD") and time ("HH:MM[:SS]") in `timeZone` to the real instant. */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Second pass corrects the guess when the first offset was from the other
  // side of a DST change.
  const first = wallAsUtc - zoneOffsetMs(wallAsUtc, timeZone);
  return new Date(wallAsUtc - zoneOffsetMs(first, timeZone));
}

/** The local calendar date ("YYYY-MM-DD") and weekday (0 = Sunday) in `timeZone` at `now`. */
export function localDay(now: Date, timeZone: string): { date: string; weekday: number } {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return { date, weekday };
}

export function isDue(remindAt: Date, now: Date): boolean {
  const age = now.getTime() - remindAt.getTime();
  return age >= 0 && age < GRACE_MS;
}

/** Reads a client-supplied zone defensively; unknown names fall back to UTC. */
export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

export interface TaskRow {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  due_time: string | null;
  repeat_type: string | null;
}

/**
 * Only one-off tasks with an explicit due time. Recurring tasks have no
 * single due moment (occurrences are generated client-side), and date-only
 * tasks have no time to remind at.
 */
export function taskReminder(task: TaskRow, timeZone: string): Reminder | null {
  if (task.status === "completed" || task.status === "cancelled") return null;
  if (task.repeat_type && task.repeat_type !== "none") return null;
  if (!task.due_date || !task.due_time) return null;
  return {
    kind: "task",
    itemId: task.id,
    remindAt: zonedTimeToUtc(task.due_date, task.due_time, timeZone),
    title: task.title,
    body: "Due now",
    url: "/app",
  };
}

export interface EventRow {
  id: string;
  title: string;
  start_time: string;
  location: string | null;
}

export function eventReminder(event: EventRow, now: Date): Reminder | null {
  const start = new Date(event.start_time);
  if (start.getTime() <= now.getTime()) return null;
  const minutes = Math.round(EVENT_LEAD_MS / 60_000);
  return {
    kind: "event",
    itemId: event.id,
    remindAt: new Date(start.getTime() - EVENT_LEAD_MS),
    title: event.title,
    body: event.location ? `Starts in ${minutes} min · ${event.location}` : `Starts in ${minutes} min`,
    url: "/app",
  };
}

export interface HabitRow {
  id: string;
  name: string;
  frequency: string;
  frequency_days: number[] | null;
  preferred_time: string | null;
  is_active: boolean | null;
}

/**
 * Daily habits, and weekly habits with explicit days, at their preferred
 * time. frequency_days uses 1 = Sunday ... 7 = Saturday (same mapping as
 * HabitsView's day labels). Weekly-without-days and monthly habits have no
 * defined day, so they get no reminder. `completedHabitIds` suppresses
 * habits already logged for the local day.
 */
export function habitReminder(
  habit: HabitRow,
  timeZone: string,
  now: Date,
  completedHabitIds: Set<string>,
): Reminder | null {
  if (habit.is_active === false || !habit.preferred_time) return null;
  if (completedHabitIds.has(habit.id)) return null;

  const today = localDay(now, timeZone);
  if (habit.frequency === "weekly") {
    if (!habit.frequency_days?.length || !habit.frequency_days.includes(today.weekday + 1)) return null;
  } else if (habit.frequency !== "daily") {
    return null;
  }

  return {
    kind: "habit",
    itemId: habit.id,
    remindAt: zonedTimeToUtc(today.date, habit.preferred_time, timeZone),
    title: habit.name,
    body: "Time for your habit",
    url: "/app",
  };
}
