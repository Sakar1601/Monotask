
import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Tag as TagIcon } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import { cn } from '@/lib/utils';

const grayscaleColors = ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db'];

const TagsView: React.FC = () => {
  const { tagsWithUsage, createTag, deleteTag, isCreatingTag, isDeletingTag, isLoading } = useTags();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(grayscaleColors[2]);
  const reduceMotion = useReducedMotion();

  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagName.trim()) {
      createTag({ name: newTagName.trim(), color: newTagColor });
      setNewTagName('');
    }
  };

  const handleDeleteTag = (tagId: string) => {
    deleteTag(tagId);
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-8">
        {/* TopBar already renders "Tags" as the page h1. */}
        <p className="text-base font-medium text-foreground">
          Manage your tags to organize tasks and habits
        </p>
      </div>

      {/* Create New Tag */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Plus className="h-5 w-5" strokeWidth={2} />
            Create new tag
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateTag} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Enter tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="flex-1"
              maxLength={50}
            />
            <div className="flex items-center gap-2" role="radiogroup" aria-label="Tag color">
              {grayscaleColors.map((color) => (
                <motion.button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={newTagColor === color}
                  aria-label={`Color ${color}`}
                  onClick={() => setNewTagColor(color)}
                  whileTap={reduceMotion ? undefined : { scale: 0.9 }}
                  animate={{ scale: newTagColor === color ? 1.15 : 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={cn(
                    'h-6 w-6 rounded-full border-2',
                    newTagColor === color ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <Button
              type="submit"
              disabled={!newTagName.trim() || isCreatingTag}
            >
              {isCreatingTag ? 'Creating...' : 'Create tag'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Tags List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <TagIcon className="h-5 w-5" strokeWidth={2} />
            Your tags <span className="tabular-nums">({tagsWithUsage.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : tagsWithUsage.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <TagIcon className="h-6 w-6" strokeWidth={2} />
              </div>
              <p className="font-medium text-foreground">No tags created yet</p>
              <p className="text-sm">Create your first tag to organize your tasks and habits</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {tagsWithUsage.map((tag, index) => (
                  <motion.div
                    key={tag.id}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.97 }}
                    whileHover={reduceMotion ? undefined : { y: -2 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1], delay: reduceMotion ? 0 : Math.min(index, 8) * 0.06 }}
                    className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-accent/40"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <div>
                        <h3 className="font-medium text-foreground">{tag.name}</h3>
                        <p className="text-sm tabular-nums text-muted-foreground">
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
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-grotesk">
                            Delete tag
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{tag.name}"?
                            {(tag.usage_count || 0) > 0 && (
                              <span className="mt-2 block font-medium text-foreground">
                                This tag is currently used in {tag.usage_count} item{tag.usage_count !== 1 ? 's' : ''} and will be removed from them.
                              </span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteTag(tag.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete tag
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TagsView;
