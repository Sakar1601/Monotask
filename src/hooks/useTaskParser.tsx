import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ParsedTaskDraft {
  title: string;
  description?: string;
  due_date?: string | null;
  due_time?: string | null;
  priority?: 'low' | 'medium' | 'high';
  tag_id?: string | null;
  repeat_type?: 'none' | 'daily' | 'weekly' | 'monthly';
}

export const useTaskParser = () => {
  const parseTaskMutation = useMutation({
    mutationFn: async (text: string) => {
      const { data, error } = await supabase.functions.invoke('parse-task', {
        body: { text },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data.task as ParsedTaskDraft;
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not parse that task with AI');
    },
  });

  return {
    parseTask: parseTaskMutation.mutateAsync,
    isParsing: parseTaskMutation.isPending,
  };
};
