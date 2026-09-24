
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, CheckCircle2, XCircle, Clock, Pencil, Trash2, PauseCircle, Flame, Repeat, Grid3x3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHabits, Habit, HabitLog } from '@/hooks/useHabits';
import HabitModal from '@/components/HabitModal';
import ConfirmDialog from '@/components/ConfirmDialog';

const toDateStr = (d: Date) => d.toISOString().split('T')[0];

// Last 7 calendar days ending today (not necessarily Mon-start - a trailing
// window reads more naturally than a fixed week for a "what have I actually
// done lately" glance, and avoids an empty-looking grid early in a new
// ISO week). Real data only: every cell comes from `logs`, already loaded
// in full by useHabits with no date bound, so this needs no new query.
const getTrailing7Days = (): { date: string; label: string }[] => {
  const days: { date: string; label: string }[] = [];
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ date: toDateStr(d), label: dayLabels[d.getDay()] });
  }
  return days;
};

// A per-habit weekly grid: one cell per day, filled for completed, a dash
// for skipped, dim/empty for missed or not-yet-logged. Additive context
// next to the existing Done/Skip/Miss buttons below, not a replacement for
// them - today's own log is still logged the same way it always was.
const WeeklyHabitGrid: React.FC<{ habitId: string; logs: HabitLog[]; reduceMotion: boolean }> = ({
  habitId,
  logs,
  reduceMotion,
}) => {
  const days = getTrailing7Days();
  const logsByDate = new Map(
    logs.filter((l) => l.habit_id === habitId).map((l) => [l.date, l.status])
  );
  const today = toDateStr(new Date());

  return (
    <div className="flex items-center gap-1.5" role="img" aria-label="Last 7 days">
      {days.map((day, i) => {
        const status = logsByDate.get(day.date);
        const isFuture = day.date > today;
        return (
          <motion.div
            key={day.date}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15, delay: reduceMotion ? 0 : i * 0.03 }}
            title={`${day.date}${status ? `: ${status}` : ''}`}
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-[4px] border text-[10px] font-medium transition-colors',
              status === 'completed' && 'border-primary bg-primary text-primary-foreground',
              status === 'skipped' && 'border-border bg-muted text-muted-foreground',
              status === 'failed' && 'border-destructive/40 bg-destructive/10 text-destructive',
              !status && !isFuture && 'border-dashed border-border/60 text-transparent',
              !status && isFuture && 'border-transparent text-transparent'
            )}
          >
            {status === 'completed' && '✓'}
            {status === 'skipped' && '–'}
          </motion.div>
        );
      })}
    </div>
  );
};

// 30-day density grid across ALL habits (not per-habit) - each cell is a
// real calendar day, shaded by how many habits were completed that day
// relative to how many active habits existed to complete, using the exact
// same hsl(var(--primary) / opacity) intensity technique ProgressView's
// activity heatmap already uses (see src/components/ProgressView.tsx),
// reused here rather than inventing a second shading approach.
const ConsistencyMatrix: React.FC<{ logs: HabitLog[]; activeHabitCount: number; reduceMotion: boolean }> = ({
  logs,
  activeHabitCount,
  reduceMotion,
}) => {
  const days: { date: string; dayOfMonth: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ date: toDateStr(d), dayOfMonth: d.getDate() });
  }

  const completedCountByDate = new Map<string, number>();
  logs.forEach((log) => {
    if (log.status !== 'completed') return;
    completedCountByDate.set(log.date, (completedCountByDate.get(log.date) || 0) + 1);
  });

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-1 flex items-center gap-2">
          <Grid3x3 className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          <h3 className="text-base font-semibold text-foreground">Consistency matrix</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          30-day density across all active habits
        </p>
        <div className="grid max-w-xl grid-cols-10 gap-1.5 sm:grid-cols-[repeat(15,minmax(0,1fr))]">
          {days.map((day, i) => {
            const count = completedCountByDate.get(day.date) || 0;
            const intensity = activeHabitCount > 0 ? Math.min(count / activeHabitCount, 1) : 0;
            const opacity = intensity > 0 ? Math.max(0.15, intensity) : 0;
            return (
              <motion.div
                key={day.date}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15, delay: reduceMotion ? 0 : Math.min(i, 30) * 0.01 }}
                title={`${day.date}: ${count} of ${activeHabitCount} habits`}
                className="flex aspect-square items-center justify-center rounded-md border border-border/60 text-[10px] font-medium tabular-nums text-muted-foreground transition-colors"
                style={{
                  backgroundColor: opacity > 0 ? `hsl(var(--primary) / ${opacity})` : undefined,
                  color: opacity > 0.5 ? 'hsl(var(--primary-foreground))' : undefined,
                }}
              >
                {day.dayOfMonth}
              </motion.div>
            );
          })}
        </div>
        <div className="mt-4 flex max-w-xl items-center justify-end gap-2 text-[11px] text-muted-foreground">
          <span>Less</span>
          {[0.15, 0.4, 0.7, 1].map((o) => (
            <span
              key={o}
              className="h-3 w-3 rounded-[3px] border border-border/60"
              style={{ backgroundColor: `hsl(var(--primary) / ${o})` }}
            />
          ))}
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
};

const STATUS_BADGE: Record<string, string> = {
  completed: 'border-transparent bg-primary/15 text-primary',
  skipped: 'border-transparent bg-muted text-muted-foreground',
  failed: 'border-transparent bg-destructive/15 text-destructive',
};

// Consecutive-day streak of completed logs, walking back from today (or
// yesterday, so a not-yet-logged today doesn't zero out an active streak).
const computeStreak = (habitId: string, logs: HabitLog[]): number => {
  const completedDates = new Set(
    logs.filter(log => log.habit_id === habitId && log.status === 'completed').map(log => log.date)
  );
  if (completedDates.size === 0) return 0;

  const toDateStr = (d: Date) => d.toISOString().split('T')[0];
  const today = new Date();
  const cursor = new Date(today);
  if (!completedDates.has(toDateStr(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!completedDates.has(toDateStr(cursor))) return 0;
  }

  let streak = 0;
  while (completedDates.has(toDateStr(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

// Round-number streaks (weekly, monthly) get a bigger, one-off celebratory
// flourish on the flame instead of the usual calm idle pulse.
const isMilestoneStreak = (streak: number) => streak > 0 && (streak % 30 === 0 || streak % 7 === 0);

const HabitRow: React.FC<{
  habit: Habit;
  index: number;
  todayLog?: HabitLog;
  streak: number;
  logs: HabitLog[];
  isLogging: boolean;
  isDeleting: boolean;
  reduceMotion: boolean;
  getFrequencyDisplay: (habit: Habit) => string;
  onLog: (habitId: string, status: 'completed' | 'skipped' | 'failed') => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habitId: string) => void;
}> = ({ habit, index, todayLog, streak, logs, isLogging, isDeleting, reduceMotion, getFrequencyDisplay, onLog, onEdit, onDelete }) => {
  const prevStreak = useRef(streak);
  const [celebrate, setCelebrate] = useState(false);
  const prevStatus = useRef(todayLog?.status);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    if (streak > prevStreak.current && isMilestoneStreak(streak)) {
      setCelebrate(true);
      const timer = setTimeout(() => setCelebrate(false), 900);
      prevStreak.current = streak;
      return () => clearTimeout(timer);
    }
    prevStreak.current = streak;
  }, [streak]);

  // Brief acknowledgment pulse on the row itself whenever a habit is freshly
  // marked done, separate from the bigger milestone-streak flourish above.
  useEffect(() => {
    if (todayLog?.status === 'completed' && prevStatus.current !== 'completed') {
      setJustCompleted(true);
      const timer = setTimeout(() => setJustCompleted(false), 500);
      prevStatus.current = todayLog?.status;
      return () => clearTimeout(timer);
    }
    prevStatus.current = todayLog?.status;
  }, [todayLog?.status]);

  return (
    <motion.div
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={
        reduceMotion
          ? { opacity: 1, y: 0 }
          : justCompleted
            ? {
                opacity: 1,
                y: 0,
                scale: [1, 1.015, 1],
                boxShadow: [
                  '0 0 0 2px hsl(var(--primary) / 0)',
                  '0 0 0 2px hsl(var(--primary) / 0.4)',
                  '0 0 0 2px hsl(var(--primary) / 0)',
                ],
              }
            : { opacity: 1, y: 0, scale: 1, boxShadow: '0 0 0 2px hsl(var(--primary) / 0)' }
      }
      exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.97 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={
        justCompleted && !reduceMotion
          ? { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
          : { duration: 0.2, ease: [0.16, 1, 0.3, 1], delay: reduceMotion ? 0 : Math.min(index, 8) * 0.06 }
      }
      className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/40"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h3 className="truncate text-lg font-medium text-foreground">
              {habit.name}
            </h3>
            {streak > 0 && (
              <motion.span
                animate={
                  reduceMotion
                    ? undefined
                    : celebrate
                      ? { scale: [1, 1.5, 1.1, 1.3, 1], rotate: [0, -10, 8, -4, 0] }
                      : { scale: [1, 1.08, 1] }
                }
                transition={
                  celebrate
                    ? { duration: 0.9, ease: [0.16, 1, 0.3, 1] }
                    : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
                }
                className={cn(
                  'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-sm font-medium tabular-nums text-primary',
                  celebrate && 'shadow-[0_0_16px_-2px_hsl(var(--primary)/0.6)]'
                )}
              >
                <Flame className="h-4 w-4" strokeWidth={2} />
                {streak} day{streak !== 1 ? 's' : ''}
              </motion.span>
            )}
            {habit.tags && (
              <Badge
                className="flex-shrink-0 border-transparent text-xs text-white"
                style={{ backgroundColor: habit.tags.color }}
              >
                {habit.tags.name}
              </Badge>
            )}
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {habit.preferred_time && (
              <span className="flex items-center gap-1 tabular-nums">
                <Clock className="h-4 w-4" strokeWidth={2} />
                {habit.preferred_time}
              </span>
            )}
            <Badge variant="outline" className="text-xs font-normal">
              {getFrequencyDisplay(habit)}
            </Badge>
            {todayLog && (
              <Badge className={cn('text-xs font-normal', STATUS_BADGE[todayLog.status])}>
                {todayLog.status}
              </Badge>
            )}
          </div>

          {habit.description && (
            <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
              {habit.description}
            </p>
          )}

          <div className="flex gap-2">
            <motion.button
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={() => onLog(habit.id, 'completed')}
              disabled={isLogging || todayLog?.status === 'completed'}
              className={cn(
                'inline-flex h-8 items-center justify-center gap-1 rounded-md px-3 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-70',
                todayLog?.status === 'completed'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
              Done
            </motion.button>

            <motion.button
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={() => onLog(habit.id, 'skipped')}
              disabled={isLogging || todayLog?.status === 'skipped'}
              className={cn(
                'inline-flex h-8 items-center justify-center gap-1 rounded-md bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:pointer-events-none disabled:opacity-70',
                todayLog?.status === 'skipped' && 'bg-muted-foreground/20'
              )}
            >
              <PauseCircle className="h-3 w-3" strokeWidth={2} />
              Skip
            </motion.button>

            <motion.button
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={() => onLog(habit.id, 'failed')}
              disabled={isLogging || todayLog?.status === 'failed'}
              className={cn(
                'inline-flex h-8 items-center justify-center gap-1 rounded-md bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:pointer-events-none disabled:opacity-70',
                todayLog?.status === 'failed' && 'bg-destructive/15 text-destructive hover:bg-destructive/20'
              )}
            >
              <XCircle className="h-3 w-3" strokeWidth={2} />
              Miss
            </motion.button>
          </div>

          <div className="mt-3">
            <WeeklyHabitGrid habitId={habit.id} logs={logs} reduceMotion={reduceMotion} />
          </div>
        </div>

        <div className="ml-4 flex items-center gap-1">
          <motion.button
            whileTap={reduceMotion ? undefined : { scale: 0.9 }}
            onClick={() => onEdit(habit)}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Edit habit"
            aria-label="Edit habit"
          >
            <Pencil className="h-4 w-4" strokeWidth={2} />
          </motion.button>
          <motion.button
            whileTap={reduceMotion ? undefined : { scale: 0.9 }}
            onClick={() => onDelete(habit.id)}
            disabled={isDeleting}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Delete habit"
            aria-label="Delete habit"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

const HabitsListSkeleton: React.FC = () => (
  <div className="space-y-3">
    {[0, 1, 2].map((i) => (
      <div key={i} className="rounded-lg border border-border bg-card p-4">
        <Skeleton className="mb-3 h-5 w-1/3" />
        <Skeleton className="mb-3 h-3 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-16" />
        </div>
      </div>
    ))}
  </div>
);

const HabitsView: React.FC = () => {
  const { habits, logs, logHabit, deleteHabit, isLogging, isDeleting, isLoading } = useHabits();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; habitId?: string }>({ isOpen: false });
  const reduceMotion = useReducedMotion();

  const handleCreateHabit = () => {
    setSelectedHabit(null);
    setIsModalOpen(true);
  };

  const handleEditHabit = (habit: Habit) => {
    setSelectedHabit(habit);
    setIsModalOpen(true);
  };

  const handleDeleteHabit = (habitId: string) => {
    setDeleteConfirm({ isOpen: true, habitId });
  };

  const confirmDelete = () => {
    if (deleteConfirm.habitId) {
      deleteHabit(deleteConfirm.habitId);
    }
  };

  const handleLogHabit = (habitId: string, status: 'completed' | 'skipped' | 'failed') => {
    logHabit({ habitId, status });
  };

  const getTodayLog = (habitId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return logs.find(log => log.habit_id === habitId && log.date === today);
  };

  const getFrequencyDisplay = (habit: Habit) => {
    if (habit.frequency === 'daily') return 'Daily';
    if (habit.frequency === 'weekly') {
      if (habit.frequency_days && habit.frequency_days.length > 0) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const days = habit.frequency_days.map(day => dayNames[day - 1]).join(', ');
        return `Weekly (${days})`;
      }
      return 'Weekly';
    }
    if (habit.frequency === 'monthly') return 'Monthly';
    return habit.frequency;
  };

  // Sort habits by preferred_time, then by created_at
  const sortedHabits = [...habits].sort((a, b) => {
    if (a.preferred_time && b.preferred_time) {
      return a.preferred_time.localeCompare(b.preferred_time);
    }
    if (a.preferred_time && !b.preferred_time) return -1;
    if (!a.preferred_time && b.preferred_time) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <HabitsListSkeleton />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          {/* TopBar already renders "Habits" as the page h1. */}
          <p className="text-[15px] text-muted-foreground">
            Track your daily habits and build consistency
          </p>
        </div>
        <Button onClick={handleCreateHabit} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" strokeWidth={2} />
          New habit
        </Button>
      </div>

      {habits.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Repeat className="h-6 w-6" strokeWidth={2} />
            </div>
            <h3 className="font-grotesk text-base font-medium text-foreground">
              No habits yet
            </h3>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              Create your first habit to start building consistency, one day at a time.
            </p>
            <Button onClick={handleCreateHabit}>
              <Plus className="mr-2 h-4 w-4" strokeWidth={2} />
              Create first habit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {sortedHabits.map((habit, index) => (
              <HabitRow
                key={habit.id}
                habit={habit}
                index={index}
                todayLog={getTodayLog(habit.id)}
                streak={computeStreak(habit.id, logs)}
                logs={logs}
                isLogging={isLogging}
                isDeleting={isDeleting}
                reduceMotion={!!reduceMotion}
                getFrequencyDisplay={getFrequencyDisplay}
                onLog={handleLogHabit}
                onEdit={handleEditHabit}
                onDelete={handleDeleteHabit}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {habits.length > 0 && (
        <div className="mt-6">
          <ConsistencyMatrix
            logs={logs}
            activeHabitCount={habits.filter((h) => h.is_active).length}
            reduceMotion={!!reduceMotion}
          />
        </div>
      )}

      <HabitModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedHabit(null);
        }}
        habit={selectedHabit}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false })}
        onConfirm={confirmDelete}
        title="Delete Habit"
        message="Are you sure you want to delete this habit? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
};

export default HabitsView;
