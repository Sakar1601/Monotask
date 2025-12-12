
import React from 'react';
import { Calendar, CheckCircle, Target, TrendingUp } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useHabits } from '@/hooks/useHabits';

const Dashboard: React.FC = () => {
  const { tasks, isLoading: tasksLoading } = useTasks();
  const { habits, isLoading: habitsLoading } = useHabits();

  const isLoading = tasksLoading || habitsLoading;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  // Calculate statistics from real data
  const completedTasksToday = tasks.filter(task => {
    if (task.status !== 'completed' || !task.completed_at) return false;
    const today = new Date().toDateString();
    const completedDate = new Date(task.completed_at).toDateString();
    return today === completedDate;
  }).length;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const pendingTasks = tasks.filter(task => task.status === 'pending').length;
  const overdueTasks = tasks.filter(task => {
    if (task.status === 'completed' || !task.due_date) return false;
    return new Date(task.due_date) < new Date();
  }).length;

  const upcomingTasks = tasks
    .filter(task => task.status === 'pending' && task.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
    .slice(0, 5);

  const recentlyCompleted = tasks
    .filter(task => task.status === 'completed' && task.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
    .slice(0, 3);

  const activeHabits = habits.filter(habit => habit.is_active).length;

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-950 min-h-screen transition-colors">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Good morning!</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Here's what's happening with your tasks today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-800 rounded-lg transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Tasks Today</p>
              <p className="text-2xl font-bold text-black dark:text-white">{completedTasksToday}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-800 rounded-lg transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Tasks</p>
              <p className="text-2xl font-bold text-black dark:text-white">{totalTasks}</p>
            </div>
            <Target className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-800 rounded-lg transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
              <p className="text-2xl font-bold text-black dark:text-white">{pendingTasks}</p>
            </div>
            <Calendar className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-800 rounded-lg transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Habits</p>
              <p className="text-2xl font-bold text-black dark:text-white">{activeHabits}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
        </div>
      </div>

      {/* Overdue Tasks Alert */}
      {overdueTasks > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 transition-colors">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar className="h-5 w-5 text-red-400 dark:text-red-500" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                {overdueTasks} overdue task{overdueTasks !== 1 ? 's' : ''}
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                You have tasks that are past their due date.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Tasks */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-black mb-4">Upcoming Tasks</h2>
          {upcomingTasks.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No upcoming tasks</p>
          ) : (
            <div className="space-y-3">
              {upcomingTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div className="flex-1">
                    <h3 className="font-medium text-black">{task.title}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-sm text-gray-600">
                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                      </span>
                      {task.due_time && (
                        <span className="text-sm text-gray-600">at {task.due_time}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      task.priority === 'high' ? 'bg-gray-200' :
                      task.priority === 'medium' ? 'bg-gray-100' : 'bg-gray-50'
                    }`}>
                      {task.priority}
                    </span>
                    {task.tags && (
                      <span 
                        className="px-2 py-1 text-xs rounded text-white"
                        style={{ backgroundColor: task.tags.color }}
                      >
                        {task.tags.name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Completed */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-black mb-4">Recently Completed</h2>
          {recentlyCompleted.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No completed tasks yet</p>
          ) : (
            <div className="space-y-3">
              {recentlyCompleted.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div className="flex-1">
                    <h3 className="font-medium text-black line-through">{task.title}</h3>
                    <span className="text-sm text-gray-600">
                      Completed {task.completed_at ? new Date(task.completed_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 transition-colors">
        <h2 className="text-lg font-semibold text-black dark:text-white mb-4">Quick Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-black dark:text-white">{completedTasks}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-black dark:text-white">{pendingTasks}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-black dark:text-white">
              {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Completion Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
