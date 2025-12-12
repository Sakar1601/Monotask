
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTasks, Task } from '@/hooks/useTasks';
import TagSelector from './TagSelector';
import TimeInput from './TimeInput';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  prefilledDate?: string;
}

const formatDateForInput = (dateString?: string) => {
  if (!dateString) return '';
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }
  
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, task, prefilledDate }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    due_time: '',
    priority: 'low' as 'low' | 'medium' | 'high',
    tag_id: '',
    repeat_type: 'none' as 'none' | 'daily' | 'weekly' | 'monthly',
    repeat_interval: 1,
  });

  const { createTask, updateTask, isCreating, isUpdating } = useTasks();

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        due_date: formatDateForInput(task.due_date),
        due_time: task.due_time || '',
        priority: task.priority,
        tag_id: task.tag_id || '',
        repeat_type: task.repeat_type || 'none',
        repeat_interval: task.repeat_interval || 1,
      });
    } else if (prefilledDate) {
      setFormData(prev => ({ 
        ...prev, 
        due_date: formatDateForInput(prefilledDate),
        title: '',
        description: '',
        due_time: '',
        priority: 'low',
        tag_id: '',
        repeat_type: 'none',
        repeat_interval: 1,
      }));
    } else {
      setFormData({
        title: '',
        description: '',
        due_date: '',
        due_time: '',
        priority: 'low',
        tag_id: '',
        repeat_type: 'none',
        repeat_interval: 1,
      });
    }
  }, [task, prefilledDate, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const taskData = {
      ...formData,
      tag_id: formData.tag_id || undefined,
      status: 'pending' as const,
    };

    if (task) {
      updateTask({ id: task.id, ...taskData });
    } else {
      createTask(taskData);
    }
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-black dark:text-white">
            {task ? 'Edit Task' : 'Create Task'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              placeholder="Task title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-black dark:text-white"
            />
          </div>
          
          <div>
            <Textarea
              placeholder="Description (optional)"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-black dark:text-white resize-none"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-black dark:text-white"
              />
            </div>
            <div>
              <TimeInput
                value={formData.due_time}
                onChange={(value) => setFormData(prev => ({ ...prev, due_time: value }))}
              />
            </div>
          </div>
          
          <div>
            <Select value={formData.priority} onValueChange={(value: 'low' | 'medium' | 'high') => setFormData(prev => ({ ...prev, priority: value }))}>
              <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-black dark:text-white">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2">
              Tag
            </label>
            <TagSelector
              value={formData.tag_id}
              onChange={(value) => setFormData(prev => ({ ...prev, tag_id: value }))}
            />
          </div>
          
          <div>
            <Select value={formData.repeat_type} onValueChange={(value: 'none' | 'daily' | 'weekly' | 'monthly') => setFormData(prev => ({ ...prev, repeat_type: value }))}>
              <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-black dark:text-white">
                <SelectValue placeholder="Repeat" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <SelectItem value="none">No repeat</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="border-gray-300 dark:border-gray-700 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isCreating || isUpdating}
              className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
            >
              {isCreating || isUpdating ? 'Saving...' : (task ? 'Update' : 'Create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TaskModal;
