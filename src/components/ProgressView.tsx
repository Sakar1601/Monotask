
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useHabits } from '@/hooks/useHabits';

const ProgressView: React.FC = () => {
  const { user } = useAuth();
  const { tasks } = useTasks();
  const { habits } = useHabits();

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
      
      tasksByTag?.forEach((task: any) => {
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
    const taskDate = new Date(task.due_date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return taskDate >= weekAgo;
  }).length;

  const totalThisWeek = tasks.filter(task => {
    if (!task.due_date) return false;
    const taskDate = new Date(task.due_date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return taskDate >= weekAgo;
  }).length;

  const completedLast30Days = tasks.filter(task => {
    if (task.status !== 'completed' || !task.due_date) return false;
    const taskDate = new Date(task.due_date);
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

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `monotask-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    // For now, create a simple text-based PDF export
    const summaryText = `
MONOTASK SUMMARY REPORT
Generated: ${new Date().toLocaleDateString()}

METRICS:
- Tasks Completed This Week: ${completedThisWeek}/${totalThisWeek}
- Average Daily Tasks: ${averageDaily}
- Total Active Habits: ${habits.filter(h => h.is_active).length}

COMPLETED TASKS:
${tasks.filter(t => t.status === 'completed').slice(0, 20).map(task => 
  `- ${task.title} (${task.due_date || 'No date'}) [${task.tags?.name || 'No tag'}]`
).join('\n')}
    `;

    const blob = new Blob([summaryText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `monotask-summary-${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const kpis = [
    { 
      label: 'Tasks Completed This Week', 
      value: `${completedThisWeek}/${totalThisWeek}`, 
      percentage: totalThisWeek > 0 ? Math.round((completedThisWeek / totalThisWeek) * 100) : 0
    },
    { label: 'Active Habits', value: `${habits.filter(h => h.is_active).length}`, percentage: null },
    { label: 'Average Daily Tasks', value: averageDaily, percentage: null },
    { label: 'Total Tasks', value: `${tasks.length}`, percentage: null },
  ];

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-black dark:text-white">Progress & Analytics</h2>
          <p className="text-gray-600 dark:text-gray-400">Track your productivity insights</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={handleExportPDF}
            variant="outline"
            className="border-gray-300 dark:border-gray-700 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button 
            onClick={handleExportCSV}
            variant="outline"
            className="border-gray-300 dark:border-gray-700 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-colors">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{kpi.label}</p>
            <p className="text-2xl font-bold text-black dark:text-white">{kpi.value}</p>
            {kpi.percentage !== null && (
              <div className="mt-3">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-black dark:bg-white h-2 rounded-full transition-all" 
                    style={{ width: `${kpi.percentage}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Progress */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-colors">
          <h3 className="text-lg font-semibold text-black dark:text-white mb-4">Weekly Task Completion</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor' }} />
              <Bar dataKey="completed" fill="currentColor" className="fill-black dark:fill-white" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-colors">
          <h3 className="text-lg font-semibold text-black dark:text-white mb-4">Tasks by Category</h3>
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
          <div className="mt-4 space-y-2">
            {categoryData.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2" 
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{item.name}</span>
                </div>
                <span className="text-sm font-medium text-black dark:text-white">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Heatmap */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-colors">
        <h3 className="text-lg font-semibold text-black dark:text-white mb-4">Activity Heatmap</h3>
        <div className="grid grid-cols-7 gap-1">
          {heatmapData.map((day, i) => {
            const intensity = Math.min(day.count / 5, 1); // Normalize to 0-1 scale
            const opacity = Math.max(0.1, intensity);
            
            return (
              <div
                key={i}
                className="w-4 h-4 rounded-sm bg-gray-200 dark:bg-gray-700 transition-colors"
                style={{
                  backgroundColor: intensity > 0 ? (
                    document.documentElement.classList.contains('dark') ? 
                    `rgba(255, 255, 255, ${opacity})` : 
                    `rgba(0, 0, 0, ${opacity})`
                  ) : undefined
                }}
                title={`${day.date}: ${day.count} activities`}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600 dark:text-gray-400">
          <span>Less</span>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded-sm"></div>
            <div className="w-3 h-3 bg-gray-400 dark:bg-gray-500 rounded-sm"></div>
            <div className="w-3 h-3 bg-gray-600 dark:bg-gray-300 rounded-sm"></div>
            <div className="w-3 h-3 bg-black dark:bg-white rounded-sm"></div>
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
};

export default ProgressView;
