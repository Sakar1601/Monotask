
import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  BarChart3,
  Settings,
  Repeat,
  LogOut,
  Tag,
  X
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, isOpen = false, onClose }) => {
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

  const handleSelect = (view: string) => {
    onViewChange(view);
    onClose?.();
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col h-screen shrink-0 transform transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:static md:sticky md:top-0`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-border shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Monotask</h1>
            <p className="text-sm text-muted-foreground">Minimal productivity</p>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto min-h-0">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleSelect(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-foreground text-background shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <Icon className={`mr-3 h-5 w-5 transition-colors ${
                      isActive ? 'text-background' : 'text-muted-foreground'
                    }`} />
                    <span className="font-medium">{item.label}</span>
                    {isActive && <div className="ml-auto w-1 h-1 bg-background rounded-full" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-border shrink-0 mt-auto">
          <button
            onClick={signOut}
            className="w-full flex items-center px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all duration-200"
          >
            <LogOut className="mr-3 h-5 w-5 text-muted-foreground" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
