import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ExternalEvent {
  id: string;
  connection_id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  meeting_url: string | null;
}

export const useExternalEvents = () => {
  const { user } = useAuth();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['external-events', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('external_events')
        .select('id, connection_id, title, start_time, end_time, meeting_url')
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data as ExternalEvent[];
    },
    enabled: !!user,
  });

  return { events, isLoading };
};
