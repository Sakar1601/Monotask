import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { Check, Download, FileText, Moon, Search, Sun, UserRound } from 'lucide-react';

/**
 * Ticks 0..steps-1 forever while the preview is on screen. With reduced motion
 * (or before it scrolls in) it holds the final, fully-drawn state instead.
 */
function useTicker(steps: number, ms: number) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { amount: 0.6 });
  const [tick, setTick] = useState(steps - 1);
  useEffect(() => {
    if (reduce || !inView) return;
    setTick(0);
    const id = setInterval(() => setTick((t) => (t + 1) % steps), ms);
    return () => clearInterval(id);
  }, [reduce, inView, steps, ms]);
  return { ref, tick };
}

/** Every preview has the same fixed height so nothing shifts while it animates. */
function Frame({ children, frameRef }: { children: React.ReactNode; frameRef: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={frameRef}
      aria-hidden
      className="mb-6 flex h-28 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40 px-4"
    >
      {children}
    </div>
  );
}

const chip = 'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors duration-300';

function RepeatPreview() {
  const { ref, tick } = useTicker(8, 450);
  return (
    <Frame frameRef={ref}>
      <div className="flex gap-1.5">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">{d}</span>
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors duration-300 ${
                i < tick ? 'border-foreground bg-foreground text-background' : 'border-border bg-background'
              }`}
            >
              {i < tick && <Check className="h-3.5 w-3.5" />}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// A fixed pattern so the heatmap looks like a real habit, not noise.
const HEAT = [2, 3, 0, 3, 3, 1, 0, 3, 2, 3, 3, 0, 1, 3, 3, 2, 3, 0, 3, 3, 3, 1, 3, 3, 2, 0, 3, 3];
const HEAT_STYLE = ['bg-border/60', 'bg-foreground/25', 'bg-foreground/55', 'bg-foreground'];

function HabitPreview() {
  const { ref, tick } = useTicker(HEAT.length + 8, 90);
  return (
    <Frame frameRef={ref}>
      <div className="grid grid-flow-col grid-rows-4 gap-1.5">
        {HEAT.map((level, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-[4px] transition-colors duration-300 ${i < tick ? HEAT_STYLE[level] : 'bg-border/40'}`}
          />
        ))}
      </div>
    </Frame>
  );
}

function CalendarPreview() {
  const { ref, tick } = useTicker(6, 700);
  const dots: Record<number, number> = { 3: 1, 6: 2, 9: 1, 12: 3, 16: 1, 19: 2, 23: 1 };
  return (
    <Frame frameRef={ref}>
      <div className="grid grid-cols-7 gap-x-2.5 gap-y-1">
        {Array.from({ length: 28 }, (_, i) => {
          const today = i === 8 + (tick % 3) * 1;
          return (
            <span
              key={i}
              className={`relative flex h-5 w-5 items-center justify-center rounded-full text-[9px] tabular-nums transition-colors duration-300 ${
                today ? 'bg-foreground text-background' : 'text-muted-foreground'
              }`}
            >
              {i + 1}
              {dots[i] && !today && <span className="absolute -bottom-0.5 h-0.5 w-0.5 rounded-full bg-foreground" />}
            </span>
          );
        })}
      </div>
    </Frame>
  );
}

function ProgressPreview() {
  const { ref, tick } = useTicker(6, 700);
  const bars = [40, 65, 50, 85, 70, 95, 60];
  return (
    <Frame frameRef={ref}>
      <div className="flex h-16 items-end gap-2.5">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-4 rounded-t-sm bg-foreground transition-[height] duration-500 ease-out"
            style={{ height: tick >= 1 ? `${h}%` : '8%', transitionDelay: `${i * 60}ms`, opacity: 0.35 + (h / 100) * 0.65 }}
          />
        ))}
      </div>
    </Frame>
  );
}

function PalettePreview() {
  const { ref, tick } = useTicker(7, 400);
  const query = 'design'.slice(0, Math.min(tick, 6));
  return (
    <Frame frameRef={ref}>
      <div className="w-full max-w-[15rem] rounded-lg border border-border bg-background shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-2.5 py-2 text-xs">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-foreground">{query}</span>
          <span className="h-3 w-px animate-pulse bg-foreground" />
          <kbd className="ml-auto font-mono text-[10px] text-muted-foreground">⌘K</kbd>
        </div>
        <div className="space-y-0.5 p-1">
          <div className={`rounded px-2 py-1 text-[11px] ${tick >= 3 ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}>
            Design review
          </div>
          <div className="rounded px-2 py-1 text-[11px] text-muted-foreground">Design system audit</div>
        </div>
      </div>
    </Frame>
  );
}

function TagsPreview() {
  const { ref, tick } = useTicker(6, 800);
  const tags = ['Work', 'Home', 'High', 'Done'];
  const active = tick % 4;
  return (
    <Frame frameRef={ref}>
      <div className="flex flex-wrap justify-center gap-2">
        {tags.map((t, i) => (
          <span
            key={t}
            className={`${chip} ${i === active ? 'border-foreground bg-foreground text-background' : 'border-border bg-background text-muted-foreground'}`}
          >
            {t}
          </span>
        ))}
      </div>
    </Frame>
  );
}

function ExportPreview() {
  const { ref, tick } = useTicker(5, 700);
  const formats = ['PDF', 'CSV', 'JSON'];
  return (
    <Frame frameRef={ref}>
      <div className="flex items-center gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
          <FileText className="h-5 w-5 text-foreground" strokeWidth={1.5} />
        </span>
        <Download
          className={`h-4 w-4 text-foreground transition-transform duration-500 ${tick % 2 ? 'translate-y-1' : '-translate-y-0.5'}`}
        />
        <div className="flex gap-1.5">
          {formats.map((f, i) => (
            <span
              key={f}
              className={`${chip} ${i === tick % 3 ? 'border-foreground bg-foreground text-background' : 'border-border bg-background text-muted-foreground'}`}
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function GuestPreview() {
  const { ref, tick } = useTicker(4, 900);
  return (
    <Frame frameRef={ref}>
      <div
        className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-all duration-300 ${
          tick === 2 ? 'scale-95 border-foreground bg-foreground text-background' : 'border-border bg-background text-foreground'
        }`}
      >
        <UserRound className="h-4 w-4" strokeWidth={1.5} />
        {tick === 3 ? 'Welcome in' : 'Continue as guest'}
      </div>
    </Frame>
  );
}

function ThemePreview() {
  const { ref, tick } = useTicker(2, 1600);
  const dark = tick === 1;
  return (
    <Frame frameRef={ref}>
      <div className="flex items-center gap-3">
        <div
          className={`w-28 space-y-1.5 rounded-lg border p-2.5 transition-colors duration-500 ${
            dark ? 'border-white/15 bg-[#111]' : 'border-black/10 bg-white'
          }`}
        >
          <span className={`block h-1.5 w-14 rounded-full transition-colors duration-500 ${dark ? 'bg-white' : 'bg-black'}`} />
          <span className={`block h-1.5 w-20 rounded-full transition-colors duration-500 ${dark ? 'bg-white/30' : 'bg-black/25'}`} />
          <span className={`block h-1.5 w-10 rounded-full transition-colors duration-500 ${dark ? 'bg-white/30' : 'bg-black/25'}`} />
        </div>
        {dark ? <Moon className="h-4 w-4 text-foreground" strokeWidth={1.5} /> : <Sun className="h-4 w-4 text-foreground" strokeWidth={1.5} />}
      </div>
    </Frame>
  );
}

const PREVIEWS: Record<string, () => JSX.Element> = {
  'Tasks that repeat properly': RepeatPreview,
  'Habits and streaks': HabitPreview,
  'Month, week, agenda': CalendarPreview,
  'Progress at a glance': ProgressPreview,
  'Command palette': PalettePreview,
  'Tags and filters': TagsPreview,
  'Yours to keep': ExportPreview,
  'Start as a guest': GuestPreview,
  'Dark and light': ThemePreview,
};

/** Looks up the preview by the same titles used in FEATURES (LandingSections). */
export function FeaturePreview({ title }: { title: string }) {
  const Preview = PREVIEWS[title];
  return Preview ? <Preview /> : null;
}
