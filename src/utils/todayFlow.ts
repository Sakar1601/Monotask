import type { Task } from '@/hooks/useTasks';
import type { TaskInstance } from '@/hooks/useTaskInstances';
import type { Event } from '@/hooks/useEvents';
import { formatDateLocal } from '@/utils/dateOnly';
import { getTasksForDate, RecurringTaskInstance } from '@/utils/recurringTasks';
import { isOccurrenceCompleted, getOccurrenceDate } from '@/utils/taskOccurrences';

export type TaskFlowItem = {
  kind: 'task';
  id: string;
  sortKey: string;
  timeLabel: string;
  title: string;
  completed: boolean;
  occurrence: RecurringTaskInstance;
};

export type EventFlowItem = {
  kind: 'event';
  id: string;
  sortKey: string;
  timeLabel: string;
  title: string;
  location?: string | null;
  provider?: 'google' | 'microsoft' | null;
};

export type TimedFlowItem = TaskFlowItem | EventFlowItem;
export type FlowRow = TimedFlowItem | { kind: 'now'; label: string };

const pad = (n: number) => String(n).padStart(2, '0');
const clockLabel = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** "HH:MM" or "HH:MM:SS" -> "9:30 AM" in the user's locale. */
const timeStringLabel = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return clockLabel(d);
};

export interface TodayFlow {
  /** Items with a clock time, in order, with the "now" marker spliced in. */
  rows: FlowRow[];
  timedCount: number;
  /** Today's tasks that have no time of day. */
  anytime: TaskFlowItem[];
  /** Meetings and tasks together. */
  total: number;
  eventCount: number;
  /** Tasks only: meetings cannot be "done". */
  taskTotal: number;
  done: number;
}

/**
 * Merges today's task occurrences and calendar events into one timeline.
 * Pure so it can be tested without React.
 */
export function buildTodayFlow(
  tasks: Task[],
  instances: TaskInstance[],
  events: Event[],
  now: Date = new Date()
): TodayFlow {
  const todayStr = formatDateLocal(now);

  const occurrences = getTasksForDate(tasks, instances, todayStr);
  const toTaskItem = (t: RecurringTaskInstance): TaskFlowItem => ({
    kind: 'task',
    id: `${t.id}-${getOccurrenceDate(t)}`,
    sortKey: t.due_time ? t.due_time.slice(0, 5) : '99:99',
    timeLabel: t.due_time ? timeStringLabel(t.due_time) : '',
    title: t.title,
    completed: isOccurrenceCompleted(t),
    occurrence: t,
  });

  const timedTasks = occurrences.filter((t) => !!t.due_time).map(toTaskItem);
  const anytime = occurrences.filter((t) => !t.due_time).map(toTaskItem);

  const todaysEvents: EventFlowItem[] = events
    .filter((e) => formatDateLocal(new Date(e.start_time)) === todayStr)
    .map((e) => {
      const d = new Date(e.start_time);
      return {
        kind: 'event' as const,
        id: e.id,
        sortKey: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        timeLabel: clockLabel(d),
        title: e.title,
        location: e.location,
        provider: e.sync_provider ?? null,
      };
    });

  const timed = [...timedTasks, ...todaysEvents].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const rows: FlowRow[] = [...timed];
  if (timed.length > 0) {
    const nowKey = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const idx = timed.findIndex((item) => item.sortKey > nowKey);
    rows.splice(idx === -1 ? timed.length : idx, 0, { kind: 'now', label: clockLabel(now) });
  }

  const allTasks = [...timedTasks, ...anytime];
  return {
    rows,
    timedCount: timed.length,
    anytime,
    total: allTasks.length + todaysEvents.length,
    eventCount: todaysEvents.length,
    taskTotal: allTasks.length,
    done: allTasks.filter((t) => t.completed).length,
  };
}
