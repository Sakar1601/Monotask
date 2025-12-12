
import { Task } from '@/hooks/useTasks';
import { TaskInstance } from '@/hooks/useTaskInstances';

export interface RecurringTaskInstance extends Task {
  instance_date: string;
  instance_id?: string;
  instance_status?: 'pending' | 'completed';
  instance_completed_at?: string;
}

export const generateRecurringInstances = (
  tasks: Task[],
  instances: TaskInstance[],
  startDate: Date,
  endDate: Date
): RecurringTaskInstance[] => {
  const recurringInstances: RecurringTaskInstance[] = [];
  
  tasks.forEach(task => {
    if (!task.repeat_type || task.repeat_type === 'none') {
      // Regular task - just add it if it falls within the date range
      if (task.due_date) {
        const taskDate = new Date(task.due_date);
        if (taskDate >= startDate && taskDate <= endDate) {
          recurringInstances.push({
            ...task,
            instance_date: task.due_date,
          });
        }
      }
      return;
    }

    // Generate instances for recurring tasks
    const taskStart = task.due_date ? new Date(task.due_date) : startDate;
    let currentDate = new Date(Math.max(taskStart.getTime(), startDate.getTime()));

    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      
      // Find existing instance for this date
      const existingInstance = instances.find(
        inst => inst.task_id === task.id && inst.instance_date === dateString
      );
      
      recurringInstances.push({
        ...task,
        instance_date: dateString,
        instance_id: existingInstance?.id,
        instance_status: existingInstance?.status || 'pending',
        instance_completed_at: existingInstance?.completed_at,
      });

      // Calculate next occurrence
      switch (task.repeat_type) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + (task.repeat_interval || 1));
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + (7 * (task.repeat_interval || 1)));
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + (task.repeat_interval || 1));
          break;
        default:
          return; // Exit if unknown repeat type
      }
    }
  });

  return recurringInstances.sort((a, b) => a.instance_date.localeCompare(b.instance_date));
};

export const getTasksForDate = (
  tasks: Task[],
  instances: TaskInstance[],
  date: string
): RecurringTaskInstance[] => {
  const targetDate = new Date(date);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  
  return generateRecurringInstances(tasks, instances, targetDate, nextDay);
};

export const getTasksForWeek = (
  tasks: Task[],
  instances: TaskInstance[],
  weekStart: Date
): RecurringTaskInstance[] => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  return generateRecurringInstances(tasks, instances, weekStart, weekEnd);
};

export const getTasksForMonth = (
  tasks: Task[],
  instances: TaskInstance[],
  month: Date
): RecurringTaskInstance[] => {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  
  return generateRecurringInstances(tasks, instances, monthStart, monthEnd);
};
