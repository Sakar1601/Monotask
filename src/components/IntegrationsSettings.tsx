import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useIntegrationConnections, IntegrationConnection } from '@/hooks/useIntegrationConnections';

const PROVIDER_LABELS: Record<'google' | 'microsoft', string> = { google: 'Google', microsoft: 'Microsoft' };

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 300, damping: 30 };

/** A small pulsing dot that reads as "actively syncing" without a color-only cue. */
const SyncPulse: React.FC<{ shouldReduceMotion: boolean }> = ({ shouldReduceMotion }) => (
  <span className="relative flex h-2 w-2" aria-hidden="true">
    {shouldReduceMotion ? (
      <span className="inline-flex h-2 w-2 rounded-full bg-brand" />
    ) : (
      <>
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full bg-brand"
          animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
      </>
    )}
  </span>
);

interface ConnectionRowProps {
  label: string;
  connection: IntegrationConnection;
  isSyncing: boolean;
  onReconnect: (id: string) => void;
  onSync: (id: string) => void;
  onDisconnect: (id: string) => void;
  onToggleMessageScan: (connection: IntegrationConnection) => void;
}

const ConnectionRow: React.FC<ConnectionRowProps> = ({
  label,
  connection,
  isSyncing,
  onReconnect,
  onSync,
  onDisconnect,
  onToggleMessageScan,
}) => {
  const shouldReduceMotion = !!useReducedMotion();
  const prevStatusRef = useRef(connection.status);
  const [justSettled, setJustSettled] = useState(false);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = connection.status;
    if (prevStatus !== 'connected' && connection.status === 'connected') {
      setJustSettled(true);
      const timeout = window.setTimeout(() => setJustSettled(false), 1200);
      return () => window.clearTimeout(timeout);
    }
  }, [connection.status]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {connection.status === 'needs_reconnect' ? (
        <motion.div
          key="needs-reconnect"
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-center justify-between gap-3 p-3 bg-brand/5 border border-brand/30 rounded-md"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-brand mt-0.5 shrink-0" strokeWidth={2} />
            <div>
              <h3 className="font-medium text-foreground">
                {label}
                {connection.account_email && (
                  <span className="ml-2 font-normal text-sm text-muted-foreground">{connection.account_email}</span>
                )}
              </h3>
              <p className="text-sm text-muted-foreground">
                {label} needs new permissions for two-way sync.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => onReconnect(connection.id)} className="shrink-0">
            Reconnect
          </Button>
        </motion.div>
      ) : (
        <motion.div
          key="connected"
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 rounded-md transition-colors duration-500',
            justSettled && !shouldReduceMotion && 'bg-brand/5'
          )}
        >
          <div className="min-w-0">
            <h3 className="font-medium text-foreground flex items-center gap-1.5">
              {label}
              {connection.account_email && (
                <span className="font-normal text-sm text-muted-foreground break-all">{connection.account_email}</span>
              )}
              <AnimatePresence>
                {justSettled && (
                  <motion.span
                    initial={shouldReduceMotion ? undefined : { scale: 0, opacity: 0 }}
                    animate={shouldReduceMotion ? undefined : { scale: 1, opacity: 1 }}
                    exit={shouldReduceMotion ? undefined : { scale: 0, opacity: 0 }}
                    transition={SPRING_SNAPPY}
                  >
                    <CheckCircle2 className="h-4 w-4 text-brand" strokeWidth={2} />
                  </motion.span>
                )}
              </AnimatePresence>
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              {isSyncing && <SyncPulse shouldReduceMotion={shouldReduceMotion} />}
              {isSyncing
                ? 'Syncing...'
                : connection.status === 'connected'
                  ? connection.last_synced_at
                    ? `Last synced ${new Date(connection.last_synced_at).toLocaleString()}`
                    : 'Connected, not yet synced'
                  : `Status: ${connection.status}${connection.last_error ? ` - ${connection.last_error}` : ''}`}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Switch
                id={`message-scan-${connection.id}`}
                checked={connection.message_scan_enabled}
                onCheckedChange={() => onToggleMessageScan(connection)}
              />
              <Label htmlFor={`message-scan-${connection.id}`} className="text-sm font-normal text-muted-foreground cursor-pointer">
                Scan messages for task suggestions
              </Label>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" disabled={isSyncing} onClick={() => onSync(connection.id)}>
              {isSyncing ? 'Syncing...' : 'Sync now'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDisconnect(connection.id)}
            >
              Disconnect
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
  onToggleMessageScan: (connection: IntegrationConnection) => void;
}

const ProviderSection: React.FC<ProviderSectionProps> = ({
  provider,
  connections,
  syncingConnectionId,
  onConnect,
  onReconnect,
  onSync,
  onDisconnect,
  onToggleMessageScan,
}) => {
  const label = PROVIDER_LABELS[provider];

  if (connections.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-medium text-foreground">{label}</h3>
          <p className="text-sm text-muted-foreground">Not connected</p>
        </div>
        <Button variant="outline" onClick={onConnect} className="shrink-0">Connect {label}</Button>
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
          onToggleMessageScan={onToggleMessageScan}
        />
      ))}
      <Button variant="ghost" size="sm" onClick={onConnect}>
        + Connect another {label} account
      </Button>
    </div>
  );
};

const IntegrationsSettings: React.FC = () => {
  const { connections, isLoading, connectGoogle, connectMicrosoft, reconnect, toggleMessageScan, disconnect, syncNow, syncingConnectionId } =
    useIntegrationConnections();
  const googleConnections = connections.filter((c) => c.provider === 'google');
  const microsoftConnections = connections.filter((c) => c.provider === 'microsoft');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Integrations</CardTitle>
        <CardDescription>
          Connect one or more Google or Microsoft accounts to bring their calendar events and tasks into Monotask, fully editable here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="h-4 w-1/4 rounded bg-muted" />
          </div>
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
              onToggleMessageScan={toggleMessageScan}
            />
            <Separator />
            <ProviderSection
              provider="microsoft"
              connections={microsoftConnections}
              syncingConnectionId={syncingConnectionId}
              onConnect={connectMicrosoft}
              onReconnect={(id) => reconnect('microsoft', id)}
              onSync={syncNow}
              onDisconnect={disconnect}
              onToggleMessageScan={toggleMessageScan}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default IntegrationsSettings;
