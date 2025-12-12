
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Habit {
  id: string;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  frequency_days?: number[];
  preferred_time?: string;
  tag_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
  tags?: { name: string; color: string };
}

export interface HabitLog {
  id: string;
  habit_id: string;
  date: string;
  status: 'completed' | 'skipped' | 'failed';
  notes?: string;
  created_at: string;
  user_id: string;
}

export const useHabits = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: habits = [], isLoading } = useQuery({
    queryKey: ['habits', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('habits')
        .select(`
          *,
          tags:tag_id (name, color)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('preferred_time', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Habit[];
    },
    enabled: !!user,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['habit-logs', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .eq('user_id', user.id)
        .not('habit_id', 'is', null)
        .order('date', { ascending: false });

      if (error) throw error;
      return data as HabitLog[];
    },
    enabled: !!user,
  });

  const createHabitMutation = useMutation({
    mutationFn: async (habitData: Omit<Habit, 'id' | 'created_at' | 'updated_at' | 'tags' | 'user_id'>) => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('habits')
        .insert([{ 
          ...habitData, 
          user_id: user.id,
          tag_id: habitData.tag_id || null,
          preferred_time: habitData.preferred_time || null
        }])
        .select(`
          *,
          tags:tag_id (name, color)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newHabit) => {
      queryClient.setQueryData(['habits', user?.id], (oldHabits: Habit[] = []) => {
        return [newHabit, ...oldHabits];
      });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      toast.success('Habit created successfully');
    },
    onError: (error) => {
      console.error('Habit creation failed:', error);
      toast.error('Failed to create habit');
    },
  });

  const updateHabitMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Habit> & { id: string }) => {
      const { data, error } = await supabase
        .from('habits')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
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
    onSuccess: (updatedHabit) => {
      queryClient.setQueryData(['habits', user?.id], (oldHabits: Habit[] = []) => {
        return oldHabits.map(habit => 
          habit.id === updatedHabit.id ? updatedHabit : habit
        );
      });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      toast.success('Habit updated successfully');
    },
    onError: (error) => {
      console.error('Habit update failed:', error);
      toast.error('Failed to update habit');
    },
  });

  const deleteHabitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData(['habits', user?.id], (oldHabits: Habit[] = []) => {
        return oldHabits.filter(habit => habit.id !== deletedId);
      });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
      toast.success('Habit deleted successfully');
    },
    onError: (error) => {
      console.error('Habit deletion failed:', error);
      toast.error('Failed to delete habit');
    },
  });

  const logHabitMutation = useMutation({
    mutationFn: async ({ habitId, status, notes }: { habitId: string; status: 'completed' | 'skipped' | 'failed'; notes?: string }) => {
      if (!user) throw new Error('User not authenticated');
      
      const today = new Date().toISOString().split('T')[0];
      
      // Check if log already exists for today
      const { data: existingLog } = await supabase
        .from('logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('habit_id', habitId)
        .eq('date', today)
        .single();

      if (existingLog) {
        // Update existing log
        const { data, error } = await supabase
          .from('logs')
          .update({ status, notes })
          .eq('id', existingLog.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new log
        const { data, error } = await supabase
          .from('logs')
          .insert([{ 
            user_id: user.id,
            habit_id: habitId,
            date: today,
            status,
            notes 
          }])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
      toast.success('Habit logged successfully');
    },
    onError: (error) => {
      console.error('Habit logging failed:', error);
      toast.error('Failed to log habit');
    },
  });

  return {
    habits,
    logs,
    isLoading,
    createHabit: createHabitMutation.mutate,
    updateHabit: updateHabitMutation.mutate,
    deleteHabit: deleteHabitMutation.mutate,
    logHabit: logHabitMutation.mutate,
    isCreating: createHabitMutation.isPending,
    isUpdating: updateHabitMutation.isPending,
    isDeleting: deleteHabitMutation.isPending,
    isLogging: logHabitMutation.isPending,
  };
};
