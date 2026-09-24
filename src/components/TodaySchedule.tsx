import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, CalendarDays, MapPin, PartyPopper } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useTaskInstances } from '@/hooks/useTaskInstances';
import { useEvents } from '@/hooks/useEvents';
import { useCompleteWithUndo } from '@/hooks/useCompleteWithUndo';
import { buildTodayFlow, TaskFlowItem } from '@/utils/todayFlow';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PROVIDER_LABEL = { google: 'Google', microsoft: 'Outlook' } as const;

function CheckBox({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        checked ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground/50'
      )}
    >
      {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </button>
  );
}

/** Confetti-lite: small monochrome squares that fly out once, when the last task is completed. */
function Celebration() {
  const pieces = Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2;
    return { x: Math.cos(angle) * (70 + (i % 3) * 25), y: Math.sin(angle) * (50 + (i % 4) * 15), r: (i * 47) % 180 };
  });
  return (
    <div aria-hidden className="pointer-events-none absolute right-8 top-8">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className={cn('absolute h-2 w-2 rounded-[2px]', i % 3 === 0 ? 'bg-foreground' : 'bg-foreground/40')}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.4, rotate: p.r }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  );
}

interface TodayScheduleProps {
  onNavigate?: (view: string) => void;
  /** Hide the card entirely on days with nothing scheduled (used on the Calendar page). */
  hideWhenEmpty?: boolean;
}

const TodaySchedule: React.FC<TodayScheduleProps> = ({ onNavigate, hideWhenEmpty }) => {
  const reduceMotion = useReducedMotion();
  const { tasks } = useTasks();
  const { instances } = useTaskInstances();
  const { events } = useEvents();
  const complete = useCompleteWithUndo();

  // Re-evaluate every minute so the "now" marker keeps moving.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const flow = useMemo(() => buildTodayFlow(tasks, instances, events, now), [tasks, instances, events, now]);

  const allTasksDone = flow.taskTotal > 0 && flow.done === flow.taskTotal;

  // Celebrate only on the transition to done, never on first load.
  const prevAllDone = useRef<boolean | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (prevAllDone.current === false && allTasksDone && !reduceMotion) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 1400);
      return () => clearTimeout(t);
    }
    prevAllDone.current = allTasksDone;
  }, [allTasksDone, reduceMotion]);

  if (hideWhenEmpty && flow.total === 0) return null;

  const dateLabel = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const renderTask = (item: TaskFlowItem, withTime: boolean) => (
    <div key={item.id} className="relative flex items-center gap-4 py-2.5">
      {withTime && <span className="absolute -left-[25px] h-2 w-2 rounded-full border-2 border-border bg-background" />}
      {withTime && <span className="w-[4.5rem] shrink-0 text-sm tabular-nums text-muted-foreground">{item.timeLabel}</span>}
      <CheckBox
        checked={item.completed}
        label={`${item.completed ? 'Mark incomplete' : 'Complete'}: ${item.title}`}
        onToggle={() => complete(item.occurrence)}
      />
      <span className={cn('flex-1 truncate text-sm font-medium text-foreground', item.completed && 'text-muted-foreground line-through')}>
        {item.title}
      </span>
    </div>
  );

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-grotesk text-xl font-semibold tracking-[-0.02em] text-foreground">Today</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {dateLabel}
              {flow.eventCount > 0 && (
                <>
                  {' '}&middot; <span className="tabular-nums">{flow.eventCount}</span> {flow.eventCount === 1 ? 'meeting' : 'meetings'}
                </>
              )}
              {flow.taskTotal > 0 && (
                <>
                  {' '}&middot; <span className="tabular-nums">{flow.done}</span> of <span className="tabular-nums">{flow.taskTotal}</span> tasks done
                </>
              )}
            </p>
          </div>
          {onNavigate && (
            <Button variant="ghost" size="sm" onClick={() => onNavigate('calendar')} className="text-muted-foreground">
              <CalendarDays className="mr-2 h-4 w-4" strokeWidth={1.75} />
              Open calendar
            </Button>
          )}
        </div>

        {flow.total === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CalendarDays className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <p className="font-grotesk text-base font-medium text-foreground">A clear day</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Nothing scheduled for today. Add a task, or connect Google or Outlook to see your meetings here.
            </p>
          </div>
        ) : (
          <div className="mt-5">
            <AnimatePresence>
              {allTasksDone && (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3"
                >
                  <PartyPopper className="h-5 w-5 text-foreground" strokeWidth={1.75} />
                  <p className="text-sm font-medium text-foreground">All done for today. Nice work.</p>
                </motion.div>
              )}
            </AnimatePresence>

            {flow.rows.length > 0 && (
              <div className="relative space-y-0 border-l border-border pl-6">
                {flow.rows.map((row) =>
                  row.kind === 'now' ? (
                    <div key="now" className="relative flex items-center gap-3 py-2">
                      <span className="absolute -left-[27px] flex h-3 w-3 items-center justify-center">
                        <span className={cn('absolute h-3 w-3 rounded-full bg-foreground', !reduceMotion && 'animate-ping opacity-40')} />
                        <span className="relative h-2 w-2 rounded-full bg-foreground" />
                      </span>
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
                        Now &middot; {row.label}
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  ) : row.kind === 'task' ? (
                    renderTask(row, true)
                  ) : (
                    <div key={row.id} className="relative flex items-center gap-4 py-2.5">
                      <span className="absolute -left-[25px] h-2 w-2 rounded-full border-2 border-foreground bg-background" />
                      <span className="w-[4.5rem] shrink-0 text-sm tabular-nums text-muted-foreground">{row.timeLabel}</span>
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{row.title}</span>
                        {row.provider && (
                          <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {PROVIDER_LABEL[row.provider]}
                          </span>
                        )}
                      </span>
                      {row.location && (
                        <span className="hidden shrink-0 items-center gap-1 truncate text-xs text-muted-foreground sm:flex">
                          <MapPin className="h-3 w-3" strokeWidth={1.75} /> {row.location}
                        </span>
                      )}
                    </div>
                  )
                )}
              </div>
            )}

            {flow.anytime.length > 0 && (
              <div className={cn(flow.rows.length > 0 && 'mt-5 border-t border-border pt-4')}>
                <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Anytime today</p>
                {flow.anytime.map((item) => renderTask(item, false))}
              </div>
            )}
          </div>
        )}
      </CardContent>
      {celebrate && <Celebration />}
    </Card>
  );
};

export default TodaySchedule;
