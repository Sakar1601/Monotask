
import { parseDateOnly } from '@/utils/dateOnly';
import { quoteForDate } from '@/utils/dailyQuote';
import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Calendar, CheckCircle2, Target, TrendingUp, AlertTriangle, Sparkles, Quote, ArrowRight } from 'lucide-react';
import { useTasks, formatDateLocal } from '@/hooks/useTasks';
import { useHabits } from '@/hooks/useHabits';
import { useAiSuggestions } from '@/hooks/useAiSuggestions';
import { Button } from '@/components/ui/button';
import TodaySchedule from '@/components/TodaySchedule';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const priorityBadgeClass = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    case 'medium':
      return 'border-primary/30 bg-primary/10 text-primary';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
};

const StatCard: React.FC<{ label: string; value: number | string; icon: React.ReactNode; progress?: number }> = ({
  label,
  value,
  icon,
  progress,
}) => {
  const prefersReducedMotion = useReducedMotion();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  };

  return (
    <motion.div
      variants={
        prefersReducedMotion
          ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
          : { hidden: { opacity: 0, y: 16, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1 } }
      }
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      whileHover={prefersReducedMotion ? undefined : { y: -2 }}
      onMouseMove={prefersReducedMotion ? undefined : handleMouseMove}
      className="group relative h-full"
    >
      <Card className="relative h-full overflow-hidden transition-colors duration-300 hover:border-foreground/25">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: 'radial-gradient(220px circle at var(--spot-x, 50%) var(--spot-y, 50%), hsl(var(--primary) / 0.12), transparent 70%)',
          }}
        />
        <CardContent className="relative p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
              <p className="mt-2 font-grotesk text-4xl font-semibold tracking-[-0.03em] tabular-nums text-foreground">{value}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
              {icon}
            </div>
          </div>
          {progress !== undefined && (
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={prefersReducedMotion ? { width: `${progress}%` } : { width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: prefersReducedMotion ? 0 : 0.2 }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="space-y-2">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-72" />
    </div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  </div>
);

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

interface DashboardProps {
  onNavigate?: (view: string) => void;
  onAddTask?: () => void;
  onOpenPalette?: () => void;
  paletteUsed?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onAddTask, onOpenPalette, paletteUsed = false }) => {
  const { pendingCount } = useAiSuggestions();
  const { tasks, isLoading: tasksLoading } = useTasks();
  const { habits, isLoading: habitsLoading } = useHabits();
  const prefersReducedMotion = useReducedMotion();

  const isLoading = tasksLoading || habitsLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Calculate statistics from real data
  const completedTasksToday = tasks.filter(task => {
    if (task.status !== 'completed' || !task.completed_at) return false;
    const today = new Date().toDateString();
    const completedDate = new Date(task.completed_at).toDateString();
    return today === completedDate;
  }).length;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const pendingTasks = tasks.filter(task => task.status === 'pending').length;
  // Date-only comparison, matching useTasks' getOverdueTasks: a task due
  // today is not overdue just because part of today has already passed.
  const todayLocal = formatDateLocal(new Date());
  const overdueTasks = tasks.filter(task => {
    if (task.status === 'completed' || !task.due_date) return false;
    return task.due_date < todayLocal;
  }).length;

  const upcomingTasks = tasks
    .filter(task => task.status === 'pending' && task.due_date)
    .sort((a, b) => parseDateOnly(a.due_date!).getTime() - parseDateOnly(b.due_date!).getTime())
    .slice(0, 5);

  const recentlyCompleted = tasks
    .filter(task => task.status === 'completed' && task.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
    .slice(0, 3);

  const activeHabits = habits.filter(habit => habit.is_active).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Real due-today completion, not just a raw "completed today" count - how
  // many of the tasks actually due today are done, so the stat card's
  // progress bar means something concrete rather than an arbitrary fill.
  const dueToday = tasks.filter(task => task.due_date === todayLocal);
  const dueTodayCompleted = dueToday.filter(task => task.status === 'completed').length;
  const dueTodayPercent = dueToday.length > 0 ? Math.round((dueTodayCompleted / dueToday.length) * 100) : 0;

  const listVariants = {
    hidden: {},
    show: {
      transition: { staggerChildren: prefersReducedMotion ? 0 : 0.05 },
    },
  };
  const itemVariants = prefersReducedMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };
  const statsGridVariants = {
    hidden: {},
    show: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.07 } },
  };
  const sectionTransition = { duration: prefersReducedMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={sectionTransition}
      >
        <h1 className="font-grotesk text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">{greeting()}</h1>
        <p className="mt-1.5 text-muted-foreground">Here's what's happening with your tasks today.</p>
        {onNavigate && onAddTask && onOpenPalette && (
          <div className="mt-6">
            <OnboardingChecklist
              onNavigate={onNavigate}
              onAddTask={onAddTask}
              onOpenPalette={onOpenPalette}
              paletteUsed={paletteUsed}
            />
          </div>
        )}
        <figure className="mt-6 flex items-start gap-4 rounded-xl border border-border bg-card px-5 py-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Quote className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <figcaption className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Thought for today
            </figcaption>
            <blockquote className="mt-1 font-grotesk text-lg font-medium leading-snug text-foreground sm:text-xl">
              &ldquo;{quoteForDate()}&rdquo;
            </blockquote>
          </div>
        </figure>
      </motion.div>

      {/* Pending AI suggestions: the product's differentiator, surfaced on home */}
      {pendingCount > 0 && onNavigate && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={sectionTransition}
          className="flex flex-col gap-4 rounded-xl border border-foreground/20 bg-foreground/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
              <Sparkles className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <p className="font-grotesk text-lg font-medium text-foreground">
                {pendingCount} suggestion{pendingCount !== 1 ? 's' : ''} waiting for your review
              </p>
              <p className="text-sm text-muted-foreground">
                Found in your messages and calendar. Accept the useful ones, dismiss the rest.
              </p>
            </div>
          </div>
          <Button onClick={() => onNavigate('suggestions')} className="w-full shrink-0 sm:w-auto">
            Review
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>
      )}

      {/* Stats Grid */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={statsGridVariants}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          label="Due today"
          value={dueToday.length > 0 ? `${dueTodayCompleted}/${dueToday.length}` : completedTasksToday}
          icon={<CheckCircle2 className="h-5 w-5" strokeWidth={1.75} />}
          progress={dueToday.length > 0 ? dueTodayPercent : undefined}
        />
        <StatCard label="Total tasks" value={totalTasks} icon={<Target className="h-5 w-5" strokeWidth={1.75} />} />
        <StatCard label="Pending" value={pendingTasks} icon={<Calendar className="h-5 w-5" strokeWidth={1.75} />} />
        <StatCard label="Active habits" value={activeHabits} icon={<TrendingUp className="h-5 w-5" strokeWidth={1.75} />} />
      </motion.div>

      {/* Today: meetings and tasks on one timeline */}
      <TodaySchedule onNavigate={onNavigate} />

      {/* Overdue Tasks Alert */}
      {overdueTasks > 0 && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 transition-colors"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" strokeWidth={1.75} />
          <div>
            <h3 className="text-sm font-medium text-destructive">
              {overdueTasks} overdue task{overdueTasks !== 1 ? 's' : ''}
            </h3>
            <p className="mt-1 text-sm text-destructive/80">
              You have tasks that are past their due date.
            </p>
          </div>
        </motion.div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming Tasks */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20, delay: prefersReducedMotion ? 0 : 0.1 }}
        >
          <Card>
            <CardContent className="p-6">
              <h2 className="font-grotesk text-lg font-semibold text-foreground">Upcoming tasks</h2>
              {upcomingTasks.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Sparkles className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
                  <p className="text-sm text-muted-foreground">Nothing upcoming. You're all caught up.</p>
                </div>
              ) : (
                <motion.div
                  variants={listVariants}
                  initial="hidden"
                  animate="show"
                  className="mt-4 space-y-2"
                >
                  <AnimatePresence initial={false}>
                    {upcomingTasks.map((task) => (
                      <motion.div
                        key={task.id}
                        layout={!prefersReducedMotion}
                        variants={itemVariants}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -8, transition: { duration: 0.15 } }}
                        whileHover={prefersReducedMotion ? undefined : { y: -1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        style={task.due_date ? { viewTransitionName: `task-row-${task.id}-${task.due_date}` } : undefined}
                        className="flex items-center justify-between gap-3 rounded-md bg-muted/60 p-3 transition-colors hover:bg-muted"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-medium text-foreground">{task.title}</h3>
                          <div className="mt-1 flex items-center gap-2 text-sm tabular-nums text-muted-foreground">
                            <span>{task.due_date ? parseDateOnly(task.due_date).toLocaleDateString() : 'No date'}</span>
                            {task.due_time && <span>at {task.due_time}</span>}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="outline" className={`capitalize ${priorityBadgeClass(task.priority)}`}>
                            {task.priority}
                          </Badge>
                          {task.tags && (
                            <span
                              className="rounded-full px-2 py-1 text-xs font-medium text-white"
                              style={{ backgroundColor: task.tags.color }}
                            >
                              {task.tags.name}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recently Completed */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20, delay: prefersReducedMotion ? 0 : 0.16 }}
        >
          <Card>
            <CardContent className="p-6">
              <h2 className="font-grotesk text-lg font-semibold text-foreground">Recently completed</h2>
              {recentlyCompleted.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <CheckCircle2 className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
                  <p className="text-sm text-muted-foreground">No completed tasks yet.</p>
                </div>
              ) : (
                <motion.div
                  variants={listVariants}
                  initial="hidden"
                  animate="show"
                  className="mt-4 space-y-2"
                >
                  <AnimatePresence initial={false}>
                    {recentlyCompleted.map((task) => (
                      <motion.div
                        key={task.id}
                        layout={!prefersReducedMotion}
                        variants={itemVariants}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -8, transition: { duration: 0.15 } }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        style={task.due_date ? { viewTransitionName: `task-row-${task.id}-${task.due_date}` } : undefined}
                        className="flex items-center justify-between gap-3 rounded-md bg-muted/60 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-medium text-foreground line-through opacity-70">{task.title}</h3>
                          <span className="text-sm tabular-nums text-muted-foreground">
                            Completed {task.completed_at ? new Date(task.completed_at).toLocaleDateString() : ''}
                          </span>
                        </div>
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Stats */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20, delay: prefersReducedMotion ? 0 : 0.22 }}
      >
      <Card>
        <CardContent className="p-6">
          <h2 className="font-grotesk text-lg font-semibold text-foreground">Quick overview</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="text-center">
              <div className="font-grotesk text-2xl font-bold tabular-nums text-foreground">{completedTasks}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="font-grotesk text-2xl font-bold tabular-nums text-foreground">{pendingTasks}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
            <div className="text-center">
              <div className="font-grotesk text-2xl font-bold tabular-nums text-primary">{completionRate}%</div>
              <div className="text-sm text-muted-foreground">Completion rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
      </motion.div>
    </div>
  );
};

export default Dashboard;
