import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useRef } from 'react';
import { motion, useReducedMotion, useScroll, useMotionValueEvent, useTransform } from 'framer-motion';
import {
  CheckSquare,
  ArrowRight,
  Check,
  Target,
  LineChart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MagneticButton } from '@/components/landing/MagneticButton';
import { GrainOverlay } from '@/components/landing/GrainOverlay';
import { StepsStack } from '@/components/landing/StepsStack';
import { ThemeToggle } from '@/components/landing/ThemeToggle';
import { AIShowcase } from '@/components/landing/AIShowcase';
import { SyncDiagram } from '@/components/landing/SyncDiagram';
import { RecurringDemo } from '@/components/landing/RecurringDemo';
import { AnalyticsPreview } from '@/components/landing/AnalyticsPreview';
import { HeroDemo } from '@/components/landing/HeroDemo';
import { TiltCard } from '@/components/landing/TiltCard';
import { AddStepDemo, CheckOffStepDemo, PatternStepDemo } from '@/components/landing/StepDemos';
import { FeatureDetailGrid } from '@/components/landing/FeatureDetailGrid';

/**
 * Design read: a productivity landing page for people drowning in
 * five different apps, in a pure monochrome, typography-and-motion-driven
 * language, leaning on the existing cinematic infrastructure (3D hero,
 * GSAP sticky-stack, magnetic buttons, tilt cards, grain) recolored to
 * grayscale. "Monotask" is about doing one thing at a time; removing the
 * accent color is not a downgrade, it is the same idea applied to the page
 * itself. Dials for this pass: DESIGN_VARIANCE 9, MOTION_INTENSITY 9,
 * VISUAL_DENSITY 4.
 */
const Landing = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const featuresRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollY } = useScroll();

  useEffect(() => {
    if (!loading && user) {
      navigate('/app');
    }
  }, [user, loading, navigate]);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 20);
  });

  // Logo shrinks a touch as the nav picks up its scrolled background, a
  // small piece of continuous feedback that the page is tracking scroll
  // position rather than the nav just snapping between two fixed states.
  const logoScale = useTransform(scrollY, [0, 160], [1, 0.9]);

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const goToSignup = () => navigate('/auth?mode=signup');
  const goToSignin = () => navigate('/auth');

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  const fadeUp = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-80px' },
        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
      };

  // A second entrance flavor for sections that read better as a settle-in
  // than a slide-up (the sync diagram is a centered object, not a list),
  // so the scroll rhythm varies rather than repeating the same fadeUp for
  // every single section on the page.
  const fadeScale = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, scale: 0.94 },
        whileInView: { opacity: 1, scale: 1 },
        viewport: { once: true, margin: '-80px' },
        transition: { type: 'spring', stiffness: 100, damping: 20 } as const,
      };

  // A clip-reveal for the one section that breaks the page's layout pattern
  // (tabs over a card grid, deliberately denser than everywhere else) - the
  // heading unveils like a blind lifting rather than fading, marking the
  // section as a distinct moment before the tab content itself takes over.
  const clipReveal = prefersReducedMotion
    ? {}
    : {
        initial: { clipPath: 'inset(0 0 100% 0)', opacity: 0 },
        whileInView: { clipPath: 'inset(0 0 0% 0)', opacity: 1 },
        viewport: { once: true, margin: '-80px' },
        transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] as const },
      };

  const timelineSteps = [
    {
      icon: Target,
      title: 'Add tasks and habits',
      description: 'Type it in plain English or fill a short form. Both take a few seconds.',
      Demo: AddStepDemo,
    },
    {
      icon: Check,
      title: 'Check things off',
      description: 'Mark tasks done and keep your habit streaks alive, one day at a time.',
      Demo: CheckOffStepDemo,
    },
    {
      icon: LineChart,
      title: 'See the pattern',
      description: 'A calendar view and a twelve-week heatmap show you where the time actually went.',
      Demo: PatternStepDemo,
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-background overflow-x-hidden">
      <GrainOverlay />
      {/* Ambient background, fixed and non-interactive so it never taxes scroll compositing */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div
          animate={prefersReducedMotion ? undefined : { y: [0, -24, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-24 right-[8%] w-80 h-80 bg-foreground/[0.05] rounded-full blur-3xl"
        />
        <motion.div
          animate={prefersReducedMotion ? undefined : { y: [0, 20, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-20 left-[6%] w-72 h-72 bg-foreground/[0.03] rounded-full blur-3xl"
        />
      </div>

      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
          scrolled
            ? 'bg-background/85 backdrop-blur-xl border-b border-border'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <motion.div
              style={prefersReducedMotion ? undefined : { scale: logoScale }}
              className="flex items-center gap-2 origin-left"
            >
              <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center">
                <CheckSquare className="w-[18px] h-[18px] text-background" />
              </div>
              <span className="text-lg font-bold text-foreground tracking-tight font-grotesk">
                Monotask
              </span>
            </motion.div>
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <Button variant="ghost" onClick={goToSignin} className="text-muted-foreground hover:text-foreground">
                Sign In
              </Button>
              <MagneticButton onClick={goToSignup} className="group" strength={0.25}>
                <span className="hidden sm:inline">Get Started</span>
                <span className="sm:hidden">Start</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </MagneticButton>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero: asymmetric split. The right side used to carry an abstract 3D
          geometry cluster behind the preview card - shapes disconnected from
          anything the product does, which read as clutter rather than
          craft. Replaced with a quiet ambient glow (the ambient ramp already
          used elsewhere on the page) and a looping animated demo of the
          product actually working, per direct feedback: motion here should
          demonstrate the UI, not decorate around it. */}
      <section className="relative min-h-[100dvh] flex items-center pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 z-0 pointer-events-none opacity-80" aria-hidden>
          <div className="absolute right-[6%] top-1/2 -translate-y-1/2 w-[26rem] h-[26rem] bg-gradient-to-br from-foreground/[0.08] via-foreground/[0.02] to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-8 items-center w-full">
          <div className="text-center lg:text-left">
            <motion.h1
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight leading-[1.05] font-grotesk mb-5"
            >
              One task at a time.
              <br />
              Everything else stays quiet.
            </motion.h1>

            <motion.p
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="text-lg text-muted-foreground max-w-md mx-auto lg:mx-0 mb-8"
            >
              Tasks, habits, and your calendar in one place, with AI filling in the details
              you would rather skip.
            </motion.p>

            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3"
            >
              <MagneticButton size="lg" onClick={goToSignup} className="px-7 group w-full sm:w-auto">
                Get Started
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </MagneticButton>
              <Button size="lg" variant="outline" onClick={scrollToFeatures} className="px-7 w-full sm:w-auto">
                Features
              </Button>
            </motion.div>
          </div>

          {/* Looping product demo, built from the actual UI primitives -
              see HeroDemo for the sequencing. Still gets the tilt/spotlight
              treatment so it doesn't feel static relative to the rest of
              the page's motion language. */}
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full max-w-sm mx-auto lg:max-w-none"
          >
            <TiltCard className="rounded-2xl">
              <HeroDemo />
            </TiltCard>
          </motion.div>
        </div>
      </section>

      {/* AI: quick add + suggestions, the strongest differentiator, gets a
          full-width spotlight with two real interactive recreations rather
          than a bento cell each. */}
      <section ref={featuresRef} className="py-24 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp} className="max-w-2xl mb-12">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Built-in AI
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground font-grotesk mb-3">
              Less typing. Less digging through your inbox.
            </h2>
            <p className="text-lg text-muted-foreground">
              Type a task in plain English and AI fills in the fields. Connect your inbox
              and it finds tasks already hiding in your messages.
            </p>
          </motion.div>

          <motion.div {...fadeUp}>
            <AIShowcase />
          </motion.div>
          <p className="mt-4 text-sm text-muted-foreground">
            Every AI draft lands in the form for you to review. Nothing saves itself.
          </p>
        </div>
      </section>

      {/* Two-way calendar sync: centered diagram, not a split, breaking the
          pattern before it can repeat. */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-secondary/40 border-y border-border">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div {...fadeScale} className="max-w-xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground font-grotesk mb-3">
              Synced both ways, automatically.
            </h2>
            <p className="text-lg text-muted-foreground">
              Google Calendar and Microsoft Outlook stay in step with Monotask in real time,
              so an edit on either side shows up everywhere else.
            </p>
          </motion.div>
          <motion.div {...fadeUp}>
            <SyncDiagram />
          </motion.div>
        </div>
      </section>

      {/* Recurring tasks: the one genuine text/image split on the page. */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground font-grotesk mb-3">
              Recurring tasks that respect each day.
            </h2>
            <p className="text-lg text-muted-foreground">
              Daily, weekly, or monthly, each occurrence is tracked on its own. Checking off
              today never checks off the rest of the series.
            </p>
          </motion.div>
          <motion.div {...fadeUp}>
            <RecurringDemo />
          </motion.div>
        </div>
      </section>

      {/* Analytics: dashboard-echo layout, reusing ProgressView's own chart
          and heatmap visual language so the landing page and the real
          product agree with each other. */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp} className="max-w-2xl mb-12">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Progress and analytics
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground font-grotesk mb-3">
              See the pattern, not just the list.
            </h2>
            <p className="text-lg text-muted-foreground">
              A weekly chart and a twelve-week heatmap show where your time actually went,
              plus an on-demand AI summary that never invents the numbers.
            </p>
          </motion.div>
          <motion.div {...fadeUp}>
            <AnalyticsPreview />
          </motion.div>
        </div>
      </section>

      {/* Every detail, covered: the full breadth of the app, from due dates
          and priorities down to import error messages, grouped into tabs
          rather than dumped as a flat bullet list. Direct, deliberate
          departure from the "cut ruthlessly" default for this one section,
          because comprehensive coverage is the explicit goal here, and this
          is the page everyone actually reads. A distinct layout family
          (tabs over a card grid) from every section around it. */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-secondary/40 border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-12">
            <motion.h2 {...clipReveal} className="text-3xl sm:text-4xl font-bold text-foreground font-grotesk mb-3">
              Every detail, covered.
            </motion.h2>
            <motion.p {...fadeUp} className="text-lg text-muted-foreground">
              Past the headline features, there is a lot of small, deliberate work in here too.
            </motion.p>
          </div>

          <motion.div {...fadeUp}>
            <FeatureDetailGrid />
          </motion.div>
        </div>
      </section>

      {/* How it works: GSAP sticky-stack, each step pins and shrinks away as
          the next one arrives. Each pinned card used to hold only an icon,
          a one-line heading, and a sentence, centered in an otherwise empty
          full-viewport slide - a void, not an impression. Every step now
          also carries a small real recreation of the thing it describes
          (see StepDemos), the same "built from actual app styling" pattern
          used by AIShowcase / RecurringDemo / SyncDiagram elsewhere, so the
          pinned time is spent looking at something. Collapses to plain
          vertical scroll below md (see StepsStack). */}
      <section className="bg-secondary/40 border-b border-border">
        <div className="pt-24 px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="max-w-3xl mx-auto text-center mb-4">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground font-grotesk">
              Three steps, no onboarding tour
            </h2>
          </motion.div>
        </div>

        <StepsStack
          items={timelineSteps.map((step, index) => {
            const Icon = step.icon;
            const Demo = step.Demo;
            const accent = index === 1;
            return {
              key: step.title,
              content: (
                <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
                  <div className="text-center">
                    <div
                      className={`mx-auto mb-5 w-14 h-14 rounded-2xl flex items-center justify-center ${
                        accent ? 'bg-foreground text-background' : 'bg-background border-2 border-foreground'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${accent ? '' : 'text-foreground'}`} />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-foreground font-grotesk mb-3">
                      {step.title}
                    </h3>
                    <p className="text-lg text-muted-foreground max-w-md mx-auto mb-9">{step.description}</p>
                  </div>
                  <TiltCard className="rounded-2xl">
                    <Demo />
                  </TiltCard>
                </div>
              ),
            };
          })}
        />
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <motion.div
          {...fadeUp}
          className="max-w-4xl mx-auto text-center rounded-3xl bg-foreground px-8 py-16 sm:py-20 relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
            <motion.div
              animate={prefersReducedMotion ? undefined : { scale: [1, 1.15, 1], opacity: [1, 0.7, 1] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-10 -left-10 w-72 h-72 bg-background rounded-full blur-3xl"
            />
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-background font-grotesk mb-4">
              Ready to focus on one thing?
            </h2>
            <p className="text-lg text-background/70 mb-9 max-w-md mx-auto">
              Free for personal use. No credit card, no trial clock.
            </p>
            <MagneticButton
              size="lg"
              onClick={goToSignup}
              className="bg-background text-foreground hover:bg-background/90 px-9 group"
            >
              Get Started
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </MagneticButton>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
        <motion.div {...fadeUp} className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="group flex items-center gap-2">
            <div className="w-7 h-7 bg-foreground rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:rotate-6">
              <CheckSquare className="w-4 h-4 text-background" />
            </div>
            <span className="text-base font-bold text-foreground font-grotesk">Monotask</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={scrollToFeatures}
              className="text-sm text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:text-foreground"
            >
              Features
            </button>
            <button
              onClick={goToSignin}
              className="text-sm text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:text-foreground"
            >
              Sign In
            </button>
            <button
              onClick={goToSignup}
              className="text-sm text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:text-foreground"
            >
              Get Started
            </button>
          </div>

          <p className="text-sm text-muted-foreground">
            {new Date().getFullYear()} Monotask
          </p>
        </motion.div>
      </footer>
    </div>
  );
};

export default Landing;
