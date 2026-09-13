import { afterEach, describe, expect, it, vi } from 'vitest';
import '../types/deno';
import { mapMicrosoftEvent, mapMicrosoftTask, mapOutlookMessage, mapTeamsChatMessage, microsoftProvider } from '../../supabase/functions/_shared/integrations/microsoft.ts';

describe('Microsoft mapping', () => {
  it('maps a Graph event, defaulting to UTC when no offset is present', () => {
    expect(mapMicrosoftEvent({
      id: 'evt-1',
      subject: 'Standup',
      start: { dateTime: '2026-09-15T09:00:00.0000000' },
      end: { dateTime: '2026-09-15T09:30:00.0000000' },
      onlineMeeting: { joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc' },
    })).toMatchObject({
      externalId: 'evt-1',
      title: 'Standup',
      startTime: '2026-09-15T09:00:00.0000000Z',
      endTime: '2026-09-15T09:30:00.0000000Z',
      meetingUrl: 'https://teams.microsoft.com/l/meetup-join/abc',
    });
  });

  it('returns null for an event with no id or no start time', () => {
    expect(mapMicrosoftEvent({ subject: 'No id' })).toBeNull();
    expect(mapMicrosoftEvent({ id: 'evt-2' })).toBeNull();
  });

  it('maps Graph task completion status and timestamps', () => {
    expect(mapMicrosoftTask({ id: 'task-1', status: 'completed', completedDateTime: { dateTime: '2026-09-11T12:00:00.0000000' } }))
      .toMatchObject({ status: 'completed', completedAt: '2026-09-11T12:00:00.0000000Z' });
    expect(mapMicrosoftTask({ id: 'task-2', status: 'notStarted' }))
      .toMatchObject({ status: 'pending', completedAt: null });
  });
});

describe('Microsoft message mapping', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps an Outlook mail message', () => {
    expect(mapOutlookMessage({
      id: 'mail-1',
      subject: 'Report needed',
      bodyPreview: 'Can you send the report by Friday?',
      from: { emailAddress: { address: 'boss@example.com', name: 'Boss' } },
      receivedDateTime: '2026-09-15T09:00:00Z',
    })).toEqual({
      externalId: 'mail-1',
      source: 'email',
      subject: 'Report needed',
      snippet: 'Can you send the report by Friday?',
      sender: 'boss@example.com',
      receivedAt: '2026-09-15T09:00:00Z',
    });
  });

  it('strips HTML from a Teams chat message body', () => {
    expect(mapTeamsChatMessage({
      id: 'chat-1',
      from: { user: { displayName: 'Alex' } },
      body: { content: '<p>Can you <b>review</b> the PR?</p>', contentType: 'html' },
      createdDateTime: '2026-09-15T09:00:00Z',
    })).toEqual({
      externalId: 'chat-1',
      source: 'chat',
      subject: null,
      snippet: 'Can you review the PR?',
      sender: 'Alex',
      receivedAt: '2026-09-15T09:00:00Z',
    });
  });

  it('returns null for a message with no id', () => {
    expect(mapOutlookMessage({ subject: 'no id' })).toBeNull();
    expect(mapTeamsChatMessage({ body: { content: 'no id' } })).toBeNull();
  });

  it('appends extraScopes to the authorize URL when provided', () => {
    vi.stubGlobal('Deno', { env: { get: () => 'test-value' } });
    const url = microsoftProvider.getAuthUrl('state-1', 'https://example.com/callback', 'Mail.Read Chat.Read');
    const scope = new URL(url).searchParams.get('scope')!;
    expect(scope).toContain('Mail.Read');
    expect(scope).toContain('Chat.Read');
    expect(scope).toContain('Calendars.ReadWrite');
  });
});

describe('Microsoft fetch pagination', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('follows @odata.nextLink across pages for events', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [{ id: 'evt-1', subject: 'First', start: { dateTime: '2026-09-15T09:00:00.0000000' } }],
        '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/calendarView?$skip=250',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: [{ id: 'evt-2', subject: 'Second', start: { dateTime: '2026-09-16T09:00:00.0000000' } }],
      })));
    vi.stubGlobal('fetch', fetchMock);

    const events = await microsoftProvider.fetchEvents('token', new Date('2026-09-01'), new Date('2026-09-30'));

    expect(events.map((e) => e.externalId)).toEqual(['evt-1', 'evt-2']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://graph.microsoft.com/v1.0/me/calendarView?$skip=250');
  });

  it('resolves the default task list id from /me/todo/lists', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      value: [
        { id: 'list-other', wellknownListName: 'flaggedEmails' },
        { id: 'list-default', wellknownListName: 'defaultList' },
      ],
    })));
    vi.stubGlobal('fetch', fetchMock);

    const metadata = await microsoftProvider.resolveProviderMetadata!('token');

    expect(metadata).toEqual({ taskListId: 'list-default' });
  });

  it('throws a clear error when fetchTasks is called without a resolved taskListId', async () => {
    await expect(microsoftProvider.fetchTasks('token', new Date(), null)).rejects.toThrow(/taskListId/);
  });
});

describe('Microsoft push mechanism', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends only the changed fields on task update, mapping status correctly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await microsoftProvider.updateTask('token', 'task-1', { status: 'completed' }, { taskListId: 'list-1' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/todo/lists/list-1/tasks/task-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ status: 'completed' });
  });

  it('treats a 404 on task delete as success (already gone in Microsoft)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(microsoftProvider.deleteTask('token', 'task-1', { taskListId: 'list-1' })).resolves.toBeUndefined();
  });

  it('sends only the changed fields on event update, including a null end time when explicitly cleared', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await microsoftProvider.updateEvent('token', 'event-1', { title: 'New title', endTime: null });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/events/event-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ subject: 'New title', end: null });
  });

  it('strips the offset from start/end times, since Graph rejects anything but a bare local literal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await microsoftProvider.updateEvent('token', 'event-1', {
      startTime: '2026-09-15T09:00:00+00:00',
      endTime: '2026-09-15T09:30:00Z',
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      start: { dateTime: '2026-09-15T09:00:00', timeZone: 'UTC' },
      end: { dateTime: '2026-09-15T09:30:00', timeZone: 'UTC' },
    });
  });

  it('treats a 404 on event delete as success (already gone in Microsoft)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(microsoftProvider.deleteEvent('token', 'event-1')).resolves.toBeUndefined();
  });

  it('throws on a real delete failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('server error', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(microsoftProvider.deleteTask('token', 'task-1', { taskListId: 'list-1' })).rejects.toThrow(/500/);
  });

  it('throws a clear error when updateTask/deleteTask are called without a resolved taskListId', async () => {
    await expect(microsoftProvider.updateTask('token', 'task-1', { status: 'completed' }, null)).rejects.toThrow(/taskListId/);
    await expect(microsoftProvider.deleteTask('token', 'task-1', undefined)).rejects.toThrow(/taskListId/);
  });
});
