
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
  usage_count?: number;
}

export const useTags = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['tags', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      return data as Tag[];
    },
    enabled: !!user,
  });

  const { data: tagsWithUsage = [], isLoading: isLoadingUsage } = useQuery({
    queryKey: ['tags-with-usage', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Get tags with usage count from tasks and habits
      const { data: tagsData, error: tagsError } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (tagsError) throw tagsError;

      // Get usage counts
      const tagsWithUsage = await Promise.all(
        tagsData.map(async (tag) => {
          const [{ count: taskCount }, { count: habitCount }] = await Promise.all([
            supabase
              .from('tasks')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('tag_id', tag.id),
            supabase
              .from('habits')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('tag_id', tag.id)
          ]);

          return {
            ...tag,
            usage_count: (taskCount || 0) + (habitCount || 0)
          };
        })
      );

      return tagsWithUsage;
    },
    enabled: !!user,
  });

  const createTagMutation = useMutation({
    mutationFn: async (tagData: { name: string; color?: string }) => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('tags')
        .insert([{ 
          name: tagData.name.trim(), 
          color: tagData.color || '#6b7280',
          user_id: user.id 
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('A tag with this name already exists');
        }
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['tags-with-usage'] });
      toast.success(`Tag "${data.name}" created successfully`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      if (!user) throw new Error('User not authenticated');
      
      // First, unassign the tag from all tasks and habits
      await Promise.all([
        supabase
          .from('tasks')
          .update({ tag_id: null })
          .eq('user_id', user.id)
          .eq('tag_id', tagId),
        supabase
          .from('habits')
          .update({ tag_id: null })
          .eq('user_id', user.id)
          .eq('tag_id', tagId)
      ]);

      // Then delete the tag
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', tagId)
        .eq('user_id', user.id);

      if (error) throw error;
      return tagId;
    },
    onMutate: async (tagId: string) => {
      await queryClient.cancelQueries({ queryKey: ['tags', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['tags-with-usage', user?.id] });

      const previousTags = queryClient.getQueryData<Tag[]>(['tags', user?.id]);
      const previousTagsWithUsage = queryClient.getQueryData<Tag[]>(['tags-with-usage', user?.id]);

      queryClient.setQueryData<Tag[]>(['tags', user?.id], (old = []) => old.filter(tag => tag.id !== tagId));
      queryClient.setQueryData<Tag[]>(['tags-with-usage', user?.id], (old = []) => old.filter(tag => tag.id !== tagId));

      return { previousTags, previousTagsWithUsage };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['tags-with-usage'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      toast.success('Tag deleted successfully');
    },
    onError: (error: Error, _tagId, context) => {
      if (context?.previousTags) {
        queryClient.setQueryData(['tags', user?.id], context.previousTags);
      }
      if (context?.previousTagsWithUsage) {
        queryClient.setQueryData(['tags-with-usage', user?.id], context.previousTagsWithUsage);
      }
      toast.error('Failed to delete tag');
    },
  });

  return {
    tags,
    tagsWithUsage,
    isLoading: isLoading || isLoadingUsage,
    createTag: createTagMutation.mutate,
    createTagAsync: createTagMutation.mutateAsync,
    deleteTag: deleteTagMutation.mutate,
    isCreatingTag: createTagMutation.isPending,
    isDeletingTag: deleteTagMutation.isPending,
  };
};
