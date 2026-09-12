import { describe, it, test, expect } from 'vitest';
import { Task } from '@/hooks/useTasks';
import { Habit } from '@/hooks/useHabits';
import { Tag } from '@/hooks/useTags';
import { Event } from '@/hooks/useEvents';
import { buildExportData, parseImportFile, ImportValidationError, MONOTASK_EXPORT_VERSION } from './dataPortability';

describe('buildExportData', () => {
  const tags: Tag[] = [{ id: 'tag-1', name: 'Work', color: '#111827', created_at: '2026-01-01T00:00:00Z' }];

  it('resolves tag_id to the tag name, and omits it when unset', () => {
    const tasks: Task[] = [
      {
        id: 't1', title: 'Tagged', priority: 'low', status: 'pending',
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', user_id: 'u1',
        tag_id: 'tag-1',
      },
      {
        id: 't2', title: 'Untagged', priority: 'low', status: 'pending',
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', user_id: 'u1',
      },
    ];
    const result = buildExportData(tasks, [], tags);
    expect(result.version).toBe(MONOTASK_EXPORT_VERSION);
    expect(result.tasks[0].tag_name).toBe('Work');
    expect(result.tasks[1].tag_name).toBeNull();
  });

  it('defaults repeat_type/repeat_interval when unset on the task', () => {
    const tasks: Task[] = [{
      id: 't1', title: 'No repeat set', priority: 'low', status: 'pending',
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', user_id: 'u1',
    }];
    const result = buildExportData(tasks, [], []);
    expect(result.tasks[0].repeat_type).toBe('none');
    expect(result.tasks[0].repeat_interval).toBe(1);
  });

  it('resolves a habit tag_name the same way as tasks', () => {
    const habits: Habit[] = [{
      id: 'h1', name: 'Meditate', frequency: 'daily', is_active: true,
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', user_id: 'u1',
      tag_id: 'tag-1',
    }];
    const result = buildExportData([], habits, tags);
    expect(result.habits[0].tag_name).toBe('Work');
  });
});

test('buildExportData tags each task and event with its source', () => {
  const tasks: Task[] = [
    { id: '1', title: 'Native task', priority: 'low', status: 'pending', created_at: '', updated_at: '', user_id: 'u', google_connection_id: null },
    { id: '2', title: 'Synced task', priority: 'medium', status: 'pending', created_at: '', updated_at: '', user_id: 'u', google_connection_id: 'conn-1' },
  ];
  const events: Event[] = [
    { id: '3', title: 'Native event', start_time: '2026-01-01T00:00:00Z', created_at: '', updated_at: '', user_id: 'u', google_connection_id: null },
    { id: '4', title: 'Synced event', start_time: '2026-01-01T00:00:00Z', created_at: '', updated_at: '', user_id: 'u', google_connection_id: 'conn-1' },
  ];

  const data = buildExportData(tasks, [], [], events);

  expect(data.tasks.find((t) => t.title === 'Native task')?.source).toBe('monotask');
  expect(data.tasks.find((t) => t.title === 'Synced task')?.source).toBe('google');
  expect(data.events?.find((e) => e.title === 'Native event')?.source).toBe('monotask');
  expect(data.events?.find((e) => e.title === 'Synced event')?.source).toBe('google');
});

describe('parseImportFile', () => {
  const validExport = {
    version: 1,
    exportedAt: '2026-01-01T00:00:00Z',
    tags: [{ name: 'Work', color: '#111827' }],
    tasks: [{
      title: 'Task', description: null, due_date: null, due_time: null,
      priority: 'low', status: 'pending', repeat_type: 'none', repeat_interval: 1, tag_name: null,
    }],
    habits: [{
      name: 'Habit', description: null, frequency: 'daily', frequency_days: null,
      preferred_time: null, tag_name: null,
    }],
  };

  it('accepts a well-formed export', () => {
    expect(() => parseImportFile(validExport)).not.toThrow();
  });

  it('rejects a non-object', () => {
    expect(() => parseImportFile('not an object')).toThrow(ImportValidationError);
    expect(() => parseImportFile(null)).toThrow(ImportValidationError);
  });

  it('rejects a missing version field', () => {
    const { version, ...withoutVersion } = validExport;
    expect(() => parseImportFile(withoutVersion)).toThrow(/version/i);
  });

  it('rejects a malformed task (invalid priority)', () => {
    const bad = { ...validExport, tasks: [{ ...validExport.tasks[0], priority: 'urgent' }] };
    expect(() => parseImportFile(bad)).toThrow(/tasks/i);
  });

  it('rejects a malformed habit (invalid frequency)', () => {
    const bad = { ...validExport, habits: [{ ...validExport.habits[0], frequency: 'hourly' }] };
    expect(() => parseImportFile(bad)).toThrow(/habits/i);
  });

  it('rejects tags that are not an array', () => {
    const bad = { ...validExport, tags: 'Work,Personal' };
    expect(() => parseImportFile(bad)).toThrow(/tags/i);
  });
});
