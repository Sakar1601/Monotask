import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface IntegrationConnection {
  id: string;
  provider: 'google';
  status: 'connected' | 'expired' | 'error' | 'disconnected' | 'needs_reconnect';
  calendar_sync_enabled: boolean;
  message_scan_enabled: boolean;
  last_synced_at: string | null;
  last_scanned_at: string | null;
  last_error: string | null;
}

export const useIntegrationConnections = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['integration-connections', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('integration_connections_view')
        .select('id, provider, status, calendar_sync_enabled, message_scan_enabled, last_synced_at, last_scanned_at, last_error')
        .neq('status', 'disconnected');
      if (error) throw error;
      return data as IntegrationConnection[];
    },
    enabled: !!user,
  });

  const connectGoogle = async () => {
    const { data, error } = await supabase.functions.invoke('integration-oauth-start', {
      body: { provider: 'google' },
    });
    if (error) {
      toast.error('Could not start Google connection');
      return;
    }
    window.location.href = data.url;
  };

  const disconnectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('integration_connections').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-connections', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
      toast.success('Disconnected');
    },
    onError: () => toast.error('Failed to disconnect'),
  });

  const syncNowMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke('sync-integrations', { body: { connection_id: id } });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-connections', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
      toast.success('Synced');
    },
    onError: () => toast.error('Sync failed'),
  });

  return {
    connections,
    isLoading,
    connectGoogle,
    disconnect: disconnectMutation.mutate,
    syncNow: syncNowMutation.mutate,
    isSyncing: syncNowMutation.isPending,
  };
};
