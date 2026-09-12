import React from 'react';
import { Button } from '@/components/ui/button';
import { useIntegrationConnections } from '@/hooks/useIntegrationConnections';

const PROVIDER_LABELS: Record<string, string> = { google: 'Google' };

const IntegrationsSettings: React.FC = () => {
  const { connections, isLoading, connectGoogle, disconnect, syncNow, isSyncing } = useIntegrationConnections();
  const googleConnection = connections.find((c) => c.provider === 'google');

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Integrations</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Connect your Google account to bring its calendar events and tasks into Monotask, fully editable here.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : googleConnection?.status === 'needs_reconnect' ? (
        <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-md">
          <div>
            <h3 className="font-medium text-foreground">Google</h3>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Google needs new permissions for two-way sync.
            </p>
          </div>
          <Button size="sm" onClick={connectGoogle} className="bg-amber-600 hover:bg-amber-700 text-white">
            Reconnect
          </Button>
        </div>
      ) : googleConnection ? (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-foreground">Google</h3>
            <p className="text-sm text-muted-foreground">
              {googleConnection.status === 'connected'
                ? googleConnection.last_synced_at
                  ? `Last synced ${new Date(googleConnection.last_synced_at).toLocaleString()}`
                  : 'Connected, not yet synced'
                : `Status: ${googleConnection.status}${googleConnection.last_error ? ` — ${googleConnection.last_error}` : ''}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={isSyncing} onClick={() => syncNow(googleConnection.id)}>
              {isSyncing ? 'Syncing...' : 'Sync now'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => disconnect(googleConnection.id)}
            >
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-foreground">Google</h3>
            <p className="text-sm text-muted-foreground">Not connected</p>
          </div>
          <Button onClick={connectGoogle}>Connect {PROVIDER_LABELS.google}</Button>
        </div>
      )}
    </div>
  );
};

export default IntegrationsSettings;
