import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ExternalTask {
  id: string;
  connection_id: string;
  title: string;
  due_date: string | null;
  status: 'pending' | 'completed';
  source_url: string | null;
}

export const useExternalTasks = () => {
  const { user } = useAuth();

  const { data: externalTasks = [], isLoading } = useQuery({
    queryKey: ['external-tasks', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('external_tasks')
        .select('id, connection_id, title, due_date, status, source_url')
        .eq('status', 'pending')
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as ExternalTask[];
    },
    enabled: !!user,
  });

  return { externalTasks, isLoading };
};
