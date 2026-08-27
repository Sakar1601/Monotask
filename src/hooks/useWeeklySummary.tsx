import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface WeeklySummaryResponse {
  summary: string;
  stats: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    completionRate: number;
    topTag: string | null;
    habitCompletions: number;
    habitRate: number;
  };
}

export const useWeeklySummary = (enabled: boolean) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['weekly-summary', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('weekly-summary');

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as WeeklySummaryResponse;
    },
    enabled: enabled && !!user,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
};
