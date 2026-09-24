import { describe, expect, it } from 'vitest';
import { parseDateOnly } from './dateOnly';

describe('parseDateOnly', () => {
  it('keeps the calendar day in local time', () => {
    const d = parseDateOnly('2026-09-24');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 24]);
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });

  it('ignores a time component if one is present', () => {
    const d = parseDateOnly('2026-09-24T15:30:00Z');
    expect(d.getDate()).toBe(24);
  });
});
