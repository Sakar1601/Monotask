
import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { useTags } from '@/hooks/useTags';

interface TagSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const TagSelector: React.FC<TagSelectorProps> = ({ value, onChange }) => {
  const { tags, createTag, isCreatingTag } = useTags();
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const reduceMotion = useReducedMotion();

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      createTag({ name: newTagName.trim() });
      setNewTagName('');
      setShowCreateTag(false);
    }
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {showCreateTag ? (
        <motion.div
          key="create"
          initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap gap-2 sm:flex-nowrap"
        >
          <Input
            placeholder="Tag name"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateTag();
              if (e.key === 'Escape') setShowCreateTag(false);
            }}
            className="min-w-0 flex-1"
            autoFocus
            maxLength={50}
          />
          <div className="flex gap-2">
            <motion.div whileTap={reduceMotion ? undefined : { scale: 0.9 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
              <Button
                type="button"
                size="sm"
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || isCreatingTag}
                className="px-3"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
              </Button>
            </motion.div>
            <motion.div whileTap={reduceMotion ? undefined : { scale: 0.9 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowCreateTag(false)}
                className="px-3"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="select"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="space-y-2"
        >
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select tag" />
            </SelectTrigger>
            <SelectContent>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCreateTag(true)}
            className="w-full text-xs"
          >
            <Plus className="mr-1 h-3 w-3" strokeWidth={2} />
            Create new tag
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TagSelector;
