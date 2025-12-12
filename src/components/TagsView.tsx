
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Tag as TagIcon } from 'lucide-react';
import { useTags } from '@/hooks/useTags';

const TagsView: React.FC = () => {
  const { tagsWithUsage, createTag, deleteTag, isCreatingTag, isDeletingTag } = useTags();
  const [newTagName, setNewTagName] = useState('');

  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagName.trim()) {
      createTag({ name: newTagName.trim() });
      setNewTagName('');
    }
  };

  const handleDeleteTag = (tagId: string) => {
    deleteTag(tagId);
  };

  const grayscaleColors = [
    '#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db'
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black dark:text-white mb-2">Tags</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your tags to organize tasks and habits
        </p>
      </div>

      {/* Create New Tag */}
      <Card className="mb-6 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-black dark:text-white flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Tag
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateTag} className="flex gap-3">
            <Input
              placeholder="Enter tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="flex-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-black dark:text-white"
              maxLength={50}
            />
            <Button 
              type="submit" 
              disabled={!newTagName.trim() || isCreatingTag}
              className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
            >
              {isCreatingTag ? 'Creating...' : 'Create Tag'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Tags List */}
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-black dark:text-white flex items-center gap-2">
            <TagIcon className="h-5 w-5" />
            Your Tags ({tagsWithUsage.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tagsWithUsage.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <TagIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tags created yet</p>
              <p className="text-sm">Create your first tag to organize your tasks and habits</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tagsWithUsage.map((tag) => (
                <div 
                  key={tag.id} 
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: tag.color }}
                    />
                    <div>
                      <h3 className="font-medium text-black dark:text-white">{tag.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Used in {tag.usage_count || 0} item{(tag.usage_count || 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isDeletingTag}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 border-gray-300 dark:border-gray-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-black dark:text-white">
                          Delete Tag
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
                          Are you sure you want to delete "{tag.name}"? 
                          {(tag.usage_count || 0) > 0 && (
                            <span className="block mt-2 text-amber-600 dark:text-amber-400">
                              This tag is currently used in {tag.usage_count} item{tag.usage_count !== 1 ? 's' : ''} and will be removed from them.
                            </span>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-gray-300 dark:border-gray-700 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteTag(tag.id)}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          Delete Tag
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TagsView;
