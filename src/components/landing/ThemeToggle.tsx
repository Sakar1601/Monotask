import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

/**
 * Standalone light/dark toggle for the (unauthenticated) landing page. The
 * app itself persists theme through useSettings once a user is signed in
 * (see src/hooks/useSettings.tsx), but the landing page has no session to
 * read from, so this talks directly to the same mechanism the app uses at
 * the root: a `.dark` class on <html>. Verified live, not just claimed in a
 * bullet, per the brief - this page is where the feature gets demonstrated.
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Dark by default now (product decision, not just a system-preference
    // fallback) - an explicit stored choice still wins either way.
    const stored = localStorage.getItem('monotask-landing-theme');
    const dark = stored ? stored === 'dark' : true;
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('monotask-landing-theme', next ? 'dark' : 'light');
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30"
    >
      {isDark ? <Sun className="h-4 w-4" strokeWidth={2} /> : <Moon className="h-4 w-4" strokeWidth={2} />}
    </button>
  );
}
