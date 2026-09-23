
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
          'relative w-full flex items-center px-3 py-2.5 text-sm rounded-md',
          isActive
            ? 'text-brand font-semibold'
            : 'text-muted-foreground font-medium hover:text-foreground hover:bg-accent'
        )}
      >
        {isActive && (
          <>
            <motion.span
              layoutId="sidebar-active-bg"
              className="absolute inset-0 rounded-md bg-brand/10 shadow-[0_0_20px_-6px_hsl(var(--brand)/0.5)]"
              transition={shouldReduceMotion ? { duration: 0 } : SPRING_SNAPPY}
            />
            <motion.span
              layoutId="sidebar-active-indicator"
              className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand shadow-[0_0_8px_hsl(var(--brand)/0.7)]"
              transition={shouldReduceMotion ? { duration: 0 } : SPRING_SNAPPY}
            />
          </>
        )}
        <motion.span
          style={shouldReduceMotion ? undefined : { x: springX, y: springY }}
          className="relative z-10 mr-3 flex shrink-0"
        >
          <Icon
            className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-brand' : 'text-muted-foreground')}
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
  const { signOut } = useAuth();
  const shouldReduceMotion = !!useReducedMotion();
  const isDesktop = useIsDesktop();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'events', label: 'Events', icon: CalendarClock },
    { id: 'habits', label: 'Habits', icon: Repeat },
    { id: 'tags', label: 'Tags', icon: Tag },
    { id: 'progress', label: 'Progress', icon: BarChart3 },
    { id: 'suggestions', label: 'Suggestions', icon: Sparkles },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

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
        <div className="p-6 border-b border-border shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold font-grotesk tracking-tight text-foreground">Monotask</h1>
            <p className="text-sm text-muted-foreground">Minimal productivity</p>
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
        <nav className="flex-1 p-3 overflow-y-auto min-h-0">
          <ul className="space-y-0.5">
            {menuItems.map((item, index) => (
              <SidebarNavItem
                key={item.id}
                id={item.id}
                label={item.label}
                icon={item.icon}
                isActive={currentView === item.id}
                badge={badges[item.id]}
                index={index}
                shouldReduceMotion={shouldReduceMotion}
                onSelect={handleSelect}
              />
            ))}
          </ul>
        </nav>

        <Separator />

        {/* User Section */}
        <div className="p-3 shrink-0">
          <motion.button
            onClick={signOut}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
            transition={SPRING_SNAPPY}
            className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors duration-150"
          >
            <LogOut className="mr-3 h-[18px] w-[18px] text-muted-foreground" strokeWidth={2} />
            Sign Out
          </motion.button>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
