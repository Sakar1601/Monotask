
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTasks, Task } from '@/hooks/useTasks';
import { useSettings } from '@/hooks/useSettings';
import { RecurringTaskInstance } from '@/utils/recurringTasks';
import { isOccurrenceCompleted } from '@/utils/taskOccurrences';
import { Edit, Trash2, Check, Plus, CalendarX2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import TaskModal from './TaskModal';
import ConfirmDialog from './ConfirmDialog';

interface DayTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  tasks: RecurringTaskInstance[];
  onToggleComplete: (item: RecurringTaskInstance) => void;
}

// Floating-layer glass treatment, matching EventModal's recipe: backdrop
// blur + inner highlight via inline style (guaranteed to win over the
// shared ui/dialog.tsx primitive's opaque background class), with a solid
// fallback for prefers-reduced-transparency.
const useReducedTransparency = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-transparency: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
};

const DayTasksModal: React.FC<DayTasksModalProps> = ({ isOpen, onClose, date, tasks, onToggleComplete }) => {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; taskId?: string }>({ isOpen: false });
  const { deleteTask, isUpdating, isDeleting } = useTasks();
  const { settings } = useSettings();
  const prefersReducedMotion = useReducedMotion();
  const reducedTransparency = useReducedTransparency();

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    
    const [hours, minutes] = time.split(':');
    const hour24 = parseInt(hours, 10);
    
    if (settings.timeFormat === '12h') {
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 >= 12 ? 'PM' : 'AM';
      return `${hour12}:${minutes} ${ampm}`;
    }
    
    return `${hours}:${minutes}`;
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const handleDeleteTask = (taskId: string) => {
    setDeleteConfirm({ isOpen: true, taskId });
  };

  const confirmDelete = () => {
    if (deleteConfirm.taskId) {
      deleteTask(deleteConfirm.taskId);
    }
  };

  const handleAddNewTask = () => {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };

  const completedTasks = tasks.filter(task => isOccurrenceCompleted(task));
  const pendingTasks = tasks.filter(task => !isOccurrenceCompleted(task));

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="max-h-[80vh] max-w-2xl overflow-y-auto shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)]"
          style={
            reducedTransparency
              ? undefined
              : { backgroundColor: 'hsl(var(--background) / 0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }
          }
        >
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Tasks for {formatDate(date)}</span>
              <motion.div whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
                <Button
                  onClick={handleAddNewTask}
                  size="sm"
                >
                  <Plus className="mr-1 h-4 w-4" strokeWidth={1.75} />
                  Add Task
                </Button>
              </motion.div>
            </DialogTitle>
            <DialogDescription>
              Manage your tasks for this day
            </DialogDescription>
          </DialogHeader>

          <motion.div
            className="space-y-6"
            variants={{ hidden: {}, show: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.06, delayChildren: prefersReducedMotion ? 0 : 0.12 } } }}
            initial="hidden"
            animate="show"
          >
            {/* Pending Tasks */}
            {pendingTasks.length > 0 && (
              <motion.div variants={prefersReducedMotion ? { hidden: { opacity: 1 }, show: { opacity: 1 } } : { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                  Pending tasks ({pendingTasks.length})
                </h3>
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {pendingTasks.map((task) => (
                      <TaskCard
                        key={`${task.id}-${task.instance_date}`}
                        task={task}
                        onToggleComplete={onToggleComplete}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                        isUpdating={isUpdating}
                        isDeleting={isDeleting}
                        formatTime={formatTime}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <motion.div variants={prefersReducedMotion ? { hidden: { opacity: 1 }, show: { opacity: 1 } } : { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                  Completed tasks ({completedTasks.length})
                </h3>
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {completedTasks.map((task) => (
                      <TaskCard
                        key={`${task.id}-${task.instance_date}`}
                        task={task}
                        onToggleComplete={onToggleComplete}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                        isUpdating={isUpdating}
                        isDeleting={isDeleting}
                        formatTime={formatTime}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {tasks.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                <CalendarX2 className="h-6 w-6" strokeWidth={1.75} />
                <p>No tasks for this day</p>
                <Button
                  onClick={handleAddNewTask}
                  variant="outline"
                  className="mt-2"
                >
                  <Plus className="mr-1 h-4 w-4" strokeWidth={1.75} />
                  Add First Task
                </Button>
              </div>
            )}
          </motion.div>
          </motion.div>
        </DialogContent>
      </Dialog>

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        task={editingTask}
        prefilledDate={!editingTask ? date : undefined}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false })}
        onConfirm={confirmDelete}
        title="Delete Task?"
        message="Are you sure you want to delete this task?"
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
};

interface TaskCardProps {
  task: RecurringTaskInstance;
  onToggleComplete: (task: RecurringTaskInstance) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  isUpdating: boolean;
  isDeleting: boolean;
  formatTime: (time: string) => string;
}

const priorityBadgeClass = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    case 'medium':
      return 'border-primary/30 bg-primary/10 text-primary';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
};

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
  isUpdating,
  isDeleting,
  formatTime
}) => {
  const isCompleted = isOccurrenceCompleted(task);
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -8, transition: { duration: 0.15 } }}
      whileHover={prefersReducedMotion ? undefined : { y: -1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        'rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50 hover:shadow-[0_14px_30px_-18px_hsl(var(--primary)/0.5)]',
        isCompleted && 'opacity-75'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-1 items-start space-x-3">
          <motion.button
            onClick={() => onToggleComplete(task)}
            disabled={isUpdating}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={cn(
              'mt-1 flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
              isCompleted
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:border-primary/60'
            )}
          >
            {isCompleted && <Check className="h-3 w-3" strokeWidth={2} />}
          </motion.button>

          <div className="min-w-0 flex-1">
            <h4 className={cn('font-medium', isCompleted ? 'text-muted-foreground line-through' : 'text-foreground')}>
              {task.title}
            </h4>
            {task.description && (
              <p className={cn('mt-1 text-sm', isCompleted ? 'text-muted-foreground/70' : 'text-muted-foreground')}>
                {task.description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              {task.due_time && (
                <span className="tabular-nums">{formatTime(task.due_time)}</span>
              )}
              <Badge variant="outline" className={cn('capitalize font-normal', priorityBadgeClass(task.priority))}>
                {task.priority}
              </Badge>
              {task.tags && (
                <span
                  className="rounded-full px-2 py-1 font-medium text-white"
                  style={{ backgroundColor: task.tags.color }}
                >
                  {task.tags.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="ml-4 flex items-center space-x-2">
          <button
            onClick={() => onEdit(task)}
            className="p-1 text-muted-foreground transition-colors hover:text-foreground"
            title="Edit task"
          >
            <Edit className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            disabled={isDeleting}
            className="p-1 text-muted-foreground transition-colors hover:text-destructive"
            title="Delete task"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default DayTasksModal;
