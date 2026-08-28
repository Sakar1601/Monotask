import { describe, it, expect, vi } from 'vitest';
import { RecurringTaskInstance } from './recurringTasks';
import { isOccurrenceCompleted, getOccurrenceDate, toggleOccurrenceComplete } from './taskOccurrences';

const baseOccurrence = (overrides: Partial<RecurringTaskInstance> = {}): RecurringTaskInstance => ({
  id: 'task-1',
  title: 'Test task',
  priority: 'low',
  status: 'pending',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  user_id: 'user-1',
  instance_date: '2026-08-01',
  ...overrides,
});

describe('isOccurrenceCompleted', () => {
  it('falls back to task.status for a plain (non-instance-tracked) task', () => {
    expect(isOccurrenceCompleted(baseOccurrence({ status: 'completed' }))).toBe(true);
    expect(isOccurrenceCompleted(baseOccurrence({ status: 'pending' }))).toBe(false);
  });

  it('uses instance_status when present, ignoring task.status', () => {
    const occurrence = baseOccurrence({ status: 'pending', instance_status: 'completed' });
    expect(isOccurrenceCompleted(occurrence)).toBe(true);
  });

  it('treats instance_status "pending" as not completed even if task.status is completed', () => {
    // Can't happen from the real generator (recurring tasks stay 'pending' at
    // the template level), but the function must trust instance_status when set.
    const occurrence = baseOccurrence({ status: 'completed', instance_status: 'pending' });
    expect(isOccurrenceCompleted(occurrence)).toBe(false);
  });
});

describe('getOccurrenceDate', () => {
  it('prefers instance_date over due_date', () => {
    expect(getOccurrenceDate(baseOccurrence({ instance_date: '2026-08-05', due_date: '2026-08-01' }))).toBe('2026-08-05');
  });

  it('falls back to due_date when instance_date is empty', () => {
    expect(getOccurrenceDate(baseOccurrence({ instance_date: '', due_date: '2026-08-01' }))).toBe('2026-08-01');
  });
});

describe('toggleOccurrenceComplete', () => {
  it('routes a plain task through updateTask, not updateInstance', () => {
    const updateTask = vi.fn();
    const updateInstance = vi.fn();
    const occurrence = baseOccurrence({ status: 'pending' });

    toggleOccurrenceComplete(occurrence, { updateTask, updateInstance });

    expect(updateInstance).not.toHaveBeenCalled();
    expect(updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-1', status: 'completed' }),
    );
  });

  it('routes an instance-tracked occurrence through updateInstance, not updateTask', () => {
    const updateTask = vi.fn();
    const updateInstance = vi.fn();
    const occurrence = baseOccurrence({ instance_status: 'pending', instance_id: 'inst-1', instance_date: '2026-08-02' });

    toggleOccurrenceComplete(occurrence, { updateTask, updateInstance });

    expect(updateTask).not.toHaveBeenCalled();
    expect(updateInstance).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'inst-1', task_id: 'task-1', instance_date: '2026-08-02', status: 'completed' }),
    );
  });

  it('toggles a completed occurrence back to pending', () => {
    const updateTask = vi.fn();
    const updateInstance = vi.fn();
    const occurrence = baseOccurrence({ status: 'completed' });

    toggleOccurrenceComplete(occurrence, { updateTask, updateInstance });

    expect(updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', completed_at: null }),
    );
  });
});
