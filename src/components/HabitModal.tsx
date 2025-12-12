
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHabits, Habit } from '@/hooks/useHabits';
import TagSelector from './TagSelector';

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  habit?: Habit | null;
}

const HabitModal: React.FC<HabitModalProps> = ({ isOpen, onClose, habit }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    frequency_days: [1, 2, 3, 4, 5, 6, 7] as number[],
    preferred_time: '',
    tag_id: '',
    is_active: true,
  });

  const { createHabit, updateHabit, isCreating, isUpdating } = useHabits();

  useEffect(() => {
    if (habit) {
      setFormData({
        name: habit.name,
        description: habit.description || '',
        frequency: habit.frequency,
        frequency_days: habit.frequency_days || [1, 2, 3, 4, 5, 6, 7],
        preferred_time: habit.preferred_time || '',
        tag_id: habit.tag_id || '',
        is_active: habit.is_active,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        frequency: 'daily',
        frequency_days: [1, 2, 3, 4, 5, 6, 7],
        preferred_time: '',
        tag_id: '',
        is_active: true,
      });
    }
  }, [habit, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const habitData = {
      ...formData,
      tag_id: formData.tag_id || undefined,
      preferred_time: formData.preferred_time || undefined,
    };

    if (habit) {
      updateHabit({ id: habit.id, ...habitData });
    } else {
      createHabit(habitData);
    }
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-black dark:text-white">
            {habit ? 'Edit Habit' : 'Create Habit'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              placeholder="Habit name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
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
          
          <div>
            <Select value={formData.frequency} onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setFormData(prev => ({ ...prev, frequency: value }))}>
              <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-black dark:text-white">
                <SelectValue placeholder="Frequency" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-black dark:text-white mb-2">
              Preferred Time (optional)
            </label>
            <Input
              type="time"
              value={formData.preferred_time}
              onChange={(e) => setFormData(prev => ({ ...prev, preferred_time: e.target.value }))}
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-black dark:text-white"
            />
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
          
          <div className="flex justify-end space-x-2 pt-4">
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
              {isCreating || isUpdating ? 'Saving...' : (habit ? 'Update' : 'Create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default HabitModal;
