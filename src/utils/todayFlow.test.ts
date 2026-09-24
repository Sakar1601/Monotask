import { describe, expect, it } from 'vitest';
import { buildTodayFlow } from './todayFlow';
import type { Task } from '@/hooks/useTasks';
import type { Event } from '@/hooks/useEvents';

const NOW = new Date(2026, 8, 23, 12, 0);

const task = (over: Partial<Task>): Task =>
  ({
    id: 't',
    title: 'Task',
    status: 'pending',
    priority: 'medium',
    due_date: '2026-09-23',
    due_time: null,
    repeat_type: 'none',
    ...over,
  }) as Task;

const event = (over: Partial<Event>): Event =>
  ({
    id: 'e',
    title: 'Meeting',
    start_time: new Date(2026, 8, 23, 10, 0).toISOString(),
    created_at: '',
    updated_at: '',
    user_id: 'u',
    ...over,
  }) as Event;

describe('buildTodayFlow', () => {
  it('orders tasks and events by time and puts the now marker between them', () => {
    const flow = buildTodayFlow(
      [task({ id: 'a', title: 'Afternoon task', due_time: '15:00:00' })],
      [],
      [event({ id: 'm', title: 'Morning meeting' })],
      NOW
    );
    expect(flow.rows.map((r) => (r.kind === 'now' ? 'now' : r.title))).toEqual([
      'Morning meeting',
      'now',
      'Afternoon task',
    ]);
  });

  it('puts the now marker last when everything is already past', () => {
    const flow = buildTodayFlow([], [], [event({})], new Date(2026, 8, 23, 18, 0));
    expect(flow.rows[flow.rows.length - 1].kind).toBe('now');
  });

  it('separates tasks without a time into "anytime"', () => {
    const flow = buildTodayFlow([task({ id: 'x', title: 'No time' })], [], [], NOW);
    expect(flow.anytime.map((t) => t.title)).toEqual(['No time']);
    expect(flow.rows).toHaveLength(0);
  });

  it('ignores items on other days', () => {
    const flow = buildTodayFlow(
      [task({ due_date: '2026-09-24' })],
      [],
      [event({ start_time: new Date(2026, 8, 24, 9, 0).toISOString() })],
      NOW
    );
    expect(flow.total).toBe(0);
  });

  it('counts completed tasks toward done', () => {
    const flow = buildTodayFlow([task({ id: 'd', status: 'completed' }), task({ id: 'p' })], [], [], NOW);
    expect(flow.total).toBe(2);
    expect(flow.taskTotal).toBe(2);
    expect(flow.eventCount).toBe(0);
    expect(flow.done).toBe(1);
  });
});
