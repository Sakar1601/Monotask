import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  vi.stubGlobal('Deno', { env: { get: vi.fn() }, serve: vi.fn() });
});

vi.mock('npm:@supabase/supabase-js@2', () => ({ createClient: vi.fn() }));
vi.mock('https://esm.sh/@anthropic-ai/sdk@0.122.0', () => ({ default: vi.fn() }));

import { findOverlappingPairs, type EventForConflictCheck } from '../../supabase/functions/detect-conflicts/index.ts';

const event = (id: string, start: string, end: string | null): EventForConflictCheck => ({
  id,
  title: id,
  start_time: start,
  end_time: end,
});

describe('findOverlappingPairs', () => {
  it('flags two events whose time ranges overlap', () => {
    const pairs = findOverlappingPairs([
      event('a', '2026-09-15T09:00:00Z', '2026-09-15T10:00:00Z'),
      event('b', '2026-09-15T09:30:00Z', '2026-09-15T10:30:00Z'),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].eventA.id).toBe('a');
    expect(pairs[0].eventB.id).toBe('b');
  });

  it('does not flag back-to-back events that touch but do not overlap', () => {
    const pairs = findOverlappingPairs([
      event('a', '2026-09-15T09:00:00Z', '2026-09-15T10:00:00Z'),
      event('b', '2026-09-15T10:00:00Z', '2026-09-15T11:00:00Z'),
    ]);
    expect(pairs).toHaveLength(0);
  });

  it('does not flag two events on entirely different days', () => {
    const pairs = findOverlappingPairs([
      event('a', '2026-09-15T09:00:00Z', '2026-09-15T10:00:00Z'),
      event('b', '2026-09-16T09:00:00Z', '2026-09-16T10:00:00Z'),
    ]);
    expect(pairs).toHaveLength(0);
  });

  it('treats a null end_time as a zero-duration point in time', () => {
    const pairs = findOverlappingPairs([
      event('a', '2026-09-15T09:00:00Z', null),
      event('b', '2026-09-15T09:00:00Z', '2026-09-15T10:00:00Z'),
    ]);
    // a's "end" is its own start (09:00), and b starts exactly at 09:00,
    // not before it - so this does not count as an overlap either.
    expect(pairs).toHaveLength(0);
  });

  it('flags all three pairs in a three-way overlap', () => {
    const pairs = findOverlappingPairs([
      event('a', '2026-09-15T09:00:00Z', '2026-09-15T11:00:00Z'),
      event('b', '2026-09-15T10:00:00Z', '2026-09-15T12:00:00Z'),
      event('c', '2026-09-15T10:30:00Z', '2026-09-15T11:30:00Z'),
    ]);
    expect(pairs).toHaveLength(3);
  });
});
