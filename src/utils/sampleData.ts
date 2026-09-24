import { formatDateLocal } from '@/hooks/useTasks';

export interface SampleTask {
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  repeat_type: 'none' | 'daily';
  tagName: string | null;
}

export interface SampleHabit {
  name: string;
  description: string;
  frequency: 'daily';
  preferred_time: string;
  tagName: string;
}

const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return formatDateLocal(d);
};

/**
 * Small, clearly-labelled starter content so a brand-new account has
 * something to look at. The titles double as gentle tips about the product.
 */
export function buildSampleData(now: Date = new Date()): { tasks: SampleTask[]; habit: SampleHabit } {
  return {
    tasks: [
      { title: 'Plan your week', description: 'A sample task. Edit or delete it any time.', due_date: addDays(now, 0), priority: 'high', repeat_type: 'none', tagName: 'Work' },
      { title: 'Try AI Quick Add on the Tasks page', description: 'Type something like "lunch with Sam tomorrow 1pm" and review the result.', due_date: addDays(now, 0), priority: 'medium', repeat_type: 'none', tagName: null },
      { title: 'Book a dentist appointment', description: null, due_date: addDays(now, 3), priority: 'medium', repeat_type: 'none', tagName: 'Health' },
      { title: 'Read 20 pages', description: 'A daily recurring sample task.', due_date: addDays(now, 0), priority: 'low', repeat_type: 'daily', tagName: 'Learning' },
      { title: 'Review your goals for the month', description: null, due_date: addDays(now, 7), priority: 'low', repeat_type: 'none', tagName: 'Personal' },
    ],
    habit: {
      name: 'Morning walk',
      description: 'A sample habit. Log it each day to build a streak.',
      frequency: 'daily',
      preferred_time: '07:30',
      tagName: 'Health',
    },
  };
}
