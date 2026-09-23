import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Check, Repeat } from 'lucide-react';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const COMPLETED_INDEX = 2; // Wednesday only

/**
 * Demonstrates true per-instance recurring-task tracking: a week of the same
 * recurring task, where completing one day's occurrence marks only that
 * day (backed by the task_instances table), leaving the rest of the series
 * untouched. A single checkbox mid-row cannot show this; a week strip can.
 */
export function RecurringDemo() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });

  return (
    <div ref={ref} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-2 text-sm text-foreground">
        <Repeat className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
        <span className="font-medium">Morning workout</span>
        <span className="text-muted-foreground">repeats daily</span>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {DAYS.map((day, i) => {
          const done = i === COMPLETED_INDEX;
          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">{day}</span>
              <motion.div
                initial={reduceMotion ? undefined : { scale: 0.85, opacity: 0 }}
                animate={inView ? { scale: 1, opacity: 1 } : {}}
                whileHover={reduceMotion ? undefined : { scale: 1.1 }}
                transition={{ duration: 0.3, delay: reduceMotion ? 0 : i * 0.05 }}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors sm:h-10 sm:w-10 ${
                  done
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background text-transparent'
                }`}
              >
                <Check className="h-4 w-4" strokeWidth={2.5} />
              </motion.div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-sm text-muted-foreground">
        Checking off Wednesday marks that day done. Tuesday and Thursday stay exactly as
        they were, not silently completed along with it.
      </p>
    </div>
  );
}
