
import React from 'react';
import { Plus, Menu, Search } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface TopBarProps {
  onQuickAdd: () => void;
  currentView: string;
  onMenuClick?: () => void;
  onSearchClick?: () => void;
}

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 300, damping: 30 };

const TopBar: React.FC<TopBarProps> = ({ onQuickAdd, currentView, onMenuClick, onSearchClick }) => {
  const shouldReduceMotion = useReducedMotion();

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const viewTitles = {
    dashboard: 'Dashboard',
    tasks: 'Task Manager',
    calendar: 'Calendar',
    events: 'Events',
    habits: 'Habits',
    tags: 'Tags',
    progress: 'Progress & Analytics',
    suggestions: 'Suggestions',
    settings: 'Settings'
  };

  return (
    <div className="h-16 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 [@media(prefers-reduced-transparency:reduce)]:bg-background border-b border-border flex items-center justify-between gap-3 px-4 sm:px-6 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <motion.button
          onClick={onMenuClick}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
          transition={SPRING_SNAPPY}
          className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" strokeWidth={2} />
        </motion.button>
        <div className="min-w-0">
          {/* This is the page's one real heading - the view components
              below used to render their own second <h1> repeating this
              same text (e.g. "Task Manager" here AND "Task Manager" again
              as the first thing in the scrollable body), which was both a
              redundant-heading a11y issue and wasted vertical space for no
              new information. This h1 is now the single source of truth;
              each view's body starts directly with its subtitle/stats and
              primary action instead of re-announcing the title. */}
          <motion.h1
            key={currentView}
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="text-xl font-semibold font-grotesk tracking-tight text-foreground truncate"
          >
            {viewTitles[currentView as keyof typeof viewTitles]}
          </motion.h1>
          <p className="text-sm text-muted-foreground hidden sm:block truncate">{formattedDate}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
      {onSearchClick && (
        <button
          type="button"
          onClick={onSearchClick}
          className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="h-4 w-4" strokeWidth={1.75} />
          <span>Search anything...</span>
          <kbd className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            &#8984;K
          </kbd>
        </button>
      )}

      <motion.div
        whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
        transition={SPRING_SNAPPY}
        className="shrink-0"
      >
        <Button onClick={onQuickAdd} size="sm" className="px-3 sm:px-4">
          <motion.span
            whileHover={shouldReduceMotion ? undefined : { rotate: 90 }}
            transition={SPRING_SNAPPY}
            className="flex"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
          </motion.span>
          <span className="hidden sm:inline">Quick Add</span>
        </Button>
      </motion.div>
      </div>
    </div>
  );
};

export default TopBar;
