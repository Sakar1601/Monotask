import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isIos, isStandalone } from '@/hooks/useInstallPrompt';

export type NotificationState =
  | 'loading'
  | 'unsupported' // browser (or missing VAPID key) can't do Web Push
  | 'needs-install' // iOS only delivers push to apps added to the Home Screen
  | 'denied' // permission blocked in browser settings
  | 'off'
  | 'on';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const urlBase64ToUint8Array = (base64: string) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const getBrowserSubscription = async () => {
  const registration = await navigator.serviceWorker.ready;
  return { registration, subscription: await registration.pushManager.getSubscription() };
};

export const useNotifications = () => {
  const { user } = useAuth();
  const [state, setState] = useState<NotificationState>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Works out the real state: browser subscription AND a saved row for this
  // user (a different account may have used this browser before).
  const refresh = useCallback(async () => {
    if (!pushSupported() || !VAPID_PUBLIC_KEY) {
      setState(isIos() && !isStandalone() ? 'needs-install' : 'unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    if (!user) {
      setState('off');
      return;
    }
    try {
      const { subscription } = await getBrowserSubscription();
      if (!subscription) {
        setState('off');
        return;
      }
      const { data } = await supabase
        .from('push_subscriptions')
        .select('id, timezone')
        .eq('endpoint', subscription.endpoint)
        .maybeSingle();
      if (!data) {
        setState('off');
        return;
      }
      setState('on');
      // Keep reminder times correct after travelling or a zone change.
      const zone = deviceTimeZone();
      if (data.timezone !== zone) {
        await supabase.from('push_subscriptions').update({ timezone: zone }).eq('id', data.id);
      }
    } catch {
      setState('off');
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const { registration, subscription: existing } = await getBrowserSubscription();
      // Always mint a fresh endpoint: reusing one that another account saved
      // earlier on this browser would collide with that account's row.
      if (existing) await existing.unsubscribe();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = subscription.toJSON();
      const { error: saveError } = await supabase.from('push_subscriptions').insert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
        timezone: deviceTimeZone(),
      });
      if (saveError) {
        await subscription.unsubscribe();
        throw saveError;
      }
      setState('on');
      await registration.showNotification('Notifications are on', {
        body: "You'll get reminders for tasks, events and habits.",
        icon: '/pwa-192.png',
        badge: '/pwa-192.png',
      });
    } catch (e) {
      console.error('Enabling notifications failed:', e);
      setError('Could not turn on notifications. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [user]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { subscription } = await getBrowserSubscription();
      if (subscription) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState('off');
    } catch (e) {
      console.error('Disabling notifications failed:', e);
      setError('Could not turn off notifications. Please try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, error, enable, disable };
};
