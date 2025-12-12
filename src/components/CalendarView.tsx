
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import TaskModal from './TaskModal';
import DayTasksModal from './DayTasksModal';

const CalendarView: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'agenda'>('month');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isDayTasksModalOpen, setIsDayTasksModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [prefilledDate, setPrefilledDate] = useState<string>('');
  
  const { tasks, isLoading } = useTasks();

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const formatDateForComparison = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getTasksForDate = (dateString: string) => {
    return tasks.filter(task => task.due_date === dateString);
  };

  const handleDayClick = (day: number) => {
    const clickedDate = formatDateForComparison(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dayTasks = getTasksForDate(clickedDate);
    
    if (dayTasks.length > 0) {
      setSelectedDate(clickedDate);
      setIsDayTasksModalOpen(true);
    } else {
      setPrefilledDate(clickedDate);
      setIsTaskModalOpen(true);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const today = new Date();

  const renderWeekView = () => {
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(weekStart);
      currentDay.setDate(weekStart.getDate() + i);
      
      const dateString = formatDateForComparison(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate());
      const dayTasks = getTasksForDate(dateString);
      
      const isToday = today.getDate() === currentDay.getDate() && 
                     today.getMonth() === currentDay.getMonth() && 
                     today.getFullYear() === currentDay.getFullYear();
      
      days.push(
        <div 
          key={i} 
          className="border-r last:border-r-0 border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer min-h-[400px]"
          onClick={() => handleDayClick(currentDay.getDate())}
        >
          <div className="text-center mb-3">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {dayNames[i]}
            </div>
            <div className={`text-lg font-semibold ${isToday ? 'text-white bg-black dark:bg-white dark:text-black rounded-full w-8 h-8 flex items-center justify-center mx-auto' : 'text-black dark:text-white'}`}>
              {currentDay.getDate()}
            </div>
          </div>
          <div className="space-y-2">
            {dayTasks.map((task) => (
              <div 
                key={task.id}
                className={`text-xs p-2 rounded ${
                  task.status === 'completed' 
                    ? 'bg-gray-200 dark:bg-gray-700 line-through text-gray-600 dark:text-gray-400' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}
                title={task.title}
              >
                <div className="font-medium truncate">{task.title}</div>
                {task.due_time && (
                  <div className="text-gray-500 dark:text-gray-400 mt-1">{task.due_time}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    return days;
  };

  const renderMonthView = () => {
    const days = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-32 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"></div>);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = today.getDate() === day && 
                     today.getMonth() === currentDate.getMonth() && 
                     today.getFullYear() === currentDate.getFullYear();
      
      const dateString = formatDateForComparison(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayTasks = getTasksForDate(dateString);
      
      days.push(
        <div 
          key={day} 
          className="h-32 border border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer group transition-colors"
          onClick={() => handleDayClick(day)}
        >
          <div className="flex justify-between items-start mb-1">
            <div className={`text-sm font-medium ${isToday ? 'text-white bg-black dark:bg-white dark:text-black rounded-full w-6 h-6 flex items-center justify-center' : 'text-black dark:text-white'}`}>
              {day}
            </div>
            {dayTasks.length === 0 && (
              <Plus className="w-4 h-4 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
          <div className="space-y-1 overflow-hidden">
            {dayTasks.slice(0, 3).map((task) => (
              <div 
                key={task.id} 
                className={`text-xs p-1 rounded truncate ${
                  task.status === 'completed' 
                    ? 'bg-gray-200 dark:bg-gray-700 line-through text-gray-600 dark:text-gray-400' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}
                title={task.title}
              >
                {task.title}
              </div>
            ))}
            {dayTasks.length > 3 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                +{dayTasks.length - 3} more
              </div>
            )}
          </div>
        </div>
      );
    }
    
    return days;
  };

  const renderAgendaView = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcomingTasks = tasks
      .filter(task => {
        if (!task.due_date) return false;
        const taskDate = new Date(task.due_date + 'T00:00:00');
        return taskDate >= today;
      })
      .sort((a, b) => {
        const dateA = new Date(a.due_date! + 'T00:00:00');
        const dateB = new Date(b.due_date! + 'T00:00:00');
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 10);

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-black dark:text-white mb-4">Upcoming Tasks</h3>
        {upcomingTasks.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No upcoming tasks</p>
        ) : (
          <div className="space-y-4">
            {upcomingTasks.map((task) => (
              <div key={task.id} className="flex items-center space-x-4 p-3 border-l-4 border-black dark:border-white bg-gray-50 dark:bg-gray-700 transition-colors">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString() : 'No date'}
                </div>
                <div className="flex-1">
                  <div className={`font-medium text-black dark:text-white ${task.status === 'completed' ? 'line-through' : ''}`}>
                    {task.title}
                  </div>
                  {task.due_time && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">{task.due_time}</div>
                  )}
                </div>
                {task.tags && (
                  <div 
                    className="px-2 py-1 rounded text-xs text-white"
                    style={{ backgroundColor: task.tags.color }}
                  >
                    {task.tags.name}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-gray-600">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-black dark:text-white">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-black dark:text-white" />
            </button>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-black dark:text-white" />
            </button>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {(['month', 'week', 'agenda'] as const).map((viewType) => (
            <button
              key={viewType}
              onClick={() => setView(viewType)}
              className={`px-3 py-1 text-sm rounded-md capitalize transition-colors ${
                view === viewType
                  ? 'bg-black dark:bg-white text-white dark:text-black'
                  : 'border border-gray-300 dark:border-gray-600 text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {viewType}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-900">
            {dayNames.map((dayName) => (
              <div key={dayName} className="p-4 text-center text-sm font-medium text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 last:border-r-0">
                {dayName}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7">
            {renderMonthView()}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7">
            {renderWeekView()}
          </div>
        </div>
      )}

      {view === 'agenda' && renderAgendaView()}

      <TaskModal 
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setPrefilledDate('');
        }}
        prefilledDate={prefilledDate}
      />

      <DayTasksModal
        isOpen={isDayTasksModalOpen}
        onClose={() => {
          setIsDayTasksModalOpen(false);
          setSelectedDate('');
        }}
        date={selectedDate}
        tasks={getTasksForDate(selectedDate)}
      />
    </div>
  );
};

export default CalendarView;
