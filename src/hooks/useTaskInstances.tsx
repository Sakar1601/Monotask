
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TaskInstance {
  id: string;
  task_id: string;
  instance_date: string;
  status: 'pending' | 'completed';
  completed_at?: string;
  created_at: string;
}

export const useTaskInstances = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ['task-instances', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('task_instances')
        .select('*')
        .order('instance_date', { ascending: false });

      if (error) throw error;
      return data as TaskInstance[];
    },
    enabled: !!user,
  });

  const updateInstanceMutation = useMutation({
    mutationFn: async (params: { id?: string; task_id: string; instance_date: string; status: 'pending' | 'completed'; completed_at?: string }) => {
      if (params.id) {
        // Update existing instance
        const { data, error } = await supabase
          .from('task_instances')
          .update({ status: params.status, completed_at: params.completed_at })
          .eq('id', params.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new instance
        const { data, error } = await supabase
          .from('task_instances')
          .insert([{ 
            task_id: params.task_id, 
            instance_date: params.instance_date, 
            status: params.status, 
            completed_at: params.completed_at 
          }])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-instances'] });
    },
  });

  return {
    instances,
    isLoading,
    updateInstance: updateInstanceMutation.mutate,
    isUpdating: updateInstanceMutation.isPending,
  };
};
