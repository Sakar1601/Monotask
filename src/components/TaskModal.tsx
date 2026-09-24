
import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTasks, Task } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import TagSelector from './TagSelector';
import TimeInput from './TimeInput';
import { SegmentedControl } from '@/components/ui/segmented-control';

interface TaskDraft {
  title: string;
  description?: string;
  due_date?: string | null;
  due_time?: string | null;
  priority?: 'low' | 'medium' | 'high';
  tag_id?: string | null;
  repeat_type?: 'none' | 'daily' | 'weekly' | 'monthly';
}

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  prefilledDate?: string;
  draft?: TaskDraft | null;
}

const formatDateForInput = (dateString?: string) => {
  if (!dateString) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, task, prefilledDate, draft }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    due_time: '',
    priority: 'low' as 'low' | 'medium' | 'high',
    tag_id: '',
    repeat_type: 'none' as 'none' | 'daily' | 'weekly' | 'monthly',
    repeat_interval: 1,
  });
  const [titleError, setTitleError] = useState('');

  const { createTask, updateTask, isCreating, isUpdating } = useTasks();
  const reduceMotion = useReducedMotion();
  const fieldTransition = { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const };
  const fieldVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { ...fieldTransition, delay: reduceMotion ? 0 : i * 0.05 } }),
  };
  const focusGlow = 'transition-shadow duration-200 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]';

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        due_date: formatDateForInput(task.due_date),
        due_time: task.due_time || '',
        priority: task.priority,
        tag_id: task.tag_id || '',
        repeat_type: task.repeat_type || 'none',
        repeat_interval: task.repeat_interval || 1,
      });
    } else if (draft) {
      setFormData({
        title: draft.title,
        description: draft.description || '',
        due_date: formatDateForInput(draft.due_date || undefined),
        due_time: draft.due_time || '',
        priority: draft.priority || 'low',
        tag_id: draft.tag_id || '',
        repeat_type: draft.repeat_type || 'none',
        repeat_interval: 1,
      });
    } else if (prefilledDate) {
      setFormData(prev => ({
        ...prev,
        due_date: formatDateForInput(prefilledDate),
        title: '',
        description: '',
        due_time: '',
        priority: 'low',
        tag_id: '',
        repeat_type: 'none',
        repeat_interval: 1,
      }));
    } else {
      setFormData({
        title: '',
        description: '',
        due_date: '',
        due_time: '',
        priority: 'low',
        tag_id: '',
        repeat_type: 'none',
        repeat_interval: 1,
      });
    }
    setTitleError('');
  }, [task, prefilledDate, draft, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setTitleError('Give this task a title before saving.');
      return;
    }

    const taskData = {
      ...formData,
      // The empty-string defaults of these inputs are rejected by Postgres
      // for date/time columns (400), which would block ALL edits to a task
      // with no due date set - coerce them the same way tag_id is.
      due_date: formData.due_date || undefined,
      due_time: formData.due_time || undefined,
      tag_id: formData.tag_id || undefined,
      // Preserve the task's existing completion state instead of resetting
      // it to pending on every save (which, now that edits push to Google,
      // would also re-open a completed task in the user's Google Tasks).
      status: (task?.status ?? 'pending') as 'pending' | 'completed' | 'cancelled',
    };

    if (task) {
      updateTask({ id: task.id, ...taskData });
    } else {
      createTask(taskData);
    }

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="mx-4 max-h-[90vh] max-w-lg overflow-y-auto pb-0 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="font-grotesk">
            {task ? 'Edit task' : 'Create task'}
          </DialogTitle>
          <DialogDescription>
            {task ? 'Update the details below.' : 'Add a task with an optional due date and repeat.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div custom={0} initial="hidden" animate="visible" variants={fieldVariants}>
            <Label htmlFor="task-title" className="mb-1.5 block text-sm font-medium text-foreground">Title</Label>
            <Input
              id="task-title"
              placeholder="Task title"
              value={formData.title}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, title: e.target.value }));
                if (titleError) setTitleError('');
              }}
              aria-invalid={!!titleError}
              className={cn(focusGlow, titleError && 'border-destructive focus-visible:ring-destructive')}
            />
            {titleError && <p className="mt-1.5 text-xs text-destructive">{titleError}</p>}
          </motion.div>

          <motion.div custom={1} initial="hidden" animate="visible" variants={fieldVariants}>
            <Label htmlFor="task-description" className="mb-1.5 block text-sm font-medium text-foreground">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="task-description"
              placeholder="Description (optional)"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className={cn('resize-none', focusGlow)}
            />
          </motion.div>

          <motion.div custom={2} initial="hidden" animate="visible" variants={fieldVariants} className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="task-due-date" className="mb-1.5 block text-sm font-medium text-foreground">Due date</Label>
              <Input
                id="task-due-date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                className={focusGlow}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-medium text-foreground">Time</Label>
              <TimeInput
                value={formData.due_time}
                onChange={(value) => setFormData(prev => ({ ...prev, due_time: value }))}
              />
            </div>
          </motion.div>

          <motion.div custom={3} initial="hidden" animate="visible" variants={fieldVariants}>
            <Label className="mb-1.5 block text-sm font-medium text-foreground">Priority</Label>
            <SegmentedControl
              aria-label="Priority"
              value={formData.priority}
              onChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ]}
            />
          </motion.div>

          <motion.div custom={4} initial="hidden" animate="visible" variants={fieldVariants}>
            <Label className="mb-1.5 block text-sm font-medium text-foreground">Tag</Label>
            <TagSelector
              value={formData.tag_id}
              onChange={(value) => setFormData(prev => ({ ...prev, tag_id: value }))}
            />
          </motion.div>

          <motion.div custom={5} initial="hidden" animate="visible" variants={fieldVariants}>
            <Label className="mb-1.5 block text-sm font-medium text-foreground">Repeat</Label>
            <Select value={formData.repeat_type} onValueChange={(value: 'none' | 'daily' | 'weekly' | 'monthly') => setFormData(prev => ({ ...prev, repeat_type: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Repeat" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No repeat</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </motion.div>

          <div className="-mx-6 mt-2 flex flex-col-reverse justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4 sm:flex-row">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || isUpdating}>
              {isCreating || isUpdating ? 'Saving...' : (task ? 'Update' : 'Create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TaskModal;
