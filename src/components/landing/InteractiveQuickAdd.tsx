import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Sparkles, CalendarClock, Repeat, ArrowRight, Flag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { parseQuickAdd } from '@/utils/quickAddPreview';

const EXAMPLES = [
  'lunch with Sam tomorrow 1pm, high priority',
  'call the dentist friday 9am',
  'water the plants every day',
];

const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' } as const;
const REPEAT_LABEL = { none: '', daily: 'Repeats daily', weekly: 'Repeats weekly', monthly: 'Repeats monthly' } as const;

const formatDue = (d: Date, now: Date) => {
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

/**
 * A real, editable Quick Add that runs entirely in the browser (see
 * utils/quickAddPreview) so visitors can try the product's headline feature
 * before signing up. It types the first example once on scroll-in to show
 * what to do, then hands over to the visitor.
 */
export function InteractiveQuickAdd() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const touched = useRef(false);
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState('');

  const run = (text: string) => setSubmitted(text.trim());

  useEffect(() => {
    if (!inView || touched.current) return;
    const phrase = EXAMPLES[0];
    if (reduceMotion) {
      setValue(phrase);
      setSubmitted(phrase);
      return;
    }
    let i = 0;
    const type = setInterval(() => {
      if (touched.current) return clearInterval(type);
      i += 1;
      setValue(phrase.slice(0, i));
      if (i >= phrase.length) {
        clearInterval(type);
        setTimeout(() => !touched.current && setSubmitted(phrase), 450);
      }
    }, 38);
    return () => clearInterval(type);
  }, [inView, reduceMotion]);

  const now = new Date();
  const result = submitted ? parseQuickAdd(submitted, now) : null;

  return (
    <div ref={ref} className="h-full rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
        <Sparkles className="h-4 w-4" strokeWidth={2} />
        AI Quick Add
        <span className="ml-auto rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Try it
        </span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          touched.current = true;
          run(value);
        }}
        className="flex gap-2"
      >
        <input
          value={value}
          onChange={(e) => {
            touched.current = true;
            setValue(e.target.value);
          }}
          onFocus={() => (touched.current = true)}
          placeholder="Type a task in plain English"
          aria-label="Try AI Quick Add"
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/40"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="shrink-0 rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity disabled:opacity-40"
        >
          Parse
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              touched.current = true;
              setValue(example);
              run(example);
            }}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>

      <div className="mt-4 min-h-[8.5rem]">
        <AnimatePresence mode="wait">
          {result && result.title ? (
            <motion.div
              key={submitted}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-2.5 rounded-xl border border-border bg-secondary/40 p-4"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Review before saving</p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{result.title}</span>
                <Badge variant="secondary" className="shrink-0 font-normal">
                  <Flag className="mr-1 h-3 w-3" /> {PRIORITY_LABEL[result.priority]}
                </Badge>
              </div>
              {(result.dueDate || result.time) && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
                  {[result.dueDate ? formatDue(result.dueDate, now) : null, result.time].filter(Boolean).join(', ')}
                </div>
              )}
              {result.repeat !== 'none' && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Repeat className="h-3.5 w-3.5" strokeWidth={2} />
                  {REPEAT_LABEL[result.repeat]}
                </div>
              )}
            </motion.div>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Type something like &ldquo;lunch with Sam tomorrow 1pm&rdquo; and press Parse.
            </p>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>This preview runs in your browser. The real feature uses Claude and handles far more phrasing.</span>
        <button
          type="button"
          onClick={() => navigate('/auth?mode=signup')}
          className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
        >
          Use it with your account <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
