import { describe, expect, it } from 'vitest';
import { QUOTES, quoteForDate } from './dailyQuote';

describe('quoteForDate', () => {
  it('returns the same quote for any time on the same local day', () => {
    expect(quoteForDate(new Date(2026, 8, 23, 0, 5))).toBe(quoteForDate(new Date(2026, 8, 23, 23, 55)));
  });

  it('changes on the next local day', () => {
    expect(quoteForDate(new Date(2026, 8, 23))).not.toBe(quoteForDate(new Date(2026, 8, 24)));
  });

  it('cycles through every quote before repeating', () => {
    const seen = new Set<string>();
    for (let i = 0; i < QUOTES.length; i++) seen.add(quoteForDate(new Date(2026, 0, 1 + i)));
    expect(seen.size).toBe(QUOTES.length);
  });

  it('has no duplicate or empty quotes', () => {
    expect(new Set(QUOTES).size).toBe(QUOTES.length);
    expect(QUOTES.every((q) => q.trim().length > 0)).toBe(true);
  });
});
