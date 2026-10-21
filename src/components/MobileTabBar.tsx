import React, { useState } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Repeat,
  MoreHorizontal,
  CalendarClock,
  Sparkles,
  BarChart3,
  Tag,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useReducedMotion, motion } from 'framer-motion';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface MobileTabBarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  badges?: Record<string, number>;
}

interface Destination {
  id: string;
  label: string;
  icon: LucideIcon;
}

// Thumb-reach destinations get a tab; everything else lives behind "More".
const TABS: Destination[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'habits', label: 'Habits', icon: Repeat },
];

const MORE: Destination[] = [
  { id: 'events', label: 'Events', icon: CalendarClock },
  { id: 'suggestions', label: 'Suggestions', icon: Sparkles },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
  { id: 'tags', label: 'Tags', icon: Tag },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 300, damping: 30 };

const TabButton: React.FC<{
  label: string;
  icon: LucideIcon;
  active: boolean;
  dot?: boolean;
  onClick: () => void;
  shouldReduceMotion: boolean;
}> = ({ label, icon: Icon, active, dot, onClick, shouldReduceMotion }) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
    transition={SPRING_SNAPPY}
    aria-current={active ? 'page' : undefined}
    className={cn(
      'relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
      active ? 'text-foreground' : 'text-muted-foreground'
    )}
  >
    {active && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-foreground" aria-hidden="true" />}
    <span className="relative">
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.25 : 1.75} />
      {dot && <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-foreground ring-2 ring-card" aria-hidden="true" />}
    </span>
    <span>{label}</span>
  </motion.button>
);

/** Phone-only bottom navigation (hidden from md up, where the sidebar takes over). */
const MobileTabBar: React.FC<MobileTabBarProps> = ({ currentView, onViewChange, badges = {} }) => {
  const { user, signOut } = useAuth();
  const shouldReduceMotion = !!useReducedMotion();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = MORE.some((d) => d.id === currentView);
  const moreBadge = MORE.reduce((sum, d) => sum + (badges[d.id] ?? 0), 0);
  const displayName = user?.is_anonymous ? 'Guest' : (user?.email?.split('@')[0] ?? 'Account');

  const go = (view: string) => {
    setMoreOpen(false);
    onViewChange(view);
  };

  return (
    <>
      <nav
        aria-label="Primary"
        className="flex shrink-0 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:hidden"
      >
        {TABS.map((tab) => (
          <TabButton
            key={tab.id}
            label={tab.label}
            icon={tab.icon}
            active={currentView === tab.id}
            onClick={() => onViewChange(tab.id)}
            shouldReduceMotion={shouldReduceMotion}
          />
        ))}
        <TabButton
          label="More"
          icon={MoreHorizontal}
          active={moreActive || moreOpen}
          dot={moreBadge > 0}
          onClick={() => setMoreOpen(true)}
          shouldReduceMotion={shouldReduceMotion}
        />
      </nav>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent className="pb-[env(safe-area-inset-bottom)]">
          <DrawerHeader className="text-left">
            <DrawerTitle>More</DrawerTitle>
            <DrawerDescription className="sr-only">Other sections of Monotask</DrawerDescription>
          </DrawerHeader>
          <ul className="px-3 pb-2">
            {MORE.map((item) => {
              const Icon = item.icon;
              const active = currentView === item.id;
              const badge = badges[item.id];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => go(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-[3rem] w-full items-center gap-3 rounded-lg px-3 text-left text-base font-medium transition-colors active:bg-accent',
                      active ? 'bg-accent text-foreground' : 'text-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <span className="flex-1">{item.label}</span>
                    {!!badge && (
                      <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 font-mono tabular-nums text-[11px] font-semibold">
                        {badge}
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" strokeWidth={1.75} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mx-3 mb-3 mt-1 flex items-center gap-3 rounded-lg border border-border p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.is_anonymous ? 'Guest account' : user?.email}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              className="shrink-0 rounded-md p-2.5 text-muted-foreground transition-colors active:bg-accent"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default MobileTabBar;
