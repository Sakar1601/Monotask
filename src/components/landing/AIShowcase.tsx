import { useEffect, useState } from 'react';
import { motion, useReducedMotion, useInView } from 'framer-motion';
import { useRef } from 'react';
import {Mail, Check, X } from 'lucide-react';
import { InteractiveQuickAdd } from './InteractiveQuickAdd';

interface SuggestionCard {
  from: string;
  title: string;
  detail: string;
}

const SUGGESTIONS: SuggestionCard[] = [
  { from: 'From an email', title: 'Send Q3 deck to the design team', detail: 'Mentioned in a thread from yesterday' },
  { from: 'From a message', title: 'Confirm Thursday dentist appointment', detail: 'Reminder buried in a calendar invite reply' },
];

/**
 * Recreates AI Suggestions (SuggestionsView's accept/dismiss cards, backed
 * by supabase/functions/scan-messages scanning connected Google/Microsoft
 * messages). The first card animates to an accepted state, the second to
 * dismissed, showing both halves of the real interaction model in one
 * glance without needing six cards to prove the point.
 */
function SuggestionsDemo() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [resolved, setResolved] = useState(!!reduceMotion);

  useEffect(() => {
    if (reduceMotion || !inView) return;
    const t = setTimeout(() => setResolved(true), 1400);
    return () => clearTimeout(t);
  }, [inView, reduceMotion]);

  return (
    <div
      ref={ref}
      className="rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-foreground/25 hover:shadow-md sm:p-6"
    >
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Mail className="h-4 w-4" strokeWidth={2} />
        AI Suggestions
      </div>
      <div className="space-y-3">
        {SUGGESTIONS.map((s, i) => {
          const accepted = i === 0 && resolved;
          const dismissed = i === 1 && resolved;
          return (
            <motion.div
              key={s.title}
              animate={dismissed ? { opacity: 0.4, x: -6 } : { opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl border border-border bg-background p-3.5"
            >
              <p className="text-xs text-muted-foreground">{s.from}</p>
              <p className="mt-1 text-sm font-medium text-foreground">{s.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    accepted ? 'bg-foreground text-background' : 'border border-border text-muted-foreground'
                  }`}
                >
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                  {accepted ? 'Accepted' : 'Accept'}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium transition-colors ${
                    dismissed ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <X className="h-3 w-3" strokeWidth={2.5} />
                  {dismissed ? 'Dismissed' : 'Dismiss'}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export function AIShowcase() {
  const reduceMotion = useReducedMotion();
  const containerVariants = reduceMotion
    ? {}
    : { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };
  const itemVariants = reduceMotion
    ? {}
    : {
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
      };

  return (
    <motion.div
      initial={reduceMotion ? undefined : 'hidden'}
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      variants={containerVariants}
      className="grid gap-5 sm:grid-cols-2"
    >
      <motion.div variants={itemVariants}>
        <InteractiveQuickAdd />
      </motion.div>
      <motion.div variants={itemVariants}>
        <SuggestionsDemo />
      </motion.div>
    </motion.div>
  );
}
