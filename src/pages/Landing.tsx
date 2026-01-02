import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useRef } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import { 
  CheckSquare, 
  Repeat, 
  Calendar, 
  BarChart3, 
  Download, 
  Moon,
  ArrowRight,
  ArrowDown,
  Github,
  Linkedin,
  Twitter,
  Sparkles,
  FileText,
  Upload,
  Flame,
  Play,
  Check,
  Clock,
  Target,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const Landing = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [activeDemo, setActiveDemo] = useState<'tasks' | 'habits' | 'calendar' | 'heatmap'>('tasks');
  const featuresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && user) {
      navigate('/app');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    );
  }

  const features = [
    {
      icon: CheckSquare,
      title: 'Task Manager',
      description: 'Create and manage tasks with due dates, priorities, and categories.',
      color: 'from-foreground/10 to-foreground/5'
    },
    {
      icon: Repeat,
      title: 'Habit Tracker',
      description: 'Build consistent routines and view your habit streaks over time.',
      color: 'from-foreground/10 to-foreground/5'
    },
    {
      icon: Calendar,
      title: 'Calendar View',
      description: 'Plan visually with intuitive calendar week and month views.',
      color: 'from-foreground/10 to-foreground/5'
    },
    {
      icon: Flame,
      title: 'Weekly Heatmap',
      description: 'Track productivity patterns with beautiful visual graphs.',
      color: 'from-foreground/10 to-foreground/5'
    },
    {
      icon: Repeat,
      title: 'Recurring Tasks',
      description: 'Auto-create repeating tasks on daily, weekly, or custom schedules.',
      color: 'from-foreground/10 to-foreground/5'
    },
    {
      icon: FileText,
      title: 'Export as PDF',
      description: 'Print or export your task list and productivity summary.',
      color: 'from-foreground/10 to-foreground/5'
    },
    {
      icon: Upload,
      title: 'Import/Export',
      description: 'Seamlessly transfer your task data between devices.',
      color: 'from-foreground/10 to-foreground/5'
    },
    {
      icon: Moon,
      title: 'Dark Mode',
      description: 'Switch themes easily with beautiful dark and light modes.',
      color: 'from-foreground/10 to-foreground/5'
    }
  ];

  const steps = [
    {
      icon: Target,
      title: 'Create Tasks & Habits',
      description: 'Add your daily tasks and habits with just a few clicks.',
      visual: 'form'
    },
    {
      icon: Check,
      title: 'Track Your Day',
      description: 'Check off completed tasks and build your habit streaks.',
      visual: 'check'
    },
    {
      icon: BarChart3,
      title: 'Review Progress',
      description: 'Visualize your productivity with calendars and heatmaps.',
      visual: 'chart'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94] as const
      }
    }
  };

  const slideUp = {
    hidden: { opacity: 0, y: 60 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] as const }
    }
  };

  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 0.8, delay: 0.3 }
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Floating Shapes Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ 
            y: [0, -20, 0],
            rotate: [0, 5, 0]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 left-[10%] w-64 h-64 bg-foreground/[0.02] rounded-full blur-3xl"
        />
        <motion.div
          animate={{ 
            y: [0, 30, 0],
            rotate: [0, -5, 0]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-40 right-[15%] w-80 h-80 bg-foreground/[0.03] rounded-full blur-3xl"
        />
        <motion.div
          animate={{ 
            y: [0, -15, 0],
            x: [0, 10, 0]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-40 left-[20%] w-72 h-72 bg-foreground/[0.02] rounded-full blur-3xl"
        />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="fixed inset-0 -z-10 pointer-events-none opacity-[0.015]">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />
        </svg>
      </div>

      {/* Sticky Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled 
            ? 'bg-background/80 backdrop-blur-xl border-b border-border shadow-lg shadow-foreground/5' 
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2"
            >
              <div className="w-9 h-9 bg-foreground rounded-xl flex items-center justify-center shadow-lg">
                <CheckSquare className="w-5 h-5 text-background" />
              </div>
              <span className="text-xl font-bold text-foreground tracking-tight">Monotask</span>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2 sm:gap-3"
            >
              <Button 
                variant="ghost" 
                onClick={() => navigate('/auth')}
                className="text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              >
                Sign In
              </Button>
              <Button 
                onClick={() => navigate('/auth?mode=signup')}
                className="bg-foreground text-background hover:bg-foreground/90 group shadow-lg shadow-foreground/20"
              >
                <span className="hidden sm:inline">Get Started</span>
                <span className="sm:hidden">Start</span>
                <ArrowRight className="ml-1 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 border border-border mb-8"
          >
            <Sparkles className="w-4 h-4 text-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Simple. Focused. Effective.</span>
          </motion.div>
          
          <motion.h1 
            variants={slideUp}
            initial="hidden"
            animate="visible"
            className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground tracking-tight mb-4"
          >
            Stay focused.
          </motion.h1>
          
          <motion.p 
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-muted-foreground tracking-tight mb-6"
          >
            Track tasks. Build habits.
          </motion.p>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            A minimal productivity app designed to help you focus on what matters most. 
            Simple, distraction-free, and beautifully crafted.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button 
              size="lg"
              onClick={scrollToFeatures}
              className="bg-foreground text-background hover:bg-foreground/90 px-8 py-6 text-lg group shadow-xl shadow-foreground/20"
            >
              Start for Free
              <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button 
              variant="outline"
              size="lg"
              onClick={() => navigate('/auth')}
              className="px-8 py-6 text-lg border-border hover:bg-accent"
            >
              Sign In
            </Button>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <motion.button
            onClick={scrollToFeatures}
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="text-sm font-medium">Scroll to explore</span>
            <ArrowDown className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </section>

      {/* Product Demo Preview Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background via-accent/30 to-background">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              See it in action
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Experience how Monotask helps you stay organized and productive
            </p>
          </motion.div>

          {/* Demo Tabs */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-wrap justify-center gap-2 mb-8"
          >
            {[
              { id: 'tasks', label: 'Task Manager', icon: CheckSquare },
              { id: 'habits', label: 'Habit Tracker', icon: Repeat },
              { id: 'calendar', label: 'Calendar View', icon: Calendar },
              { id: 'heatmap', label: 'Heatmap', icon: BarChart3 }
            ].map((tab) => (
              <motion.button
                key={tab.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveDemo(tab.id as typeof activeDemo)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                  activeDemo === tab.id 
                    ? 'bg-foreground text-background shadow-lg' 
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </motion.button>
            ))}
          </motion.div>

          {/* Demo Window */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-foreground/20"></div>
                <div className="w-3 h-3 rounded-full bg-foreground/15"></div>
                <div className="w-3 h-3 rounded-full bg-foreground/10"></div>
              </div>
              <span className="ml-4 text-xs text-muted-foreground font-medium">Monotask Dashboard</span>
            </div>
            
            <div className="p-6 sm:p-10 min-h-[400px] bg-gradient-to-br from-card via-card to-accent/10">
              <AnimatePresence mode="wait">
                {activeDemo === 'tasks' && (
                  <motion.div
                    key="tasks"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-foreground">Today's Tasks</h3>
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium"
                      >
                        + Add Task
                      </motion.button>
                    </div>
                    {[
                      { text: 'Complete project proposal', done: false, priority: 'high' },
                      { text: 'Morning exercise routine', done: true, priority: 'medium' },
                      { text: 'Review team updates', done: false, priority: 'low' },
                      { text: 'Prepare for client meeting', done: false, priority: 'high' }
                    ].map((task, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        whileHover={{ scale: 1.01, x: 4 }}
                        className={`flex items-center gap-4 p-4 rounded-xl border ${
                          task.done ? 'bg-accent/50 border-border' : 'bg-background border-border hover:border-foreground/20'
                        } transition-all cursor-pointer`}
                      >
                        <motion.div 
                          whileTap={{ scale: 0.9 }}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                            task.done ? 'bg-foreground border-foreground' : 'border-muted-foreground/40'
                          }`}
                        >
                          {task.done && <Check className="w-3 h-3 text-background" />}
                        </motion.div>
                        <span className={`flex-1 ${task.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {task.text}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          task.priority === 'high' ? 'bg-foreground/10 text-foreground' :
                          task.priority === 'medium' ? 'bg-muted text-muted-foreground' :
                          'bg-muted/50 text-muted-foreground/70'
                        }`}>
                          {task.priority}
                        </span>
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {activeDemo === 'habits' && (
                  <motion.div
                    key="habits"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h3 className="text-xl font-semibold text-foreground mb-6">Your Habits</h3>
                    {[
                      { name: 'Morning Meditation', streak: 12, done: [true, true, true, true, true, false, false] },
                      { name: 'Read 30 minutes', streak: 7, done: [true, true, true, true, true, true, true] },
                      { name: 'Exercise', streak: 5, done: [true, true, true, true, true, false, false] }
                    ].map((habit, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.15 }}
                        className="p-5 rounded-xl bg-background border border-border"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-semibold text-foreground">{habit.name}</h4>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Flame className="w-4 h-4 text-foreground" />
                              {habit.streak} day streak
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, j) => (
                            <motion.div
                              key={j}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: i * 0.1 + j * 0.05 }}
                              className={`flex-1 h-10 rounded-lg flex items-center justify-center text-xs font-medium ${
                                habit.done[j] 
                                  ? 'bg-foreground text-background' 
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {day}
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {activeDemo === 'calendar' && (
                  <motion.div
                    key="calendar"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <h3 className="text-xl font-semibold text-foreground mb-6">January 2026</h3>
                    <div className="grid grid-cols-7 gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="text-center text-xs text-muted-foreground font-medium py-2">
                          {day}
                        </div>
                      ))}
                      {Array.from({ length: 35 }, (_, i) => {
                        const day = i - 3;
                        const hasTasks = [2, 5, 8, 12, 15, 19, 22, 26].includes(day);
                        const isToday = day === 15;
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.01 }}
                            className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm cursor-pointer transition-all ${
                              day < 1 || day > 31 ? 'text-muted-foreground/30' :
                              isToday ? 'bg-foreground text-background font-bold' :
                              hasTasks ? 'bg-accent hover:bg-accent/80' : 'hover:bg-accent/50'
                            }`}
                          >
                            {day >= 1 && day <= 31 && (
                              <>
                                <span>{day}</span>
                                {hasTasks && !isToday && (
                                  <div className="w-1 h-1 rounded-full bg-foreground mt-1" />
                                )}
                              </>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {activeDemo === 'heatmap' && (
                  <motion.div
                    key="heatmap"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-foreground">Productivity Heatmap</h3>
                      <span className="text-sm text-muted-foreground">Last 12 weeks</span>
                    </div>
                    <div className="space-y-2">
                      {['Mon', 'Wed', 'Fri'].map((day, dayIndex) => (
                        <div key={day} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-8">{day}</span>
                          <div className="flex gap-1 flex-1">
                            {Array.from({ length: 12 }, (_, weekIndex) => {
                              const intensity = Math.random();
                              return (
                                <motion.div
                                  key={weekIndex}
                                  initial={{ opacity: 0, scale: 0 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: (dayIndex * 12 + weekIndex) * 0.01 }}
                                  className={`flex-1 h-6 rounded-sm ${
                                    intensity > 0.8 ? 'bg-foreground' :
                                    intensity > 0.6 ? 'bg-foreground/70' :
                                    intensity > 0.4 ? 'bg-foreground/40' :
                                    intensity > 0.2 ? 'bg-foreground/20' :
                                    'bg-muted'
                                  }`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground">
                      <span>Less</span>
                      <div className="flex gap-1">
                        {[10, 30, 50, 70, 100].map((opacity) => (
                          <div 
                            key={opacity} 
                            className="w-4 h-4 rounded-sm" 
                            style={{ backgroundColor: `hsl(var(--foreground) / ${opacity / 100})` }}
                          />
                        ))}
                      </div>
                      <span>More</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section ref={featuresRef} className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Everything you need to stay productive
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features wrapped in a minimal interface. No clutter, no distractions.
            </p>
          </motion.div>
          
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6"
          >
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div 
                  key={index}
                  variants={itemVariants}
                  whileHover={{ 
                    y: -8, 
                    scale: 1.02,
                    transition: { duration: 0.2 }
                  }}
                  className="group p-6 rounded-2xl border border-border bg-card hover:bg-accent/50 hover:border-foreground/10 transition-all duration-300 cursor-default hover:shadow-xl hover:shadow-foreground/5"
                >
                  <motion.div 
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.4 }}
                    className="w-12 h-12 rounded-xl bg-gradient-to-br from-foreground to-foreground/80 flex items-center justify-center mb-4 shadow-lg group-hover:shadow-foreground/20"
                  >
                    <Icon className="w-6 h-6 text-background" />
                  </motion.div>
                  <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-foreground/90">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-accent/30 via-background to-background">
        <div className="max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              How it works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes with a simple three-step workflow
            </p>
          </motion.div>

          <div className="space-y-8">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="relative"
              >
                <div className={`flex flex-col md:flex-row items-center gap-8 ${
                  index % 2 === 1 ? 'md:flex-row-reverse' : ''
                }`}>
                  {/* Step Number & Content */}
                  <div className="flex-1 text-center md:text-left">
                    <motion.div 
                      whileInView={{ scale: [0.8, 1.1, 1] }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5 }}
                      className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-foreground text-background font-bold text-lg mb-4"
                    >
                      {index + 1}
                    </motion.div>
                    <h3 className="text-2xl font-bold text-foreground mb-3">{step.title}</h3>
                    <p className="text-muted-foreground text-lg">{step.description}</p>
                  </div>

                  {/* Visual */}
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className="flex-1 w-full max-w-sm"
                  >
                    <div className="p-6 rounded-2xl bg-card border border-border shadow-xl">
                      {step.visual === 'form' && (
                        <div className="space-y-4">
                          <motion.div 
                            initial={{ width: 0 }}
                            whileInView={{ width: '100%' }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                            className="h-10 bg-muted rounded-lg"
                          />
                          <motion.div 
                            initial={{ width: 0 }}
                            whileInView={{ width: '70%' }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                            className="h-10 bg-muted rounded-lg"
                          />
                          <motion.button
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.7 }}
                            className="w-full h-10 bg-foreground text-background rounded-lg font-medium"
                          >
                            Create Task
                          </motion.button>
                        </div>
                      )}
                      {step.visual === 'check' && (
                        <div className="space-y-3">
                          {[true, true, false].map((checked, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -20 }}
                              whileInView={{ opacity: 1, x: 0 }}
                              viewport={{ once: true }}
                              transition={{ delay: 0.3 + i * 0.2 }}
                              className="flex items-center gap-3"
                            >
                              <motion.div 
                                initial={{ scale: 0 }}
                                whileInView={{ scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.5 + i * 0.2, type: "spring" }}
                                className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                                  checked ? 'bg-foreground border-foreground' : 'border-muted-foreground/40'
                                }`}
                              >
                                {checked && <Check className="w-4 h-4 text-background" />}
                              </motion.div>
                              <div className={`h-3 rounded ${checked ? 'bg-muted w-3/4' : 'bg-foreground/20 w-full'}`} />
                            </motion.div>
                          ))}
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: '100%' }}
                            viewport={{ once: true }}
                            transition={{ delay: 1, duration: 0.5 }}
                            className="mt-4 flex items-center gap-2 text-sm text-foreground"
                          >
                            <Flame className="w-4 h-4" />
                            <span className="font-medium">5 day streak!</span>
                          </motion.div>
                        </div>
                      )}
                      {step.visual === 'chart' && (
                        <div className="space-y-4">
                          <div className="flex items-end gap-2 h-24">
                            {[40, 65, 85, 50, 90, 75, 60].map((h, i) => (
                              <motion.div 
                                key={i}
                                initial={{ height: 0 }}
                                whileInView={{ height: `${h}%` }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                                className="flex-1 bg-foreground rounded-t"
                              />
                            ))}
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => (
                              <span key={d}>{d}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute left-1/2 bottom-0 w-px h-8 bg-border -mb-8" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <motion.section 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="py-24 px-4 sm:px-6 lg:px-8 bg-foreground relative overflow-hidden"
      >
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-background rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-background rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/10 border border-background/20 mb-8"
          >
            <Zap className="w-4 h-4 text-background" />
            <span className="text-sm font-medium text-background/80">Start your productivity journey</span>
          </motion.div>

          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl sm:text-5xl font-bold text-background mb-4"
          >
            Ready to get focused?
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-background/70 mb-10"
          >
            Join thousands who've simplified their day.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Button 
                size="lg"
                onClick={() => navigate('/auth?mode=signup')}
                className="bg-background text-foreground hover:bg-background/90 px-10 py-7 text-lg group shadow-2xl"
              >
                Create Free Account
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight className="ml-2 w-5 h-5" />
                </motion.span>
              </Button>
            </motion.div>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="text-sm text-background/50 mt-6"
          >
            No credit card required • Free forever for personal use
          </motion.p>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 bg-foreground rounded-xl flex items-center justify-center">
                  <CheckSquare className="w-5 h-5 text-background" />
                </div>
                <span className="text-xl font-bold text-foreground">Monotask</span>
              </div>
              <p className="text-muted-foreground text-sm max-w-xs mb-4">
                A minimal productivity app designed to help you focus on what matters most.
              </p>
              <div className="flex items-center gap-3">
                <motion.a 
                  href="#" 
                  whileHover={{ scale: 1.1, y: -2 }}
                  className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors"
                >
                  <Twitter className="w-4 h-4" />
                </motion.a>
                <motion.a 
                  href="#" 
                  whileHover={{ scale: 1.1, y: -2 }}
                  className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors"
                >
                  <Github className="w-4 h-4" />
                </motion.a>
                <motion.a 
                  href="#" 
                  whileHover={{ scale: 1.1, y: -2 }}
                  className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                </motion.a>
              </div>
            </div>
            
            {/* Links */}
            <div>
              <h4 className="font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-2">
                <li>
                  <button 
                    onClick={() => navigate('/auth?mode=signup')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Get Started
                  </button>
                </li>
                <li>
                  <button 
                    onClick={scrollToFeatures}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Features
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate('/auth')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Login
                  </button>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Monotask. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground">
              Made with focus and simplicity in mind.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
