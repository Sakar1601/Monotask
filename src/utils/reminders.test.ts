import { describe, expect, it } from 'vitest';
import {
  eventReminder,
  habitReminder,
  isDue,
  localDay,
  safeTimeZone,
  taskReminder,
  zonedTimeToUtc,
} from '../../supabase/functions/send-reminders/reminders';

describe('zonedTimeToUtc', () => {
  it('converts winter and summer wall time using the right offset', () => {
    expect(zonedTimeToUtc('2026-01-15', '09:00', 'America/Los_Angeles').toISOString()).toBe('2026-01-15T17:00:00.000Z');
    expect(zonedTimeToUtc('2026-07-15', '09:00', 'America/Los_Angeles').toISOString()).toBe('2026-07-15T16:00:00.000Z');
  });

  it('handles half-hour zones and UTC', () => {
    expect(zonedTimeToUtc('2026-03-10', '08:30', 'Asia/Kolkata').toISOString()).toBe('2026-03-10T03:00:00.000Z');
    expect(zonedTimeToUtc('2026-03-10', '08:30', 'UTC').toISOString()).toBe('2026-03-10T08:30:00.000Z');
  });

  it('is correct on a DST-change day', () => {
    // US spring forward 2026-03-08 at 02:00 local; 10:00 is already PDT (UTC-7).
    expect(zonedTimeToUtc('2026-03-08', '10:00', 'America/Los_Angeles').toISOString()).toBe('2026-03-08T17:00:00.000Z');
  });
});

describe('localDay', () => {
  it('uses the zone, not UTC, for the date and weekday', () => {
    const now = new Date('2026-03-10T03:00:00Z'); // Tue 03:00 UTC = Mon evening in LA
    expect(localDay(now, 'America/Los_Angeles')).toEqual({ date: '2026-03-09', weekday: 1 });
    expect(localDay(now, 'UTC')).toEqual({ date: '2026-03-10', weekday: 2 });
  });
});

describe('isDue', () => {
  const remindAt = new Date('2026-03-10T12:00:00Z');
  it('is due from the reminder time until the grace window ends', () => {
    expect(isDue(remindAt, new Date('2026-03-10T11:59:59Z'))).toBe(false);
    expect(isDue(remindAt, new Date('2026-03-10T12:00:00Z'))).toBe(true);
    expect(isDue(remindAt, new Date('2026-03-10T12:19:00Z'))).toBe(true);
    expect(isDue(remindAt, new Date('2026-03-10T12:20:00Z'))).toBe(false);
  });
});

describe('safeTimeZone', () => {
  it('falls back to UTC for missing or invalid zones', () => {
    expect(safeTimeZone(null)).toBe('UTC');
    expect(safeTimeZone('Not/AZone')).toBe('UTC');
    expect(safeTimeZone('Asia/Kolkata')).toBe('Asia/Kolkata');
  });
});

describe('taskReminder', () => {
  const base = { id: 't1', title: 'Pay rent', status: 'pending', due_date: '2026-03-10', due_time: '09:00', repeat_type: null };
  it('reminds at the due time in the user zone', () => {
    expect(taskReminder(base, 'UTC')?.remindAt.toISOString()).toBe('2026-03-10T09:00:00.000Z');
  });
  it('skips completed, recurring, and date-only tasks', () => {
    expect(taskReminder({ ...base, status: 'completed' }, 'UTC')).toBeNull();
    expect(taskReminder({ ...base, repeat_type: 'daily' }, 'UTC')).toBeNull();
    expect(taskReminder({ ...base, due_time: null }, 'UTC')).toBeNull();
    expect(taskReminder({ ...base, repeat_type: 'none' }, 'UTC')).not.toBeNull();
  });
});

describe('eventReminder', () => {
  const event = { id: 'e1', title: 'Standup', start_time: '2026-03-10T10:00:00Z', location: null };
  it('reminds 15 minutes before the start', () => {
    expect(eventReminder(event, new Date('2026-03-10T09:00:00Z'))?.remindAt.toISOString()).toBe('2026-03-10T09:45:00.000Z');
  });
  it('skips events that already started', () => {
    expect(eventReminder(event, new Date('2026-03-10T10:00:01Z'))).toBeNull();
  });
});

describe('habitReminder', () => {
  const habit = { id: 'h1', name: 'Read', frequency: 'daily', frequency_days: null, preferred_time: '20:00', is_active: true };
  const now = new Date('2026-03-10T20:01:00Z'); // Tuesday
  it('reminds daily habits at the preferred time', () => {
    expect(habitReminder(habit, 'UTC', now, new Set())?.remindAt.toISOString()).toBe('2026-03-10T20:00:00.000Z');
  });
  it('skips habits already completed today, inactive, or without a time', () => {
    expect(habitReminder(habit, 'UTC', now, new Set(['h1']))).toBeNull();
    expect(habitReminder({ ...habit, is_active: false }, 'UTC', now, new Set())).toBeNull();
    expect(habitReminder({ ...habit, preferred_time: null }, 'UTC', now, new Set())).toBeNull();
  });
  it('matches weekly habits by weekday (1 = Sunday)', () => {
    const weekly = { ...habit, frequency: 'weekly', frequency_days: [3] }; // Tuesday
    expect(habitReminder(weekly, 'UTC', now, new Set())).not.toBeNull();
    expect(habitReminder({ ...weekly, frequency_days: [2] }, 'UTC', now, new Set())).toBeNull();
    expect(habitReminder({ ...weekly, frequency_days: null }, 'UTC', now, new Set())).toBeNull();
    expect(habitReminder({ ...habit, frequency: 'monthly' }, 'UTC', now, new Set())).toBeNull();
  });
});
