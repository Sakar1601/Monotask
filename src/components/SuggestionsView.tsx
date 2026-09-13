import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAiSuggestions, TaskSuggestionPayload, RescheduleSuggestionPayload } from '@/hooks/useAiSuggestions';
import { useEvents } from '@/hooks/useEvents';
import TaskModal from './TaskModal';
import type { ParsedTaskDraft } from '@/hooks/useTaskParser';

const SuggestionsView: React.FC = () => {
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
    });
    accept(suggestionId);
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Suggestions</h2>
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending suggestions.</p>
      ) : (
        suggestions.map((suggestion) => (
          <div key={suggestion.id} className="bg-card border border-border rounded-lg p-4">
            {suggestion.kind === 'task' ? (
              (() => {
                const payload = suggestion.payload as TaskSuggestionPayload;
                return (
                  <>
                    <p className="font-medium text-foreground">{payload.title}</p>
                    {payload.description && <p className="text-sm text-muted-foreground mt-1">{payload.description}</p>}
                    {payload.due_date && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Due {payload.due_date}{payload.due_time ? ` ${payload.due_time}` : ''}
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
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
                    <p className="font-medium text-foreground">Reschedule suggestion</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Move from {new Date(payload.current_start_time).toLocaleString()} to {new Date(payload.suggested_start_time).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{payload.reasoning}</p>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={() => acceptReschedule(suggestion.id, payload)}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => dismiss(suggestion.id)}>Dismiss</Button>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        ))
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
