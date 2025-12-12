
import React, { useState } from 'react';
import { Plus, Filter, Search, Check, Edit, Trash2, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useTasks, Task } from '@/hooks/useTasks';
import { useTags } from '@/hooks/useTags';
import TaskModal from './TaskModal';
import ConfirmDialog from './ConfirmDialog';

const TaskManager: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; taskId?: string }>({ isOpen: false });
  
  const { 
    tasks, 
    updateTask, 
    deleteTask, 
    isLoading, 
    isUpdating, 
    isDeleting,
    getTodayTasks,
    getUpcomingTasks,
    getOverdueTasks
  } = useTasks();
  const { tags } = useTags();

  const formatLocalDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString();
  };

  const filterTasks = (taskList: Task[]) => {
    return taskList.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesTag = tagFilter === 'all' || task.tag_id === tagFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      
      return matchesSearch && matchesStatus && matchesTag && matchesPriority;
    });
  };

  const handleToggleComplete = (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateTask({
      id: task.id,
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null
    });
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleDeleteTask = (taskId: string) => {
    setDeleteConfirm({ isOpen: true, taskId });
  };

  const confirmDelete = () => {
    if (deleteConfirm.taskId) {
      deleteTask(deleteConfirm.taskId);
    }
  };

  const handleAddNew = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const TaskCard: React.FC<{ task: Task; showDate?: boolean }> = ({ task, showDate = false }) => {
    const isCompleted = task.status === 'completed';
    const isOverdue = task.due_date && new Date(task.due_date + 'T00:00:00') < new Date() && !isCompleted;

    return (
      <div className={`p-4 border rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
        isOverdue ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <button
              onClick={() => handleToggleComplete(task)}
              disabled={isUpdating}
              className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                isCompleted
                  ? 'bg-black dark:bg-white border-black dark:border-white text-white dark:text-black'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              {isCompleted && <Check className="w-3 h-3" />}
            </button>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className={`font-medium ${isCompleted ? 'line-through text-gray-500 dark:text-gray-400' : 'text-black dark:text-white'}`}>
                  {task.title}
                </h3>
                {task.repeat_type && task.repeat_type !== 'none' && (
                  <Badge variant="secondary" className="text-xs">
                    {task.repeat_type}
                  </Badge>
                )}
              </div>
              
              {task.description && (
                <p className={`text-sm mt-1 ${isCompleted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'}`}>
                  {task.description}
                </p>
              )}
              
              <div className="flex items-center gap-3 mt-2 text-xs">
                {(showDate && task.due_date) && (
                  <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    <Calendar className="w-3 h-3" />
                    {formatLocalDate(task.due_date)}
                  </span>
                )}
                {task.due_time && (
                  <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                    <Clock className="w-3 h-3" />
                    {task.due_time}
                  </span>
                )}
                <Badge variant="outline" className={`text-xs ${
                  task.priority === 'high' ? 'border-red-200 text-red-700 dark:border-red-800 dark:text-red-300' :
                  task.priority === 'medium' ? 'border-yellow-200 text-yellow-700 dark:border-yellow-800 dark:text-yellow-300' :
                  'border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300'
                }`}>
                  {task.priority}
                </Badge>
                {task.tags && (
                  <Badge 
                    className="text-xs text-white"
                    style={{ backgroundColor: task.tags.color }}
                  >
                    {task.tags.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={() => handleEditTask(task)}
              className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Edit task"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeleteTask(task.id)}
              disabled={isDeleting}
              className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Delete task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading tasks...</div>
      </div>
    );
  }

  const todayTasks = filterTasks(getTodayTasks());
  const upcomingTasks = filterTasks(getUpcomingTasks());
  const overdueTasks = filterTasks(getOverdueTasks());
  const allTasks = filterTasks(tasks);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Task Manager</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {tasks.length} total tasks, {tasks.filter(t => t.status === 'completed').length} completed
          </p>
        </div>
        <Button 
          onClick={handleAddNew}
          className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-black dark:text-white"
            />
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-black dark:text-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-32 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-black dark:text-white">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-32 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-black dark:text-white">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <SelectItem value="all">All Tags</SelectItem>
              {tags.map(tag => (
                <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Task Tabs */}
      <Tabs defaultValue="today" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="today">Today ({todayTasks.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({upcomingTasks.length})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({overdueTasks.length})</TabsTrigger>
          <TabsTrigger value="all">All ({allTasks.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="today" className="space-y-3 mt-6">
          {todayTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-4">No tasks for today</p>
              <Button onClick={handleAddNew} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Task
              </Button>
            </div>
          ) : (
            todayTasks.map(task => <TaskCard key={task.id} task={task} />)
          )}
        </TabsContent>
        
        <TabsContent value="upcoming" className="space-y-3 mt-6">
          {upcomingTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No upcoming tasks</p>
            </div>
          ) : (
            upcomingTasks.map(task => <TaskCard key={task.id} task={task} showDate />)
          )}
        </TabsContent>
        
        <TabsContent value="overdue" className="space-y-3 mt-6">
          {overdueTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No overdue tasks</p>
            </div>
          ) : (
            overdueTasks.map(task => <TaskCard key={task.id} task={task} showDate />)
          )}
        </TabsContent>
        
        <TabsContent value="all" className="space-y-3 mt-6">
          {allTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-4">No tasks found</p>
              <Button onClick={handleAddNew} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Task
              </Button>
            </div>
          ) : (
            allTasks.map(task => <TaskCard key={task.id} task={task} showDate />)
          )}
        </TabsContent>
      </Tabs>

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        task={editingTask}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false })}
        onConfirm={confirmDelete}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
};

export default TaskManager;
