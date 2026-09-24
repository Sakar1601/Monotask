import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Repeat,
  Sparkles,
  Settings,
  Check,
  X,
  CalendarClock,
  Mail,
} from 'lucide-react';

/**
 * A recreation of the real app window (sidebar, Today list, Suggestions)
 * built from the app's own tokens, used as the hero's centerpiece. The
 * suggestion loop mirrors the real trust model: an AI suggestion waits
 * for an explicit Accept, and only then becomes a task.
 */
const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: CheckSquare, label: 'Tasks' },
  { icon: Calendar, label: 'Calendar' },
  { icon: Repeat, label: 'Habits' },
  { icon: Sparkles, label: 'Suggestions', badge: 2 },
  { icon: Settings, label: 'Settings' },
];

const BASE_TASKS = [
  { title: 'Design review: Q4 roadmap', meta: '10:00 AM', source: 'Google' },
  { title: 'Approve vendor contract redline', meta: '1:00 PM', source: 'Outlook' },
  { title: 'Plan weekend hike', meta: 'Anytime', source: null },
];

function SourceChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      {label}
    </span>
  );
}

export function ProductWindow() {
  const reduceMotion = useReducedMotion();
  // 0: suggestion pending, 1: accept pressed, 2: task added
  const [step, setStep] = useState(reduceMotion ? 2 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      setStep(0);
      timers.push(setTimeout(() => setStep(1), 2600));
      timers.push(setTimeout(() => setStep(2), 3300));
      timers.push(setTimeout(run, 9000));
    };
    run();
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);

  const accepted = step === 2;

  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-[0_30px_120px_-30px_hsl(var(--foreground)/0.35)]"
    >
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        <span className="ml-3 rounded-md bg-muted px-3 py-1 text-[11px] text-muted-foreground">
          monotask.vercel.app/app
        </span>
      </div>

      <div className="grid grid-cols-[3.25rem_1fr] md:grid-cols-[13rem_1fr]">
        {/* sidebar */}
        <div className="border-r border-border bg-background/50 p-2 md:p-3">
          <div className="mb-3 hidden items-center gap-2 px-2 pt-1 md:flex">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground">
              <CheckSquare className="h-3.5 w-3.5 text-background" />
            </span>
            <span className="font-grotesk text-sm font-semibold text-foreground">Monotask</span>
          </div>
          <div className="space-y-0.5">
            {NAV.map(({ icon: Icon, label, active, badge }) => (
              <div
                key={label}
                className={`flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] ${
                  active ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span className="hidden md:inline">{label}</span>
                {badge && (
                  <span className="ml-auto hidden rounded-full bg-foreground px-1.5 text-[10px] font-semibold text-background md:inline">
                    {accepted ? badge - 1 : badge}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* main */}
        <div className="min-w-0 p-4 md:p-6">
          <p className="font-grotesk text-lg font-semibold text-foreground md:text-xl">Good morning</p>
          <p className="text-xs text-muted-foreground md:text-sm">Here's what's happening today.</p>

          <div className="mt-4 grid gap-4 md:grid-cols-[1.15fr_1fr]">
            {/* Today */}
            <div className="rounded-xl border border-border bg-background/40 p-3 md:p-4">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Today
              </p>
              <div className="space-y-1.5">
                {BASE_TASKS.map((t) => (
                  <div key={t.title} className="flex items-center gap-3 rounded-lg px-2 py-2">
                    <span className="h-4 w-4 shrink-0 rounded border border-border" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-foreground">{t.title}</p>
                      <p className="text-[11px] text-muted-foreground">{t.meta}</p>
                    </div>
                    {t.source && <SourceChip label={t.source} />}
                  </div>
                ))}
                {/* Always in the layout so accepting never changes the window's height;
                    only its opacity and offset animate. */}
                <motion.div
                  animate={accepted ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  aria-hidden={!accepted}
                >
                  <div className="flex items-center gap-3 rounded-lg bg-accent px-2 py-2">
                    <span className="h-4 w-4 shrink-0 rounded border border-border" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-foreground">Send Q3 deck to the design team</p>
                      <p className="text-[11px] text-muted-foreground">Due Friday</p>
                    </div>
                    <SourceChip label="AI" />
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Suggestions */}
            <div className="rounded-xl border border-border bg-background/40 p-3 md:p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <Sparkles className="h-3 w-3" /> Suggestions
              </p>
              <div className="space-y-2">
                <div className="relative min-h-[6.25rem] rounded-lg border border-border bg-card p-3">
                  <motion.div
                    animate={{ opacity: accepted ? 0 : 1 }}
                    transition={{ duration: 0.3 }}
                    aria-hidden={accepted}
                  >
                    <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Mail className="h-3 w-3" /> From an email
                    </p>
                    <p className="mt-1 text-[13px] font-medium text-foreground">Send Q3 deck to the design team</p>
                    <div className="mt-2.5 flex gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          step === 1 ? 'bg-foreground/80 text-background' : 'bg-foreground text-background'
                        }`}
                      >
                        <Check className="h-3 w-3" /> Accept
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                        <X className="h-3 w-3" /> Dismiss
                      </span>
                    </div>
                  </motion.div>
                  <motion.div
                    animate={{ opacity: accepted ? 1 : 0, scale: accepted ? 1 : 0.96 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    aria-hidden={!accepted}
                    className="absolute inset-0 flex items-center justify-center gap-2 text-[13px] font-medium text-foreground"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    Accepted, added to Today
                  </motion.div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <CalendarClock className="h-3 w-3" /> Meeting overlap
                  </p>
                  <p className="mt-1 text-[13px] font-medium text-foreground">Move 1:1 with Sam to 3:30 PM</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Overlaps with Design review</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
