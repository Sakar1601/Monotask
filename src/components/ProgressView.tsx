
import { parseDateOnly } from '@/utils/dateOnly';
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Sparkles } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useHabits } from '@/hooks/useHabits';
import { useWeeklySummary } from '@/hooks/useWeeklySummary';
import { exportToPDF } from '@/utils/pdfExport';
import { toCsvRow } from '@/utils/csv';

// Custom animated fill replacing the static Radix Progress indicator here -
// springs from 0 to value on mount and eases to any later value change,
// instead of snapping.
const AnimatedProgressBar: React.FC<{ value: number; reduceMotion: boolean | null }> = ({ value, reduceMotion }) => (
  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
    <motion.div
      className="h-full w-full origin-left rounded-full bg-primary"
      initial={reduceMotion ? { scaleX: value / 100 } : { scaleX: 0 }}
      animate={{ scaleX: value / 100 }}
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 100, damping: 20 }}
    />
  </div>
);

const ProgressView: React.FC = () => {
  const { user } = useAuth();
  const { tasks } = useTasks();
  const { habits, logs } = useHabits();
  const [summaryRequested, setSummaryRequested] = useState(false);
  const { data: weeklySummary, isLoading: isSummaryLoading, error: summaryError } = useWeeklySummary(summaryRequested);
  const reduceMotion = useReducedMotion();

  // Weekly task completion data
  const { data: weeklyData = [] } = useQuery({
    queryKey: ['weekly-progress', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

      const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const data = [];

      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(startOfWeek);
        currentDay.setDate(startOfWeek.getDate() + i);
        const dateStr = currentDay.toISOString().split('T')[0];

        const { data: completedTasks } = await supabase
          .from('tasks')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .eq('due_date', dateStr);

        const { data: totalTasks } = await supabase
          .from('tasks')
          .select('id')
          .eq('user_id', user.id)
          .eq('due_date', dateStr);

        data.push({
          day: weekDays[i],
          completed: completedTasks?.length || 0,
          total: totalTasks?.length || 0,
        });
      }

      return data;
    },
    enabled: !!user,
  });

  // Category/Tag distribution
  const { data: categoryData = [] } = useQuery({
    queryKey: ['category-distribution', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: tasksByTag } = await supabase
        .from('tasks')
        .select(`
          tag_id,
          tags:tag_id (name, color)
        `)
        .eq('user_id', user.id)
        .eq('status', 'completed');

      const tagCounts: Record<string, { name: string; color: string; count: number }> = {};

      tasksByTag?.forEach((task: { tags: { name: string; color: string } | null }) => {
        const tagName = task.tags?.name || 'No Tag';
        const tagColor = task.tags?.color || '#9ca3af';

        if (!tagCounts[tagName]) {
          tagCounts[tagName] = { name: tagName, color: tagColor, count: 0 };
        }
        tagCounts[tagName].count++;
      });

      const total = Object.values(tagCounts).reduce((sum, tag) => sum + tag.count, 0);

      return Object.values(tagCounts).map(tag => ({
        name: tag.name,
        value: total > 0 ? Math.round((tag.count / total) * 100) : 0,
        color: tag.color,
      }));
    },
    enabled: !!user,
  });

  // Activity heatmap data
  const { data: heatmapData = [] } = useQuery({
    queryKey: ['activity-heatmap', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 84); // 12 weeks

      const { data: logs } = await supabase
        .from('logs')
        .select('date')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      const logCounts: Record<string, number> = {};
      logs?.forEach(log => {
        logCounts[log.date] = (logCounts[log.date] || 0) + 1;
      });

      const data = [];
      for (let i = 0; i < 84; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];
        data.push({
          date: dateStr,
          count: logCounts[dateStr] || 0,
        });
      }

      return data;
    },
    enabled: !!user,
  });

  // KPI calculations
  const completedThisWeek = tasks.filter(task => {
    if (task.status !== 'completed' || !task.due_date) return false;
    const taskDate = parseDateOnly(task.due_date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return taskDate >= weekAgo;
  }).length;

  const totalThisWeek = tasks.filter(task => {
    if (!task.due_date) return false;
    const taskDate = parseDateOnly(task.due_date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return taskDate >= weekAgo;
  }).length;

  const completedLast30Days = tasks.filter(task => {
    if (task.status !== 'completed' || !task.due_date) return false;
    const taskDate = parseDateOnly(task.due_date);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return taskDate >= thirtyDaysAgo;
  }).length;

  const averageDaily = (completedLast30Days / 30).toFixed(1);

  const handleExportCSV = () => {
    const csvData = [
      ['Type', 'Title', 'Status', 'Date', 'Tag'],
      ...tasks.map(task => [
        'Task',
        task.title,
        task.status,
        task.due_date || '',
        task.tags?.name || 'No Tag'
      ]),
      ...habits.map(habit => [
        'Habit',
        habit.name,
        habit.is_active ? 'Active' : 'Inactive',
        habit.created_at.split('T')[0],
        'Habit'
      ])
    ];

    const csvContent = csvData.map(row => toCsvRow(row)).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `monotask-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    try {
      await exportToPDF(tasks, habits, logs);
    } catch (error) {
      console.error('Error exporting PDF:', error);
    }
  };

  const kpis = [
    {
      label: 'Tasks completed this week',
      value: `${completedThisWeek}/${totalThisWeek}`,
      percentage: totalThisWeek > 0 ? Math.round((completedThisWeek / totalThisWeek) * 100) : 0
    },
    { label: 'Active habits', value: `${habits.filter(h => h.is_active).length}`, percentage: null },
    { label: 'Average daily tasks', value: averageDaily, percentage: null },
    { label: 'Total tasks', value: `${tasks.length}`, percentage: null },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          {/* TopBar already renders "Progress & Analytics" as the page h1. */}
          <p className="text-[15px] text-muted-foreground">Track your productivity insights</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportPDF} variant="outline">
            <Download className="mr-2 h-4 w-4" strokeWidth={2} />
            Export PDF
          </Button>
          <Button onClick={handleExportCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" strokeWidth={2} />
            Export CSV
          </Button>
        </div>
      </div>

      {/* AI Weekly Summary */}
      <Card>
        <CardContent className="flex items-start justify-between gap-4 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
            <div>
              <h3 className="font-medium text-foreground">AI weekly summary</h3>
              {!summaryRequested && (
                <p className="text-sm text-muted-foreground">Get a short AI-generated recap of your last 7 days.</p>
              )}
              {summaryRequested && isSummaryLoading && (
                <p className="text-sm text-muted-foreground">Generating summary...</p>
              )}
              {summaryRequested && summaryError && (
                <p className="text-sm text-destructive">{(summaryError as Error).message}</p>
              )}
              {summaryRequested && weeklySummary && (
                <p className="mt-1 text-sm text-foreground/80">{weeklySummary.summary}</p>
              )}
            </div>
          </div>
          {!summaryRequested && (
            <Button onClick={() => setSummaryRequested(true)} variant="outline" className="shrink-0">
              Generate
            </Button>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, index) => (
          <motion.div
            key={index}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={reduceMotion ? undefined : { y: -2 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: reduceMotion ? 0 : index * 0.07 }}
          >
            <Card className="h-full transition-colors">
              <CardContent className="p-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{kpi.label}</p>
                <p className="mt-2 font-grotesk text-4xl font-semibold tracking-[-0.03em] tabular-nums text-foreground">{kpi.value}</p>
                {kpi.percentage !== null && (
                  <div className="mt-3">
                    <AnimatedProgressBar value={kpi.percentage} reduceMotion={reduceMotion} />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Weekly Progress */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
        <Card className="transition-colors">
          <CardContent className="p-6">
            <h3 className="mb-4 font-grotesk text-lg font-semibold text-foreground">Weekly task completion</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor' }} className="text-muted-foreground" />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor' }} className="text-muted-foreground" />
                <Bar dataKey="completed" className="fill-primary" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        </motion.div>

        {/* Category Distribution */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: reduceMotion ? 0 : 0.08 }}
        >
        <Card className="transition-colors">
          <CardContent className="p-6">
            <h3 className="mb-4 font-grotesk text-lg font-semibold text-foreground">Tasks by category</h3>
            {categoryData.length === 0 ? (
              <div className="flex h-[200px] flex-col items-center justify-center gap-1 text-center">
                <p className="text-sm font-medium text-foreground">Nothing to split yet</p>
                <p className="max-w-[16rem] text-sm text-muted-foreground">
                  Complete tagged tasks and your split by category shows up here.
                </p>
              </div>
            ) : (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            )}
            <div className="mt-4 space-y-2">
              {categoryData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className="mr-2 h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-foreground">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        </motion.div>
      </div>

      {/* Activity Heatmap */}
      <Card className="transition-colors">
        <CardContent className="p-6">
          <h3 className="mb-4 font-grotesk text-lg font-semibold text-foreground">Activity heatmap</h3>
          <div className="overflow-x-auto pb-1">
          <div className="grid w-max grid-flow-col grid-rows-7 gap-1">
            {heatmapData.map((day, i) => {
              const intensity = Math.min(day.count / 5, 1); // Normalize to 0-1 scale
              const opacity = Math.max(0.12, intensity);

              return (
                <motion.div
                  key={i}
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.15, delay: reduceMotion ? 0 : Math.min(i, 40) * 0.004 }}
                  className="h-4 w-4 rounded-[3px] bg-muted transition-colors"
                  style={{
                    backgroundColor: intensity > 0 ? `hsl(var(--primary) / ${opacity})` : undefined,
                  }}
                  title={`${day.date}: ${day.count} activities`}
                />
              );
            })}
          </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>Less</span>
            <div className="flex items-center space-x-1">
              <div className="h-3 w-3 rounded-sm bg-muted"></div>
              <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--primary) / 0.35)' }}></div>
              <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--primary) / 0.7)' }}></div>
              <div className="h-3 w-3 rounded-sm bg-primary"></div>
            </div>
            <span>More</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProgressView;
