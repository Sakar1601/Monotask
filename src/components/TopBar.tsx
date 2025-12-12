
import React from 'react';
import { Plus } from 'lucide-react';

interface TopBarProps {
  onQuickAdd: () => void;
  currentView: string;
}

const TopBar: React.FC<TopBarProps> = ({ onQuickAdd, currentView }) => {
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
    progress: 'Progress & Analytics',
    settings: 'Settings'
  };

  return (
    <div className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 transition-colors">
      <div>
        <h2 className="text-xl font-semibold text-black dark:text-white">{viewTitles[currentView as keyof typeof viewTitles]}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{formattedDate}</p>
      </div>
      
      <button
        onClick={onQuickAdd}
        className="flex items-center px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
      >
        <Plus className="w-4 h-4 mr-2" />
        Quick Add
      </button>
    </div>
  );
};

export default TopBar;
