import { afterEach, describe, expect, it, vi } from 'vitest';
import '../types/deno';
import { googleProvider, mapGoogleTask, mapGmailMessage } from '../../supabase/functions/_shared/integrations/google.ts';

describe('Google Tasks pull fidelity', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps Google completion timestamps', () => {
    expect(mapGoogleTask({ id: 'task-1', status: 'completed', completed: '2026-09-11T12:00:00Z' }))
      .toMatchObject({ status: 'completed', completedAt: '2026-09-11T12:00:00Z' });
    expect(mapGoogleTask({ id: 'task-2', status: 'needsAction' }))
      .toMatchObject({ status: 'pending', completedAt: null });
  });

  it('requests hidden completed tasks and consumes every page', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 'task-1', title: 'First page' }],
        nextPageToken: 'next-page',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 'task-2', title: 'Second page', status: 'completed' }],
      })));
    vi.stubGlobal('fetch', fetchMock);

    const completedMin = new Date('2026-09-10T00:00:00Z');
    const tasks = await googleProvider.fetchTasks('token', completedMin);

    expect(tasks.items.map((task) => task.externalId)).toEqual(['task-1', 'task-2']);
    expect(tasks.complete).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('showCompleted=true');
    expect(fetchMock.mock.calls[0][0]).toContain('showHidden=true');
    expect(fetchMock.mock.calls[0][0]).toContain(`completedMin=${encodeURIComponent(completedMin.toISOString())}`);
    expect(fetchMock.mock.calls[1][0]).toContain('pageToken=next-page');
  });

  it('stops paginating after the page ceiling instead of looping forever', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({
        items: [{ id: 'task-x' }],
        nextPageToken: 'always-more', // simulates a misbehaving/looping API
      }))),
    );
    vi.stubGlobal('fetch', fetchMock);

    const tasks = await googleProvider.fetchTasks('token', new Date());

    expect(fetchMock).toHaveBeenCalledTimes(20);
    expect(tasks.items).toHaveLength(20);
    expect(tasks.complete).toBe(false);
  });
});

describe('Google push mechanism', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends only the changed fields on task update, mapping status correctly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await googleProvider.updateTask('token', 'task-1', { status: 'completed' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/tasks/task-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ status: 'completed' });
  });

  it('treats a 410 on delete as success (already gone in Google)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 410 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(googleProvider.deleteTask('token', 'task-1')).resolves.toBeUndefined();
  });

  it('sends only the changed fields on event update, including a null end time when explicitly cleared', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await googleProvider.updateEvent('token', 'event-1', { title: 'New title', endTime: null });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/events/event-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ summary: 'New title', end: null });
  });

  it('treats a 410 on event delete as success (already gone in Google)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 410 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(googleProvider.deleteEvent('token', 'event-1')).resolves.toBeUndefined();
  });

  it('throws on a real delete failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('server error', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(googleProvider.deleteTask('token', 'task-1')).rejects.toThrow(/500/);
  });
});

describe('Gmail message mapping', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps a Gmail message detail, preferring the snippet field over a full body fetch', () => {
    expect(mapGmailMessage({
      id: 'msg-1',
      snippet: 'Can you send the report by Friday?',
      internalDate: '1700000000000',
      payload: { headers: [
        { name: 'Subject', value: 'Report needed' },
        { name: 'From', value: 'boss@example.com' },
      ] },
    })).toEqual({
      externalId: 'msg-1',
      source: 'email',
      subject: 'Report needed',
      snippet: 'Can you send the report by Friday?',
      sender: 'boss@example.com',
      receivedAt: new Date(1700000000000).toISOString(),
    });
  });

  it('returns null for a message with no id', () => {
    expect(mapGmailMessage({ snippet: 'no id here' })).toBeNull();
  });

  it('appends extraScopes to the authorize URL when provided', () => {
    vi.stubGlobal('Deno', { env: { get: () => 'test-client-id' } });
    const url = googleProvider.getAuthUrl('state-1', 'https://example.com/callback', 'https://www.googleapis.com/auth/gmail.readonly');
    const scope = new URL(url).searchParams.get('scope')!;
    expect(scope).toContain('https://www.googleapis.com/auth/gmail.readonly');
    expect(scope).toContain('https://www.googleapis.com/auth/calendar');
  });

  it('omits extraScopes from the authorize URL when not provided', () => {
    vi.stubGlobal('Deno', { env: { get: () => 'test-client-id' } });
    const url = googleProvider.getAuthUrl('state-1', 'https://example.com/callback');
    const scope = new URL(url).searchParams.get('scope')!;
    expect(scope).not.toContain('gmail.readonly');
  });
});
