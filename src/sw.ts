import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// tsconfig.app.json targets the DOM, which clashes with the "webworker" lib,
// so the handful of worker-only members used here are declared locally.
interface PushEventLike extends Event {
  data: { json(): unknown } | null;
  waitUntil(promise: Promise<unknown>): void;
}
interface NotificationClickEventLike extends Event {
  notification: Notification;
  waitUntil(promise: Promise<unknown>): void;
}
interface WindowClientLike {
  url: string;
  focus(): Promise<unknown>;
  navigate?(url: string): Promise<unknown>;
}
interface WorkerScope {
  location: Location;
  registration: ServiceWorkerRegistration;
  clients: {
    matchAll(opts: { type: 'window'; includeUncontrolled: boolean }): Promise<WindowClientLike[]>;
    openWindow(url: string): Promise<unknown>;
  };
  skipWaiting(): Promise<void>;
  addEventListener<E extends Event>(type: string, listener: (event: E) => void): void;
}
const sw = self as unknown as WorkerScope;

// App shell: precached at build time. Supabase calls are cross-origin and
// intentionally not cached here, so task/event data is never stale.
// vite-plugin-pwa replaces the literal `self.__WB_MANIFEST` at build time.
declare const self: { __WB_MANIFEST: Array<string | { url: string; revision: string | null }> };
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-styles' })
);
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-files',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// registerType "prompt": the page asks for this once the user taps "Reload".
sw.addEventListener<MessageEvent>('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') sw.skipWaiting();
});

interface ReminderPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

sw.addEventListener<PushEventLike>('push', (event) => {
  let payload: ReminderPayload;
  try {
    payload = event.data?.json() as ReminderPayload;
  } catch {
    return;
  }
  if (!payload?.title) return;
  event.waitUntil(
    sw.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { url: payload.url ?? '/app' },
    })
  );
});

sw.addEventListener<NotificationClickEventLike>('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? '/app', sw.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((w) => new URL(w.url).origin === sw.location.origin);
      if (existing) {
        await existing.focus();
        if (existing.navigate && existing.url !== target) await existing.navigate(target);
        return;
      }
      await sw.clients.openWindow(target);
    })()
  );
});
