import { beforeEach, describe, expect, it, vi } from 'vitest';

const useQuery = vi.hoisted(() => vi.fn());
const useMutation = vi.hoisted(() => vi.fn());
const useQueryClient = vi.hoisted(() => vi.fn());
const useAuth = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock('@tanstack/react-query', () => ({ useQuery, useMutation, useQueryClient }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));
vi.mock('./useAuth', () => ({ useAuth }));
vi.mock('sonner', () => ({ toast }));

import { useAiSuggestions, type AiSuggestion } from './useAiSuggestions';

const suggestion: AiSuggestion = {
  id: 'suggestion-1',
  kind: 'task',
  payload: {
    title: 'Send report',
    description: 'Send the report to the team',
    due_date: '2026-09-15',
    due_time: null,
    priority: 'high',
  },
  created_at: '2026-09-13T12:00:00Z',
};

describe('useAiSuggestions', () => {
  const invalidateQueries = vi.fn();
  const mutationOptions: Array<Record<string, any>> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mutationOptions.length = 0;
    useAuth.mockReturnValue({ user: { id: 'user-1' } });
    useQueryClient.mockReturnValue({ invalidateQueries });
    useQuery.mockReturnValue({ data: [suggestion], isLoading: false });
    useMutation.mockImplementation((options: Record<string, any>) => {
      mutationOptions.push(options);
      return { mutate: vi.fn() };
    });
  });

  it('returns pending suggestions and configures a user-scoped query', () => {
    const result = useAiSuggestions();

    expect(result).toEqual({
      suggestions: [suggestion],
      isLoading: false,
      accept: expect.any(Function),
      dismiss: expect.any(Function),
      pendingCount: 1,
    });
    expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: ['ai-suggestions', 'user-1'],
      enabled: true,
    }));
  });

  it('fetches only pending suggestions ordered newest first', async () => {
    const order = vi.fn().mockResolvedValue({ data: [suggestion], error: null });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    from.mockReturnValue({ select });

    useAiSuggestions();
    const queryConfig = useQuery.mock.calls[0][0];

    await expect(queryConfig.queryFn()).resolves.toEqual([suggestion]);
    expect(from).toHaveBeenCalledWith('ai_suggestions');
    expect(select).toHaveBeenCalledWith('id, kind, payload, created_at');
    expect(eq).toHaveBeenCalledWith('status', 'pending');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('marks accepted and dismissed suggestions, invalidating pending results', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    from.mockReturnValue({ update });

    useAiSuggestions();
    await mutationOptions[0].mutationFn('suggestion-1');
    await mutationOptions[0].onSuccess();
    await mutationOptions[1].mutationFn('suggestion-1');
    await mutationOptions[1].onSuccess();

    expect(update).toHaveBeenNthCalledWith(1, { status: 'dismissed' });
    expect(update).toHaveBeenNthCalledWith(2, { status: 'accepted' });
    expect(eq).toHaveBeenNthCalledWith(1, 'id', 'suggestion-1');
    expect(eq).toHaveBeenNthCalledWith(2, 'id', 'suggestion-1');
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['ai-suggestions', 'user-1'] });
  });

  it('shows an error toast when accepting or dismissing fails', async () => {
    const eq = vi.fn().mockResolvedValue({ error: new Error('failed') });
    const update = vi.fn().mockReturnValue({ eq });
    from.mockReturnValue({ update });

    useAiSuggestions();
    await expect(mutationOptions[0].mutationFn('suggestion-1')).rejects.toThrow('failed');
    await mutationOptions[0].onError();
    await expect(mutationOptions[1].mutationFn('suggestion-1')).rejects.toThrow('failed');
    await mutationOptions[1].onError();

    expect(toast.error).toHaveBeenNthCalledWith(1, 'Could not dismiss suggestion');
    expect(toast.error).toHaveBeenNthCalledWith(2, 'Could not accept suggestion');
  });
});
