import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useMotionValueEvent, useTransform } from 'framer-motion';
import { CheckSquare, ArrowRight, Sparkles, Check, Mail, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MagneticButton } from '@/components/landing/MagneticButton';
import { GrainOverlay } from '@/components/landing/GrainOverlay';
import { ThemeToggle } from '@/components/landing/ThemeToggle';
import { AIShowcase } from '@/components/landing/AIShowcase';
import { SyncDiagram } from '@/components/landing/SyncDiagram';
import { ProductWindow } from '@/components/landing/ProductWindow';
import {
  Eyebrow,
  Reveal,
  WorksWithStrip,
  ProblemSection,
  TrustBand,
  FeatureGrid,
  HowItWorks,
  FaqSection,
  LandingFooter,
} from '@/components/landing/LandingSections';

const HEADLINE = ['Your', 'inbox', 'and', 'calendars,', 'turned', 'into', 'a', 'plan.'];

const NAV_LINKS = [
  { href: '#ai', label: 'AI' },
  { href: '#integrations', label: 'Integrations' },
  { href: '#features', label: 'Features' },
  { href: '#faq', label: 'FAQ' },
];

function FloatChip({
  children,
  icon,
  className,
  delay,
  drift,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  className?: string;
  delay: number;
  drift: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute z-10 hidden lg:block ${className ?? ''}`}
      initial={reduce ? false : { opacity: 0, scale: 0.85, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, drift, 0] }}
        transition={{ duration: 5 + Math.abs(drift) / 4, repeat: Infinity, ease: 'easeInOut', delay }}
        className="flex items-center gap-2 rounded-full border border-border bg-card/90 px-3.5 py-2 text-xs font-medium text-foreground shadow-[0_12px_40px_-12px_hsl(var(--foreground)/0.35)] backdrop-blur"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">{icon}</span>
        {children}
      </motion.div>
    </motion.div>
  );
}

const Landing = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const { scrollY, scrollYProgress } = useScroll();
  const windowRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: tiltProgress } = useScroll({ target: windowRef, offset: ['start end', 'start 25%'] });
  const tiltRotate = useTransform(tiltProgress, [0, 1], [18, 0]);
  const tiltScale = useTransform(tiltProgress, [0, 1], [0.9, 1]);

  useEffect(() => {
    if (!loading && user) navigate('/app');
  }, [user, loading, navigate]);

  useMotionValueEvent(scrollY, 'change', (latest) => setScrolled(latest > 20));

  const goToSignup = () => navigate('/auth?mode=signup');
  const goToSignin = () => navigate('/auth');

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  const heroIn = (delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <div className="min-h-[100dvh] bg-background overflow-x-clip">
      <GrainOverlay />

      {!prefersReducedMotion && (
        <motion.div
          aria-hidden
          style={{ scaleX: scrollYProgress }}
          className="fixed left-0 right-0 top-0 z-[60] h-0.5 origin-left bg-foreground"
        />
      )}

      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
          scrolled ? 'bg-background/85 backdrop-blur-xl border-b border-border' : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
              <CheckSquare className="h-[18px] w-[18px] text-background" />
            </span>
            <span className="font-grotesk text-lg font-semibold tracking-tight text-foreground">Monotask</span>
          </a>
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map(({ href, label }) => (
              <a key={href} href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                {label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Button variant="ghost" onClick={goToSignin} className="text-muted-foreground hover:text-foreground">
              Sign In
            </Button>
            <MagneticButton onClick={goToSignup} className="group" strength={0.25}>
              <span className="hidden sm:inline">Get Started</span>
              <span className="sm:hidden">Start</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </MagneticButton>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        id="top"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
          e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
        }}
        className="relative px-4 pb-0 pt-32 sm:px-6 sm:pt-40 lg:px-8"
      >
        {/* Brighter grid lines that only show around the cursor */}
        {!prefersReducedMotion && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden opacity-0 transition-opacity duration-500 [background-image:linear-gradient(hsl(var(--foreground)/0.22)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground)/0.22)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(240px_circle_at_var(--mx,-999px)_var(--my,-999px),black,transparent)] [@media(hover:hover)]:block [@media(hover:hover)]:opacity-100"
          />
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5] [background-image:linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
        />
        <div className="relative mx-auto max-w-5xl text-center">
          <motion.div {...heroIn(0)}>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-foreground" />
              AI capture, plus two-way Google and Microsoft sync
            </span>
          </motion.div>
          <h1 className="mx-auto mt-7 max-w-4xl text-balance font-grotesk text-5xl font-semibold leading-[1.02] tracking-[-0.045em] text-foreground sm:text-7xl">
            {HEADLINE.map((word, i) => (
              <span key={i}>
                <span className="inline-block overflow-hidden pb-[0.12em] align-top">
                  <motion.span
                    className="inline-block"
                    initial={prefersReducedMotion ? false : { y: '110%', opacity: 0, filter: 'blur(8px)' }}
                    animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {word}
                  </motion.span>
                </span>{' '}
              </span>
            ))}
          </h1>
          <motion.p {...heroIn(0.16)} className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            Monotask finds the tasks and clashes hiding in your email and meetings, keeps Google and
            Microsoft in sync, and never acts without your approval.
          </motion.p>
          <motion.div {...heroIn(0.24)} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <MagneticButton size="lg" onClick={goToSignup} className="group w-full px-8 sm:w-auto">
              Get started free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </MagneticButton>
            <Button size="lg" variant="outline" asChild className="w-full px-8 sm:w-auto">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </motion.div>
          <motion.p {...heroIn(0.3)} className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <Check className="h-4 w-4" /> Free for personal use. No credit card.
          </motion.p>
        </div>

        <motion.div {...heroIn(0.36)} className="relative mx-auto mt-16 max-w-5xl">
          <div ref={windowRef} className="[perspective:1400px]">
            <motion.div
              style={prefersReducedMotion ? undefined : { rotateX: tiltRotate, scale: tiltScale, transformOrigin: '50% 0%' }}
              className="max-h-[420px] overflow-hidden sm:max-h-[540px]"
            >
              <ProductWindow />
            </motion.div>
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />

          {/* Floating status chips: the live-product story in motion */}
          <FloatChip className="-left-4 top-24 xl:-left-28" delay={1.4} drift={9} icon={<Check className="h-3.5 w-3.5" />}>
            Synced with Google Calendar
          </FloatChip>
          <FloatChip className="-right-4 top-36 xl:-right-28" delay={1.8} drift={-8} icon={<Mail className="h-3.5 w-3.5" />}>
            New suggestion from Gmail
          </FloatChip>
          <FloatChip className="-left-2 top-[21rem] xl:-left-20" delay={2.2} drift={7} icon={<CalendarClock className="h-3.5 w-3.5" />}>
            Meeting overlap found
          </FloatChip>
        </motion.div>
      </section>

      <WorksWithStrip />
      <ProblemSection />

      {/* AI */}
      <section id="ai" className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Reveal className="mx-auto max-w-3xl text-center">
            <Eyebrow>Built-in AI</Eyebrow>
            <h2 className="text-balance mt-6 font-grotesk text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
              Say it in plain English. Or let it find it for you.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              Type a task and AI fills in the fields. Turn on message scanning and it surfaces the
              requests hiding in Gmail, Outlook and Teams, and proposes fixes for double-booked meetings.
            </p>
          </Reveal>
          <Reveal className="mt-14">
            <AIShowcase />
          </Reveal>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Every AI draft lands in the form for you to review. Nothing saves itself.
          </p>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="border-t border-border bg-secondary/40 px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal className="mx-auto max-w-2xl">
            <Eyebrow>Integrations</Eyebrow>
            <h2 className="text-balance mt-6 font-grotesk text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
              Google and Microsoft, in sync both ways.
            </h2>
            <p className="mt-5 text-lg text-muted-foreground">
              Calendar events and tasks flow in, and your edits flow back out. Connect several
              accounts per provider and let the background sync do the rest.
            </p>
          </Reveal>
          <Reveal className="mt-14">
            <SyncDiagram />
          </Reveal>
        </div>
      </section>

      <TrustBand />
      <FeatureGrid />
      <HowItWorks />
      <FaqSection />

      {/* Final CTA */}
      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-foreground px-8 py-16 text-center sm:py-24">
          <div
            aria-hidden
            className="animate-grid-drift pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(hsl(var(--background))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--background))_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_50%,black,transparent)]"
          />
          <div className="relative">
            <h2 className="text-balance mx-auto max-w-3xl font-grotesk text-4xl font-semibold tracking-[-0.03em] text-background sm:text-5xl">
              Stop chasing your commitments. Start planning them.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-lg text-background/60">
              Free for personal use. No credit card, no trial clock.
            </p>
            <span className="relative mt-9 inline-flex">
              {!prefersReducedMotion && (
                <span aria-hidden className="absolute inset-0 animate-ping rounded-md bg-background/25 [animation-duration:2.8s]" />
              )}
              <MagneticButton
                size="lg"
                onClick={goToSignup}
                className="group relative bg-background px-9 text-foreground hover:bg-background/90"
              >
                Get started free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </MagneticButton>
            </span>
          </div>
        </Reveal>
      </section>

      <LandingFooter onSignIn={goToSignin} onSignUp={goToSignup} />
    </div>
  );
};

export default Landing;
