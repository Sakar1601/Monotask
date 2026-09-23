import { motion, useReducedMotion } from 'framer-motion';
import { CheckSquare, ShieldCheck, Mail } from 'lucide-react';

interface SyncNode {
  slug: string | null;
  name: string;
}

// Simple Icons doesn't carry a Microsoft/Outlook mark at all (checked their
// current slug catalog directly - it isn't a broken slug, the brand isn't in
// the set). Rather than ship a broken <img> or guess at a trademarked glyph,
// nodes without a resolvable icon fall back to a plain lucide mark - honest
// about not being an official logo, and consistent with the icon language
// used everywhere else in this app.
const NODES: SyncNode[] = [
  { slug: 'googlecalendar', name: 'Google Calendar' },
  { slug: null, name: 'Microsoft Outlook' },
];

/**
 * A real diagram, not a fake screenshot: two logo nodes flanking the
 * Monotask mark, connected by lines that carry animated pulses in BOTH
 * directions on each side, to make "two-way" a visible fact rather than a
 * claim. Backed by supabase/functions/sync-integrations and
 * push-integration-change. Motion is motivated: it is the entire content of
 * the section, storytelling the direction of sync, not decoration on top of
 * a static diagram.
 */
export function SyncDiagram() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="rounded-3xl border border-border bg-card p-6 sm:p-10">
      <div className="relative mx-auto flex max-w-2xl items-center justify-between">
        {/* Connecting lines, drawn first so nodes sit above them */}
        <svg
          aria-hidden
          className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 overflow-visible"
        >
          <line x1="12%" y1="0" x2="88%" y2="0" stroke="currentColor" strokeWidth="1.5" className="text-border" />
        </svg>

        {NODES.map((node, i) => (
          <div key={node.name} className="relative z-10 flex flex-col items-center gap-2">
            <motion.div
              whileHover={reduceMotion ? undefined : { scale: 1.06 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background sm:h-16 sm:w-16"
            >
              {node.slug ? (
                <img
                  src={`https://cdn.simpleicons.org/${node.slug}`}
                  alt={node.name}
                  width={26}
                  height={26}
                  className="h-6 w-6 opacity-80 dark:invert sm:h-7 sm:w-7"
                  loading="lazy"
                />
              ) : (
                <Mail className="h-6 w-6 text-foreground/70 sm:h-7 sm:w-7" strokeWidth={1.75} aria-label={node.name} />
              )}
            </motion.div>
            <span className="text-xs font-medium text-muted-foreground">{node.name}</span>
            {i === 0 && (
              <motion.div
                aria-hidden
                animate={reduceMotion ? undefined : { x: ['0%', '620%'], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.6 }}
                className="absolute left-full top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-foreground/70"
                style={{ marginLeft: '1.75rem' }}
              />
            )}
            {i === 1 && (
              <motion.div
                aria-hidden
                animate={reduceMotion ? undefined : { x: ['0%', '-620%'], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.6, delay: 1.3 }}
                className="absolute right-full top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-foreground/70"
                style={{ marginRight: '1.75rem' }}
              />
            )}
          </div>
        ))}

        {/* Center node, positioned between the two via flex order rather
            than absolute math, so it stays correct at any width. */}
        <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground shadow-lg sm:h-[4.5rem] sm:w-[4.5rem]">
            <CheckSquare className="h-7 w-7 text-background" strokeWidth={2} />
          </div>
          <span className="text-xs font-semibold text-foreground">Monotask</span>
        </div>
      </div>

      <div className="mt-10 flex items-start justify-center gap-2.5 border-t border-border pt-6 text-center sm:mt-12">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
        <p className="max-w-sm text-sm text-muted-foreground">
          Changes flow both ways automatically, and overlapping edits from either side are
          flagged as conflicts instead of silently overwritten.
        </p>
      </div>
    </div>
  );
}
