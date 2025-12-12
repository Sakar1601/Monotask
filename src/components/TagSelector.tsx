
import React, { useState } from 'react';
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

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      createTag({ name: newTagName.trim() });
      setNewTagName('');
      setShowCreateTag(false);
    }
  };

  if (showCreateTag) {
    return (
      <div className="flex gap-2 flex-wrap sm:flex-nowrap">
        <Input
          placeholder="Tag name"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreateTag();
            if (e.key === 'Escape') setShowCreateTag(false);
          }}
          className="flex-1 min-w-0 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-black dark:text-white"
          autoFocus
          maxLength={50}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleCreateTag}
            disabled={!newTagName.trim() || isCreatingTag}
            className="px-3 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowCreateTag(false)}
            className="px-3 border-gray-300 dark:border-gray-700 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-black dark:text-white">
          <SelectValue placeholder="Select tag" />
        </SelectTrigger>
        <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          {tags.map((tag) => (
            <SelectItem key={tag.id} value={tag.id} className="text-black dark:text-white">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
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
        className="w-full text-xs border-gray-300 dark:border-gray-700 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <Plus className="h-3 w-3 mr-1" />
        Create New Tag
      </Button>
    </div>
  );
};

export default TagSelector;
