
import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  CalendarClock,
  BarChart3,
  Settings,
  Repeat,
  LogOut,
  Tag,
  Sparkles,
  X
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  badges?: Record<string, number>;
}

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 300, damping: 30 };

/** Tracks the md breakpoint so mobile drawer physics never fight the desktop static layout. */
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isDesktop;
};

interface NavItemProps {
  id: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  badge?: number;
  index: number;
  shouldReduceMotion: boolean;
  onSelect: (id: string) => void;
}

const SidebarNavItem: React.FC<NavItemProps> = ({ id, label, icon: Icon, isActive, badge, index, shouldReduceMotion, onSelect }) => {
  // Small magnetic pull on hover, driven by motion values so re-renders never touch React state.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const springX = useSpring(mx, { stiffness: 300, damping: 20, mass: 0.5 });
  const springY = useSpring(my, { stiffness: 300, damping: 20, mass: 0.5 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (shouldReduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    const max = 4;
    mx.set(Math.max(-max, Math.min(max, relX * 0.15)));
    my.set(Math.max(-max, Math.min(max, relY * 0.4)));
  };

  const handleMouseLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.li
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 4 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
    >
      <motion.button
        onClick={() => onSelect(id)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
        transition={SPRING_SNAPPY}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'relative w-full flex items-center px-3 py-2 text-sm rounded-lg',
          isActive
            ? 'text-foreground font-medium'
            : 'text-muted-foreground font-medium hover:text-foreground hover:bg-accent/60'
        )}
      >
        {isActive && (
          <>
            <motion.span
              layoutId="sidebar-active-bg"
              className="absolute inset-0 rounded-md bg-accent"
              transition={shouldReduceMotion ? { duration: 0 } : SPRING_SNAPPY}
            />
            <motion.span
              layoutId="sidebar-active-indicator"
              className="absolute -left-3 top-2 bottom-2 w-0.5 rounded-full bg-foreground"
              transition={shouldReduceMotion ? { duration: 0 } : SPRING_SNAPPY}
            />
          </>
        )}
        <motion.span
          style={shouldReduceMotion ? undefined : { x: springX, y: springY }}
          className="relative z-10 mr-3 flex shrink-0"
        >
          <Icon
            className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-foreground' : 'text-muted-foreground')}
            strokeWidth={2}
          />
        </motion.span>
        <span className="relative z-10">{label}</span>
        {!!badge && (
          <Badge
            variant="secondary"
            className="relative z-10 ml-auto h-5 min-w-5 justify-center px-1.5 font-mono tabular-nums text-[11px] font-semibold"
          >
            {badge}
          </Badge>
        )}
      </motion.button>
    </motion.li>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, isOpen = false, onClose, badges = {} }) => {
  const { user, signOut } = useAuth();
  const shouldReduceMotion = !!useReducedMotion();
  const isDesktop = useIsDesktop();

  const menuGroups = [
    {
      label: 'Plan',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare },
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'events', label: 'Events', icon: CalendarClock },
        { id: 'habits', label: 'Habits', icon: Repeat },
      ],
    },
    {
      label: 'Insights',
      items: [
        { id: 'suggestions', label: 'Suggestions', icon: Sparkles },
        { id: 'progress', label: 'Progress', icon: BarChart3 },
      ],
    },
    {
      label: 'Manage',
      items: [
        { id: 'tags', label: 'Tags', icon: Tag },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  const displayName = user?.is_anonymous ? 'Guest' : (user?.email?.split('@')[0] ?? 'Account');
  const initial = displayName.charAt(0).toUpperCase();

  const handleSelect = (view: string) => {
    onViewChange(view);
    onClose?.();
  };

  return (
    <>
      {/* Mobile drawer scrim - glass tint since it's a floating overlay layer, not primary content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="sidebar-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm supports-[backdrop-filter]:bg-black/40 [@media(prefers-reduced-transparency:reduce)]:bg-black/70 [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-0 md:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Mobile: animated drawer via spring physics. Desktop (md+): static, always visible. */}
      <motion.aside
        initial={false}
        animate={{ x: isDesktop || isOpen ? 0 : -288 }}
        transition={shouldReduceMotion ? { duration: 0 } : SPRING_SNAPPY}
        className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col h-screen shrink-0 md:static md:sticky md:top-0"
      >
        {/* Logo */}
        <div className="h-16 sm:h-24 px-5 border-b border-border shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground">
              <CheckSquare className="h-5 w-5 text-background" />
            </span>
            <p className="text-xl font-semibold font-grotesk tracking-tight text-foreground">Monotask</p>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-1 text-muted-foreground hover:text-foreground rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto min-h-0 space-y-6">
          {menuGroups.map((group, gi) => (
            <div key={group.label}>
              <p className="px-3 mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item, index) => (
                  <SidebarNavItem
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    icon={item.icon}
                    isActive={currentView === item.id}
                    badge={badges[item.id]}
                    index={gi * 5 + index}
                    shouldReduceMotion={shouldReduceMotion}
                    onSelect={handleSelect}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <Separator />

        {/* User Section */}
        <div className="p-3 shrink-0">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.is_anonymous ? 'Guest account' : user?.email}
              </p>
            </div>
            <motion.button
              onClick={signOut}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
              transition={SPRING_SNAPPY}
              aria-label="Sign out"
              title="Sign out"
              className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
            </motion.button>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
