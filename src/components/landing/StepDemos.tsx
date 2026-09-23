import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { CalendarClock, Repeat, Check, Flame, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Per-step visuals for the "three steps" sticky-stack. Each pinned card used
 * to hold only an icon, a heading, and one sentence, centered in an
 * otherwise empty full-viewport-height slide - impressive on paper, a void
 * on a real screen. These give each step a small real recreation of the app
 * it is describing, in the same "built from actual app styling" spirit as
 * AIShowcase / RecurringDemo / SyncDiagram, so the pinned time is spent
 * looking at something rather than waiting past blank space.
 */

export function AddStepDemo() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });

  const rows = [
    { icon: CalendarClock, label: 'Fri, 3:00 PM' },
    { icon: Repeat, label: 'Every 2 weeks' },
  ];

  return (
    <div ref={ref} className="mx-auto w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-left sm:p-6">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">New task</p>
      <motion.p
        initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="mb-4 text-base font-medium text-foreground"
      >
        Draft the Q3 proposal
      </motion.p>
      <div className="space-y-2.5">
        {rows.map((row, i) => {
          const Icon = row.icon;
          return (
            <motion.div
              key={row.label}
              initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.27 + i * 0.12 }}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              {row.label}
            </motion.div>
          );
        })}
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.51 }}
          className="flex items-center gap-2 pt-1"
        >
          <Badge variant="secondary" className="font-normal">High priority</Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#3b6fa0' }} />
            Work
          </span>
        </motion.div>
      </div>
    </div>
  );
}

export function CheckOffStepDemo() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });

  const tasks = [
    { label: 'Draft the Q3 proposal', done: true },
    { label: 'Reply to design thread', done: false },
    { label: 'Book dentist appointment', done: false },
  ];
  const states: { label: string; state: 'done' | 'skipped' | 'missed' }[] = [
    { label: 'M', state: 'done' },
    { label: 'T', state: 'done' },
    { label: 'W', state: 'skipped' },
    { label: 'T', state: 'missed' },
  ];

  return (
    <div className="mx-auto grid w-full max-w-xl gap-4 text-left sm:grid-cols-2">
      <div ref={ref} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Today</p>
        <div className="space-y-2.5">
          {tasks.map((task, i) => (
            <motion.div
              key={task.label}
              initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.35, delay: i * 0.1 }}
              className="flex items-center gap-2.5"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                  task.done ? 'border-foreground bg-foreground text-background' : 'border-border text-transparent'
                }`}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className={`text-sm ${task.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                {task.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Morning run</p>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Flame className="h-3.5 w-3.5" strokeWidth={2} />
            12 day streak
          </span>
        </div>
        <div className="flex items-center gap-2">
          {states.map((day, i) => (
            <motion.div
              key={`${day.label}-${i}`}
              initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.35, delay: i * 0.1 }}
              className="flex flex-col items-center gap-1.5"
            >
              <span className="text-[11px] text-muted-foreground">{day.label}</span>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-medium ${
                  day.state === 'done'
                    ? 'bg-foreground text-background'
                    : day.state === 'skipped'
                      ? 'border border-border text-muted-foreground'
                      : 'border border-dashed border-border text-muted-foreground/60'
                }`}
              >
                {day.state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : day.state === 'skipped' ? 'S' : 'M'}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PatternStepDemo() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });

  // A quiet month grid, not the real current month - the point is the shape
  // of the view, not the accuracy of any given date.
  const cells = Array.from({ length: 35 }, (_, i) => {
    const day = i - 2; // month starts on a Wednesday in this mock
    const inMonth = day >= 1 && day <= 30;
    const hasTask = inMonth && [2, 5, 9, 14, 18, 21, 27].includes(day);
    const isToday = day === 14;
    return { day, inMonth, hasTask, isToday };
  });

  return (
    <div ref={ref} className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-5 text-left sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          <CalendarDays className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
          March
        </span>
        <div className="flex items-center gap-1 rounded-md bg-muted p-0.5 text-[11px] text-muted-foreground">
          <span className="rounded bg-background px-2 py-0.5 text-foreground shadow-sm">Month</span>
          <span className="px-2 py-0.5">Week</span>
          <span className="px-2 py-0.5">Agenda</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell, i) => (
          <motion.div
            key={i}
            initial={reduceMotion ? undefined : { opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.3, delay: Math.min(i, 20) * 0.02 }}
            className={`flex aspect-square items-center justify-center rounded-md text-[10px] ${
              !cell.inMonth
                ? 'text-transparent'
                : cell.isToday
                  ? 'bg-foreground font-medium text-background'
                  : cell.hasTask
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground'
            }`}
          >
            {cell.inMonth ? cell.day : '.'}
          </motion.div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Recurring tasks show up on every occurrence, not just the day they were created.
      </p>
    </div>
  );
}
