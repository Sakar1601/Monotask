import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAiSuggestions, TaskSuggestionPayload, RescheduleSuggestionPayload } from '@/hooks/useAiSuggestions';
import { useEvents } from '@/hooks/useEvents';
import TaskModal from './TaskModal';
import type { ParsedTaskDraft } from '@/hooks/useTaskParser';

// Not the framer-motion `useReducedMotion()` hook: this component is unit
// tested by calling it as a plain function (no React reconciler in play,
// see SuggestionsView.test.ts's `vi.mock('react', ...)`), and a hook call
// would reach into the mocked React module for APIs it doesn't stub. A
// direct matchMedia read avoids that while still respecting the setting.
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

const SuggestionsView: React.FC = () => {
  const reduceMotion = prefersReducedMotion();
  const { suggestions, isLoading, accept, dismiss } = useAiSuggestions();
  const { updateEvent } = useEvents();
  const [taskDraft, setTaskDraft] = useState<{ suggestionId: string; draft: ParsedTaskDraft } | null>(null);

  const acceptTask = (suggestionId: string, payload: TaskSuggestionPayload) => {
    setTaskDraft({ suggestionId, draft: payload });
  };

  const acceptReschedule = (suggestionId: string, payload: RescheduleSuggestionPayload) => {
    updateEvent({
      id: payload.event_id,
      start_time: payload.suggested_start_time,
      end_time: payload.suggested_end_time,
    }, {
      onSuccess: () => accept(suggestionId),
      onError: () => undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="text-[15px] text-muted-foreground">
        Tasks and meeting fixes found in your connected accounts. Nothing happens until you accept.
      </p>
      {suggestions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lightbulb className="h-6 w-6" strokeWidth={2} />
          </div>
          <h3 className="font-grotesk text-base font-medium text-foreground">No pending suggestions</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            When Monotask notices a scheduling conflict or a task worth adding, it will show up here.
          </p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
        {suggestions.map((suggestion) => (
          <motion.div
            key={suggestion.id}
            layout
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: -24, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/40"
          >
            {suggestion.kind === 'task' ? (
              (() => {
                const payload = suggestion.payload as TaskSuggestionPayload;
                return (
                  <>
                    <div className="flex items-start gap-2">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
                      <p className="font-medium text-foreground">{payload.title}</p>
                    </div>
                    {payload.description && <p className="mt-1 text-sm text-muted-foreground">{payload.description}</p>}
                    {payload.due_date && (
                      <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                        Due {payload.due_date}{payload.due_time ? ` ${payload.due_time}` : ''}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => acceptTask(suggestion.id, payload)}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => dismiss(suggestion.id)}>Dismiss</Button>
                    </div>
                  </>
                );
              })()
            ) : (
              (() => {
                const payload = suggestion.payload as RescheduleSuggestionPayload;
                return (
                  <>
                    <div className="flex items-start gap-2">
                      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
                      <p className="font-medium text-foreground">Reschedule suggestion</p>
                    </div>
                    <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                      Move from {new Date(payload.current_start_time).toLocaleString()} to {new Date(payload.suggested_start_time).toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{payload.reasoning}</p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => acceptReschedule(suggestion.id, payload)}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => dismiss(suggestion.id)}>Dismiss</Button>
                    </div>
                  </>
                );
              })()
            )}
          </motion.div>
        ))}
        </AnimatePresence>
      )}
      <TaskModal
        isOpen={!!taskDraft}
        onClose={() => {
          if (taskDraft) accept(taskDraft.suggestionId);
          setTaskDraft(null);
        }}
        draft={taskDraft?.draft ?? null}
      />
    </div>
  );
};

export default SuggestionsView;
