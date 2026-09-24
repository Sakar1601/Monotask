
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Plus, Search, Check, Pencil, Trash2, Clock, Calendar, Sparkles, ListChecks, CalendarClock, AlarmClock, ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTasks, Task, formatDateLocal } from '@/hooks/useTasks';
import { useTaskInstances } from '@/hooks/useTaskInstances';
import { useTags } from '@/hooks/useTags';
import { useTaskParser, ParsedTaskDraft } from '@/hooks/useTaskParser';
import { generateRecurringInstances, getTasksForDate, RecurringTaskInstance } from '@/utils/recurringTasks';
import { isOccurrenceCompleted, getOccurrenceDate, toggleOccurrenceComplete } from '@/utils/taskOccurrences';
import TaskModal from './TaskModal';
import ConfirmDialog from './ConfirmDialog';

// Plain (non-recurring-expanded) tasks still render through the same card -
// this just gives them the RecurringTaskInstance shape with no instance
// tracking, so isOccurrenceCompleted falls back to task.status.
const asOccurrence = (task: Task): RecurringTaskInstance => ({ ...task, instance_date: task.due_date || '' });

const PRIORITY_STYLES: Record<string, string> = {
  high: 'border-destructive/40 text-destructive',
  medium: 'border-foreground/25 text-foreground',
  low: 'border-transparent bg-muted text-muted-foreground',
};

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; description: string; cta?: React.ReactNode }> = ({ icon, title, description, cta }) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
      {icon}
    </div>
    <h3 className="font-grotesk text-base font-medium text-foreground">{title}</h3>
    <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    {cta && <div className="mt-2">{cta}</div>}
  </div>
);

// Small radial dot-burst fired once when a task flips to complete. Hand-rolled
// with a handful of absolutely-positioned motion.span dots rather than a
// particle library - fades out on its own via AnimatePresence.
const CompletionBurst: React.FC<{ active: boolean; onDone: () => void }> = ({ active, onDone }) => {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  const dots = [0, 1, 2, 3, 4, 5];
  return (
    <AnimatePresence onExitComplete={onDone}>
      {active && (
        <motion.span className="pointer-events-none absolute inset-0 z-10" initial={false}>
          {dots.map((i) => {
            const angle = (i / dots.length) * Math.PI * 2;
            const x = Math.cos(angle) * 14;
            const y = Math.sin(angle) * 14;
            return (
              <motion.span
                key={i}
                className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-primary"
                initial={{ opacity: 1, scale: 0.6, x: 0, y: 0 }}
                animate={{ opacity: 0, scale: 1, x, y }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              />
            );
          })}
        </motion.span>
      )}
    </AnimatePresence>
  );
};

const TaskListSkeleton: React.FC = () => (
  <div className="space-y-3">
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
        <Skeleton className="mt-1 h-5 w-5 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
    ))}
  </div>
);

const TaskManager: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskDraft, setTaskDraft] = useState<ParsedTaskDraft | null>(null);
  const [aiInput, setAiInput] = useState('');
  const { parseTask, isParsing } = useTaskParser();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; taskId?: string }>({ isOpen: false });
  const reduceMotion = useReducedMotion();

  // Keyboard-nav power-user layer (J/K/X/N) - see DESIGN.md "Task Row
  // Keyboard Navigation". Rows are real tabIndex={0} elements identified by
  // data-task-row, so J/K just move native DOM focus (native
  // :focus-visible gives the visual indicator for free) rather than
  // mirroring a separate "focused" state - simpler, and it stays correct
  // automatically since Radix Tabs only mounts the active tab's rows.
  const aiInputRef = useRef<HTMLInputElement>(null);

  const {
    tasks,
    updateTask,
    deleteTask,
    isLoading,
    isUpdating,
    isDeleting,
    getOverdueTasks
  } = useTasks();
  const { instances, updateInstance, isUpdating: isUpdatingInstance } = useTaskInstances();
  const { tags } = useTags();

  const formatLocalDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString();
  };

  const filterTasks = (taskList: RecurringTaskInstance[]) => {
    return taskList.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'completed' ? isOccurrenceCompleted(task) : !isOccurrenceCompleted(task));
      const matchesTag = tagFilter === 'all' || task.tag_id === tagFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesTag && matchesPriority;
    });
  };

  // Today: every occurrence (recurring or not) whose date falls today.
  const getTodayOccurrences = (): RecurringTaskInstance[] => {
    const todayStr = formatDateLocal(new Date());
    return getTasksForDate(tasks, instances, todayStr);
  };

  // Upcoming: same "today (uncompleted) + all of tomorrow + rest of week
  // (uncompleted)" window useTasks.getUpcomingTasks used, now occurrence-aware.
  const getUpcomingOccurrences = (): RecurringTaskInstance[] => {
    const today = new Date();
    const todayStr = formatDateLocal(today);
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = formatDateLocal(tomorrow);
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const occurrences = generateRecurringInstances(tasks, instances, today, nextWeek);
    return occurrences.filter(item => {
      const date = getOccurrenceDate(item);
      if (!date) return false;
      const completed = isOccurrenceCompleted(item);
      if (date === todayStr) return !completed;
      if (date === tomorrowStr) return true;
      if (date > tomorrowStr) return !completed;
      return false;
    });
  };

  const handleToggleComplete = (item: RecurringTaskInstance) => {
    toggleOccurrenceComplete(item, { updateTask, updateInstance });
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleDeleteTask = (taskId: string) => {
    setDeleteConfirm({ isOpen: true, taskId });
  };

  const confirmDelete = () => {
    if (deleteConfirm.taskId) {
      deleteTask(deleteConfirm.taskId);
    }
  };

  const handleAddNew = () => {
    setEditingTask(null);
    setTaskDraft(null);
    setIsModalOpen(true);
  };

  const handleAiQuickAdd = async () => {
    if (!aiInput.trim() || isParsing) return;
    try {
      const draft = await parseTask(aiInput.trim());
      setEditingTask(null);
      setTaskDraft(draft);
      setIsModalOpen(true);
      setAiInput('');
    } catch {
      // toast already shown by useTaskParser
    }
  };

  const TaskCard: React.FC<{ task: RecurringTaskInstance; index: number; showDate?: boolean }> = ({ task, index, showDate = false }) => {
    const isCompleted = isOccurrenceCompleted(task);
    const displayDate = getOccurrenceDate(task);
    // Date-only comparison: a task due today is not "overdue" just because
    // part of today has already passed. Comparing displayDate's midnight
    // against the current instant (the previous version) meant every
    // still-open task due today rendered as overdue the moment the clock
    // ticked past 00:00.
    const isOverdue = displayDate && displayDate < formatDateLocal(new Date()) && !isCompleted;
    const [burst, setBurst] = useState(false);
    const rowRef = useRef<HTMLDivElement>(null);

    // Physical drag-to-complete (right) / drag-to-delete (left) gesture. The
    // card itself never actually leaves the list on drag - x always springs
    // back to 0 (dragConstraints pins it to a single point); crossing the
    // threshold just fires the same completion/delete flow the buttons use.
    const x = useMotionValue(0);
    const completeIconOpacity = useTransform(x, [0, 90], [0, 1]);
    const deleteIconOpacity = useTransform(x, [-90, 0], [1, 0]);

    const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const width = rowRef.current?.offsetWidth || 320;
      const threshold = width * 0.35;
      if (info.offset.x > threshold) {
        if (!isCompleted) setBurst(true);
        handleToggleComplete(task);
      } else if (info.offset.x < -threshold) {
        handleDeleteTask(task.id);
      }
    };

    return (
      <motion.div
        layout
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1], delay: reduceMotion ? 0 : Math.min(index, 8) * 0.06 }}
        className="relative"
      >
        {/* Drag affordance: check fades in as you drag right, trash as you drag left */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-between overflow-hidden rounded-lg px-6"
        >
          <motion.div style={{ opacity: deleteIconOpacity }} className="text-destructive">
            <Trash2 className="h-5 w-5" strokeWidth={2} />
          </motion.div>
          <motion.div style={{ opacity: completeIconOpacity }} className="text-primary">
            <Check className="h-5 w-5" strokeWidth={2} />
          </motion.div>
        </div>

        <motion.div
          ref={rowRef}
          data-task-row
          data-task-id={task.id}
          data-task-date={displayDate}
          tabIndex={0}
          drag={reduceMotion ? false : 'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
          onDragEnd={handleDragEnd}
          style={{ x, viewTransitionName: `task-row-${task.id}-${displayDate}` }}
          whileHover={reduceMotion ? undefined : { y: -2 }}
          className={cn(
            'relative touch-pan-y rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            !reduceMotion && 'cursor-grab active:cursor-grabbing',
            isOverdue ? 'border-destructive/30 bg-destructive/5' : 'border-border'
          )}
        >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-1 items-start gap-3">
            <motion.button
              onClick={() => {
                if (!isCompleted) setBurst(true);
                handleToggleComplete(task);
              }}
              disabled={isUpdating || isUpdatingInstance}
              whileTap={reduceMotion ? undefined : { scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={cn(
                'relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                isCompleted
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input hover:border-primary/60'
              )}
              aria-label={isCompleted ? 'Mark task incomplete' : 'Mark task complete'}
            >
              <CompletionBurst active={burst} onDone={() => setBurst(false)} />
              <AnimatePresence>
                {isCompleted && (
                  <motion.span
                    initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={reduceMotion ? undefined : { scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  >
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <h3 className={cn('font-medium', isCompleted ? 'text-muted-foreground line-through' : 'text-foreground')}>
                  {task.title}
                </h3>
                {task.repeat_type && task.repeat_type !== 'none' && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    {task.repeat_type}
                  </Badge>
                )}
              </div>

              {task.description && (
                <p className={cn('mt-1 text-sm', isCompleted ? 'text-muted-foreground/70' : 'text-muted-foreground')}>
                  {task.description}
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                {(showDate && displayDate) && (
                  <span className={cn('flex items-center gap-1 tabular-nums', isOverdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                    <Calendar className="h-3 w-3" strokeWidth={2} />
                    {formatLocalDate(displayDate)}
                  </span>
                )}
                {task.due_time && (
                  <span className="flex items-center gap-1 tabular-nums text-muted-foreground">
                    <Clock className="h-3 w-3" strokeWidth={2} />
                    {task.due_time}
                  </span>
                )}
                <Badge variant="outline" className={cn('text-xs font-normal', PRIORITY_STYLES[task.priority])}>
                  {task.priority}
                </Badge>
                {task.tags && (
                  <Badge
                    className="border-transparent text-xs font-normal text-white"
                    style={{ backgroundColor: task.tags.color }}
                  >
                    {task.tags.name}
                  </Badge>
                )}
                {task.sync_error && (
                  <Badge
                    variant="outline"
                    className="border-destructive/40 text-xs font-normal text-destructive"
                    title={task.sync_error}
                  >
                    Sync failed
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="ml-2 flex items-center gap-1">
            <motion.button
              onClick={() => handleEditTask(task)}
              whileTap={reduceMotion ? undefined : { scale: 0.9 }}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Edit task"
              aria-label="Edit task"
            >
              <Pencil className="h-4 w-4" strokeWidth={2} />
            </motion.button>
            <motion.button
              onClick={() => handleDeleteTask(task.id)}
              disabled={isDeleting}
              whileTap={reduceMotion ? undefined : { scale: 0.9 }}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Delete task"
              aria-label="Delete task"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
            </motion.button>
          </div>
        </div>
        </motion.div>
      </motion.div>
    );
  };

  // Declared before the isLoading early return below (and the keyboard
  // effect with it) so hook call order never changes between the loading
  // and loaded renders - filterTasks/tasks are safe to call during loading,
  // they just produce empty-ish arrays until data resolves.
  const todayTasks = filterTasks(getTodayOccurrences());
  const upcomingTasks = filterTasks(getUpcomingOccurrences());
  const overdueTasks = filterTasks(getOverdueTasks().map(asOccurrence));
  const allTasks = filterTasks(tasks.map(asOccurrence));

  // J/K/X/N keyboard nav. Ignored while typing in any text input/textarea
  // (including this page's search and AI-quick-add fields) so the letters
  // aren't hijacked from normal typing. Rows are identified via
  // data-task-row/data-task-id/data-task-date rather than array index, so
  // nav stays correct across re-renders and works identically in every tab
  // (Radix Tabs only mounts the active panel's rows).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isTyping) return;

      const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-task-row]'));
      const activeIndex = rows.findIndex((row) => row === document.activeElement);

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        const next = rows[activeIndex + 1] ?? rows[0];
        next?.focus();
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        const prev = activeIndex > 0 ? rows[activeIndex - 1] : rows[rows.length - 1];
        prev?.focus();
      } else if (e.key === 'x' || e.key === 'X') {
        if (activeIndex === -1) return;
        e.preventDefault();
        const taskId = rows[activeIndex].dataset.taskId;
        const displayDate = rows[activeIndex].dataset.taskDate;
        const item = [...todayTasks, ...upcomingTasks, ...overdueTasks, ...allTasks].find(
          (t) => t.id === taskId && getOccurrenceDate(t) === displayDate
        );
        if (item) handleToggleComplete(item);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        aiInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayTasks, upcomingTasks, overdueTasks, allTasks]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <TaskListSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          {/* TopBar already renders "Task Manager" as the page h1 - this
              stat line is the actual new information for this view, so it
              carries the weight instead of repeating the title. */}
          <p className="text-[15px] text-muted-foreground">
            <span className="tabular-nums font-medium text-foreground">{tasks.length}</span> total tasks, <span className="tabular-nums font-medium text-foreground">{tasks.filter(t => t.status === 'completed').length}</span> completed
          </p>
        </div>
        <Button onClick={handleAddNew} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" strokeWidth={2} />
          Add Task
        </Button>
      </div>

      {/* AI Quick Add */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2 pl-3 transition-colors focus-within:border-foreground/30 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Sparkles className="absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground" strokeWidth={2} />
          <Input
            ref={aiInputRef}
            placeholder="Try: lunch with Sam tomorrow 1pm, high priority"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAiQuickAdd()}
            disabled={isParsing}
            className="h-11 border-0 bg-transparent pl-8 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <Button
          onClick={handleAiQuickAdd}
          disabled={isParsing || !aiInput.trim()}
          className="w-full sm:w-auto"
        >
          {isParsing ? 'Parsing...' : 'Quick add with AI'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="min-w-0 flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={2} />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {tags.map(tag => (
                <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Task Tabs */}
      <Tabs defaultValue="today" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="today">Today <span className="ml-1 tabular-nums">({todayTasks.length})</span></TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming <span className="ml-1 tabular-nums">({upcomingTasks.length})</span></TabsTrigger>
          <TabsTrigger value="overdue">Overdue <span className="ml-1 tabular-nums">({overdueTasks.length})</span></TabsTrigger>
          <TabsTrigger value="all">All <span className="ml-1 tabular-nums">({allTasks.length})</span></TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-6 space-y-3">
          {todayTasks.length === 0 ? (
            <EmptyState
              icon={<ListTodo className="h-6 w-6" strokeWidth={2} />}
              title="No tasks for today"
              description="Your day is clear. Add a task to get started."
              cta={
                <Button onClick={handleAddNew} variant="outline">
                  <Plus className="mr-2 h-4 w-4" strokeWidth={2} />
                  Add your first task
                </Button>
              }
            />
          ) : (
            <AnimatePresence initial={false}>
              {todayTasks.map((task, i) => <TaskCard key={`${task.id}-${getOccurrenceDate(task)}`} task={task} index={i} />)}
            </AnimatePresence>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-6 space-y-3">
          {upcomingTasks.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="h-6 w-6" strokeWidth={2} />}
              title="No upcoming tasks"
              description="Nothing scheduled for the days ahead."
            />
          ) : (
            <AnimatePresence initial={false}>
              {upcomingTasks.map((task, i) => <TaskCard key={`${task.id}-${getOccurrenceDate(task)}`} task={task} index={i} showDate />)}
            </AnimatePresence>
          )}
        </TabsContent>

        <TabsContent value="overdue" className="mt-6 space-y-3">
          {overdueTasks.length === 0 ? (
            <EmptyState
              icon={<AlarmClock className="h-6 w-6" strokeWidth={2} />}
              title="No overdue tasks"
              description="You're all caught up."
            />
          ) : (
            <AnimatePresence initial={false}>
              {overdueTasks.map((task, i) => <TaskCard key={`${task.id}-${getOccurrenceDate(task)}`} task={task} index={i} showDate />)}
            </AnimatePresence>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-6 space-y-3">
          {allTasks.length === 0 ? (
            <EmptyState
              icon={<ListChecks className="h-6 w-6" strokeWidth={2} />}
              title="No tasks found"
              description="Create a task, or adjust your filters to see more."
              cta={
                <Button onClick={handleAddNew} variant="outline">
                  <Plus className="mr-2 h-4 w-4" strokeWidth={2} />
                  Add your first task
                </Button>
              }
            />
          ) : (
            <AnimatePresence initial={false}>
              {allTasks.map((task, i) => <TaskCard key={`${task.id}-${getOccurrenceDate(task)}`} task={task} index={i} showDate />)}
            </AnimatePresence>
          )}
        </TabsContent>
      </Tabs>

      {/* Discoverable hint for the J/K/X/N keyboard-nav layer above -
          without this, a real power-user feature is invisible. Hidden on
          touch-first layouts where it doesn't apply. */}
      <div className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">J</kbd>
          <span>/</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">K</kbd>
          <span className="ml-1">navigate</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">X</kbd>
          <span className="ml-1">toggle</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">N</kbd>
          <span className="ml-1">new</span>
        </span>
      </div>

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
          setTaskDraft(null);
        }}
        task={editingTask}
        draft={taskDraft}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false })}
        onConfirm={confirmDelete}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
};

export default TaskManager;
