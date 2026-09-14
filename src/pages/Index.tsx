
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import Dashboard from "@/components/Dashboard";
import TaskManager from "@/components/TaskManager";
import CalendarView from "@/components/CalendarView";
import EventsView from "@/components/EventsView";
import HabitsView from "@/components/HabitsView";
import TagsView from "@/components/TagsView";
import ProgressView from "@/components/ProgressView";
import Settings from "@/components/Settings";
import SuggestionsView from "@/components/SuggestionsView";
import { useAiSuggestions } from "@/hooks/useAiSuggestions";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { settings } = useSettings();
  const { pendingCount } = useAiSuggestions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Apply theme on component mount and when settings change
  useEffect(() => {
    if (settings?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings?.theme]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  // The OAuth callback function redirects back here with
  // ?integration=connected&provider=google (or =microsoft), or
  // ?integration=error(&provider=...). Surface the outcome, then strip the
  // params so a refresh doesn't re-fire the toast.
  useEffect(() => {
    const integration = searchParams.get('integration');
    if (!integration) return;
    const provider = searchParams.get('provider');
    const label = provider === 'microsoft' ? 'Microsoft' : provider === 'google' ? 'Google' : 'the integration';
    if (integration === 'connected') {
      toast.success(`${label} connected!`);
    } else {
      toast.error(`Failed to connect ${label}. Please try again.`);
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleQuickAdd = () => {
    // Quick add functionality - could open a task modal or navigate to tasks
    setCurrentView('tasks');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black dark:border-white mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'tasks':
        return <TaskManager />;
      case 'calendar':
        return <CalendarView />;
      case 'events':
        return <EventsView />;
      case 'habits':
        return <HabitsView />;
      case 'tags':
        return <TagsView />;
      case 'progress':
        return <ProgressView />;
      case 'suggestions':
        return <SuggestionsView />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex w-full">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        badges={{ suggestions: pendingCount }}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          onQuickAdd={handleQuickAdd}
          currentView={currentView}
          onMenuClick={() => setIsSidebarOpen(true)}
        />
        <main className="flex-1 overflow-auto">
          <div className="h-full">
            {renderCurrentView()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
