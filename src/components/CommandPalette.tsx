import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  CalendarClock,
  Repeat,
  Tag,
  LineChart,
  Sparkles,
  Settings as SettingsIcon,
  Search,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useTasks } from '@/hooks/useTasks';
import { useHabits } from '@/hooks/useHabits';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateView: (view: string) => void;
}

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'events', label: 'Events', icon: CalendarClock },
  { id: 'habits', label: 'Habits', icon: Repeat },
  { id: 'tags', label: 'Tags', icon: Tag },
  { id: 'progress', label: 'Progress', icon: LineChart },
  { id: 'suggestions', label: 'Suggestions', icon: Sparkles },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

/**
 * A real command palette, not a decorative search box: it jumps between the
 * app's actual views and searches actual task/habit titles already loaded
 * by useTasks/useHabits (no separate search endpoint, no invented data).
 * Selecting a task or habit navigates to its owning view - this app has no
 * per-item deep link yet, so "open the exact task" isn't a capability that
 * exists to promise here.
 */
export function CommandPalette({ open, onOpenChange, onNavigateView }: CommandPaletteProps) {
  const { tasks } = useTasks();
  const { habits } = useHabits();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const goToView = (view: string) => {
    onOpenChange(false);
    onNavigateView(view);
  };

  const matchedTasks = search.trim()
    ? tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : [];
  const matchedHabits = search.trim()
    ? habits.filter((h) => h.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : [];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search tasks, habits, or jump to a view..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-2 text-muted-foreground">
            <Search className="h-4 w-4" strokeWidth={1.75} />
            <span>No matches.</span>
          </div>
        </CommandEmpty>

        {matchedTasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {matchedTasks.map((task) => (
              <CommandItem key={task.id} value={`${task.title} task-${task.id}`} onSelect={() => goToView('tasks')}>
                <CheckSquare className="mr-2 h-4 w-4" strokeWidth={1.75} />
                <span className="truncate">{task.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {matchedHabits.length > 0 && (
          <CommandGroup heading="Habits">
            {matchedHabits.map((habit) => (
              <CommandItem key={habit.id} value={`${habit.name} habit-${habit.id}`} onSelect={() => goToView('habits')}>
                <Repeat className="mr-2 h-4 w-4" strokeWidth={1.75} />
                <span className="truncate">{habit.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {(matchedTasks.length > 0 || matchedHabits.length > 0) && <CommandSeparator />}

        <CommandGroup heading="Jump to">
          {VIEWS.map((view) => (
            <CommandItem key={view.id} value={`view-${view.label}`} onSelect={() => goToView(view.id)}>
              <view.icon className="mr-2 h-4 w-4" strokeWidth={1.75} />
              <span>{view.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
