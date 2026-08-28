import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowUpRight, CheckSquare, Repeat, Calendar, BarChart3, Check, Flame } from 'lucide-react';

// ---------------------------------------------------------------------------
// Design system for this page only (scoped via arbitrary Tailwind values -
// the authenticated app keeps its own tokens in index.css/tailwind.config.ts).
//
//   bg #FAFAF8  ink #0A0A0A  muted #6B6B67  hair #E4E2DC  ghost #EDECE6
//
// No hue accent anywhere - Monotask's pitch is "no clutter," enacted as a
// single-color interface rather than illustrated with a gradient. Type:
// Space Grotesk (display) + IBM Plex Mono (labels, the "1" signature - a
// nod to "mono") + Inter (body).
//
// The centerpiece is a real, tabbed preview of the four actual app screens
// (Task Manager / Habit Tracker / Calendar / Heatmap) - a visitor should be
// able to see the product, not just read a thesis about it. Everything else
// stays quiet so that window is the thing your eye lands on.
// ---------------------------------------------------------------------------

const CAPABILITIES = [
  { label: 'TASKS', text: 'Due dates, priorities, and tags - with recurring schedules that actually repeat, on the calendar and in the list.' },
  { label: 'HABITS', text: 'Daily, weekly, or monthly. Done, skipped, or missed - no habit tracker that only knows "done."' },
  { label: 'CALENDAR', text: 'Month, week, and agenda views that understand recurring tasks - not just whatever was due on day one.' },
  { label: 'PROGRESS', text: 'Completion trends, tag breakdowns, and a twelve-week activity heatmap. No vanity metrics.' },
  { label: 'EXPORT', text: 'PDF, CSV, or a JSON backup you can import back in - to this account or a different one.' },
] as const;

const DEMO_TABS = [
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'habits', label: 'Habits', icon: Repeat },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'heatmap', label: 'Heatmap', icon: BarChart3 },
] as const;

type DemoTab = (typeof DEMO_TABS)[number]['id'];

const DEMO_TASKS = [
  { text: 'Finish quarterly proposal', done: false, priority: 'high' as const },
  { text: 'Morning run', done: true, priority: 'medium' as const },
  { text: 'Review pull requests', done: false, priority: 'low' as const },
  { text: 'Prep for client call', done: false, priority: 'high' as const },
];

const DEMO_HABITS = [
  { name: 'Meditate', streak: 12, done: [true, true, true, true, true, false, false] },
  { name: 'Read 20 pages', streak: 7, done: [true, true, true, true, true, true, true] },
  { name: 'Gym session', streak: 5, done: [true, false, true, false, true, false, false] },
];

// Fixed, not random - a real product screenshot doesn't reshuffle itself
// every render. Values are 0-4 (intensity levels), 3 rows x 12 weeks.
const DEMO_HEATMAP = [
  [1, 3, 0, 4, 2, 3, 1, 4, 2, 0, 3, 4],
  [2, 2, 4, 1, 3, 0, 4, 2, 1, 3, 2, 4],
  [0, 4, 1, 2, 4, 3, 0, 1, 3, 4, 2, 1],
];
const HEATMAP_SHADES = ['bg-[#EDECE6]', 'bg-[#0A0A0A]/25', 'bg-[#0A0A0A]/50', 'bg-[#0A0A0A]/75', 'bg-[#0A0A0A]'];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const Landing = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const capabilitiesRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [activeDemo, setActiveDemo] = useState<DemoTab>('tasks');

  useEffect(() => {
    if (!loading && user) {
      navigate('/app');
    }
  }, [user, loading, navigate]);

  const scrollToCapabilities = () => {
    capabilitiesRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
        <div className="w-5 h-5 rounded-full border-2 border-[#0A0A0A] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (user) return null;

  const enter = (delay = 0) =>
    prefersReducedMotion
      ? {}
      : {
          initial: 'hidden',
          whileInView: 'visible',
          viewport: { once: true, margin: '-10%' },
          variants: fadeUp,
          transition: { duration: 0.5, delay, ease: 'easeOut' as const },
        };

  return (
    <div className="bg-[#FAFAF8] text-[#0A0A0A] font-sans">
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 sm:px-10 h-16 bg-[#FAFAF8]/90 backdrop-blur-sm border-b border-transparent">
        <span className="font-mono text-xs tracking-[0.2em] font-medium">MONOTASK</span>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" onClick={() => navigate('/auth')} className="text-[#0A0A0A] hover:bg-[#0A0A0A]/5 font-sans">
            Sign in
          </Button>
          <Button onClick={() => navigate('/auth?mode=signup')} className="bg-[#0A0A0A] text-[#FAFAF8] hover:bg-[#0A0A0A]/85 rounded-full px-5">
            Start free
          </Button>
        </div>
      </header>

      {/* ---------------------------------------------------------- HERO */}
      <section className="relative overflow-hidden px-6 sm:px-10 pt-16 pb-8 sm:pt-24">
        <span
          aria-hidden="true"
          className="pointer-events-none select-none absolute -right-[6vw] -top-[6vw] font-mono font-medium text-[#EDECE6] leading-none"
          style={{ fontSize: 'min(32vw, 320px)' }}
        >
          1
        </span>

        <div className="relative max-w-4xl mx-auto w-full">
          <motion.p {...enter(0)} className="font-mono text-xs sm:text-sm tracking-[0.2em] text-[#6B6B67] mb-6">
            A PRODUCTIVITY APP WITH ONE JOB
          </motion.p>

          <motion.h1 {...enter(0.08)} className="font-grotesk font-bold tracking-tight leading-[0.95] text-[12vw] sm:text-[5.5rem] lg:text-[6.5rem]">
            Do one thing.
            <br />
            Then the next.
          </motion.h1>

          <motion.p {...enter(0.18)} className="mt-8 max-w-lg text-lg text-[#6B6B67] leading-relaxed">
            Tasks, habits, and a calendar that agree with each other - and nothing else
            competing for your attention.
          </motion.p>

          <motion.div {...enter(0.26)} className="mt-10 flex flex-wrap items-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate('/auth?mode=signup')}
              className="bg-[#0A0A0A] text-[#FAFAF8] hover:bg-[#0A0A0A]/85 rounded-full px-8 py-6 text-base group"
            >
              Start free
              <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <button
              onClick={scrollToCapabilities}
              className="font-mono text-xs tracking-[0.15em] text-[#6B6B67] hover:text-[#0A0A0A] transition-colors underline underline-offset-4 decoration-[#E4E2DC] hover:decoration-[#0A0A0A]"
            >
              WHAT'S INSIDE ↓
            </button>
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------- DEMO WINDOW */}
      <section className="px-6 sm:px-10 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto w-full">
          <motion.p {...enter(0)} className="font-mono text-xs tracking-[0.2em] text-[#6B6B67] mb-3">
            SEE IT WORK
          </motion.p>
          <motion.h2 {...enter(0.06)} className="font-grotesk font-bold text-3xl sm:text-4xl mb-8">
            One screen. Everything on it.
          </motion.h2>

          <motion.div {...enter(0.1)} className="flex flex-wrap gap-2 mb-4">
            {DEMO_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveDemo(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                  activeDemo === tab.id
                    ? 'bg-[#0A0A0A] text-[#FAFAF8] border-[#0A0A0A]'
                    : 'bg-white text-[#6B6B67] border-[#E4E2DC] hover:border-[#0A0A0A]/30 hover:text-[#0A0A0A]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </motion.div>

          <motion.div {...enter(0.16)} className="rounded-2xl border border-[#E4E2DC] bg-white overflow-hidden shadow-[0_1px_0_#E4E2DC]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E4E2DC]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#E4E2DC]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#E4E2DC]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#E4E2DC]" />
              </div>
              <span className="ml-3 font-mono text-xs tracking-wide text-[#6B6B67]">monotask.app</span>
            </div>

            <div className="p-6 sm:p-8 min-h-[380px]">
              <AnimatePresence mode="wait">
                {activeDemo === 'tasks' && (
                  <motion.div key="tasks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-3">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="font-grotesk font-semibold text-lg">Today's tasks</h3>
                      <span className="font-mono text-xs text-[#6B6B67]">4 total</span>
                    </div>
                    {DEMO_TASKS.map((task, i) => (
                      <div
                        key={task.text}
                        className={`flex items-center gap-4 p-4 rounded-xl border ${task.done ? 'bg-[#FAFAF8] border-[#E4E2DC]' : 'bg-white border-[#E4E2DC]'}`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${task.done ? 'bg-[#0A0A0A] border-[#0A0A0A]' : 'border-[#E4E2DC]'}`}>
                          {task.done && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`flex-1 text-sm ${task.done ? 'line-through text-[#6B6B67]' : 'text-[#0A0A0A]'}`}>{task.text}</span>
                        <span className="font-mono text-[10px] tracking-wide px-2 py-1 rounded-full border border-[#E4E2DC] text-[#6B6B67] uppercase">
                          {task.priority}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}

                {activeDemo === 'habits' && (
                  <motion.div key="habits" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
                    <h3 className="font-grotesk font-semibold text-lg mb-5">Your habits</h3>
                    {DEMO_HABITS.map((habit) => (
                      <div key={habit.name} className="p-4 rounded-xl border border-[#E4E2DC]">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium">{habit.name}</span>
                          <span className="font-mono text-xs text-[#6B6B67] flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5" />
                            {habit.streak}d
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, j) => (
                            <div
                              key={j}
                              className={`flex-1 h-8 rounded-md flex items-center justify-center text-[10px] font-mono ${
                                habit.done[j] ? 'bg-[#0A0A0A] text-white' : 'bg-[#FAFAF8] text-[#6B6B67] border border-[#E4E2DC]'
                              }`}
                            >
                              {day}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {activeDemo === 'calendar' && (
                  <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    <h3 className="font-grotesk font-semibold text-lg mb-5">August 2026</h3>
                    <div className="grid grid-cols-7 gap-1.5">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <div key={`${d}${i}`} className="text-center font-mono text-[10px] text-[#6B6B67] py-1">
                          {d}
                        </div>
                      ))}
                      {Array.from({ length: 35 }, (_, i) => {
                        const day = i - 5;
                        const hasTasks = [2, 5, 8, 12, 15, 19, 22, 26].includes(day);
                        const isToday = day === 15;
                        return (
                          <div
                            key={i}
                            className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs ${
                              day < 1 || day > 31
                                ? 'text-transparent'
                                : isToday
                                  ? 'bg-[#0A0A0A] text-white font-semibold'
                                  : hasTasks
                                    ? 'bg-[#EDECE6] text-[#0A0A0A]'
                                    : 'text-[#6B6B67]'
                            }`}
                          >
                            {day >= 1 && day <= 31 ? day : '-'}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {activeDemo === 'heatmap' && (
                  <motion.div key="heatmap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-grotesk font-semibold text-lg">Activity heatmap</h3>
                      <span className="font-mono text-xs text-[#6B6B67]">12 weeks</span>
                    </div>
                    <div className="space-y-1.5">
                      {['Mon', 'Wed', 'Fri'].map((day, dayIndex) => (
                        <div key={day} className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-[#6B6B67] w-7">{day}</span>
                          <div className="flex gap-1 flex-1">
                            {DEMO_HEATMAP[dayIndex].map((level, weekIndex) => (
                              <div key={weekIndex} className={`flex-1 h-6 rounded-sm ${HEATMAP_SHADES[level]}`} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-4 font-mono text-[10px] text-[#6B6B67]">
                      <span>LESS</span>
                      {HEATMAP_SHADES.map((shade, i) => (
                        <div key={i} className={`w-3.5 h-3.5 rounded-sm ${shade}`} />
                      ))}
                      <span>MORE</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --------------------------------------------------- CAPABILITIES */}
      <section ref={capabilitiesRef} className="px-6 sm:px-10 py-16 sm:py-20 border-t border-[#E4E2DC]">
        <div className="max-w-3xl mx-auto w-full">
          <motion.p {...enter(0)} className="font-mono text-xs tracking-[0.2em] text-[#6B6B67] mb-10">
            WHAT'S INSIDE
          </motion.p>
          <div>
            {CAPABILITIES.map((item, i) => (
              <motion.div
                key={item.label}
                {...enter(0.04 * i)}
                className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-8 py-6 border-b border-[#E4E2DC] first:border-t"
              >
                <span className="font-mono text-xs tracking-[0.15em] text-[#0A0A0A] shrink-0 sm:w-32">{item.label}</span>
                <span className="text-[#6B6B67] leading-relaxed">{item.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- AI SPOTLIGHT */}
      <section className="px-6 sm:px-10 py-16 sm:py-20 border-t border-[#E4E2DC]">
        <div className="max-w-4xl mx-auto w-full grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <motion.p {...enter(0)} className="font-mono text-xs tracking-[0.2em] text-[#6B6B67] mb-6">
              AI, USED SPARINGLY
            </motion.p>
            <motion.h2 {...enter(0.06)} className="font-grotesk font-bold text-3xl sm:text-4xl leading-[1.05]">
              Type it like
              <br />
              you'd say it.
            </motion.h2>
            <motion.p {...enter(0.14)} className="mt-6 text-[#6B6B67] leading-relaxed max-w-sm">
              Claude fills in the rest, and you confirm before anything's saved. Ask for a
              weekly recap and get three honest sentences about what actually happened - not
              another dashboard.
            </motion.p>
          </div>

          <motion.div {...enter(0.12)} className="font-mono text-sm">
            <div className="border border-[#E4E2DC] rounded-2xl bg-white p-5 shadow-[0_1px_0_#E4E2DC]">
              <p className="text-[#6B6B67] mb-4">
                <span className="text-[#0A0A0A]">&gt;</span> lunch with sam tomorrow 1pm, high priority
              </p>
              <div className="flex flex-wrap gap-2">
                {['Lunch with Sam', 'Tomorrow', '1:00 PM', 'High'].map((chip) => (
                  <span key={chip} className="px-3 py-1.5 rounded-full border border-[#E4E2DC] text-xs tracking-wide text-[#0A0A0A]">
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------- CLOSING */}
      <section className="px-6 sm:px-10 py-20 sm:py-28 border-t border-[#E4E2DC]">
        <div className="max-w-3xl mx-auto w-full text-center">
          <motion.h2 {...enter(0)} className="font-grotesk font-bold text-4xl sm:text-6xl leading-[0.95]">
            Start with
            <br />
            one task.
          </motion.h2>
          <motion.p {...enter(0.1)} className="mt-6 text-[#6B6B67] text-lg">
            No credit card. No onboarding tour. Just the next thing you need to do.
          </motion.p>
          <motion.div {...enter(0.18)} className="mt-10">
            <Button
              size="lg"
              onClick={() => navigate('/auth?mode=signup')}
              className="bg-[#0A0A0A] text-[#FAFAF8] hover:bg-[#0A0A0A]/85 rounded-full px-8 py-6 text-base group"
            >
              Get started free
              <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* -------------------------------------------------------- FOOTER */}
      <footer className="border-t border-[#E4E2DC] px-6 sm:px-10 py-10">
        <div className="max-w-3xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-mono text-xs tracking-[0.2em] text-[#6B6B67]">© {new Date().getFullYear()} MONOTASK</span>
          <nav className="flex items-center gap-6">
            <button onClick={() => navigate('/auth?mode=signup')} className="text-sm text-[#6B6B67] hover:text-[#0A0A0A] transition-colors inline-flex items-center gap-1">
              Get started
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button onClick={scrollToCapabilities} className="text-sm text-[#6B6B67] hover:text-[#0A0A0A] transition-colors">
              Features
            </button>
            <button onClick={() => navigate('/auth')} className="text-sm text-[#6B6B67] hover:text-[#0A0A0A] transition-colors">
              Sign in
            </button>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
