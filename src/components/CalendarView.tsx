
import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, CalendarClock } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useTaskInstances } from '@/hooks/useTaskInstances';
import { useEvents, Event } from '@/hooks/useEvents';
import { getTasksForDate as getOccurrencesForDate, generateRecurringInstances, RecurringTaskInstance } from '@/utils/recurringTasks';
import { isOccurrenceCompleted, getOccurrenceDate, toggleOccurrenceComplete } from '@/utils/taskOccurrences';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import TaskModal from './TaskModal';
import DayTasksModal from './DayTasksModal';
import EventModal from './EventModal';
import TodaySchedule from './TodaySchedule';

const CalendarView: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [monthDirection, setMonthDirection] = useState<1 | -1>(1);
  const [view, setView] = useState<'month' | 'week' | 'agenda'>('month');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isDayTasksModalOpen, setIsDayTasksModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [prefilledDate, setPrefilledDate] = useState<string>('');

  const prefersReducedMotion = useReducedMotion();

  const { tasks, isLoading: tasksLoading, updateTask } = useTasks();
  const { instances, isLoading: instancesLoading, updateInstance } = useTaskInstances();
  const { events } = useEvents();
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const isLoading = tasksLoading || instancesLoading;

  // start_time is a UTC ISO timestamp from PostgREST, but dateString is built
  // from LOCAL date components - compare on the event's LOCAL date so a late
  // evening event in a UTC-negative timezone doesn't land on the next day.
  const getEventsForDate = (dateString: string) =>
    events.filter((event) => {
      const eventDate = new Date(event.start_time);
      return formatDateForComparison(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()) === dateString;
    });

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setMonthDirection(direction === 'next' ? 1 : -1);
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const formatDateForComparison = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getTasksForDate = (dateString: string): RecurringTaskInstance[] => {
    return getOccurrencesForDate(tasks, instances, dateString);
  };

  const handleToggleComplete = (item: RecurringTaskInstance) => {
    toggleOccurrenceComplete(item, { updateTask, updateInstance });
  };

  const handleDayClick = (date: Date) => {
    const clickedDate = formatDateForComparison(date.getFullYear(), date.getMonth(), date.getDate());
    const dayTasks = getTasksForDate(clickedDate);

    if (dayTasks.length > 0) {
      setSelectedDate(clickedDate);
      setIsDayTasksModalOpen(true);
    } else {
      setPrefilledDate(clickedDate);
      setIsTaskModalOpen(true);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const today = new Date();

  const EventChip: React.FC<{ event: Event }> = ({ event }) => (
    <motion.button
      type="button"
      whileHover={prefersReducedMotion ? undefined : { y: -1 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onClick={(e) => {
        e.stopPropagation();
        setEditingEvent(event);
        setIsEventModalOpen(true);
      }}
      className={cn(
        'block w-full truncate rounded px-1.5 py-1 text-left text-xs font-medium text-secondary-foreground bg-secondary transition-colors hover:bg-secondary/80',
        event.sync_error && 'ring-1 ring-destructive'
      )}
      title={event.sync_error ? `${event.title} (sync failed: ${event.sync_error})` : event.title}
    >
      {event.title}
    </motion.button>
  );

  // Today's date indicator: shared-element spring marker + a restrained
  // "live now" pulse (genuinely live - reflects the real current date),
  // per the motion contract's snappy-feedback spring and the perpetual
  // micro-interaction rule (motivated by real-time state, not decoration).
  const TodayMarker: React.FC<{ day: number | string; size: 'sm' | 'lg' }> = ({ day, size }) => (
    <div className="relative flex items-center justify-center">
      {!prefersReducedMotion && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-primary/40"
          animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <motion.div
        layoutId="calendar-today-marker"
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'relative flex items-center justify-center rounded-full bg-primary font-semibold tabular-nums text-primary-foreground',
          size === 'lg' ? 'h-8 w-8 text-lg' : 'h-6 w-6 text-sm'
        )}
      >
        {day}
      </motion.div>
    </div>
  );

  const renderWeekView = () => {
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());

    const days = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(weekStart);
      currentDay.setDate(weekStart.getDate() + i);

      const dateString = formatDateForComparison(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate());
      const dayTasks = getTasksForDate(dateString);

      const isToday = today.getDate() === currentDay.getDate() &&
                     today.getMonth() === currentDay.getMonth() &&
                     today.getFullYear() === currentDay.getFullYear();

      days.push(
        <motion.button
          key={i}
          type="button"
          aria-label={`${dayNames[i]}, ${currentDay.toLocaleDateString()}${dayTasks.length > 0 ? `, ${dayTasks.length} task${dayTasks.length > 1 ? 's' : ''}` : ', no tasks'}`}
          whileHover={prefersReducedMotion ? undefined : { y: -1 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="block min-h-[280px] w-full border-r border-border bg-card p-3 text-left transition-colors last:border-r-0 hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:min-h-[400px]"
          onClick={() => handleDayClick(currentDay)}
        >
          <div className="mb-3 text-center">
            <div className="text-sm font-medium text-muted-foreground">
              {dayNames[i]}
            </div>
            {isToday ? (
              <div className="mx-auto">
                <TodayMarker day={currentDay.getDate()} size="lg" />
              </div>
            ) : (
              <div className="mx-auto flex h-8 w-8 items-center justify-center text-lg font-semibold tabular-nums text-foreground">
                {currentDay.getDate()}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            {dayTasks.map((task) => (
              <div
                key={`${task.id}-${getOccurrenceDate(task)}`}
                className={cn(
                  'rounded p-2 text-xs',
                  isOccurrenceCompleted(task)
                    ? 'bg-muted text-muted-foreground line-through'
                    : 'bg-muted/60 text-foreground'
                )}
                title={task.title}
              >
                <div className="truncate font-medium">{task.title}</div>
                {task.due_time && (
                  <div className="mt-1 tabular-nums text-muted-foreground">{task.due_time}</div>
                )}
              </div>
            ))}
            {getEventsForDate(dateString).slice(0, 2).map((event) => (
              <EventChip key={event.id} event={event} />
            ))}
          </div>
        </motion.button>
      );
    }

    return days;
  };

  const renderMonthView = () => {
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-32 border border-border bg-muted/30"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = today.getDate() === day &&
                     today.getMonth() === currentDate.getMonth() &&
                     today.getFullYear() === currentDate.getFullYear();

      const dateString = formatDateForComparison(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayTasks = getTasksForDate(dateString);

      days.push(
        <motion.button
          key={day}
          type="button"
          aria-label={`${monthNames[currentDate.getMonth()]} ${day}, ${currentDate.getFullYear()}${dayTasks.length > 0 ? `, ${dayTasks.length} task${dayTasks.length > 1 ? 's' : ''}` : ', no tasks'}`}
          whileHover={prefersReducedMotion ? undefined : { y: -1 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="group relative block h-20 w-full border border-border bg-card p-1.5 text-left transition-colors hover:bg-muted/60 hover:shadow-[0_10px_24px_-14px_hsl(var(--primary)/0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:h-32 sm:p-2"
          onClick={() => handleDayClick(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
        >
          <div className="mb-1 flex items-start justify-between">
            {isToday ? (
              <TodayMarker day={day} size="sm" />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center text-sm font-medium tabular-nums text-foreground">
                {day}
              </div>
            )}
            {dayTasks.length === 0 && (
              <Plus className="hidden h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:block" strokeWidth={1.75} />
            )}
          </div>
          <div className="space-y-1 overflow-hidden">
            {dayTasks.slice(0, 3).map((task, idx) => (
              <div
                key={`${task.id}-${getOccurrenceDate(task)}`}
                className={cn(
                  'truncate rounded p-1 text-xs',
                  idx > 0 && 'hidden sm:block',
                  isOccurrenceCompleted(task)
                    ? 'bg-muted text-muted-foreground line-through'
                    : 'bg-muted/60 text-foreground'
                )}
                title={task.title}
              >
                {task.title}
              </div>
            ))}
            {dayTasks.length > 1 && (
              <div className="text-[10px] tabular-nums text-muted-foreground sm:hidden">
                +{dayTasks.length - 1} more
              </div>
            )}
            <div className="hidden sm:block">
              {getEventsForDate(dateString).slice(0, 2).map((event) => (
                <EventChip key={event.id} event={event} />
              ))}
            </div>
            {dayTasks.length > 3 && (
              <div className="hidden text-xs text-muted-foreground sm:block">
                +{dayTasks.length - 3} more
              </div>
            )}
          </div>
        </motion.button>
      );
    }

    return days;
  };

  // A vertical timeline for today's real scheduled items (tasks with a
  // due_time, events with a start_time), with a live "now" row inserted at
  // its actual chronological position among them - not a proportional
  // pixel-position line (that would need a fixed day-window assumption
  // this app has no real concept of), just an honest "here's what's next"
  // marker computed from the real current time. No focus-mode/deep-work
  // tracking here - this app has no such feature, so none is implied.
  const renderAgendaView = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 30);

    const upcomingTasks = generateRecurringInstances(tasks, instances, today, horizon)
      .filter(item => !!getOccurrenceDate(item))
      .sort((a, b) => getOccurrenceDate(a).localeCompare(getOccurrenceDate(b)))
      .slice(0, 10);

    return (
      <div>
        <div className="mb-6"><TodaySchedule hideWhenEmpty /></div>
        <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-grotesk text-lg font-semibold text-foreground">Upcoming tasks</h3>
        {upcomingTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CalendarClock className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
            <p className="text-sm text-muted-foreground">Nothing scheduled in the next 30 days.</p>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.05 } } }}
            className="mt-4 space-y-3"
          >
            <AnimatePresence initial={false}>
              {upcomingTasks.map((task) => (
                <motion.div
                  key={`${task.id}-${getOccurrenceDate(task)}`}
                  layout={!prefersReducedMotion}
                  variants={prefersReducedMotion ? { hidden: { opacity: 1 }, show: { opacity: 1 } } : { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -8, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  whileHover={prefersReducedMotion ? undefined : { y: -1 }}
                  className="flex items-center gap-4 border-l-4 border-primary bg-muted/60 p-3 transition-colors hover:shadow-[0_10px_24px_-16px_hsl(var(--primary)/0.6)]"
                >
                  <div className="text-sm tabular-nums text-muted-foreground">
                    {new Date(getOccurrenceDate(task) + 'T00:00:00').toLocaleDateString()}
                  </div>
                  <div className="flex-1">
                    <div className={cn('font-medium text-foreground', isOccurrenceCompleted(task) && 'line-through opacity-70')}>
                      {task.title}
                    </div>
                    {task.due_time && (
                      <div className="text-sm tabular-nums text-muted-foreground">{task.due_time}</div>
                    )}
                  </div>
                  {task.tags && (
                    <div
                      className="rounded-full px-2 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: task.tags.color }}
                    >
                      {task.tags.name}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-56" />
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-none sm:h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <h2 className="font-grotesk text-2xl font-bold text-foreground">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth('prev')} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth('next')} aria-label="Next month">
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          {(['month', 'week', 'agenda'] as const).map((viewType) => (
            <motion.div key={viewType} whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
              <Button
                size="sm"
                variant={view === viewType ? 'default' : 'outline'}
                className="capitalize"
                onClick={() => setView(viewType)}
              >
                {viewType}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>

      {view === 'month' && (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-7 bg-muted/40">
            {dayNames.map((dayName) => (
              <div key={dayName} className="border-r border-border p-2 text-center text-xs font-medium text-muted-foreground last:border-r-0 sm:p-4 sm:text-sm">
                {dayName}
              </div>
            ))}
          </div>

          <div className="overflow-hidden">
            <AnimatePresence mode="wait" custom={monthDirection} initial={false}>
              <motion.div
                key={`${currentDate.getFullYear()}-${currentDate.getMonth()}`}
                custom={monthDirection}
                initial={prefersReducedMotion ? false : { opacity: 0, x: monthDirection * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -monthDirection * 24 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="grid grid-cols-7"
              >
                {renderMonthView()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-7">
            {renderWeekView()}
          </div>
        </div>
      )}

      {view === 'agenda' && renderAgendaView()}

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setPrefilledDate('');
        }}
        prefilledDate={prefilledDate}
      />

      <DayTasksModal
        isOpen={isDayTasksModalOpen}
        onClose={() => {
          setIsDayTasksModalOpen(false);
          setSelectedDate('');
        }}
        date={selectedDate}
        tasks={getTasksForDate(selectedDate)}
        onToggleComplete={handleToggleComplete}
      />

      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => {
          setIsEventModalOpen(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
      />
    </div>
  );
};

export default CalendarView;
