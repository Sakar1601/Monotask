import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface IntegrationConnection {
  id: string;
  provider: 'google' | 'microsoft';
  status: 'connected' | 'expired' | 'error' | 'disconnected' | 'needs_reconnect';
  calendar_sync_enabled: boolean;
  message_scan_enabled: boolean;
  last_synced_at: string | null;
  last_scanned_at: string | null;
  last_error: string | null;
  account_email: string | null;
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
        .select('id, provider, status, calendar_sync_enabled, message_scan_enabled, last_synced_at, last_scanned_at, last_error, account_email')
        .neq('status', 'disconnected');
      if (error) throw error;
      return data as IntegrationConnection[];
    },
    enabled: !!user,
  });

  // connectionId is only passed for "Reconnect" on an existing connection -
  // the callback then updates that exact row instead of adding a new one.
  // Omitting it (a fresh "Connect", or "Connect another account") always
  // creates a new connection, which is what allows more than one account
  // per provider.
  const startOAuth = async (provider: 'google' | 'microsoft', errorMessage: string, connectionId?: string) => {
    const { data, error } = await supabase.functions.invoke('integration-oauth-start', {
      body: { provider, connectionId },
    });
    if (error) {
      toast.error(errorMessage);
      return;
    }
    window.location.href = data.url;
  };

  const connectGoogle = () => startOAuth('google', 'Could not start Google connection');
  const connectMicrosoft = () => startOAuth('microsoft', 'Could not start Microsoft connection');
  const reconnect = (provider: 'google' | 'microsoft', connectionId: string) =>
    startOAuth(provider, `Could not reconnect ${provider === 'microsoft' ? 'Microsoft' : 'Google'}`, connectionId);

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
    connectMicrosoft,
    reconnect,
    disconnect: disconnectMutation.mutate,
    syncNow: syncNowMutation.mutate,
    // Which connection id is currently syncing, if any - so each provider
    // row can show its own "Syncing..." state instead of both rows
    // reacting to any sync, regardless of which one was clicked.
    syncingConnectionId: syncNowMutation.isPending ? syncNowMutation.variables : undefined,
  };
};
