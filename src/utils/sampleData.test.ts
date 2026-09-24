import { describe, expect, it } from 'vitest';
import { buildSampleData } from './sampleData';

describe('buildSampleData', () => {
  const now = new Date(2026, 8, 23, 12, 0);

  it('dates tasks relative to today in local time', () => {
    const { tasks } = buildSampleData(now);
    expect(tasks[0].due_date).toBe('2026-09-23');
    expect(tasks.find((t) => t.title === 'Book a dentist appointment')?.due_date).toBe('2026-09-26');
  });

  it('only references the four default tag names', () => {
    const { tasks, habit } = buildSampleData(now);
    const allowed = new Set(['Work', 'Personal', 'Health', 'Learning', null]);
    expect(tasks.every((t) => allowed.has(t.tagName))).toBe(true);
    expect(allowed.has(habit.tagName)).toBe(true);
  });

  it('includes a recurring task so the recurrence UI has something to show', () => {
    expect(buildSampleData(now).tasks.some((t) => t.repeat_type === 'daily')).toBe(true);
  });
});
