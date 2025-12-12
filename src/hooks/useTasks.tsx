
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed' | 'cancelled';
  tag_id?: string;
  repeat_type?: 'none' | 'daily' | 'weekly' | 'monthly';
  repeat_interval?: number;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  tags?: { name: string; color: string };
}

// Helper function to format date for local timezone
const formatDateLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const useTasks = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      console.log('Fetching tasks for user:', user.id);
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          tags:tag_id (name, color)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tasks:', error);
        throw error;
      }
      
      console.log('Fetched tasks:', data);
      return data as Task[];
    },
    enabled: !!user,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'tags' | 'user_id'>) => {
      if (!user) throw new Error('User not authenticated');
      
      console.log('Creating task with data:', taskData);
      
      const processedTaskData = {
        ...taskData,
        due_date: taskData.due_date ? taskData.due_date : null,
        due_time: taskData.due_time || null,
        tag_id: taskData.tag_id || null,
        user_id: user.id
      };
      
      const { data, error } = await supabase
        .from('tasks')
        .insert([processedTaskData])
        .select(`
          *,
          tags:tag_id (name, color)
        `)
        .single();

      if (error) {
        console.error('Error creating task:', error);
        throw error;
      }
      
      console.log('Created task:', data);
      return data;
    },
    onSuccess: (newTask) => {
      console.log('Task created successfully, updating cache');
      
      // Immediately update the cache with the new task
      queryClient.setQueryData(['tasks', user?.id], (oldTasks: Task[] = []) => {
        return [newTask, ...oldTasks];
      });
      
      // Also invalidate to ensure fresh data from server
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
      toast.success('Task created successfully');
    },
    onError: (error) => {
      console.error('Task creation failed:', error);
      toast.error('Failed to create task');
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      const updateData = { 
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      if (updates.status === 'completed' && !updates.completed_at) {
        updateData.completed_at = new Date().toISOString();
      } else if (updates.status === 'pending') {
        updateData.completed_at = null;
      }
      
      const { data, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user?.id)
        .select(`
          *,
          tags:tag_id (name, color)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updatedTask) => {
      queryClient.setQueryData(['tasks', user?.id], (oldTasks: Task[] = []) => {
        return oldTasks.map(task => 
          task.id === updatedTask.id ? updatedTask : task
        );
      });
      
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
      toast.success('Task updated successfully');
    },
    onError: (error) => {
      console.error('Task update failed:', error);
      toast.error('Failed to update task');
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData(['tasks', user?.id], (oldTasks: Task[] = []) => {
        return oldTasks.filter(task => task.id !== deletedId);
      });
      
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
      toast.success('Task deleted successfully');
    },
    onError: (error) => {
      console.error('Task deletion failed:', error);
      toast.error('Failed to delete task');
    },
  });

  // Get tasks for today (local timezone)
  const getTodayTasks = () => {
    const today = formatDateLocal(new Date());
    return tasks.filter(task => task.due_date === today);
  };

  // Get upcoming tasks (includes uncompleted today tasks + tomorrow tasks + next 7 days)
  const getUpcomingTasks = () => {
    const today = new Date();
    const todayStr = formatDateLocal(today);
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = formatDateLocal(tomorrow);
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    const nextWeekStr = formatDateLocal(nextWeek);
    
    return tasks.filter(task => {
      if (!task.due_date) return false;
      
      // Include uncompleted tasks from today
      if (task.due_date === todayStr && task.status !== 'completed') {
        return true;
      }
      
      // Include all tasks from tomorrow
      if (task.due_date === tomorrowStr) {
        return true;
      }
      
      // Include other upcoming tasks (but not completed ones)
      if (task.due_date > tomorrowStr && task.due_date <= nextWeekStr && task.status !== 'completed') {
        return true;
      }
      
      return false;
    });
  };

  // Get overdue tasks
  const getOverdueTasks = () => {
    const today = formatDateLocal(new Date());
    return tasks.filter(task => {
      return task.due_date && task.due_date < today && task.status !== 'completed';
    });
  };

  return {
    tasks,
    isLoading,
    error,
    createTask: createTaskMutation.mutate,
    updateTask: updateTaskMutation.mutate,
    deleteTask: deleteTaskMutation.mutate,
    isCreating: createTaskMutation.isPending,
    isUpdating: updateTaskMutation.isPending,
    isDeleting: deleteTaskMutation.isPending,
    getTodayTasks,
    getUpcomingTasks,
    getOverdueTasks,
  };
};
