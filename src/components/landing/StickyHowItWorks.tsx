import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform } from 'framer-motion';
import { Check, X, RefreshCw, Mail, CalendarClock } from 'lucide-react';

const STEPS = [
  { n: '01', title: 'Connect', desc: 'Link Google, Microsoft, or both. Pick what to sync, and whether to scan messages.' },
  { n: '02', title: 'Review', desc: 'Suggested tasks and meeting fixes wait in one list. Accept the useful ones, dismiss the rest.' },
  { n: '03', title: 'Stay in sync', desc: 'Changes flow both ways in the background, so your plan matches your calendars.' },
];

function Toggle({ on, delay = 0 }: { on: boolean; delay?: number }) {
  return (
    <span
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors duration-300 ${
        on ? 'border-foreground bg-foreground' : 'border-border bg-muted'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <motion.span
        className={`absolute top-0.5 h-3.5 w-3.5 rounded-full ${on ? 'bg-background' : 'bg-muted-foreground/60'}`}
        animate={{ left: on ? 18 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30, delay: delay / 1000 }}
      />
    </span>
  );
}

/** Step 1: connecting accounts. The toggles switch on one after another. */
function ConnectPanel() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timers = [setTimeout(() => setStage(1), 500), setTimeout(() => setStage(2), 1100)];
    return () => timers.forEach(clearTimeout);
  }, []);
  const rows = [
    { name: 'Google', detail: 'Calendar and tasks, two-way', on: stage >= 1 },
    { name: 'Microsoft', detail: 'Outlook calendar and To Do, two-way', on: stage >= 2 },
  ];
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.name} className="flex items-center justify-between rounded-xl border border-border bg-background/60 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.detail}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs transition-opacity duration-300 ${row.on ? 'opacity-100 text-foreground' : 'opacity-0'}`}>
              Connected
            </span>
            <Toggle on={row.on} />
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-xl border border-dashed border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Scan messages for task suggestions</p>
          <p className="text-xs text-muted-foreground">Off until you switch it on. Gmail is read-only.</p>
        </div>
        <Toggle on={false} />
      </div>
    </div>
  );
}

/** Step 2: reviewing suggestions. The first one gets accepted, the second dismissed. */
function ReviewPanel() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timers = [setTimeout(() => setStage(1), 900), setTimeout(() => setStage(2), 1700)];
    return () => timers.forEach(clearTimeout);
  }, []);
  const cards = [
    { icon: Mail, from: 'From an email', title: 'Send Q3 deck to the design team', state: stage >= 1 ? 'accepted' : 'pending' },
    { icon: CalendarClock, from: 'Meeting overlap', title: 'Move 1:1 with Sam to 3:30 PM', state: stage >= 2 ? 'dismissed' : 'pending' },
  ] as const;
  return (
    <div className="space-y-3">
      {cards.map(({ icon: Icon, from, title, state }) => (
        <motion.div
          key={title}
          animate={{ opacity: state === 'dismissed' ? 0.45 : 1 }}
          transition={{ duration: 0.4 }}
          className="rounded-xl border border-border bg-background/60 p-4"
        >
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5" /> {from}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{title}</p>
          <div className="mt-3 flex gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                state === 'accepted' ? 'bg-foreground text-background' : 'border border-border text-foreground'
              }`}
            >
              <Check className="h-3.5 w-3.5" /> {state === 'accepted' ? 'Accepted' : 'Accept'}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                state === 'dismissed' ? 'bg-muted text-foreground' : 'border border-border text-muted-foreground'
              }`}
            >
              <X className="h-3.5 w-3.5" /> {state === 'dismissed' ? 'Dismissed' : 'Dismiss'}
            </span>
          </div>
        </motion.div>
      ))}
      <p className="pt-1 text-center text-xs text-muted-foreground">Nothing changes until you choose.</p>
    </div>
  );
}

/** Step 3: syncing. Items land one by one while the sync icon turns. */
function SyncPanel() {
  const items = [
    { time: '10:00', title: 'Design review', source: 'Google' },
    { time: '13:00', title: 'Vendor call', source: 'Outlook' },
    { time: '15:30', title: 'Send Q3 deck', source: 'AI' },
  ];
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Today</p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3 animate-spin [animation-duration:3s]" /> Synced just now
        </span>
      </div>
      <div className="relative space-y-3 border-l border-border pl-5">
        {items.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.25 + i * 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3.5"
          >
            <span className="absolute -left-[26px] h-2 w-2 rounded-full border-2 border-foreground bg-background" />
            <span className="w-12 font-mono text-xs tabular-nums text-muted-foreground">{item.time}</span>
            <span className="flex-1 text-sm font-medium text-foreground">{item.title}</span>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {item.source}
            </span>
          </motion.div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Edits on either side flow to the other, every 10 minutes.</p>
    </div>
  );
}

const PANELS = [ConnectPanel, ReviewPanel, SyncPanel];

/**
 * Sticky storytelling: the section is three viewports tall, its content stays
 * pinned, and scroll progress decides which step is active. This is a normal
 * `position: sticky`, not a scroll hijack, so the page still scrolls at its
 * own speed and every step is also reachable by clicking.
 */
export function StickyHowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [active, setActive] = useState(0);
  const fill = useTransform(scrollYProgress, [0, 1], [0, 1]);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setActive(Math.max(0, Math.min(STEPS.length - 1, Math.floor(v * STEPS.length))));
  });

  const goTo = (index: number) => {
    const el = ref.current;
    if (!el) return;
    const scrollable = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: el.offsetTop + ((index + 0.5) / STEPS.length) * scrollable, behavior: 'smooth' });
  };

  const Panel = PANELS[active];

  return (
    <div ref={ref} className="relative h-[300vh]">
      <div className="sticky top-0 flex h-screen items-center">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:px-8">
          <div>
            <span className="inline-flex items-center rounded-full border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              How it works
            </span>
            <h2 className="mt-6 text-balance font-grotesk text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
              Three steps. No onboarding tour.
            </h2>

            <div className="relative mt-10 pl-8">
              <div className="absolute bottom-2 left-0 top-2 w-px bg-border" />
              <motion.div
                aria-hidden
                className="absolute left-0 top-2 w-px origin-top bg-foreground"
                style={{ scaleY: fill, height: 'calc(100% - 1rem)' }}
              />
              <ol className="space-y-7">
                {STEPS.map((step, i) => (
                  <li key={step.n}>
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      aria-current={i === active ? 'step' : undefined}
                      className={`text-left transition-opacity duration-300 ${i === active ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
                    >
                      <span className="font-mono text-xs text-muted-foreground">{step.n}</span>
                      <span className="mt-1 block font-grotesk text-2xl font-medium text-foreground">{step.title}</span>
                      <span className="mt-1 block max-w-sm text-muted-foreground">{step.desc}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_30px_100px_-30px_hsl(var(--foreground)/0.3)]">
            <div className="mb-5 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              <span className="ml-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Step {STEPS[active].n}
              </span>
            </div>
            <div className="h-[22rem]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Panel />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
