import React from 'react';
import { Button } from '@/components/ui/button';
import { useIntegrationConnections, IntegrationConnection } from '@/hooks/useIntegrationConnections';

const PROVIDER_LABELS: Record<'google' | 'microsoft', string> = { google: 'Google', microsoft: 'Microsoft' };

interface ConnectionRowProps {
  label: string;
  connection: IntegrationConnection;
  isSyncing: boolean;
  onReconnect: (id: string) => void;
  onSync: (id: string) => void;
  onDisconnect: (id: string) => void;
}

const ConnectionRow: React.FC<ConnectionRowProps> = ({ label, connection, isSyncing, onReconnect, onSync, onDisconnect }) => {
  if (connection.status === 'needs_reconnect') {
    return (
      <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-md">
        <div>
          <h3 className="font-medium text-foreground">
            {label}
            {connection.account_email && (
              <span className="ml-2 font-normal text-sm text-muted-foreground">{connection.account_email}</span>
            )}
          </h3>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {label} needs new permissions for two-way sync.
          </p>
        </div>
        <Button size="sm" onClick={() => onReconnect(connection.id)} className="bg-amber-600 hover:bg-amber-700 text-white">
          Reconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-medium text-foreground">
          {label}
          {connection.account_email && (
            <span className="ml-2 font-normal text-sm text-muted-foreground">{connection.account_email}</span>
          )}
        </h3>
        <p className="text-sm text-muted-foreground">
          {connection.status === 'connected'
            ? connection.last_synced_at
              ? `Last synced ${new Date(connection.last_synced_at).toLocaleString()}`
              : 'Connected, not yet synced'
            : `Status: ${connection.status}${connection.last_error ? ` — ${connection.last_error}` : ''}`}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={isSyncing} onClick={() => onSync(connection.id)}>
          {isSyncing ? 'Syncing...' : 'Sync now'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive/10"
          onClick={() => onDisconnect(connection.id)}
        >
          Disconnect
        </Button>
      </div>
    </div>
  );
};

interface ProviderSectionProps {
  provider: 'google' | 'microsoft';
  connections: IntegrationConnection[];
  syncingConnectionId: string | undefined;
  onConnect: () => void;
  onReconnect: (id: string) => void;
  onSync: (id: string) => void;
  onDisconnect: (id: string) => void;
}

const ProviderSection: React.FC<ProviderSectionProps> = ({
  provider,
  connections,
  syncingConnectionId,
  onConnect,
  onReconnect,
  onSync,
  onDisconnect,
}) => {
  const label = PROVIDER_LABELS[provider];

  if (connections.length === 0) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-foreground">{label}</h3>
          <p className="text-sm text-muted-foreground">Not connected</p>
        </div>
        <Button onClick={onConnect}>Connect {label}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {connections.map((connection) => (
        <ConnectionRow
          key={connection.id}
          label={label}
          connection={connection}
          isSyncing={connection.id === syncingConnectionId}
          onReconnect={onReconnect}
          onSync={onSync}
          onDisconnect={onDisconnect}
        />
      ))}
      <Button variant="ghost" size="sm" onClick={onConnect}>
        + Connect another {label} account
      </Button>
    </div>
  );
};

const IntegrationsSettings: React.FC = () => {
  const { connections, isLoading, connectGoogle, connectMicrosoft, reconnect, disconnect, syncNow, syncingConnectionId } =
    useIntegrationConnections();
  const googleConnections = connections.filter((c) => c.provider === 'google');
  const microsoftConnections = connections.filter((c) => c.provider === 'microsoft');

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Integrations</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Connect one or more Google or Microsoft accounts to bring their calendar events and tasks into Monotask, fully editable here.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-4">
          <ProviderSection
            provider="google"
            connections={googleConnections}
            syncingConnectionId={syncingConnectionId}
            onConnect={connectGoogle}
            onReconnect={(id) => reconnect('google', id)}
            onSync={syncNow}
            onDisconnect={disconnect}
          />
          <div className="border-t border-border pt-4">
            <ProviderSection
              provider="microsoft"
              connections={microsoftConnections}
              syncingConnectionId={syncingConnectionId}
              onConnect={connectMicrosoft}
              onReconnect={(id) => reconnect('microsoft', id)}
              onSync={syncNow}
              onDisconnect={disconnect}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrationsSettings;
