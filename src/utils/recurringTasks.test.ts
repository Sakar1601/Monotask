import { describe, it, expect } from 'vitest';
import { Task } from '@/hooks/useTasks';
import { TaskInstance } from '@/hooks/useTaskInstances';
import { generateRecurringInstances, getTasksForDate, getTasksForWeek } from './recurringTasks';

const baseTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Test task',
  priority: 'low',
  status: 'pending',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  user_id: 'user-1',
  repeat_type: 'none',
  ...overrides,
});

describe('generateRecurringInstances', () => {
  it('includes a non-recurring task once, on its due_date, within range', () => {
    const task = baseTask({ due_date: '2026-08-15' });
    const result = generateRecurringInstances([task], [], new Date('2026-08-01'), new Date('2026-08-31'));
    expect(result).toHaveLength(1);
    expect(result[0].instance_date).toBe('2026-08-15');
  });

  it('excludes a non-recurring task outside the range', () => {
    const task = baseTask({ due_date: '2026-09-01' });
    const result = generateRecurringInstances([task], [], new Date('2026-08-01'), new Date('2026-08-31'));
    expect(result).toHaveLength(0);
  });

  it('expands a daily recurring task into one occurrence per day in range', () => {
    const task = baseTask({ id: 'daily-1', due_date: '2026-08-01', repeat_type: 'daily' });
    const result = generateRecurringInstances([task], [], new Date('2026-08-01'), new Date('2026-08-05'));
    expect(result.map((r) => r.instance_date)).toEqual([
      '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05',
    ]);
  });

  it('respects a daily repeat_interval greater than 1', () => {
    const task = baseTask({ id: 'daily-2', due_date: '2026-08-01', repeat_type: 'daily', repeat_interval: 2 });
    const result = generateRecurringInstances([task], [], new Date('2026-08-01'), new Date('2026-08-07'));
    expect(result.map((r) => r.instance_date)).toEqual(['2026-08-01', '2026-08-03', '2026-08-05', '2026-08-07']);
  });

  it('expands a weekly recurring task on the same weekday each week', () => {
    const task = baseTask({ id: 'weekly-1', due_date: '2026-08-03', repeat_type: 'weekly' }); // a Monday
    const result = generateRecurringInstances([task], [], new Date('2026-08-01'), new Date('2026-08-24'));
    expect(result.map((r) => r.instance_date)).toEqual(['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24']);
  });

  it('expands a monthly recurring task on the same day each month', () => {
    const task = baseTask({ id: 'monthly-1', due_date: '2026-08-15', repeat_type: 'monthly' });
    const result = generateRecurringInstances([task], [], new Date('2026-08-01'), new Date('2026-10-31'));
    expect(result.map((r) => r.instance_date)).toEqual(['2026-08-15', '2026-09-15', '2026-10-15']);
  });

  it('attaches an existing task_instances row status to the matching occurrence', () => {
    const task = baseTask({ id: 'daily-3', due_date: '2026-08-01', repeat_type: 'daily' });
    const instances: TaskInstance[] = [
      { id: 'inst-1', task_id: 'daily-3', instance_date: '2026-08-02', status: 'completed', created_at: '2026-08-02T00:00:00Z' },
    ];
    const result = generateRecurringInstances([task], instances, new Date('2026-08-01'), new Date('2026-08-03'));
    const day2 = result.find((r) => r.instance_date === '2026-08-02');
    expect(day2?.instance_status).toBe('completed');
    expect(day2?.instance_id).toBe('inst-1');

    const day1 = result.find((r) => r.instance_date === '2026-08-01');
    expect(day1?.instance_status).toBe('pending');
    expect(day1?.instance_id).toBeUndefined();
  });
});

describe('getTasksForDate', () => {
  // Regression test: getTasksForDate used to pass a 2-day inclusive range
  // (date, date+1) into generateRecurringInstances (whose bounds are both
  // inclusive), silently leaking each day's occurrence into the next day's
  // result and colliding React keys wherever it was rendered.
  it('returns exactly one occurrence per call for a daily task, not a leaked extra day', () => {
    const task = baseTask({ id: 'daily-4', due_date: '2026-08-01', repeat_type: 'daily' });
    const aug1 = getTasksForDate([task], [], '2026-08-01');
    const aug2 = getTasksForDate([task], [], '2026-08-02');

    expect(aug1).toHaveLength(1);
    expect(aug1[0].instance_date).toBe('2026-08-01');
    expect(aug2).toHaveLength(1);
    expect(aug2[0].instance_date).toBe('2026-08-02');
  });

  it('returns an empty list for a date with no matching task', () => {
    const task = baseTask({ due_date: '2026-08-01' });
    expect(getTasksForDate([task], [], '2026-08-02')).toHaveLength(0);
  });
});

describe('getTasksForWeek', () => {
  it('returns exactly 7 days of occurrences for a daily task', () => {
    const task = baseTask({ id: 'daily-5', due_date: '2026-08-01', repeat_type: 'daily' });
    const result = getTasksForWeek([task], [], new Date('2026-08-01'));
    expect(result).toHaveLength(7);
  });
});
