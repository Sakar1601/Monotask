import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './quickAddPreview';

// Wednesday, 23 Sept 2026
const NOW = new Date(2026, 8, 23, 10, 0);
const ymd = (d: Date | null) => (d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : null);

describe('parseQuickAdd', () => {
  it('parses the headline example', () => {
    const r = parseQuickAdd('lunch with sam tomorrow 1pm, high priority', NOW);
    expect(r).toMatchObject({ title: 'Lunch with sam', time: '1:00 PM', priority: 'high', repeat: 'none' });
    expect(ymd(r.dueDate)).toBe('2026-9-24');
  });

  it('resolves a weekday to the next occurrence', () => {
    expect(ymd(parseQuickAdd('call dentist friday 9am', NOW).dueDate)).toBe('2026-9-25');
    // Same weekday as today means next week, not today.
    expect(ymd(parseQuickAdd('review report wednesday', NOW).dueDate)).toBe('2026-9-30');
  });

  it('understands "in N days"', () => {
    expect(ymd(parseQuickAdd('submit report in 10 days', NOW).dueDate)).toBe('2026-10-3');
  });

  it('detects recurrence', () => {
    expect(parseQuickAdd('water the plants every day', NOW)).toMatchObject({ title: 'Water the plants', repeat: 'daily' });
    expect(parseQuickAdd('pay rent every month', NOW).repeat).toBe('monthly');
    const weekly = parseQuickAdd('team sync every monday 10am', NOW);
    expect(weekly.repeat).toBe('weekly');
    expect(ymd(weekly.dueDate)).toBe('2026-9-28');
  });

  it('defaults to medium priority and no date', () => {
    expect(parseQuickAdd('buy groceries', NOW)).toMatchObject({ title: 'Buy groceries', priority: 'medium', dueDate: null, time: null });
  });

  it('handles noon and 24-hour times', () => {
    expect(parseQuickAdd('lunch tomorrow at noon', NOW).time).toBe('12:00 PM');
    expect(parseQuickAdd('standup at 14:30', NOW).time).toBe('2:30 PM');
  });

  it('returns an empty title for empty input', () => {
    expect(parseQuickAdd('   ', NOW).title).toBe('');
  });
});
