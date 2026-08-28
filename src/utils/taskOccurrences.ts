import { RecurringTaskInstance } from './recurringTasks';

// generateRecurringInstances always sets instance_status on the recurring
// branch (defaulting to 'pending' even with no DB row yet) and never sets it
// on the non-recurring pass-through branch, so its presence reliably tells
// us whether completion is tracked per-occurrence (task_instances) or on the
// task record itself.
export const isOccurrenceCompleted = (item: RecurringTaskInstance): boolean => {
  if (item.instance_status !== undefined) {
    return item.instance_status === 'completed';
  }
  return item.status === 'completed';
};

export const getOccurrenceDate = (item: RecurringTaskInstance): string =>
  item.instance_date || item.due_date || '';

export interface ToggleOccurrenceDeps {
  updateTask: (params: { id: string; status: 'pending' | 'completed'; completed_at: string | null }) => void;
  updateInstance: (params: {
    id?: string;
    task_id: string;
    instance_date: string;
    status: 'pending' | 'completed';
    completed_at?: string;
  }) => void;
}

export const toggleOccurrenceComplete = (item: RecurringTaskInstance, deps: ToggleOccurrenceDeps) => {
  const completed = isOccurrenceCompleted(item);
  const newStatus: 'pending' | 'completed' = completed ? 'pending' : 'completed';

  if (item.instance_status !== undefined) {
    deps.updateInstance({
      id: item.instance_id,
      task_id: item.id,
      instance_date: item.instance_date,
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : undefined,
    });
  } else {
    deps.updateTask({
      id: item.id,
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    });
  }
};
