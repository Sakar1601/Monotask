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

export interface AiSuggestion {
  id: string;
  kind: 'task' | 'reschedule';
  payload: TaskSuggestionPayload | RescheduleSuggestionPayload;
  created_at: string;
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
      return data as AiSuggestion[];
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
