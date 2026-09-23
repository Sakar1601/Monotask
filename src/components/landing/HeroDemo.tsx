import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sparkles, Repeat, Flame, Check, MousePointer2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

const QUICK_ADD_PHRASE = 'Lunch with Sam, tomorrow 1pm';

type Phase = 'typing' | 'added' | 'list' | 'completing' | 'settled' | 'resetting';

const SPRING_SNAPPY = { type: 'spring', stiffness: 300, damping: 30 } as const;

/**
 * The hero used to sit an abstract 3D geometry cluster behind this card -
 * shapes with no connection to what the product actually does. Replaced
 * with a short, looping "watch it work" sequence instead: AI Quick Add
 * types itself out, the drafted task lands in the list, a real task gets
 * checked off with the same completion-burst feedback TaskManager uses, the
 * streak ticks up, then it resets. The point is to demonstrate the product
 * being pleasant to use in the first five seconds, not to decorate the page.
 *
 * Reduced motion: skips the loop entirely and renders the single settled
 * end-state (task added, one item done, streak already at 12) - the same
 * information the loop tells a story about, just without the story.
 */
export function HeroDemo() {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduceMotion ? 'settled' : 'typing');
  const [typed, setTyped] = useState(reduceMotion ? QUICK_ADD_PHRASE : '');
  const [burst, setBurst] = useState(false);
  const [streak, setStreak] = useState(reduceMotion ? 12 : 11);
  const [cursorStage, setCursorStage] = useState<'hidden' | 'arriving' | 'pressing' | 'leaving'>('hidden');
  const [ringPulse, setRingPulse] = useState(false);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (reduceMotion) return;
    const schedule = (fn: () => void, delay: number) => {
      timeouts.current.push(setTimeout(fn, delay));
    };

    function runLoop() {
      setPhase('typing');
      setTyped('');
      setBurst(false);
      setStreak(11);
      setCursorStage('hidden');
      setRingPulse(false);

      let i = 0;
      const typeInterval = setInterval(() => {
        i += 1;
        setTyped(QUICK_ADD_PHRASE.slice(0, i));
        if (i >= QUICK_ADD_PHRASE.length) {
          clearInterval(typeInterval);
          schedule(() => setPhase('added'), 450);
          schedule(() => setPhase('list'), 1150);
          schedule(() => setCursorStage('arriving'), 1700);
          schedule(() => setCursorStage('pressing'), 2350);
          schedule(() => setPhase('completing'), 2450);
          schedule(() => setBurst(true), 2470);
          schedule(() => setRingPulse(true), 2470);
          schedule(() => setCursorStage('leaving'), 2650);
          schedule(() => setStreak(12), 2750);
          schedule(() => setPhase('settled'), 2950);
          schedule(() => setCursorStage('hidden'), 3200);
          schedule(() => setRingPulse(false), 3400);
          schedule(() => setPhase('resetting'), 5600);
          schedule(runLoop, 6100);
        }
      }, 42);
      timeouts.current.push(typeInterval as unknown as ReturnType<typeof setTimeout>);
    }

    runLoop();
    return () => {
      timeouts.current.forEach((t) => clearTimeout(t));
      timeouts.current = [];
    };
  }, [reduceMotion]);

  const showList = phase === 'list' || phase === 'completing' || phase === 'settled';
  const isDone = phase === 'completing' || phase === 'settled';
  const cardVisible = phase !== 'resetting';

  return (
    <Card className="relative border-border shadow-xl p-5 sm:p-6 rounded-2xl overflow-hidden">
      {/* Ambient ring pulse, synced to the completion moment - reads as the
          card itself acknowledging the action, not just the checkbox. */}
      <AnimatePresence>
        {ringPulse && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: 0, scale: 1.02 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-foreground/15"
          />
        )}
      </AnimatePresence>

      <motion.div
        animate={{ opacity: cardVisible ? 1 : 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-foreground">Today</h3>
          <Badge variant="secondary" className="font-normal">
            4 tasks
          </Badge>
        </div>

        <div className="space-y-3 min-h-[168px]">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/60 px-3 py-2.5">
            <Sparkles className="w-4 h-4 text-foreground shrink-0" />
            <span className="text-sm text-foreground flex-1 font-mono">
              {phase === 'typing' ? typed : QUICK_ADD_PHRASE}
              {phase === 'typing' && (
                <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-[2px] animate-pulse bg-foreground/60" />
              )}
            </span>
            <AnimatePresence>
              {phase !== 'typing' && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={SPRING_SNAPPY}
                >
                  <Badge className="text-[11px] px-1.5 py-0">AI</Badge>
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showList && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0 }}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <Checkbox checked disabled />
                  <span className="text-sm text-muted-foreground line-through flex-1">
                    Morning exercise routine
                  </span>
                  <Repeat className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0.06 }}
                  className="relative flex items-center gap-3 px-3 py-2"
                >
                  <span className="relative shrink-0">
                    <motion.span
                      animate={cursorStage === 'pressing' ? { scale: 0.85 } : { scale: 1 }}
                      transition={SPRING_SNAPPY}
                    >
                      <Checkbox checked={isDone} disabled />
                    </motion.span>
                    {/* A pointer that visibly travels to the checkbox and
                        clicks it - the single clearest way to read this as
                        "watching someone use the product" rather than
                        abstract state changes. */}
                    <AnimatePresence>
                      {cursorStage !== 'hidden' && (
                        <motion.span
                          aria-hidden
                          initial={{ opacity: 0, x: 36, y: -26, scale: 0.9 }}
                          animate={
                            cursorStage === 'leaving'
                              ? { opacity: 0, x: 10, y: -14, scale: 0.9 }
                              : { opacity: 1, x: 6, y: -2, scale: cursorStage === 'pressing' ? 0.82 : 1 }
                          }
                          exit={{ opacity: 0 }}
                          transition={
                            cursorStage === 'pressing'
                              ? { duration: 0.12 }
                              : { type: 'spring', stiffness: 260, damping: 24 }
                          }
                          className="pointer-events-none absolute left-1 top-1 z-10 text-foreground drop-shadow-sm"
                        >
                          <MousePointer2 className="h-4 w-4 fill-background" strokeWidth={2} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {burst && (
                      <AnimatePresence onExitComplete={() => setBurst(false)}>
                        {Array.from({ length: 6 }).map((_, i) => {
                          const angle = (i / 6) * Math.PI * 2;
                          return (
                            <motion.span
                              key={i}
                              className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-foreground"
                              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                              animate={{
                                x: Math.cos(angle) * 16,
                                y: Math.sin(angle) * 16,
                                opacity: 0,
                                scale: 0.4,
                              }}
                              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            />
                          );
                        })}
                      </AnimatePresence>
                    )}
                  </span>
                  <span
                    className={`text-sm flex-1 transition-colors ${
                      isDone ? 'text-muted-foreground line-through' : 'text-foreground'
                    }`}
                  >
                    Finish project proposal
                  </span>
                  {!isDone && (
                    <Badge variant="secondary" className="text-[11px]">
                      High
                    </Badge>
                  )}
                  {isDone && <Check className="w-3.5 h-3.5 text-foreground shrink-0" strokeWidth={2.5} />}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0.12 }}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <Checkbox disabled />
                  <span className="text-sm text-foreground flex-1">Review team updates</span>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
          <div className="relative flex items-center gap-1.5 text-sm text-foreground">
            <motion.span animate={streak === 12 ? { scale: [1, 1.3, 1] } : { scale: 1 }} transition={{ duration: 0.45 }}>
              <Flame className="w-4 h-4 text-foreground" />
            </motion.span>
            <AnimatePresence>
              {streak === 12 && ringPulse === false && cardVisible && (
                <motion.span
                  aria-hidden
                  initial={{ opacity: 0.8, y: 0, scale: 0.8 }}
                  animate={{ opacity: 0, y: -14, scale: 1.1 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="pointer-events-none absolute left-0 top-0"
                >
                  <Flame className="w-3.5 h-3.5 text-foreground/50" />
                </motion.span>
              )}
            </AnimatePresence>
            <span className="font-medium tabular-nums">{streak} day streak</span>
          </div>
          <span className="text-xs text-muted-foreground">Morning meditation</span>
        </div>
      </motion.div>
    </Card>
  );
}
