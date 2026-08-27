
import React from 'react';
import { Plus, Menu } from 'lucide-react';

interface TopBarProps {
  onQuickAdd: () => void;
  currentView: string;
  onMenuClick?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onQuickAdd, currentView, onMenuClick }) => {
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const viewTitles = {
    dashboard: 'Dashboard',
    tasks: 'Task Manager',
    calendar: 'Calendar',
    habits: 'Habits',
    tags: 'Tags',
    progress: 'Progress & Analytics',
    settings: 'Settings'
  };

  return (
    <div className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-black dark:text-white truncate">{viewTitles[currentView as keyof typeof viewTitles]}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">{formattedDate}</p>
        </div>
      </div>

      <button
        onClick={onQuickAdd}
        className="flex items-center px-3 sm:px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shrink-0"
      >
        <Plus className="w-4 h-4 sm:mr-2" />
        <span className="hidden sm:inline">Quick Add</span>
      </button>
    </div>
  );
};

export default TopBar;
