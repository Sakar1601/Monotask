import { toast } from 'sonner';
import { useTasks } from '@/hooks/useTasks';
import { useTaskInstances } from '@/hooks/useTaskInstances';
import { toggleOccurrenceComplete, isOccurrenceCompleted } from '@/utils/taskOccurrences';
import type { RecurringTaskInstance } from '@/utils/recurringTasks';

/**
 * Toggles a task occurrence and, when it was just completed, offers a short
 * Undo. A shared toast id means completing several tasks quickly replaces the
 * toast instead of stacking a pile of them.
 */
export function useCompleteWithUndo() {
  const { updateTask } = useTasks();
  const { updateInstance } = useTaskInstances();

  return (item: RecurringTaskInstance) => {
    const wasCompleted = isOccurrenceCompleted(item);
    toggleOccurrenceComplete(item, { updateTask, updateInstance });
    if (!wasCompleted) {
      toast(`Completed "${item.title}"`, {
        id: 'undo-complete',
        duration: 4000,
        action: {
          label: 'Undo',
          onClick: () =>
            toggleOccurrenceComplete(
              { ...item, status: 'completed', instance_status: item.instance_status === undefined ? undefined : 'completed' },
              { updateTask, updateInstance }
            ),
        },
      });
    }
  };
}
