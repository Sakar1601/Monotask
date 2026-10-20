import React from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useNotifications, type NotificationState } from '@/hooks/useNotifications';

const DESCRIPTIONS: Record<NotificationState, string> = {
  loading: 'Checking notification status...',
  unsupported: "This browser doesn't support push notifications.",
  'needs-install':
    'On iPhone and iPad, notifications only work once Monotask is added to your Home Screen. Install it above, then open it from there.',
  denied: 'Notifications are blocked. Allow them for this site in your browser settings, then come back.',
  off: 'Get reminders for tasks at their due time, events 15 minutes before they start, and habits at their preferred time.',
  on: "On for this device. You'll get reminders even when Monotask is closed.",
};

const NotificationsCard: React.FC = () => {
  const { state, busy, error, enable, disable } = useNotifications();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Notifications</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-foreground">Push reminders</h3>
            <p className="text-sm text-muted-foreground">{DESCRIPTIONS[state]}</p>
            {error && (
              <p role="alert" className="mt-1 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          {state === 'off' && (
            <Button variant="outline" onClick={enable} disabled={busy} className="shrink-0">
              <Bell className="w-4 h-4 mr-2" strokeWidth={2} />
              Turn on
            </Button>
          )}
          {state === 'on' && (
            <Button variant="outline" onClick={disable} disabled={busy} className="shrink-0">
              <BellOff className="w-4 h-4 mr-2" strokeWidth={2} />
              Turn off
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationsCard;
