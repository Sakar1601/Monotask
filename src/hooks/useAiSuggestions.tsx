import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface TaskSuggestionPayload {
  title: string;
  description: string;
  due_date: string | null;
  due_time: string | null;
  priority: 'low' | 'medium' | 'high';
}

export interface RescheduleSuggestionPayload {
  event_id: string;
  other_event_id: string;
  current_start_time: string;
  current_end_time: string | null;
  suggested_start_time: string;
  suggested_end_time: string;
  reasoning: string;
}

interface AiSuggestionBase {
  id: string;
  created_at: string;
}

export type AiSuggestion =
  | (AiSuggestionBase & {
      kind: 'task';
      payload: TaskSuggestionPayload;
    })
  | (AiSuggestionBase & {
      kind: 'reschedule';
      payload: RescheduleSuggestionPayload;
    });

// The DB row's payload column is jsonb (typed as Json, not this union) -
// a straight `as AiSuggestion[]` cast would compile-error (the shapes
// don't overlap enough for TS to allow it) and, even if forced, would
// give no runtime protection against a malformed row reaching the UI as
// something like an `Invalid Date`. Validate structurally instead.
const isTaskPayload = (value: unknown): value is TaskSuggestionPayload => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.title === 'string' &&
    typeof v.description === 'string' &&
    (typeof v.due_date === 'string' || v.due_date === null) &&
    (typeof v.due_time === 'string' || v.due_time === null) &&
    (v.priority === 'low' || v.priority === 'medium' || v.priority === 'high')
  );
};

const isReschedulePayload = (value: unknown): value is RescheduleSuggestionPayload => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.event_id === 'string' &&
    typeof v.other_event_id === 'string' &&
    typeof v.current_start_time === 'string' &&
    (typeof v.current_end_time === 'string' || v.current_end_time === null) &&
    typeof v.suggested_start_time === 'string' &&
    typeof v.suggested_end_time === 'string' &&
    typeof v.reasoning === 'string'
  );
};

interface AiSuggestionRow {
  id: string;
  kind: string;
  payload: unknown;
  created_at: string;
}

function parseSuggestion(row: AiSuggestionRow): AiSuggestion | null {
  if (row.kind === 'task' && isTaskPayload(row.payload)) {
    return { id: row.id, created_at: row.created_at, kind: 'task', payload: row.payload };
  }
  if (row.kind === 'reschedule' && isReschedulePayload(row.payload)) {
    return { id: row.id, created_at: row.created_at, kind: 'reschedule', payload: row.payload };
  }
  return null;
}

export const useAiSuggestions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['ai-suggestions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('ai_suggestions')
        .select('id, kind, payload, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as AiSuggestionRow[])
        .map(parseSuggestion)
        .filter((s): s is AiSuggestion => s !== null);
    },
    enabled: !!user,
  });

  const setStatus = (id: string, status: 'accepted' | 'dismissed') =>
    supabase.from('ai_suggestions').update({ status }).eq('id', id);

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await setStatus(id, 'dismissed');
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-suggestions', user?.id] }),
    onError: () => toast.error('Could not dismiss suggestion'),
  });

  // "Accept" only marks the suggestion accepted here - the caller
  // (SuggestionsView) is responsible for actually creating the task or
  // updating the event first, through the existing task/event mutations,
  // exactly as parse-task's quick-add flow does. This hook never writes
  // to tasks/events itself.
  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await setStatus(id, 'accepted');
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-suggestions', user?.id] }),
    onError: () => toast.error('Could not accept suggestion'),
  });

  return {
    suggestions,
    isLoading,
    accept: acceptMutation.mutate,
    dismiss: dismissMutation.mutate,
    pendingCount: suggestions.length,
  };
};
