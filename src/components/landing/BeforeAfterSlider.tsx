import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Mail, MessagesSquare, CalendarClock, CheckSquare, ChevronsLeftRight, Check, Sparkles } from 'lucide-react';

/** The "before" side: the same commitments, scattered across apps with no shared view. */
function Before() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-muted/60">
      <p className="absolute left-5 top-5 z-10 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Without Monotask
      </p>

      {/* Inbox */}
      <div className="absolute left-[4%] top-[16%] w-[52%] max-w-sm -rotate-2 rounded-xl border border-border bg-card p-4 shadow-sm sm:left-[6%]">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Inbox</span>
          <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">47 unread</span>
        </div>
        <p className="text-sm font-medium text-foreground">Re: Q3 deck</p>
        <p className="mt-0.5 text-xs text-muted-foreground">&hellip;could you send it to the design team by Friday? Also&hellip;</p>
        <p className="mt-2 text-[11px] text-muted-foreground/70">Buried in a thread from Tuesday</p>
      </div>

      {/* Two meetings, same hour */}
      <div className="absolute right-[4%] top-[12%] w-[48%] max-w-xs rotate-2 rounded-xl border border-border bg-card p-4 shadow-sm sm:right-[8%]">
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" /> Calendar
        </p>
        <div className="rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground">10:00 Design review</div>
        <div className="-mt-1 ml-3 rounded-md border border-dashed border-foreground/40 bg-muted px-2.5 py-1.5 text-xs text-foreground">
          10:30 1:1 with Sam
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground/70">Nobody noticed they overlap</p>
      </div>

      {/* Chat */}
      <div className="absolute bottom-[16%] left-[10%] w-[46%] max-w-xs rotate-1 rounded-xl border border-border bg-card p-4 shadow-sm sm:left-[14%]">
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MessagesSquare className="h-3.5 w-3.5" /> Chat
        </p>
        <p className="text-sm text-foreground">Sam: did you see the contract redline?</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Sam: it needs approving today</p>
      </div>

      {/* Separate to-do app */}
      <div className="absolute bottom-[10%] right-[5%] w-[44%] max-w-xs -rotate-1 rounded-xl border border-border bg-card p-4 shadow-sm sm:right-[9%]">
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckSquare className="h-3.5 w-3.5" /> To-do app
        </p>
        <p className="text-sm text-foreground line-through decoration-muted-foreground/60">Book dentist</p>
        <p className="text-sm text-foreground">Renew credentials</p>
        <p className="mt-1 text-[11px] text-muted-foreground/70">12 items, half of them stale</p>
      </div>
    </div>
  );
}

/** The "after" side: the same day as one calm timeline. */
function After() {
  const rows = [
    { time: '10:00', title: 'Design review', tag: 'Google' },
    { time: '13:00', title: 'Approve vendor contract redline', tag: 'Outlook' },
    { time: '15:30', title: 'Send Q3 deck to the design team', tag: 'AI' },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden bg-card">
      <p className="absolute right-5 top-5 z-10 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        With Monotask
      </p>
      <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 px-6 py-14">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-grotesk text-xl font-semibold tracking-[-0.02em] text-foreground">Today</p>
            <p className="text-xs text-muted-foreground">One timeline, every source</p>
          </div>
          <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">1 of 3 done</span>
        </div>

        <div className="relative space-y-2.5 border-l border-border pl-5">
          {rows.map((row) => (
            <div key={row.title} className="relative flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3">
              <span className="absolute -left-[26px] h-2 w-2 rounded-full border-2 border-foreground bg-background" />
              <span className="w-11 font-mono text-xs tabular-nums text-muted-foreground">{row.time}</span>
              <span className="flex-1 text-sm font-medium text-foreground">{row.title}</span>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{row.tag}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/50 p-3 text-sm text-foreground">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
            <Sparkles className="h-3 w-3" />
          </span>
          Overlap found: move 1:1 with Sam to 3:30 PM?
          <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background">
            <Check className="h-3 w-3" /> Accept
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Drag (or arrow-key) to compare the same day without and with Monotask.
 * The handle nudges each time it scrolls into view so people notice it can be moved.
 */
export function BeforeAfterSlider() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const touched = useRef(false);
  const dragging = useRef(false);
  const [pos, setPos] = useState(50);

  const setFromClientX = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(Math.max(4, Math.min(96, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  useEffect(() => {
    // Replay the nudge every time the slider scrolls back into view.
    if (!inView) return;
    touched.current = false;
    if (reduceMotion) return;
    const frames = [
      [25, 400],
      [75, 1400],
      [50, 2400],
    ] as const;
    const timers = frames.map(([value, delay]) => setTimeout(() => !touched.current && setPos(value), delay));
    return () => timers.forEach(clearTimeout);
  }, [inView, reduceMotion]);

  return (
    <div className="mx-auto max-w-5xl">
      <div
        ref={ref}
        className="relative h-[30rem] touch-pan-y select-none overflow-hidden rounded-2xl border border-border sm:h-[28rem]"
        onPointerDown={(e) => {
          touched.current = true;
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromClientX(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && setFromClientX(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <Before />
        {/* The "after" layer sits on top and is revealed from the handle rightwards */}
        <motion.div
          className="absolute inset-0"
          animate={{ clipPath: `inset(0 0 0 ${pos}%)` }}
          transition={dragging.current ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 22 }}
        >
          <After />
        </motion.div>

        <motion.div
          className="absolute inset-y-0 z-20 w-px bg-foreground"
          animate={{ left: `${pos}%` }}
          transition={dragging.current ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 22 }}
        >
          <div
            role="slider"
            tabIndex={0}
            aria-label="Compare without and with Monotask"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setPos((p) => Math.max(4, p - 5));
              if (e.key === 'ArrowRight') setPos((p) => Math.min(96, p + 5));
              touched.current = true;
            }}
            className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-foreground bg-background text-foreground shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronsLeftRight className="h-5 w-5" strokeWidth={1.75} />
          </div>
        </motion.div>
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">Drag the handle, or use the arrow keys.</p>
    </div>
  );
}
