import { Task } from '@/hooks/useTasks';
import { Habit } from '@/hooks/useHabits';
import { Tag } from '@/hooks/useTags';

// Round-trippable export/import format. Deliberately excludes habit logs -
// re-inserting full completion history is a lot of writes for a "restore my
// data" feature and raises duplicate-date edge cases; tasks/habits/tags are
// what a user actually needs back after switching accounts or devices.
export const MONOTASK_EXPORT_VERSION = 1;

export interface ExportedTag {
  name: string;
  color: string;
}

export interface ExportedTask {
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed' | 'cancelled';
  repeat_type: 'none' | 'daily' | 'weekly' | 'monthly';
  repeat_interval: number;
  tag_name: string | null;
}

export interface ExportedHabit {
  name: string;
  description: string | null;
  frequency: 'daily' | 'weekly' | 'monthly';
  frequency_days: number[] | null;
  preferred_time: string | null;
  tag_name: string | null;
}

export interface MonotaskExport {
  version: number;
  exportedAt: string;
  tags: ExportedTag[];
  tasks: ExportedTask[];
  habits: ExportedHabit[];
}

export const buildExportData = (tasks: Task[], habits: Habit[], tags: Tag[]): MonotaskExport => {
  const tagNameById = new Map(tags.map((tag) => [tag.id, tag.name]));

  return {
    version: MONOTASK_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    tags: tags.map((tag) => ({ name: tag.name, color: tag.color })),
    tasks: tasks.map((task) => ({
      title: task.title,
      description: task.description || null,
      due_date: task.due_date || null,
      due_time: task.due_time || null,
      priority: task.priority,
      status: task.status,
      repeat_type: task.repeat_type || 'none',
      repeat_interval: task.repeat_interval || 1,
      tag_name: task.tag_id ? tagNameById.get(task.tag_id) || null : null,
    })),
    habits: habits.map((habit) => ({
      name: habit.name,
      description: habit.description || null,
      frequency: habit.frequency,
      frequency_days: habit.frequency_days || null,
      preferred_time: habit.preferred_time || null,
      tag_name: habit.tag_id ? tagNameById.get(habit.tag_id) || null : null,
    })),
  };
};

const isString = (v: unknown): v is string => typeof v === 'string';
const isNullableString = (v: unknown): v is string | null => v === null || typeof v === 'string';

const isExportedTag = (v: unknown): v is ExportedTag =>
  !!v && typeof v === 'object' && isString((v as ExportedTag).name) && isString((v as ExportedTag).color);

const isExportedTask = (v: unknown): v is ExportedTask => {
  if (!v || typeof v !== 'object') return false;
  const t = v as ExportedTask;
  return (
    isString(t.title) &&
    isNullableString(t.description) &&
    isNullableString(t.due_date) &&
    isNullableString(t.due_time) &&
    ['low', 'medium', 'high'].includes(t.priority) &&
    ['pending', 'completed', 'cancelled'].includes(t.status) &&
    ['none', 'daily', 'weekly', 'monthly'].includes(t.repeat_type) &&
    typeof t.repeat_interval === 'number' &&
    isNullableString(t.tag_name)
  );
};

const isExportedHabit = (v: unknown): v is ExportedHabit => {
  if (!v || typeof v !== 'object') return false;
  const h = v as ExportedHabit;
  return (
    isString(h.name) &&
    isNullableString(h.description) &&
    ['daily', 'weekly', 'monthly'].includes(h.frequency) &&
    (h.frequency_days === null || Array.isArray(h.frequency_days)) &&
    isNullableString(h.preferred_time) &&
    isNullableString(h.tag_name)
  );
};

export class ImportValidationError extends Error {}

// Validates the parsed JSON matches the export schema. Throws
// ImportValidationError with a human-readable reason on any mismatch -
// callers should catch this specifically to show the message to the user
// rather than a generic "failed to import".
export const parseImportFile = (raw: unknown): MonotaskExport => {
  if (!raw || typeof raw !== 'object') {
    throw new ImportValidationError('File does not contain a JSON object.');
  }
  const data = raw as Partial<MonotaskExport>;

  if (typeof data.version !== 'number') {
    throw new ImportValidationError('Missing or invalid "version" field - this doesn\'t look like a Monotask export.');
  }
  if (!Array.isArray(data.tags) || !data.tags.every(isExportedTag)) {
    throw new ImportValidationError('"tags" is missing or malformed.');
  }
  if (!Array.isArray(data.tasks) || !data.tasks.every(isExportedTask)) {
    throw new ImportValidationError('"tasks" is missing or malformed.');
  }
  if (!Array.isArray(data.habits) || !data.habits.every(isExportedHabit)) {
    throw new ImportValidationError('"habits" is missing or malformed.');
  }

  return data as MonotaskExport;
};
