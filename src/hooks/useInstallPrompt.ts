import { useCallback, useEffect, useState } from 'react';

// Not in lib.dom yet - only Chromium-based browsers fire it.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallState =
  | 'installed' // already running as an installed app
  | 'promptable' // browser can show its native install dialog
  | 'ios-manual' // iOS Safari: only Share -> Add to Home Screen works
  | 'unavailable'; // not installable here (or the browser hasn't offered it yet)

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // iOS Safari doesn't support the media query above for home-screen apps.
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS 13+ reports itself as a Mac.
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const useInstallPrompt = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // Stop the mini-infobar so our own button is the one entry point.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event can only be used once, whatever the user chose.
    setDeferred(null);
    return outcome;
  }, [deferred]);

  const state: InstallState = installed
    ? 'installed'
    : deferred
      ? 'promptable'
      : isIos()
        ? 'ios-manual'
        : 'unavailable';

  return { state, install };
};
