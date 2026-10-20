import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';

// How often an open (e.g. installed, long-lived) app re-checks for a new deploy.
const UPDATE_CHECK_MS = 60 * 60 * 1000;

/** Registers the service worker and offers a reload when a new version has been deployed. */
const PwaUpdatePrompt = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => registration.update().catch(() => {}), UPDATE_CHECK_MS);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast('A new version of Monotask is available', {
      id: 'pwa-update',
      duration: Infinity,
      action: { label: 'Reload', onClick: () => updateServiceWorker(true) },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
};

export default PwaUpdatePrompt;
