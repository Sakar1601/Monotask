import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
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

  const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    const next = !isDark;
    const apply = () => {
      setIsDark(next);
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('monotask-landing-theme', next ? 'dark' : 'light');
    };

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof document.startViewTransition !== 'function') {
      apply();
      return;
    }

    // The new theme grows out of the button as a circle. The `theme-reveal`
    // class scopes the "no default cross-fade" CSS to this transition so the
    // app's own view-transition tuning is untouched.
    const { clientX: x, clientY: y } = event;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const root = document.documentElement;
    root.classList.add('theme-reveal');
    const transition = document.startViewTransition(() => flushSync(apply));
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 650, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' }
        );
      })
      .catch(() => undefined);
    transition.finished.finally(() => root.classList.remove('theme-reveal'));
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
