import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Circle, X, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTasks } from '@/hooks/useTasks';
import { useHabits } from '@/hooks/useHabits';
import { useTags } from '@/hooks/useTags';
import { useIntegrationConnections } from '@/hooks/useIntegrationConnections';
import { buildSampleData } from '@/utils/sampleData';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'monotask-onboarding-dismissed';

const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

interface OnboardingChecklistProps {
  onNavigate: (view: string) => void;
  onAddTask: () => void;
  onOpenPalette: () => void;
  paletteUsed: boolean;
}

const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ onNavigate, onAddTask, onOpenPalette, paletteUsed }) => {
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { tasks } = useTasks();
  const { habits } = useHabits();
  const { tags } = useTags();
  const { connections } = useIntegrationConnections();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [loadingSample, setLoadingSample] = useState(false);

  if (dismissed) return null;

  const steps = [
    { key: 'task', label: 'Add your first task', done: tasks.length > 0, cta: 'Add task', run: onAddTask },
    { key: 'habit', label: 'Start a habit', done: habits.length > 0, cta: 'Open habits', run: () => onNavigate('habits') },
    { key: 'connect', label: 'Connect Google or Outlook', done: connections.length > 0, cta: 'Connect', run: () => onNavigate('settings') },
    { key: 'palette', label: 'Try the command palette (Cmd+K)', done: paletteUsed, cta: 'Open', run: onOpenPalette },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const isEmptyAccount = tasks.length === 0 && habits.length === 0;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode: dismissal just won't persist */
    }
    setDismissed(true);
  };

  const loadSample = async () => {
    if (!user) return;
    setLoadingSample(true);
    try {
      const sample = buildSampleData();
      const tagId = (name: string | null) => (name ? tags.find((t) => t.name === name)?.id ?? null : null);
      const { error: taskError } = await supabase.from('tasks').insert(
        sample.tasks.map((t) => ({
          user_id: user.id,
          title: t.title,
          description: t.description,
          due_date: t.due_date,
          priority: t.priority,
          status: 'pending',
          repeat_type: t.repeat_type,
          tag_id: tagId(t.tagName),
        }))
      );
      if (taskError) throw taskError;
      const { error: habitError } = await supabase.from('habits').insert([
        {
          user_id: user.id,
          name: sample.habit.name,
          description: sample.habit.description,
          frequency: sample.habit.frequency,
          preferred_time: sample.habit.preferred_time,
          tag_id: tagId(sample.habit.tagName),
        },
      ]);
      if (habitError) throw habitError;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['habits'] }),
      ]);
      toast.success('Sample tasks and a habit added. Delete them any time.');
    } catch (error) {
      console.error('Error loading sample data:', error);
      toast.error('Could not add sample data. Please try again.');
    } finally {
      setLoadingSample(false);
    }
  };

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-grotesk text-xl font-semibold tracking-[-0.02em] text-foreground">
                {allDone ? "You're all set" : 'Get set up in a minute'}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {allDone ? 'Everything is connected and ready. Dismiss this whenever you like.' : (
                  <><span className="tabular-nums">{doneCount}</span> of {steps.length} done</>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss setup checklist"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-foreground"
              initial={reduceMotion ? { width: `${(doneCount / steps.length) * 100}%` } : { width: 0 }}
              animate={{ width: `${(doneCount / steps.length) * 100}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>

          <ul className="mt-4 divide-y divide-border">
            {steps.map((step) => (
              <li key={step.key} className="flex items-center gap-3 py-3">
                {step.done ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-border" strokeWidth={1.5} />
                )}
                <span className={cn('flex-1 text-sm', step.done ? 'text-muted-foreground line-through' : 'font-medium text-foreground')}>
                  {step.label}
                </span>
                {!step.done && (
                  <Button variant="outline" size="sm" onClick={step.run}>
                    {step.cta}
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {isEmptyAccount && (
            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Want to see it with something in it? Add a few sample tasks and a habit. You can delete them any time.
              </p>
              <Button onClick={loadSample} disabled={loadingSample} className="shrink-0">
                {loadingSample ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" strokeWidth={1.75} />}
                Load sample data
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default OnboardingChecklist;
