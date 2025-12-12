
import React from 'react';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Calendar, 
  BarChart3, 
  Settings,
  Repeat,
  LogOut,
  Tag
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const { signOut } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'habits', label: 'Habits', icon: Repeat },
    { id: 'tags', label: 'Tags', icon: Tag },
    { id: 'progress', label: 'Progress', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-colors duration-200 h-screen overflow-hidden">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <h1 className="text-xl font-bold text-black dark:text-white">Monotask</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Minimal productivity</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onViewChange(item.id)}
                  className={`w-full flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm'
                      : 'text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className={`mr-3 h-5 w-5 transition-colors ${
                    isActive ? 'text-white dark:text-black' : 'text-gray-400 dark:text-gray-500'
                  }`} />
                  <span className="font-medium">{item.label}</span>
                  {isActive && <div className="ml-auto w-1 h-1 bg-white dark:bg-black rounded-full" />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
        <button
          onClick={signOut}
          className="w-full flex items-center px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200"
        >
          <LogOut className="mr-3 h-5 w-5 text-gray-400 dark:text-gray-500" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
