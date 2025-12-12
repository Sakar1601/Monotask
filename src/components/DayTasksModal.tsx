
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTasks, Task } from '@/hooks/useTasks';
import { useSettings } from '@/hooks/useSettings';
import { Edit, Trash2, Check, Plus } from 'lucide-react';
import TaskModal from './TaskModal';
import ConfirmDialog from './ConfirmDialog';

interface DayTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  tasks: Task[];
}

const DayTasksModal: React.FC<DayTasksModalProps> = ({ isOpen, onClose, date, tasks }) => {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; taskId?: string }>({ isOpen: false });
  const { updateTask, deleteTask, isUpdating, isDeleting } = useTasks();
  const { settings } = useSettings();

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    
    const [hours, minutes] = time.split(':');
    const hour24 = parseInt(hours, 10);
    
    if (settings.timeFormat === '12h') {
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 >= 12 ? 'PM' : 'AM';
      return `${hour12}:${minutes} ${ampm}`;
    }
    
    return `${hours}:${minutes}`;
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
    setIsTaskModalOpen(true);
  };

  const handleDeleteTask = (taskId: string) => {
    setDeleteConfirm({ isOpen: true, taskId });
  };

  const confirmDelete = () => {
    if (deleteConfirm.taskId) {
      deleteTask(deleteConfirm.taskId);
    }
  };

  const handleAddNewTask = () => {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };

  const completedTasks = tasks.filter(task => task.status === 'completed');
  const pendingTasks = tasks.filter(task => task.status === 'pending');

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center text-black dark:text-white">
              <span>Tasks for {formatDate(date)}</span>
              <Button
                onClick={handleAddNewTask}
                size="sm"
                className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Task
              </Button>
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Manage your tasks for this day
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Pending Tasks */}
            {pendingTasks.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Pending Tasks ({pendingTasks.length})
                </h3>
                <div className="space-y-2">
                  {pendingTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggleComplete={handleToggleComplete}
                      onEdit={handleEditTask}
                      onDelete={handleDeleteTask}
                      isUpdating={isUpdating}
                      isDeleting={isDeleting}
                      formatTime={formatTime}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Completed Tasks ({completedTasks.length})
                </h3>
                <div className="space-y-2">
                  {completedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggleComplete={handleToggleComplete}
                      onEdit={handleEditTask}
                      onDelete={handleDeleteTask}
                      isUpdating={isUpdating}
                      isDeleting={isDeleting}
                      formatTime={formatTime}
                    />
                  ))}
                </div>
              </div>
            )}

            {tasks.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No tasks for this day</p>
                <Button
                  onClick={handleAddNewTask}
                  variant="outline"
                  className="mt-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add First Task
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        task={editingTask}
        prefilledDate={!editingTask ? date : undefined}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false })}
        onConfirm={confirmDelete}
        title="Delete Task?"
        message="Are you sure you want to delete this task?"
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
};

interface TaskCardProps {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  isUpdating: boolean;
  isDeleting: boolean;
  formatTime: (time: string) => string;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
  isUpdating,
  isDeleting,
  formatTime
}) => {
  const isCompleted = task.status === 'completed';

  return (
    <div className={`p-4 border rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-gray-200 dark:border-gray-700 ${
      isCompleted ? 'opacity-75' : ''
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <button
            onClick={() => onToggleComplete(task)}
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
            <h4 className={`font-medium ${
              isCompleted 
                ? 'line-through text-gray-500 dark:text-gray-400' 
                : 'text-black dark:text-white'
            }`}>
              {task.title}
            </h4>
            {task.description && (
              <p className={`text-sm mt-1 ${
                isCompleted 
                  ? 'text-gray-400 dark:text-gray-500' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {task.description}
              </p>
            )}
            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
              {task.due_time && (
                <span>{formatTime(task.due_time)}</span>
              )}
              <span className={`px-2 py-1 rounded ${
                task.priority === 'high' ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-black' :
                task.priority === 'medium' ? 'bg-gray-600 dark:bg-gray-400 text-white dark:text-black' : 
                'bg-gray-300 dark:bg-gray-600 text-black dark:text-white'
              }`}>
                {task.priority}
              </span>
              {task.tags && (
                <span 
                  className="px-2 py-1 rounded text-white dark:text-black font-medium"
                  style={{ backgroundColor: task.tags.color }}
                >
                  {task.tags.name}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          <button
            onClick={() => onEdit(task)}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Edit task"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
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

export default DayTasksModal;
