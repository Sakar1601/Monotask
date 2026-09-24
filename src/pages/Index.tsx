
import { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { CommandPalette } from "@/components/CommandPalette";
import Dashboard from "@/components/Dashboard";
import TaskManager from "@/components/TaskManager";
import CalendarView from "@/components/CalendarView";
import EventsView from "@/components/EventsView";
import HabitsView from "@/components/HabitsView";
import TagsView from "@/components/TagsView";
import ProgressView from "@/components/ProgressView";
import Settings from "@/components/Settings";
import SuggestionsView from "@/components/SuggestionsView";
import TaskModal from "@/components/TaskModal";
import { useAiSuggestions } from "@/hooks/useAiSuggestions";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { settings } = useSettings();
  const { pendingCount } = useAiSuggestions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentView, setCurrentView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Global Cmd/Ctrl+K to open the command palette, from anywhere in the app.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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

  // This app has no per-view routes (see the switch below) - "navigation"
  // is a single useState swap, which previously rendered as a flat,
  // instant cut between screens. Wrapped in the View Transitions API so it
  // reads as one continuous surface instead of a stack of static pages.
  // Same-document view transitions degrade automatically where unsupported
  // (Firefox as of this writing) - `document.startViewTransition` is simply
  // undefined there, so the branch below falls through to a plain state
  // set with no error and no missing functionality, just no transition.
  // `flushSync` is required: startViewTransition needs the DOM mutation to
  // land synchronously inside its callback, but React 18 batches state
  // updates by default.
  const changeView = (view: string) => {
    if (view === currentView) return;
    if (typeof document.startViewTransition === 'function' && !prefersReducedMotion) {
      document.startViewTransition(() => {
        flushSync(() => setCurrentView(view));
      });
    } else {
      setCurrentView(view);
    }
  };

  // Opens the New Task dialog in place, on whichever page you're on -
  // no navigation, so it works identically from Dashboard, Calendar, etc.
  const handleQuickAdd = () => setIsQuickAddOpen(true);

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
        return <Dashboard onNavigate={changeView} />;
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
        onViewChange={changeView}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        badges={{ suggestions: pendingCount }}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          onQuickAdd={handleQuickAdd}
          currentView={currentView}
          onMenuClick={() => setIsSidebarOpen(true)}
          onSearchClick={() => setIsCommandPaletteOpen(true)}
        />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
            {renderCurrentView()}
          </div>
        </main>
      </div>
      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        onNavigateView={changeView}
      />
      <TaskModal isOpen={isQuickAddOpen} onClose={() => setIsQuickAddOpen(false)} />
    </div>
  );
};

export default Index;
