
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, CheckCircle, XCircle, Clock, Edit, Trash2, Pause } from 'lucide-react';
import { useHabits } from '@/hooks/useHabits';
import HabitModal from '@/components/HabitModal';
import ConfirmDialog from '@/components/ConfirmDialog';

const HabitsView: React.FC = () => {
  const { habits, logs, logHabit, deleteHabit, isLogging, isDeleting } = useHabits();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; habitId?: string }>({ isOpen: false });

  const handleCreateHabit = () => {
    setSelectedHabit(null);
    setIsModalOpen(true);
  };

  const handleEditHabit = (habit) => {
    setSelectedHabit(habit);
    setIsModalOpen(true);
  };

  const handleDeleteHabit = (habitId: string) => {
    setDeleteConfirm({ isOpen: true, habitId });
  };

  const confirmDelete = () => {
    if (deleteConfirm.habitId) {
      deleteHabit(deleteConfirm.habitId);
    }
  };

  const handleLogHabit = (habitId: string, status: 'completed' | 'skipped' | 'failed') => {
    logHabit({ habitId, status });
  };

  const getTodayLog = (habitId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return logs.find(log => log.habit_id === habitId && log.date === today);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'skipped':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getFrequencyDisplay = (habit) => {
    if (habit.frequency === 'daily') return 'Daily';
    if (habit.frequency === 'weekly') {
      if (habit.frequency_days && habit.frequency_days.length > 0) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const days = habit.frequency_days.map(day => dayNames[day - 1]).join(', ');
        return `Weekly (${days})`;
      }
      return 'Weekly';
    }
    if (habit.frequency === 'monthly') return 'Monthly';
    return habit.frequency;
  };

  // Sort habits by preferred_time, then by created_at
  const sortedHabits = [...habits].sort((a, b) => {
    if (a.preferred_time && b.preferred_time) {
      return a.preferred_time.localeCompare(b.preferred_time);
    }
    if (a.preferred_time && !b.preferred_time) return -1;
    if (!a.preferred_time && b.preferred_time) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Habits</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track your daily habits and build consistency
          </p>
        </div>
        <Button 
          onClick={handleCreateHabit}
          className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Habit
        </Button>
      </div>

      {habits.length === 0 ? (
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-600 mb-4">
              <Clock className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No habits yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Create your first habit to start building consistency
              </p>
            </div>
            <Button 
              onClick={handleCreateHabit}
              className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create First Habit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedHabits.map((habit) => {
            const todayLog = getTodayLog(habit.id);
            
            return (
              <div key={habit.id} className="p-4 border rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium text-black dark:text-white truncate">
                        {habit.name}
                      </h3>
                      {habit.tags && (
                        <Badge 
                          className="text-xs flex-shrink-0"
                          style={{ 
                            backgroundColor: habit.tags.color,
                            color: '#ffffff'
                          }}
                        >
                          {habit.tags.name}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {habit.preferred_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {habit.preferred_time}
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {getFrequencyDisplay(habit)}
                      </Badge>
                      {todayLog && (
                        <Badge className={`text-xs ${getStatusColor(todayLog.status)}`}>
                          {todayLog.status}
                        </Badge>
                      )}
                    </div>

                    {habit.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                        {habit.description}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleLogHabit(habit.id, 'completed')}
                        disabled={isLogging || todayLog?.status === 'completed'}
                        className={`text-xs px-3 py-1 h-7 ${
                          todayLog?.status === 'completed'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900 hover:text-green-700 dark:hover:text-green-300'
                        }`}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Done
                      </Button>
                      
                      <Button
                        size="sm"
                        onClick={() => handleLogHabit(habit.id, 'skipped')}
                        disabled={isLogging || todayLog?.status === 'skipped'}
                        className={`text-xs px-3 py-1 h-7 ${
                          todayLog?.status === 'skipped'
                            ? 'bg-yellow-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 hover:text-yellow-700 dark:hover:text-yellow-300'
                        }`}
                      >
                        <Pause className="h-3 w-3 mr-1" />
                        Skip
                      </Button>
                      
                      <Button
                        size="sm"
                        onClick={() => handleLogHabit(habit.id, 'failed')}
                        disabled={isLogging || todayLog?.status === 'failed'}
                        className={`text-xs px-3 py-1 h-7 ${
                          todayLog?.status === 'failed'
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-700 dark:hover:text-red-300'
                        }`}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Miss
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleEditHabit(habit)}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      title="Edit habit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteHabit(habit.id)}
                      disabled={isDeleting}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Delete habit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <HabitModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedHabit(null);
        }}
        habit={selectedHabit}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false })}
        onConfirm={confirmDelete}
        title="Delete Habit"
        message="Are you sure you want to delete this habit? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
};

export default HabitsView;
