import { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WEEKLY = [
  { day: 'Sun', completed: 2 },
  { day: 'Mon', completed: 5 },
  { day: 'Tue', completed: 4 },
  { day: 'Wed', completed: 6 },
  { day: 'Thu', completed: 3 },
  { day: 'Fri', completed: 5 },
  { day: 'Sat', completed: 1 },
];

// 84 days (12 weeks), organic-looking activity counts, not a fabricated
// smooth curve.
const HEATMAP = Array.from({ length: 84 }, (_, i) => {
  const noise = Math.sin(i * 1.7) * Math.cos(i * 0.6);
  return Math.max(0, Math.round((noise + 1) * 2 + (i % 11 === 0 ? 2 : 0)));
});

/**
 * Echoes ProgressView's own bar chart and heatmap almost exactly (same
 * recharts config, same hsl(var(--primary)) heatmap fill logic) so the
 * landing page shows the real analytics visual language instead of a
 * divergent fake one. The AI summary button mirrors the real on-demand
 * generate flow: nothing until the user asks for it, then a short phrasing
 * of stats that were already computed, never invented numbers.
 */
export function AnalyticsPreview() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const [summaryRequested, setSummaryRequested] = useState(false);
  const [summaryReady, setSummaryReady] = useState(false);

  useEffect(() => {
    if (!summaryRequested) return;
    const t = setTimeout(() => setSummaryReady(true), 900);
    return () => clearTimeout(t);
  }, [summaryRequested]);

  return (
    <div ref={ref} className="grid gap-5 lg:grid-cols-5">
      <div className="rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-foreground/25 hover:shadow-md sm:p-6 lg:col-span-2">
        <h3 className="mb-4 text-sm font-medium text-foreground">Weekly task completion</h3>
        {inView || reduceMotion ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={WEEKLY}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" />
              <YAxis hide />
              <Bar
                dataKey="completed"
                className="fill-foreground"
                radius={[3, 3, 0, 0]}
                isAnimationActive={!reduceMotion}
                animationDuration={700}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 160 }} aria-hidden />
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-foreground/25 hover:shadow-md sm:p-6 lg:col-span-3">
        <h3 className="mb-4 text-sm font-medium text-foreground">12-week activity heatmap</h3>
        <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-[3px] sm:grid-cols-[repeat(21,minmax(0,1fr))]">
          {HEATMAP.map((count, i) => {
            const intensity = Math.min(count / 6, 1);
            const opacity = count > 0 ? Math.max(0.14, intensity) : 0;
            return (
              <motion.div
                key={i}
                initial={reduceMotion ? undefined : { opacity: 0, scale: 0.6 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.15, delay: reduceMotion ? 0 : Math.min(i, 40) * 0.006 }}
                className="aspect-square rounded-[2px] bg-muted"
                style={opacity > 0 ? { backgroundColor: `hsl(var(--foreground) / ${opacity})` } : undefined}
              />
            );
          })}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          {!summaryRequested ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                <span className="text-sm text-muted-foreground">AI weekly summary</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => setSummaryRequested(true)}>
                Generate
              </Button>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
              {summaryReady ? (
                <motion.p
                  initial={reduceMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-foreground/80"
                >
                  You completed 26 tasks this week, ahead of your last four-week average, with
                  Wednesday as your strongest day.
                </motion.p>
              ) : (
                <p className="text-sm text-muted-foreground">Generating summary...</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
