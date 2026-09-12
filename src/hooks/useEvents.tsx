import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Event {
  id: string;
  title: string;
  description?: string | null;
  start_time: string;
  end_time?: string | null;
  location?: string | null;
  meeting_url?: string | null;
  tag_id?: string | null;
  sync_connection_id?: string | null;
  external_event_id?: string | null;
  sync_provider?: 'google' | 'microsoft' | null;
  synced_at?: string | null;
  sync_error?: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  tags?: { name: string; color: string };
}

export const useEvents = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['events', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          tags:tag_id (name, color)
        `)
        .eq('user_id', user.id)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data as Event[];
    },
    enabled: !!user,
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'tags' | 'user_id'>) => {
      if (!user) throw new Error('User not authenticated');

      const processedEventData = {
        ...eventData,
        end_time: eventData.end_time || null,
        location: eventData.location || null,
        meeting_url: eventData.meeting_url || null,
        tag_id: eventData.tag_id || null,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('events')
        .insert([processedEventData])
        .select(`
          *,
          tags:tag_id (name, color)
        `)
        .single();

      if (error) throw error;
      return data as Event;
    },
    onSuccess: (newEvent) => {
      queryClient.setQueryData(['events', user?.id], (oldEvents: Event[] = []) => {
        return [...oldEvents, newEvent].sort((a, b) => a.start_time.localeCompare(b.start_time));
      });
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      toast.success('Event created successfully');
    },
    onError: (error) => {
      console.error('Event creation failed:', error);
      toast.error('Failed to create event');
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, tags, ...updates }: Partial<Event> & { id: string }) => {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          tags:tag_id (name, color)
        `)
        .single();

      if (error) throw error;
      return data as Event;
    },
    onSuccess: (updatedEvent) => {
      queryClient.setQueryData(['events', user?.id], (oldEvents: Event[] = []) => {
        return oldEvents.map((event) => (event.id === updatedEvent.id ? updatedEvent : event));
      });
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      toast.success('Event updated successfully');

      if (updatedEvent.sync_connection_id && updatedEvent.external_event_id) {
        supabase.functions
          .invoke('push-integration-change', {
            body: {
              type: 'event',
              action: 'update',
              connectionId: updatedEvent.sync_connection_id,
              externalId: updatedEvent.external_event_id,
              changes: {
                title: updatedEvent.title,
                description: updatedEvent.description ?? null,
                startTime: updatedEvent.start_time,
                endTime: updatedEvent.end_time ?? null,
                location: updatedEvent.location ?? null,
              },
            },
          })
          .then(({ error }) => {
            if (error) toast.error('Saved locally, but could not sync the change to Google');
            // Either way the row's sync_error/synced_at may have changed
            // server-side, so refetch to show (or clear) the failure badge.
            queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
          });
      }
    },
    onError: (error) => {
      console.error('Event update failed:', error);
      toast.error('Failed to update event');
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id: string) => {
      const existing = queryClient.getQueryData<Event[]>(['events', user?.id]);
      return { deletedEventSnapshot: existing?.find((e) => e.id === id) };
    },
    onSuccess: (deletedId, _variables, context) => {
      queryClient.setQueryData(['events', user?.id], (oldEvents: Event[] = []) => {
        return oldEvents.filter((event) => event.id !== deletedId);
      });
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      toast.success('Event deleted successfully');

      const snapshot = context?.deletedEventSnapshot;
      if (snapshot?.sync_connection_id && snapshot?.external_event_id) {
        supabase.functions
          .invoke('push-integration-change', {
            body: {
              type: 'event',
              action: 'delete',
              connectionId: snapshot.sync_connection_id,
              externalId: snapshot.external_event_id,
            },
          })
          .then(({ error }) => {
            if (error) toast.error('Deleted locally, but could not delete it in Google');
            queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
          });
      }
    },
    onError: (error) => {
      console.error('Event deletion failed:', error);
      toast.error('Failed to delete event');
    },
  });

  return {
    events,
    isLoading,
    error,
    createEvent: createEventMutation.mutate,
    createEventAsync: createEventMutation.mutateAsync,
    updateEvent: updateEventMutation.mutate,
    deleteEvent: deleteEventMutation.mutate,
    isCreating: createEventMutation.isPending,
    isUpdating: updateEventMutation.isPending,
    isDeleting: deleteEventMutation.isPending,
  };
};
