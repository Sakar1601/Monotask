import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion, type Variants, type MotionProps } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Design system for this page only (scoped via arbitrary Tailwind values -
// the authenticated app keeps its own tokens in index.css/tailwind.config.ts).
//
//   bg       #FAFAF8  page background, warm off-white
//   ink      #0A0A0A  primary text
//   muted    #6B6B67  secondary text
//   hair     #E4E2DC  hairline dividers
//   ghost    #EDECE6  the oversized watermark numeral + subtle fills
//
// No hue accent anywhere. Monotask's pitch is "no clutter" - a page with a
// single interface color is that pitch enacted, not illustrated. The one
// real risk this page takes is committing to that with nothing to fall back
// on: no gradient, no icon grid, no second color to reach for if a section
// feels flat.
//
// Signature: the page is built as one full-screen idea at a time (CSS scroll
// snap), literalizing "mono-task" as a reading experience, not just a word -
// echoed by a single vertical line that fills as you scroll and a huge ghost
// "1" behind the hero headline. Restraint everywhere else: no numbered
// feature lists (nothing here is a sequence), no card grid, no gradients.
// ---------------------------------------------------------------------------

const CAPABILITIES = [
  {
    label: 'TASKS',
    text: 'Due dates, priorities, and tags - with recurring schedules that actually repeat, on the calendar and in the list.',
  },
  {
    label: 'HABITS',
    text: 'Daily, weekly, or monthly. Done, skipped, or missed - no habit tracker that only knows "done."',
  },
  {
    label: 'CALENDAR',
    text: 'Month, week, and agenda views that understand recurring tasks - not just whatever was due on day one.',
  },
  {
    label: 'PROGRESS',
    text: 'Completion trends, tag breakdowns, and a twelve-week activity heatmap. No vanity metrics.',
  },
  {
    label: 'EXPORT',
    text: 'PDF, CSV, or a JSON backup you can import back in - to this account or a different one.',
  },
] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const Landing = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const capabilitiesRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({ container: scrollRef });
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

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

  const enter = (delay = 0): MotionProps =>
    prefersReducedMotion
      ? {}
      : {
          initial: 'hidden',
          whileInView: 'visible',
          viewport: { once: true, margin: '-10%' },
          variants: fadeUp,
          transition: { duration: 0.6, delay, ease: 'easeOut' },
        };

  return (
    <div className="bg-[#FAFAF8] text-[#0A0A0A] font-sans">
      {/* Fixed nav - sits above the scroll container */}
      <header className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-6 sm:px-10 h-16">
        <span className="font-mono text-xs tracking-[0.2em] font-medium">MONOTASK</span>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate('/auth')}
            className="text-[#0A0A0A] hover:bg-[#0A0A0A]/5 font-sans"
          >
            Sign in
          </Button>
          <Button
            onClick={() => navigate('/auth?mode=signup')}
            className="bg-[#0A0A0A] text-[#FAFAF8] hover:bg-[#0A0A0A]/85 rounded-full px-5"
          >
            Start free
          </Button>
        </div>
      </header>

      {/* Single vertical progress line - the page's "mono" line */}
      <div className="fixed left-0 top-0 bottom-0 w-px z-40 hidden sm:block" aria-hidden="true">
        <div className="absolute inset-0 bg-[#E4E2DC]" />
        <motion.div className="absolute inset-x-0 top-0 bottom-0 bg-[#0A0A0A] origin-top" style={{ scaleY: lineScale }} />
      </div>

      <div
        ref={scrollRef}
        className="h-dvh overflow-y-auto snap-y snap-proximity scroll-smooth"
      >
        {/* ---------------------------------------------------------- HERO */}
        <section className="relative min-h-dvh snap-start flex flex-col justify-center overflow-hidden px-6 sm:px-10">
          <span
            aria-hidden="true"
            className="pointer-events-none select-none absolute -right-[8vw] top-1/2 -translate-y-1/2 font-mono font-medium text-[#EDECE6] leading-none"
            style={{ fontSize: 'min(60vw, 640px)' }}
          >
            1
          </span>

          <div className="relative max-w-4xl mx-auto w-full pt-16">
            <motion.p {...enter(0)} className="font-mono text-xs sm:text-sm tracking-[0.2em] text-[#6B6B67] mb-6">
              A PRODUCTIVITY APP WITH ONE JOB
            </motion.p>

            <motion.h1
              {...enter(0.08)}
              className="font-grotesk font-bold tracking-tight leading-[0.95] text-[13vw] sm:text-[7rem] lg:text-[8rem]"
            >
              Do one thing.
              <br />
              Then the next.
            </motion.h1>

            <motion.p {...enter(0.2)} className="mt-8 max-w-lg text-lg text-[#6B6B67] leading-relaxed">
              Tasks, habits, and a calendar that agree with each other - and nothing else
              competing for your attention.
            </motion.p>

            <motion.div {...enter(0.3)} className="mt-10 flex flex-wrap items-center gap-4">
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

        {/* ------------------------------------------------------- PROBLEM */}
        <section className="relative min-h-dvh snap-start flex flex-col justify-center px-6 sm:px-10 border-t border-[#E4E2DC]">
          <div className="max-w-3xl mx-auto w-full text-center">
            <motion.p {...enter(0)} className="font-grotesk font-medium text-3xl sm:text-5xl leading-tight text-[#6B6B67]">
              Most productivity tools solve overwhelm
              <br />
              by adding another tab.
            </motion.p>
            <motion.p {...enter(0.15)} className="font-grotesk font-bold text-3xl sm:text-5xl leading-tight mt-6">
              Monotask removed the tabs.
            </motion.p>
          </div>
        </section>

        {/* --------------------------------------------------- CAPABILITIES */}
        <section
          ref={capabilitiesRef}
          className="relative min-h-dvh snap-start flex flex-col justify-center px-6 sm:px-10 border-t border-[#E4E2DC]"
        >
          <div className="max-w-3xl mx-auto w-full py-24">
            <motion.p {...enter(0)} className="font-mono text-xs tracking-[0.2em] text-[#6B6B67] mb-10">
              WHAT'S INSIDE
            </motion.p>

            <div>
              {CAPABILITIES.map((item, i) => (
                <motion.div
                  key={item.label}
                  {...enter(0.05 * i)}
                  className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-8 py-6 border-b border-[#E4E2DC] first:border-t"
                >
                  <span className="font-mono text-xs tracking-[0.15em] text-[#0A0A0A] shrink-0 sm:w-32">
                    {item.label}
                  </span>
                  <span className="text-[#6B6B67] leading-relaxed">{item.text}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- AI SPOTLIGHT */}
        <section className="relative min-h-dvh snap-start flex flex-col justify-center px-6 sm:px-10 border-t border-[#E4E2DC]">
          <div className="max-w-4xl mx-auto w-full grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <motion.p {...enter(0)} className="font-mono text-xs tracking-[0.2em] text-[#6B6B67] mb-6">
                AI, USED SPARINGLY
              </motion.p>
              <motion.h2 {...enter(0.08)} className="font-grotesk font-bold text-4xl sm:text-5xl leading-[1.02]">
                Type it like
                <br />
                you'd say it.
              </motion.h2>
              <motion.p {...enter(0.18)} className="mt-6 text-[#6B6B67] leading-relaxed max-w-sm">
                Claude fills in the rest, and you confirm before anything's saved. Ask for a
                weekly recap and get three honest sentences about what actually happened - not
                another dashboard.
              </motion.p>
            </div>

            <motion.div {...enter(0.15)} className="font-mono text-sm">
              <div className="border border-[#E4E2DC] rounded-2xl bg-white p-5 shadow-[0_1px_0_#E4E2DC]">
                <p className="text-[#6B6B67] mb-4">
                  <span className="text-[#0A0A0A]">&gt;</span> lunch with sam tomorrow 1pm, high priority
                </p>
                <div className="flex flex-wrap gap-2">
                  {['Lunch with Sam', 'Tomorrow', '1:00 PM', 'High'].map((chip) => (
                    <span
                      key={chip}
                      className="px-3 py-1.5 rounded-full border border-[#E4E2DC] text-xs tracking-wide text-[#0A0A0A]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ------------------------------------------------------- CLOSING */}
        <section className="relative min-h-dvh snap-start flex flex-col justify-center px-6 sm:px-10 border-t border-[#E4E2DC]">
          <div className="max-w-3xl mx-auto w-full text-center">
            <motion.h2 {...enter(0)} className="font-grotesk font-bold text-5xl sm:text-7xl leading-[0.95]">
              Start with
              <br />
              one task.
            </motion.h2>
            <motion.p {...enter(0.12)} className="mt-6 text-[#6B6B67] text-lg">
              No credit card. No onboarding tour. Just the next thing you need to do.
            </motion.p>
            <motion.div {...enter(0.22)} className="mt-10">
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
            <span className="font-mono text-xs tracking-[0.2em] text-[#6B6B67]">
              © {new Date().getFullYear()} MONOTASK
            </span>
            <nav className="flex items-center gap-6">
              <button
                onClick={() => navigate('/auth?mode=signup')}
                className="text-sm text-[#6B6B67] hover:text-[#0A0A0A] transition-colors inline-flex items-center gap-1"
              >
                Get started
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={scrollToCapabilities}
                className="text-sm text-[#6B6B67] hover:text-[#0A0A0A] transition-colors"
              >
                Features
              </button>
              <button
                onClick={() => navigate('/auth')}
                className="text-sm text-[#6B6B67] hover:text-[#0A0A0A] transition-colors"
              >
                Sign in
              </button>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
