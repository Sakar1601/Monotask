import { ReactNode, useEffect, useRef } from 'react';
import { motion, useReducedMotion, useInView, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  Calendar,
  Mail,
  MessagesSquare,
  ListChecks,
  CheckSquare,
  Inbox,
  CalendarClock,
  RefreshCw,
  Repeat,
  LineChart,
  Search,
  Download,
  Moon,
  UserRound,
  Tags,
} from 'lucide-react';
import { StickyHowItWorks } from './StickyHowItWorks';
import { FeaturePreview } from './FeaturePreviews';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Eyebrow({ children, inverted }: { children: ReactNode; inverted?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] ${
        inverted ? 'border-background/20 text-background/60' : 'border-border text-muted-foreground'
      }`}
    >
      {children}
    </span>
  );
}

export function CountUp({ from = 0, to, suffix = '' }: { from?: number; to: number; suffix?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const value = useMotionValue(reduce ? to : from);
  const text = useTransform(value, (v) => `${Math.round(v)}${suffix}`);
  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(value, to, { duration: 1.4, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [inView, reduce, value, to]);
  return <motion.span ref={ref}>{text}</motion.span>;
}

function Spotlight({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--sx', `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty('--sy', `${e.clientY - r.top}px`);
      }}
      className={`group relative overflow-hidden ${className ?? ''}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(260px circle at var(--sx, 50%) var(--sy, 50%), hsl(var(--foreground) / 0.08), transparent 70%)' }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

// Typographic wordmarks on purpose: no brand-mark reproductions, just the
// products the app genuinely talks to.
const WORKS_WITH = [
  { icon: Calendar, label: 'Google Calendar' },
  { icon: Mail, label: 'Gmail' },
  { icon: ListChecks, label: 'Google Tasks' },
  { icon: Calendar, label: 'Outlook Calendar' },
  { icon: Mail, label: 'Outlook Mail' },
  { icon: MessagesSquare, label: 'Microsoft Teams' },
  { icon: CheckSquare, label: 'Microsoft To Do' },
];

export function WorksWithStrip() {
  return (
    <div className="border-y border-border py-8">
      <p className="mb-6 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Connects with the tools you already use
      </p>
      <div className="mx-auto max-w-5xl overflow-hidden px-6 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)] motion-reduce:[mask-image:none]">
        <div className="flex w-max animate-marquee gap-x-12 hover:[animation-play-state:paused] motion-reduce:w-auto motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-y-4">
          {[0, 1].map((copy) =>
            WORKS_WITH.map(({ icon: Icon, label }) => (
              <span
                key={`${copy}-${label}`}
                aria-hidden={copy === 1 ? true : undefined}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium text-muted-foreground ${copy === 1 ? 'motion-reduce:hidden' : ''}`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {label}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const PROBLEMS = [
  {
    icon: Inbox,
    problem: 'A request buried in an email',
    fix: 'Monotask finds it and suggests the task, with a due date when one is mentioned.',
  },
  {
    icon: CalendarClock,
    problem: 'Two meetings in the same hour',
    fix: 'It spots the overlap and proposes a new time for one of them.',
  },
  {
    icon: RefreshCw,
    problem: 'Calendars you retype by hand',
    fix: 'Google and Outlook stay in sync with your tasks, both directions.',
  },
];

export function ProblemSection() {
  return (
    <section className="bg-foreground px-4 py-24 text-background sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-3xl text-center">
          <Eyebrow inverted>The problem</Eyebrow>
          <h2 className="text-balance mt-6 font-grotesk text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Your commitments live everywhere except one place.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-background/60">
            Tasks hide in emails, meetings in three calendars, and follow-ups in your head. Monotask
            pulls them into a single plan you stay in control of.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-background/15 bg-background/15 md:grid-cols-3">
          {PROBLEMS.map(({ icon: Icon, problem, fix }, i) => (
            <Reveal key={problem} delay={i * 0.08} className="bg-foreground p-8">
              <Icon className="h-6 w-6 text-background/70" strokeWidth={1.5} />
              <motion.p
                className="relative mt-6 inline-block font-grotesk text-xl font-medium"
                initial={{ opacity: 1 }}
                whileInView={{ opacity: 0.55 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.4, delay: 0.9 + i * 0.15 }}
              >
                {problem}
                <motion.span
                  aria-hidden
                  className="absolute left-0 right-0 top-1/2 h-px origin-left bg-background"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.6, delay: 0.5 + i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                />
              </motion.p>
              <motion.p
                className="mt-3 text-background"
                initial={{ opacity: 0.35 }}
                whileInView={{ opacity: 0.85 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, delay: 1.0 + i * 0.15 }}
              >
                {fix}
              </motion.p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// Every figure here is a fact about how the product is built, not a
// usage statistic.
const TRUST: { big: ReactNode; label: string; note: string }[] = [
  { big: <CountUp from={9} to={0} />, label: 'actions taken without your approval', note: 'Every AI result is a draft or pending suggestion.' },
  { big: <><CountUp to={10} /> min</>, label: 'background sync cadence', note: 'Calendar and tasks stay current on their own.' },
  { big: 'Opt-in', label: 'message scanning', note: 'Off until you switch it on; disconnect any time.' },
  { big: 'Read-only', label: 'Gmail access', note: 'Suggestions never send, delete, or edit your mail.' },
];

export function TrustBand() {
  return (
    <section className="border-t border-border px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <Eyebrow>Built for trust</Eyebrow>
          <h2 className="text-balance mt-6 font-grotesk text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
            AI that suggests. You decide.
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map(({ big, label, note }, i) => (
            <Reveal key={label} delay={i * 0.06} className="bg-background p-7">
              <p className="font-grotesk text-4xl font-semibold tracking-[-0.03em] text-foreground">{big}</p>
              <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
              <p className="mt-2 text-sm text-muted-foreground">{note}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { title: 'Tasks that repeat properly', desc: 'Daily, weekly or monthly, with each day tracked on its own.' },
  { title: 'Habits and streaks', desc: 'Log done, skipped or missed, with a 30-day consistency view.' },
  { title: 'Month, week, agenda', desc: 'Your tasks and synced events in one calendar.' },
  { title: 'Progress at a glance', desc: 'Weekly chart and a 12-week activity heatmap.' },
  { title: 'Command palette', desc: 'Press Cmd+K to find anything or jump anywhere.' },
  { title: 'Tags and filters', desc: 'Organize by tag, priority and status.' },
  { title: 'Yours to keep', desc: 'Export to PDF, CSV or JSON, and import it back.' },
  { title: 'Start as a guest', desc: 'No email needed. Upgrade to a full account any time.' },
  { title: 'Dark and light', desc: 'A calm monochrome interface in either theme.' },
];

export function FeatureGrid() {
  return (
    <section id="features" className="border-t border-border px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-3xl text-center">
          <Eyebrow>Everything else</Eyebrow>
          <h2 className="text-balance mt-6 font-grotesk text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
            The basics, done quietly and well.
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ title, desc }, i) => (
            <Reveal key={title} delay={(i % 3) * 0.05} className="bg-background">
              <Spotlight className="h-full p-7">
                <FeaturePreview title={title} />
                <p className="font-grotesk text-lg font-medium text-foreground">{title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </Spotlight>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: '01', title: 'Connect', desc: 'Link Google, Microsoft, or both. Pick what to sync, and whether to scan messages.' },
  { n: '02', title: 'Review', desc: 'Suggested tasks and meeting fixes wait in one list. Accept the useful ones, dismiss the rest.' },
  { n: '03', title: 'Stay in sync', desc: 'Changes flow both ways in the background, so your plan matches your calendars.' },
];

export function HowItWorks() {
  const reduce = useReducedMotion();
  return (
    <section id="how-it-works" className="border-t border-border">
      {/* Large screens get the scroll-driven, pinned version; small screens
          and reduced-motion users get the plain three-column steps below. */}
      {!reduce && (
        <div className="hidden lg:block">
          <StickyHowItWorks />
        </div>
      )}
      <div className={`px-4 py-24 sm:px-6 lg:px-8 ${reduce ? '' : 'lg:hidden'}`}>
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="text-balance mt-6 font-grotesk text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
            Three steps. No onboarding tour.
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {STEPS.map(({ n, title, desc }, i) => (
            <Reveal key={n} delay={i * 0.08}>
              <p className="font-mono text-sm text-muted-foreground">{n}</p>
              <div className="relative my-4 h-px bg-border">
                <motion.div
                  aria-hidden
                  className="absolute inset-0 origin-left bg-foreground"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.9, delay: 0.2 + i * 0.25, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className="font-grotesk text-2xl font-medium text-foreground">{title}</p>
              <p className="mt-2 text-muted-foreground">{desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
      </div>
    </section>
  );
}

const FAQ = [
  {
    q: 'Is Monotask free?',
    a: 'Yes. It is free for personal use, with no credit card and no trial clock.',
  },
  {
    q: 'Does the AI change anything without asking?',
    a: 'No. Every AI result arrives as a draft in the task form or as a pending suggestion. You accept or dismiss it, and nothing saves itself.',
  },
  {
    q: 'What can Monotask access in my accounts?',
    a: 'Calendar and task access, so it can sync both ways. Message scanning (Gmail read-only, Outlook mail, Teams chats) is a separate switch that stays off until you turn it on. You can disconnect at any time.',
  },
  {
    q: 'Where does my message text go?',
    a: 'Only when message scanning is on, the text is sent to Claude (from Anthropic) to pick out possible tasks. It is used to make suggestions for you, not to act on your accounts.',
  },
  {
    q: 'Can I try it without signing up?',
    a: 'Yes, continue as a guest with no email. AI features and account connections need a full account, and you can upgrade a guest account whenever you like.',
  },
  {
    q: 'Can I take my data with me?',
    a: 'Yes. Export to PDF, CSV or a JSON file, and import the JSON back into any account.',
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="border-t border-border px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.6fr]">
        <Reveal>
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="text-balance mt-6 font-grotesk text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
            Questions, answered.
          </h2>
        </Reveal>
        <Reveal>
          <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
            {FAQ.map(({ q, a }, i) => (
              <AccordionItem key={q} value={`item-${i + 1}`} className="border-border">
                <AccordionTrigger className="py-5 text-left font-grotesk text-lg font-medium text-foreground hover:no-underline">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-base text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

export function LandingFooter({
  onSignIn,
  onSignUp,
}: {
  onSignIn: () => void;
  onSignUp: () => void;
}) {
  const link =
    'text-sm text-background/60 transition-colors hover:text-background';
  return (
    <footer className="bg-foreground px-4 pb-10 pt-16 text-background sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-background">
                <CheckSquare className="h-[18px] w-[18px] text-foreground" />
              </span>
              <span className="font-grotesk text-lg font-semibold">Monotask</span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-background/60">
              Your inbox and calendars, turned into a plan you control.
            </p>
          </div>
          <div>
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-background/40">Product</p>
            <ul className="space-y-3">
              <li><a href="#features" className={link}>Features</a></li>
              <li><a href="#how-it-works" className={link}>How it works</a></li>
              <li><a href="#faq" className={link}>FAQ</a></li>
            </ul>
          </div>
          <div>
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-background/40">Account</p>
            <ul className="space-y-3">
              <li><button onClick={onSignIn} className={link}>Sign in</button></li>
              <li><button onClick={onSignUp} className={link}>Get started</button></li>
            </ul>
          </div>
        </div>
        <div className="mt-14 border-t border-background/15 pt-6 text-sm text-background/40">
          {new Date().getFullYear()} Monotask
        </div>
      </div>
    </footer>
  );
}
