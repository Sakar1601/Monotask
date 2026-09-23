import { type ReactNode, useState } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  CalendarClock,
  Flag,
  Tags,
  Repeat,
  ListFilter,
  Search,
  CalendarDays,
  CalendarRange,
  Rows3,
  Flame,
  CalendarCheck2,
  FileDown,
  FileSpreadsheet,
  FileJson,
  FileWarning,
  UserRound,
  Clock,
  ShieldCheck,
  SunMoon,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DetailItem {
  icon: typeof CalendarClock;
  label: string;
  detail: string;
}

interface DetailGroup {
  key: string;
  label: string;
  items: DetailItem[];
}

/**
 * The comprehensive "every detail, covered" tour. Deliberately denser than
 * the rest of the page: this is where the small, granular features live
 * (due dates, priorities, the three export formats, habit frequency, guest
 * upgrade, AI rate limiting) rather than the four or five headline ones
 * covered elsewhere. Rendered as tabs over icon/label card grids rather
 * than a flat bullet list, per the same "long list needs a real component"
 * rule the rest of the page already follows.
 */
const GROUPS: DetailGroup[] = [
  {
    key: 'tasks',
    label: 'Tasks',
    items: [
      { icon: CalendarClock, label: 'Due dates', detail: 'Set once, visible everywhere the task shows up' },
      { icon: Flag, label: 'Priorities', detail: 'High, medium, or low, sortable and filterable' },
      { icon: Tags, label: 'Categories', detail: 'The same tag system used across the whole app' },
      { icon: Repeat, label: 'Recurring intervals', detail: 'Daily, weekly, or monthly, every 1, 2, or N of them' },
      { icon: ListFilter, label: 'Today, Upcoming, Overdue, All', detail: 'Four tabs in Task Manager, always in sync' },
      { icon: Search, label: 'Search and filter', detail: 'By status, priority, or tag, all at once' },
    ],
  },
  {
    key: 'habits',
    label: 'Habits',
    items: [
      { icon: Flame, label: 'Tri-state logging', detail: 'Done, skipped, or missed, not just checked or not' },
      { icon: CalendarCheck2, label: 'Daily frequency', detail: 'A habit tracked every single day' },
      { icon: CalendarDays, label: 'Specific weekdays', detail: 'Mon, Wed, Fri, whatever the habit actually needs' },
      { icon: CalendarRange, label: 'Monthly frequency', detail: 'For habits that only make sense once a month' },
    ],
  },
  {
    key: 'calendar',
    label: 'Calendar',
    items: [
      { icon: CalendarDays, label: 'Month view', detail: 'The full month at a glance, recurring-aware' },
      { icon: CalendarRange, label: 'Week view', detail: 'A closer look at the next seven days' },
      { icon: Rows3, label: 'Agenda view', detail: 'A flat, scannable list instead of a grid' },
    ],
  },
  {
    key: 'data',
    label: 'Data',
    items: [
      { icon: FileDown, label: 'PDF export', detail: 'A summary report with your real metrics' },
      { icon: FileSpreadsheet, label: 'CSV export', detail: 'Tasks, habits, and logs, spreadsheet-ready' },
      { icon: FileJson, label: 'JSON export', detail: 'Fully round-trippable, tags resolved by name' },
      { icon: FileWarning, label: 'Import validation', detail: 'A specific reason on malformed input, not a generic failure' },
    ],
  },
  {
    key: 'account',
    label: 'Account',
    items: [
      { icon: UserRound, label: 'Guest access', detail: 'Start with zero signup, upgrade later without losing anything' },
      { icon: Clock, label: '12h or 24h time', detail: 'Pick the format you actually read' },
      { icon: SunMoon, label: 'Dark by default', detail: 'Light is there too, and the toggle applies instantly' },
      { icon: ShieldCheck, label: 'Rate-limited AI', detail: 'A daily cap per user, so it stays a feature, not a cost hole' },
    ],
  },
];

function DetailCard({ icon: Icon, label, detail, variants }: DetailItem & { variants?: Variants }): ReactNode {
  return (
    <motion.div
      variants={variants}
      className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-sm"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-foreground" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
      </div>
    </motion.div>
  );
}

export function FeatureDetailGrid() {
  const reduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState(GROUPS[0].key);

  const containerVariants: Variants = reduceMotion
    ? {}
    : {
        hidden: {},
        show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
      };
  const itemVariants: Variants = reduceMotion
    ? {}
    : {
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
      };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="mb-6 flex h-auto flex-wrap justify-center gap-1 bg-transparent p-0">
        {GROUPS.map((group) => (
          <TabsTrigger
            key={group.key}
            value={group.key}
            className="relative rounded-full border border-border px-4 py-1.5 text-sm transition-colors data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-background data-[state=inactive]:hover:border-foreground/40 data-[state=inactive]:hover:text-foreground"
          >
            {/* Painted first with no z-index: a negative z-index here fights
                with the trigger's own position:relative stacking context
                and can render this behind the trigger's box entirely
                (confirmed: made the active label unreadable, near-black
                text on a near-black button background because the white
                pill wasn't actually visible above it). Default DOM paint
                order already puts this behind the label below, which is
                explicitly lifted with relative z-10 to guarantee it. */}
            {activeTab === group.key && !reduceMotion && (
              <motion.span
                layoutId="feature-tab-indicator"
                className="absolute inset-0 rounded-full bg-foreground"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            {activeTab === group.key && reduceMotion && (
              <span className="absolute inset-0 rounded-full bg-foreground" />
            )}
            <span className="relative z-10">{group.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {GROUPS.map((group) => (
        <TabsContent key={group.key} value={group.key} className="mt-0 focus-visible:outline-none">
          <motion.div
            initial={reduceMotion ? undefined : 'hidden'}
            animate="show"
            variants={containerVariants}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {group.items.map((item) => (
              <DetailCard key={item.label} {...item} variants={itemVariants} />
            ))}
          </motion.div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
